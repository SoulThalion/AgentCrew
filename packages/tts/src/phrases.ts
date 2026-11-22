/**
 * Frases exactas de legacy `Frase-De` (alarma-agente.ps1).
 * El hash SHA256 debe coincidir con voces/frase-<hash>.mp3.
 */
const PHRASES: Record<string, string> = {
  fin: 'Señor, he terminado.',
  error: 'Señor, me temo que ha habido un error.',
  pregunta: 'Señor, tengo una pregunta para usted.',
  aprobacion: 'Señor, necesito su aprobación para ejecutar este comando.',
  busqueda: 'Señor, necesito su aprobación para buscar en internet.',
  plan: 'Señor, he terminado de implementar el plan.',
};

export function phraseFor(tipo: string): string {
  return PHRASES[tipo] ?? PHRASES.fin ?? 'Señor, he terminado.';
}

export function knownPhrases(): string[] {
  // Uso (umbrales) se exporta aparte vía knownUsagePhrases; precache installer puede unir ambos.
  return Object.values(PHRASES);
}
