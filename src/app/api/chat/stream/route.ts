import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveMessage, sse } from "@/server/services/ai/runtime";
import { orchestrateConversation } from "@/server/services/ai/orchestrate-conversation";

export const runtime = "nodejs";

// Adaptador HTTP: autentica, persiste a mensagem do usuário e serializa como SSE
// os eventos emitidos pelo orquestrador. Toda a lógica de rodada vive em
// `server/services/ai/orchestrate-conversation.ts`.
//
// Contrato SSE: docs/FLUXO-DE-CHAT.md §5.
export async function POST(req: NextRequest) {
  const { conversationId, content } = await req.json();

  if (!conversationId || !content) {
    return new Response("Invalid payload", { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Fora do stream de propósito: se falhar, o cliente recebe um erro HTTP de
  // verdade em vez de um stream que abre e morre.
  const savedUserMessage = await saveMessage({
    conversationId,
    userId: user.id,
    role: "user",
    content,
    metadata: null,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let errored = false;

      try {
        for await (const event of orchestrateConversation({
          conversationId,
          content,
          savedUserMessage,
        })) {
          if (event.type === "error") {
            errored = true;
          }

          controller.enqueue(encoder.encode(sse(event)));
        }
      } catch (error) {
        // O orquestrador já trata os próprios erros; isto é rede de segurança.
        console.error(error);
        errored = true;

        controller.enqueue(
          encoder.encode(
            sse({
              type: "error",
              error:
                error instanceof Error ? error.message : "Erro ao gerar resposta.",
            })
          )
        );
      }

      // `[DONE]` só em rodada sem erro — o cliente encerra o streaming ao vê-lo.
      if (!errored) {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
