import { describe, expect, it } from "vitest";
import { isValidModel, modelsFor } from "./model-catalog";

describe("model-catalog", () => {
  it("lista modelos por provider", () => {
    expect(modelsFor("gemini").length).toBeGreaterThan(0);
    expect(modelsFor("openai").length).toBeGreaterThan(0);
  });

  it("provider desconhecido → lista vazia", () => {
    expect(modelsFor("cohere")).toEqual([]);
  });

  it("valida id de modelo por provider", () => {
    expect(isValidModel("gemini", "gemini-2.5-flash")).toBe(true);
    expect(isValidModel("openai", "gpt-4o")).toBe(true);
  });

  it("rejeita modelo de outro provider ou inexistente", () => {
    expect(isValidModel("gemini", "gpt-4o")).toBe(false);
    expect(isValidModel("openai", "gemini-2.5-flash")).toBe(false);
    expect(isValidModel("gemini", "inventado")).toBe(false);
  });
});
