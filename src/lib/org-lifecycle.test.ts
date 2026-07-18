import { describe, expect, it } from "vitest";
import { diasRestantes, isOrgEffectivelyActive } from "./org-lifecycle";

const now = new Date("2026-07-17T12:00:00Z");
const emDias = (d: number) =>
  new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

describe("isOrgEffectivelyActive", () => {
  it("ativa e sem prazo → ativa", () => {
    expect(isOrgEffectivelyActive(true, null, now)).toBe(true);
  });

  it("ativa e dentro do prazo → ativa", () => {
    expect(isOrgEffectivelyActive(true, emDias(5), now)).toBe(true);
  });

  it("ativa mas com prazo vencido → INATIVA", () => {
    expect(isOrgEffectivelyActive(true, emDias(-1), now)).toBe(false);
  });

  it("desativada manualmente → inativa, mesmo dentro do prazo", () => {
    expect(isOrgEffectivelyActive(false, emDias(30), now)).toBe(false);
  });

  it("desativada e sem prazo → inativa", () => {
    expect(isOrgEffectivelyActive(false, null, now)).toBe(false);
  });
});

describe("diasRestantes", () => {
  it("sem prazo → null", () => {
    expect(diasRestantes(null, now)).toBeNull();
  });

  it("prazo no futuro → positivo", () => {
    expect(diasRestantes(emDias(10), now)).toBe(10);
  });

  it("prazo vencido → <= 0", () => {
    expect(diasRestantes(emDias(-3), now)).toBeLessThanOrEqual(0);
  });
});
