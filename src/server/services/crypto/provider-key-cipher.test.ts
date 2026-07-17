import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptProviderKey,
  encryptProviderKey,
  lastFour,
} from "./provider-key-cipher";

// Sem banco — cifra pura, roda no `npm test` normal.
const SECRET = "segredo-de-teste-longo-o-suficiente-1234567890";

describe("provider-key-cipher", () => {
  beforeEach(() => {
    process.env.PROVIDER_KEY_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.PROVIDER_KEY_SECRET;
  });

  it("decifra de volta ao original", () => {
    const chave = "AIzaSyD-exemplo-de-chave-do-gemini-4f2c";
    expect(decryptProviderKey(encryptProviderKey(chave))).toBe(chave);
  });

  it("a mesma chave cifra diferente a cada vez (iv e salt aleatórios)", () => {
    // Sem isso, cifras iguais denunciariam chaves iguais entre tenants.
    const chave = "sk-mesma-chave";
    expect(encryptProviderKey(chave)).not.toBe(encryptProviderKey(chave));
  });

  it("o texto cifrado não contém a chave em claro", () => {
    const chave = "AIzaSyD-super-secreta";
    expect(encryptProviderKey(chave)).not.toContain("super-secreta");
  });

  it("adulterar o texto cifrado faz a decifragem falhar (authTag do GCM)", () => {
    const cifrado = encryptProviderKey("chave-intacta");
    const partes = cifrado.split(".");
    partes[4] = partes[4].slice(0, -2) + (partes[4].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptProviderKey(partes.join("."))).toThrow();
  });

  it("um segredo diferente não decifra (sigilo real, não ofuscação)", () => {
    const cifrado = encryptProviderKey("chave-do-cliente");
    process.env.PROVIDER_KEY_SECRET = "outro-segredo-completamente-diferente-999";
    expect(() => decryptProviderKey(cifrado)).toThrow();
  });

  it("recusa cifrar sem PROVIDER_KEY_SECRET — não há default", () => {
    delete process.env.PROVIDER_KEY_SECRET;
    expect(() => encryptProviderKey("x")).toThrow(/PROVIDER_KEY_SECRET/);
  });

  it("recusa segredo curto demais", () => {
    process.env.PROVIDER_KEY_SECRET = "curto";
    expect(() => encryptProviderKey("x")).toThrow(/curto|mín/i);
  });

  it("lastFour pega os 4 últimos", () => {
    expect(lastFour("AIzaSyD-exemplo-4f2c")).toBe("4f2c");
  });
});
