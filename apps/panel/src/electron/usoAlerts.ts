/**
 * Avisos por voz al cruzar umbrales Inc/Otr (paridad Avisar-Umbral-Uso).
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeAtomic } from '@agentcrew/core';
import { decideUsoAlert, parseUsoPercent } from '@agentcrew/tts';
import { readUsoLabels } from './cursorUsage';

function avisosPath(stateDir: string): string {
  return path.join(stateDir, 'uso-avisos.txt');
}

export function readUsoAvisos(stateDir: string): { inc: number; otr: number } {
  try {
    const raw = fs.readFileSync(avisosPath(stateDir), 'utf8').trim();
    const parts = raw.split('|');
    const inc = Number.parseInt(parts[0] || '0', 10);
    const otr = Number.parseInt(parts[1] || '0', 10);
    return {
      inc: Number.isFinite(inc) ? inc : 0,
      otr: Number.isFinite(otr) ? otr : 0,
    };
  } catch {
    return { inc: 0, otr: 0 };
  }
}

export function writeUsoAvisos(
  stateDir: string,
  inc: number,
  otr: number,
): void {
  fs.mkdirSync(stateDir, { recursive: true });
  writeAtomic(avisosPath(stateDir), `${inc}|${otr}`, 'utf8');
}

export type AnnounceUsoOpts = {
  /** aviso===voz && !mudo (paridad legacy). */
  canSpeak: boolean;
  speak: (phrase: string) => void;
};

/** Lee uso.txt, decide umbral, habla y persiste uso-avisos.txt. */
export function announceUsoThresholds(
  stateDir: string,
  opts: AnnounceUsoOpts,
): void {
  const labels = readUsoLabels(stateDir);
  const inc = parseUsoPercent(labels.incluido);
  const otr = parseUsoPercent(labels.otros);
  const prev = readUsoAvisos(stateDir);
  const decision = decideUsoAlert(inc, otr, prev.inc, prev.otr, opts.canSpeak);
  if (decision.shouldSpeak && decision.phrase) {
    opts.speak(decision.phrase);
  }
  if (decision.changed) {
    writeUsoAvisos(stateDir, decision.nextInc, decision.nextOtr);
  }
}
