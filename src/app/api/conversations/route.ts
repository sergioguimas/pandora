import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationIdForUser } from "@/server/repositories/organization-members-repository";
import { addConversationParticipant } from "@/server/repositories/conversation-participants-repository";
import { addAgentsToConversation } from "@/server/repositories/conversation-agents-repository";

export async function POST(req: NextRequest) {
  try {
    const { title, agentIds } = await req.json();

    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um agente." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = await getOrganizationIdForUser(user.id);

    const primaryAgentId = agentIds[0];

    // 🔹 Buscar o agente principal (IMPORTANTE)
    const { data: primaryAgent, error: agentError } = await supabase
      .from("agents")
      .select("id, slug, nome")
      .eq("id", primaryAgentId)
      .single();

    if (agentError || !primaryAgent) {
      return NextResponse.json(
        { error: "Agente principal não encontrado." },
        { status: 404 }
      );
    }

    // 🔹 Criar conversa
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        agent_id: primaryAgentId,
        titulo: title?.trim() || `Nova conversa - ${primaryAgent.nome}`,
      })
      .select("*")
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Erro ao criar conversa." },
        { status: 500 }
      );
    }

    // 🔹 Criar participante
    await addConversationParticipant({
      conversationId: conversation.id,
      userId: user.id,
      role: "owner",
    });

    // 🔹 Vincular agentes
    await addAgentsToConversation({
      conversationId: conversation.id,
      agentIds,
    });

    // 🔹 RETORNO CORRETO (com slug)
    return NextResponse.json({
      conversation,
      primaryAgent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao criar conversa.",
      },
      { status: 500 }
    );
  }
}