// Regera os embeddings de TODOS os chunks da base de conhecimento.
//
// POR QUE ISSO EXISTE (PD-11)
// Os chunks embeddados antes do PD-11 saíram sem `taskType`. A doc do Gemini é
// explícita: "mismatching these produces incomparable embeddings" — e o default
// quando o campo é omitido não é documentado. Como as queries agora usam
// RETRIEVAL_QUERY, os chunks antigos ficaram num espaço vetorial diferente e
// deixaram de ser comparáveis. Sem rodar isto, o PD-11 PIORA o recall.
//
// Rode uma vez, depois de aplicar o PD-11:
//   npm run reembed:knowledge
//
// É idempotente: rodar de novo só regera os mesmos vetores.

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !GEMINI_API_KEY) {
  console.error(
    "Faltam variáveis de ambiente. Rode com:\n" +
      "  node --env-file=.env.local scripts/reembed-knowledge.mjs\n" +
      "Necessárias: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY"
  );
  process.exit(1);
}

// service_role de propósito: é manutenção, precisa enxergar todas as organizações.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function embedDocument(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    },
  });

  const values = response?.embeddings?.[0]?.values;

  if (!values?.length) {
    throw new Error("Embedding vazio retornado pelo Gemini.");
  }

  return values;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data: chunks, error } = await supabase
    .from("knowledge_chunks")
    .select("id, content")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao ler os chunks:", error.message);
    process.exit(1);
  }

  if (!chunks?.length) {
    console.log("Nenhum chunk na base. Nada a fazer.");
    return;
  }

  console.log(`Regerando embeddings de ${chunks.length} chunk(s) com RETRIEVAL_DOCUMENT…\n`);

  let ok = 0;
  const falhas = [];

  for (const [i, chunk] of chunks.entries()) {
    const posicao = `[${i + 1}/${chunks.length}]`;

    try {
      const embedding = await embedDocument(chunk.content);

      const { error: updateError } = await supabase
        .from("knowledge_chunks")
        .update({ embedding })
        .eq("id", chunk.id);

      if (updateError) throw new Error(updateError.message);

      ok += 1;
      console.log(`${posicao} ok    ${chunk.id}`);
    } catch (err) {
      falhas.push({ id: chunk.id, motivo: err.message });
      console.error(`${posicao} FALHA ${chunk.id}: ${err.message}`);
    }

    // Respiro entre chamadas para não bater no rate limit.
    await sleep(120);
  }

  console.log(`\nRegerados: ${ok}/${chunks.length}`);

  if (falhas.length) {
    console.error("\nChunks que falharam (rode de novo para tentar outra vez):");
    falhas.forEach((f) => console.error(`  ${f.id}: ${f.motivo}`));
    process.exit(1);
  }

  console.log("Concluído. Query e documento voltam a compartilhar o mesmo espaço vetorial.");
}

main().catch((err) => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
