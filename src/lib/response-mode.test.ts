import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESPONSE_MODE,
  isResponseMode,
  maxOutputTokensFor,
  RESPONSE_MODE_MAX_TOKENS,
} from "@/lib/response-mode";

describe("maxOutputTokensFor", () => {
  it("resolve cada preset", () => {
    expect(maxOutputTokensFor("leve")).toBe(800);
    expect(maxOutputTokensFor("medio")).toBe(2000);
    expect(maxOutputTokensFor("alto")).toBe(8000);
  });

  it("cai no padrão para ausente, nulo ou desconhecido", () => {
    const padrao = RESPONSE_MODE_MAX_TOKENS[DEFAULT_RESPONSE_MODE];

    expect(maxOutputTokensFor(undefined)).toBe(padrao);
    expect(maxOutputTokensFor(null)).toBe(padrao);
    expect(maxOutputTokensFor("gigante")).toBe(padrao);
    expect(maxOutputTokensFor("")).toBe(padrao);
  });

  it("o padrão preserva o teto global anterior (2000)", () => {
    // Se isto quebrar, agentes existentes mudaram de comportamento sem opt-in.
    expect(maxOutputTokensFor(DEFAULT_RESPONSE_MODE)).toBe(2000);
  });

  it("'alto' cabe no limite do gemini-2.0-flash (8192), usado na síntese", () => {
    expect(RESPONSE_MODE_MAX_TOKENS.alto).toBeLessThanOrEqual(8192);
  });
});

describe("isResponseMode", () => {
  it("aceita só os presets conhecidos", () => {
    expect(isResponseMode("leve")).toBe(true);
    expect(isResponseMode("medio")).toBe(true);
    expect(isResponseMode("alto")).toBe(true);

    expect(isResponseMode("LEVE")).toBe(false);
    expect(isResponseMode("gigante")).toBe(false);
    expect(isResponseMode(null)).toBe(false);
    expect(isResponseMode(2000)).toBe(false);
  });
});
