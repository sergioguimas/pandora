import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addAgentsToConversation,
  listAgentsByConversation,
  removeAgentFromConversation,
  reorderConversationAgents,
} from "@/server/repositories/conversation-agents-repository";

async function requireConversationAccess(conversationId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: participant, error } = await supabase
    .from("conversation_participants")
    .select("role")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !participant) {
    throw new Error("Você não participa desta conversa.");
  }

  return {
    user,
    role: participant.role as "owner" | "member",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;

    await requireConversationAccess(conversationId);

    const agents = await listAgentsByConversation(conversationId);

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao listar agentes.",
      },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { agentIds } = await req.json();

    await requireConversationAccess(conversationId);

    if (!Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json(
        { error: "Informe pelo menos um agente." },
        { status: 400 }
      );
    }

    await addAgentsToConversation({
      conversationId,
      agentIds,
    });

    const agents = await listAgentsByConversation(conversationId);

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao adicionar agentes.",
      },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { orderedAgentIds } = await req.json();

    await requireConversationAccess(conversationId);

    if (!Array.isArray(orderedAgentIds) || orderedAgentIds.length === 0) {
      return NextResponse.json(
        { error: "Informe a ordem dos agentes." },
        { status: 400 }
      );
    }

    await reorderConversationAgents({
      conversationId,
      orderedAgentIds,
    });

    const agents = await listAgentsByConversation(conversationId);

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao reordenar agentes.",
      },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { agentId } = await req.json();

    await requireConversationAccess(conversationId);

    if (!agentId) {
      return NextResponse.json(
        { error: "Informe o agente a remover." },
        { status: 400 }
      );
    }

    await removeAgentFromConversation({
      conversationId,
      agentId,
    });

    const agents = await listAgentsByConversation(conversationId);

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao remover agente.",
      },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}