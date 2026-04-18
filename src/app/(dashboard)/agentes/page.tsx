import { redirect } from "next/navigation";
import { AgentsPage } from "@/components/agents/agents-page";
import { getAllAgents } from "@/server/repositories/agents-repository";

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
    return <AgentsPage agents={[]} selectedAgent={null} />;
  }

  const selectedSlug = params?.slug ?? agents[0].slug;
  const selectedAgent =
    agents.find((agent) => agent.slug === selectedSlug) ?? agents[0];

  if (!params?.slug) {
    redirect(`/agentes?slug=${selectedAgent.slug}`);
  }

  return <AgentsPage agents={agents} selectedAgent={selectedAgent} />;
}