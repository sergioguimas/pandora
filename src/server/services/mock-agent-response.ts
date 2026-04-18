type MockResponseInput = {
  agentName: string;
  agentSlug: string;
  userMessage: string;
};

export function generateMockAgentResponse({
  agentName,
  agentSlug,
  userMessage,
}: MockResponseInput): string {
  const normalized = userMessage.trim();

  if (!normalized) {
    return `Olá, eu sou o ${agentName}. Como posso te ajudar?`;
  }

  if (agentSlug === "assistente-geral") {
    return [
      `Recebi sua mensagem: "${normalized}".`,
      `Estou atuando como ${agentName} e, na próxima etapa, minhas respostas virão de uma IA real.`,
      `Por enquanto, já consigo registrar a conversa corretamente na Pandora.`,
    ].join(" ");
  }

  if (agentSlug === "consultor-comercial") {
    return [
      `Entendi o cenário: "${normalized}".`,
      `Como consultor comercial, eu começaria organizando o contexto, a dor do cliente e a melhor forma de conduzir a abordagem.`,
      `Na próxima fase, vou te devolver sugestões mais estratégicas e contextualizadas.`,
    ].join(" ");
  }

  if (agentSlug === "analista-documental") {
    return [
      `Mensagem recebida: "${normalized}".`,
      `Como analista documental, eu vou te ajudar a interpretar conteúdos, organizar informações e extrair pontos importantes.`,
      `Por enquanto, esta é uma resposta simulada para validar o fluxo do sistema.`,
    ].join(" ");
  }

  return `Recebi sua mensagem: "${normalized}". Esta é uma resposta simulada do agente ${agentName}.`;
}