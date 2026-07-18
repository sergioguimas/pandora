import { redirect } from "next/navigation";
import { AgentsPage } from "@/components/agents/agents-page";
import { getAllAgents } from "@/server/repositories/agents-repository";
import { listUserConversationsByAgent } from "@/server/repositories/conversations-repository";
import { listKnowledgeDocumentsByAgent } from "@/server/repositories/knowledge-repository";
import { getOrganizationIdForUserOrNull } from "@/server/repositories/organization-members-repository";
import { orgHasProviderKey } from "@/server/repositories/provider-keys-repository";
import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/provider-keys";

/** Providers que a org pode usar no picker (#4): Gemini sempre (chave da
 *  plataforma); OpenAI só se a org cadastrou a própria chave OpenAI. */
async function resolveAvailableProviders(userId: string | undefined): Promise<Provider[]> {
  if (!userId) return ["gemini"];
  const orgId = await getOrganizationIdForUserOrNull(userId);
  if (!orgId) return ["gemini"];
  const temOpenAi = await orgHasProviderKey(orgId, "openai");
  return temOpenAi ? ["gemini", "openai"] : ["gemini"];
}

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

  const availableProviders = await resolveAvailableProviders(user?.id);

  return (
    <AgentsPage
      agents={agents}
      selectedAgent={selectedAgent}
      conversations={conversations}
      knowledgeSpaces={knowledgeSpaces ?? []}
      knowledgeDocuments={knowledgeDocuments}
      availableProviders={availableProviders}
    />
  );
}