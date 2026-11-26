/** Legacy PowerShell / bundle viejo (issue #6: doble TTS con alarma-agente). */
export function isLegacyHookCommand(cmd) {
  const c = String(cmd || '');
  return (
    c.includes('agentcrew-hook') ||
    /alarma-agente\.ps1/i.test(c) ||
    /Lanzar-Voz/i.test(c) ||
    /panel-agentes.*hooks/i.test(c)
  );
}
