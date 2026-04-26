import { redirect } from "next/navigation";
import { AgentsPage } from "@/components/agents/agents-page";
import { getAllAgents } from "@/server/repositories/agents-repository";
import { listUserConversationsByAgent } from "@/server/repositories/conversations-repository";
import { listKnowledgeDocumentsByAgent } from "@/server/repositories/knowledge-repository";
import { createClient } from "@/lib/supabase/server";

type AgentesPageRouteProps = {
  searchParams?: Promise<{
    slug?: string;
  }>;
};

export default async function AgentesPageRoute({
  searchParams,
}: AgentesPageRouteProps) {
  const params = await searchParams;
  const agents = await getAllAgents();
  

  if (agents.length === 0) {
    return (
      <AgentsPage
        agents={[]}
        selectedAgent={null}
        conversations={[]}
        knowledgeSpaces={[]}
        knowledgeDocuments={[]}
      />
    );
  }

  const selectedSlug = params?.slug ?? agents[0].slug;
  const selectedAgent =
    agents.find((agent) => agent.slug === selectedSlug) ?? agents[0];

  if (!params?.slug) {
    redirect(`/agentes?slug=${selectedAgent.slug}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: knowledgeSpaces } = await supabase
    .from("knowledge_spaces")
    .select("id, nome")
    .order("nome");

  const conversations =
    user && selectedAgent
      ? await listUserConversationsByAgent(user.id, selectedAgent.id)
      : [];

  const knowledgeDocuments = selectedAgent
    ? await listKnowledgeDocumentsByAgent(selectedAgent.id)
    : [];

  return (
    <AgentsPage
      agents={agents}
      selectedAgent={selectedAgent}
      conversations={conversations}
      knowledgeSpaces={knowledgeSpaces ?? []}
      knowledgeDocuments={knowledgeDocuments}
    />
  );
}