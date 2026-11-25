import { stdin as input } from 'node:process';

export async function readStdin(): Promise<string> {
  if (input.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function field(raw: string, name: string): string {
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const v = obj[name];
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  } catch {
    /* fallback regex for partial JSON */
  }
  const re = new RegExp(`"${name}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const m = raw.match(re);
  if (m?.[1]) {
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return '';
}

export function conversationId(raw: string): string {
  return field(raw, 'conversation_id') || field(raw, 'session_id');
}

export function asksSmartApproval(raw: string): boolean {
  if (!raw) return false;
  return (
    /request_smart_mode_approval"\s*:\s*true/.test(raw) ||
    /requestSmartModeApproval"\s*:\s*true/.test(raw) ||
    /"smart_mode_block_reason"\s*:/.test(raw) ||
    /"smartModeBlockReason"\s*:/.test(raw)
  );
}

export function lastSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const parts = t.split(/(?<=[.!?¿¡…])\s+/);
  return (parts[parts.length - 1] ?? t).trim().slice(0, 280);
}

/** `?` de código, URL o query (`/settings?drive=connected`) no es pregunta al usuario. */
function stripNonQuestions(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\?[A-Za-z0-9_=&%+./-]+/g, ' ');
}

export function looksLikeQuestion(text: string): boolean {
  const sentence = stripNonQuestions(lastSentence(text)).trim();
  if (!sentence) return false;
  if (sentence.includes('?') || sentence.includes('¿')) return true;
  return /^(debería|quieres|confirmas|puedo|ok para)\b/i.test(sentence);
}
