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

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("conversation_participants")
      .select(`
        role,
        conversations (
          id,
          titulo,
          agent_id,
          updated_at,
          agents (
            id,
            slug,
            nome
          ),
          conversation_agents (
            ordem,
            agents (
              id,
              slug,
              nome
            )
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Erro ao listar conversas." },
        { status: 500 }
      );
    }

    const conversations = (data ?? [])
      .map((row: any) => {
        const conversation = Array.isArray(row.conversations)
          ? row.conversations[0]
          : row.conversations;

        if (!conversation) return null;

        const primaryAgent = Array.isArray(conversation.agents)
          ? conversation.agents[0]
          : conversation.agents;

        const conversationAgents = (conversation.conversation_agents ?? [])
          .map((item: any) => {
            const agent = Array.isArray(item.agents)
              ? item.agents[0]
              : item.agents;

            return agent
              ? {
                  id: agent.id,
                  slug: agent.slug,
                  nome: agent.nome,
                  ordem: item.ordem ?? 0,
                }
              : null;
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.ordem - b.ordem);

        return {
          id: conversation.id,
          titulo: conversation.titulo,
          updated_at: conversation.updated_at,
          primaryAgent,
          agents: conversationAgents,
          href: `/chat/${primaryAgent.slug}?conversation=${conversation.id}`,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao listar conversas.",
      },
      { status: 500 }
    );
  }
}