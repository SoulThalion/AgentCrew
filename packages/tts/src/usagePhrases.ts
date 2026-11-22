/** Paridad Frase-Uso / Umbral-Uso (panel-agentes.ps1). */

export const USO_MARKS = [50, 65, 80, 90, 95, 100] as const;

export function usageThreshold(pct: number): number {
  let best = 0;
  for (const marca of USO_MARKS) {
    if (pct >= marca) best = marca;
  }
  return best;
}

export function textoPorcentajeUso(n: number): string {
  switch (n) {
    case 50:
      return 'cincuenta';
    case 65:
      return 'sesenta y cinco';
    case 80:
      return 'ochenta';
    case 90:
      return 'noventa';
    case 95:
      return 'noventa y cinco';
    case 100:
      return 'cien';
    default:
      return String(n);
  }
}

export function phraseForUso(
  subeInc: boolean,
  uInc: number,
  subeOtr: boolean,
  uOtr: number,
): string {
  if ((uInc === 100) && (uOtr === 100) && (subeInc || subeOtr)) {
    return 'Señor, ha alcanzado el cien por ciento del consumo incluido y del consumo de otros modelos. A partir de ahora se usará solo el modelo de Composer y el servicio será más lento.';
  }
  if (subeInc && subeOtr) {
    let frase =
      'Señor, ha alcanzado el ' +
      textoPorcentajeUso(uInc) +
      ' por ciento del consumo incluido y el ' +
      textoPorcentajeUso(uOtr) +
      ' por ciento del consumo de otros modelos.';
    if (uOtr === 100) frase += ' Se continúa solo con los incluidos.';
    return frase;
  }
  if (subeOtr && uOtr === 100) {
    return 'Señor, ha alcanzado el cien por ciento del consumo de otros modelos. Se continúa solo con los incluidos.';
  }
  if (subeInc) {
    return (
      'Señor, ha alcanzado el ' +
      textoPorcentajeUso(uInc) +
      ' por ciento del consumo incluido.'
    );
  }
  if (subeOtr) {
    return (
      'Señor, ha alcanzado el ' +
      textoPorcentajeUso(uOtr) +
      ' por ciento del consumo de otros modelos.'
    );
  }
  return '';
}

export function knownUsagePhrases(): string[] {
  const out = new Set<string>();
  for (const inc of USO_MARKS) {
    out.add(phraseForUso(true, inc, false, 0));
  }
  for (const otr of USO_MARKS) {
    out.add(phraseForUso(false, 0, true, otr));
  }
  for (const inc of USO_MARKS) {
    for (const otr of USO_MARKS) {
      out.add(phraseForUso(true, inc, true, otr));
    }
  }
  return [...out].filter((f) => f.length > 0);
}

export function parseUsoPercent(texto: string): number {
  const m = String(texto || '').match(/(\d+)\s*%/);
  if (!m?.[1]) return -1;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : -1;
}

export type UsoAlertDecision = {
  phrase: string;
  nextInc: number;
  nextOtr: number;
  shouldSpeak: boolean;
  changed: boolean;
};

/** Paridad Avisar-Umbral-Uso: solo habla al subir marca; baja ciclo sin voz. */
export function decideUsoAlert(
  inc: number,
  otr: number,
  prevInc: number,
  prevOtr: number,
  canSpeak: boolean,
): UsoAlertDecision {
  let nuevoInc = prevInc;
  let nuevoOtr = prevOtr;
  if (inc >= 0) nuevoInc = usageThreshold(inc);
  if (otr >= 0) nuevoOtr = usageThreshold(otr);

  let nextInc = prevInc;
  let nextOtr = prevOtr;
  if (nuevoInc < prevInc) nextInc = nuevoInc;
  if (nuevoOtr < prevOtr) nextOtr = nuevoOtr;

  const subeInc = nuevoInc > prevInc;
  const subeOtr = nuevoOtr > prevOtr;
  let phrase = '';
  let shouldSpeak = false;
  if (canSpeak && (subeInc || subeOtr)) {
    nextInc = nuevoInc;
    nextOtr = nuevoOtr;
    phrase = phraseForUso(subeInc, nuevoInc, subeOtr, nuevoOtr);
    shouldSpeak = phrase.length > 0;
  }

  return {
    phrase,
    nextInc,
    nextOtr,
    shouldSpeak,
    changed: nextInc !== prevInc || nextOtr !== prevOtr,
  };
}
