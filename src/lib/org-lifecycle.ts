// Lógica PURA do ciclo de vida da organização (PD-27). Sem banco — testável
// direto no `npm test`, e reusada pelo enforcement e pelo painel de admin.

/** Ativa de fato = ligada manualmente E dentro do prazo. `activeUntil` nulo =
 *  sem prazo (sempre dentro). */
export function isOrgEffectivelyActive(
  isActive: boolean,
  activeUntil: string | null,
  now: Date = new Date()
): boolean {
  if (!isActive) return false;
  if (activeUntil === null) return true;
  return new Date(activeUntil) > now;
}

/** Dias inteiros até expirar. `null` = sem prazo; `<= 0` = já expirada. */
export function diasRestantes(
  activeUntil: string | null,
  now: Date = new Date()
): number | null {
  if (activeUntil === null) return null;
  const ms = new Date(activeUntil).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
