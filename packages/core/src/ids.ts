/** Igual que Id-Seguro del legacy PowerShell. */
export function safeId(id: string | null | undefined): string {
  if (!id || !id.trim()) return 'sin-id';
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}
