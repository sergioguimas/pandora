"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ingestAgentKnowledge } from "@/server/services/ai/ingest-agent-knowledge";
import { deleteKnowledgeDocument } from "@/server/repositories/knowledge-repository";

export type IngestKnowledgeState = {
  success: boolean;
  error: string | null;
};

export async function ingestKnowledgeAction(
  _prevState: IngestKnowledgeState,
  formData: FormData
): Promise<IngestKnowledgeState> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Usuário não autenticado.",
      };
    }

    const agentId = String(formData.get("agentId") ?? "").trim();
    const titulo = String(formData.get("titulo") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const scope = String(formData.get("scope") ?? "").trim() as
      | "global"
      | "conversation";
    const conversationIdRaw = String(formData.get("conversationId") ?? "").trim();

    if (!agentId) {
      return { success: false, error: "AgentId não informado." };
    }

    if (!titulo) {
      return { success: false, error: "Informe um título para o conhecimento." };
    }

    if (!content) {
      return { success: false, error: "Informe o conteúdo do conhecimento." };
    }

    if (scope !== "global" && scope !== "conversation") {
      return { success: false, error: "Escopo inválido." };
    }

    if (scope === "conversation" && !conversationIdRaw) {
      return {
        success: false,
        error: "Selecione uma conversa para conhecimento específico.",
      };
    }

    await ingestAgentKnowledge({
      agentId,
      scope,
      conversationId: scope === "conversation" ? conversationIdRaw : null,
      titulo,
      content,
      fonte: "manual",
      mimeType: "text/plain",
    });

    revalidatePath("/agentes");
    revalidatePath("/chat");

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao ingerir conhecimento.",
    };
  }
}

export async function deleteKnowledgeAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const documentId = String(formData.get("documentId") ?? "").trim();

  if (!documentId) {
    throw new Error("Documento não informado.");
  }

  await deleteKnowledgeDocument(documentId);

  revalidatePath("/agentes");
  revalidatePath("/chat");
}