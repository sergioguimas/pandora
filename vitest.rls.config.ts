import { defineConfig } from "vitest/config";

// Suíte de RLS (PD-04b) — SEPARADA do `npm test` de propósito.
//
// O `npm test` roda em ~4s sem Docker, sem banco e sem rede: é o loop de
// desenvolvimento e precisa continuar assim. Esta suíte sobe um Postgres, então
// vive em `npm run test:rls` e num job próprio de CI.
//
// Rode com: npm run test:rls
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    globalSetup: ["tests/rls/setup/global-setup.ts"],
    // Um banco só, e os testes escrevem nele (em transações que desfazem).
    // Sequencial evita que um `set local role` de um arquivo apareça noutro.
    fileParallelism: false,
    // Subir container + aplicar o schema real leva mais que o default de 5s.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
