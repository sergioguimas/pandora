// O cenário que os testes de RLS observam.
//
// Semeado como `postgres` (dono das tabelas), que a RLS não filtra — é assim que
// se monta o mundo que depois é olhado pelos olhos de `authenticated`/`anon`.
//
// Duas organizações independentes (A e B), a org do sistema (agentes universais)
// e uma conversa com dono e participante. É o mínimo para provar isolamento por
// org e acesso por participante sem cenário artificial.

import type { Client } from "pg";

export const IDS = {
  // Org do sistema: dona dos agentes universais (Agente 0, Oráculo). PD-06b.
  // Confirmado em produção (2026-07-17): `Pandora System`, is_system = true.
  orgSystem: "00000000-0000-0000-0000-000000000000",
  // Ex-"Base Geral". Até o PD-25 ela era o destino de TODO usuário novo, por
  // trigger — o que fazia de qualquer cadastro um colega de organização do dono
  // do produto. O trigger morreu na migration `20260717010000`; ela continua
  // aqui só como org comum, para provar que ninguém mais cai nela sozinho.
  orgDefault: "11111111-1111-1111-1111-111111111111",

  orgA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  orgB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",

  alice: "a1111111-1111-4111-8111-111111111111", // org A, dona da conversa
  bob: "b2222222-2222-4222-8222-222222222222",   // org A, PARTICIPANTE (não dono)
  carol: "c3333333-3333-4333-8333-333333333333", // org A, fora da conversa
  dan: "d4444444-4444-4444-8444-444444444444",   // org B, estranho a tudo de A

  agentA: "0a000000-0000-4000-8000-00000000000a",
  agentB: "0b000000-0000-4000-8000-00000000000b",
  agentUniversal: "0c000000-0000-4000-8000-00000000000c", // org do sistema

  convA: "c0000000-0000-4000-8000-000000000001", // dona: alice; participante: bob
  msgA: "50000000-0000-4000-8000-000000000001",

  spaceA: "5a000000-0000-4000-8000-00000000000a",
  spaceB: "5b000000-0000-4000-8000-00000000000b",
  docA: "d0000000-0000-4000-8000-00000000000a",
  docB: "d0000000-0000-4000-8000-00000000000b",
  chunkA: "c1000000-0000-4000-8000-00000000000a",
  chunkB: "c1000000-0000-4000-8000-00000000000b",
} as const;

const agent = (id: string, slug: string, nome: string, orgId: string) => ({ id, slug, nome, orgId });

export async function seedFixtures(client: Client): Promise<void> {
  // 1. Organizações — antes dos usuários, por causa do trigger de org padrão.
  await client.query(
    `insert into public.organizations (id, name, is_system) values
       ($1, 'Sistema',      true),
       ($2, 'Base Geral',   false),
       ($3, 'Organização A', false),
       ($4, 'Organização B', false)`,
    [IDS.orgSystem, IDS.orgDefault, IDS.orgA, IDS.orgB]
  );

  // 2. Usuários. Inserir em auth.users dispara `handle_new_user`, que cria o
  //    `profiles`. E SÓ isso, desde o PD-25: o trigger que adicionava todo mundo
  //    à org padrão foi removido. Um usuário nasce sem organização, e só entra
  //    numa por convite — ver `provisionamento.test.ts`.
  for (const [id, nome] of [
    [IDS.alice, "Alice"], [IDS.bob, "Bob"], [IDS.carol, "Carol"], [IDS.dan, "Dan"],
  ] as const) {
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, jsonb_build_object('name', $3::text))`,
      [id, `${nome.toLowerCase()}@teste.local`, nome]
    );
  }

  // 3. Vínculos de organização (além da org padrão, que o trigger já criou).
  await client.query(
    `insert into public.organization_members (organization_id, user_id, role) values
       ($1, $2, 'owner'), ($1, $3, 'member'), ($1, $4, 'member'),
       ($5, $6, 'owner')`,
    [IDS.orgA, IDS.alice, IDS.bob, IDS.carol, IDS.orgB, IDS.dan]
  );

  // 4. Espaços de conhecimento, um por org.
  await client.query(
    `insert into public.knowledge_spaces (id, nome, organization_id, is_default) values
       ($1, 'Base A', $2, true), ($3, 'Base B', $4, true)`,
    [IDS.spaceA, IDS.orgA, IDS.spaceB, IDS.orgB]
  );

  // 5. Agentes: um por org, mais um universal na org do sistema.
  for (const a of [
    agent(IDS.agentA, "agente-a", "Agente A", IDS.orgA),
    agent(IDS.agentB, "agente-b", "Agente B", IDS.orgB),
    agent(IDS.agentUniversal, "agente-0", "Agente 0", IDS.orgSystem),
  ]) {
    await client.query(
      `insert into public.agents (id, slug, nome, prompt_base, organization_id)
       values ($1, $2, $3, $4, $5)`,
      [a.id, a.slug, a.nome, `prompt secreto de ${a.nome}`, a.orgId]
    );
  }

  // 6. Conversa de Alice, com Bob como participante. É o cenário do PD-05: quem
  //    conversa é participante, não necessariamente dono.
  await client.query(
    `insert into public.conversations (id, user_id, agent_id, titulo, organization_id)
     values ($1, $2, $3, 'Conversa da Alice', $4)`,
    [IDS.convA, IDS.alice, IDS.agentA, IDS.orgA]
  );
  await client.query(
    `insert into public.conversation_participants (conversation_id, user_id, role) values
       ($1, $2, 'owner'), ($1, $3, 'member')`,
    [IDS.convA, IDS.alice, IDS.bob]
  );
  await client.query(
    `insert into public.messages (id, conversation_id, role, content, user_id)
     values ($1, $2, 'user', 'mensagem privada da conversa da Alice', $3)`,
    [IDS.msgA, IDS.convA, IDS.alice]
  );

  // 7. Chave de provider da org A (PD-26). Semeada AQUI, e não dentro do teste:
  //    cada teste roda numa transação que faz rollback, então semear lá dentro
  //    desfaz a linha antes da asserção — e os testes que afirmam "ninguém lê a
  //    chave" passariam no vazio, sem chave nenhuma para ler.
  await client.query(
    `insert into public.organization_provider_keys
       (organization_id, provider, chave_cifrada, ultimos_4, criado_por)
     values ($1, 'gemini', 'cifra-de-mentira-so-para-o-teste', '4f2c', $2)`,
    [IDS.orgA, IDS.alice]
  );

  // 8. Conhecimento por org (scope 'global' = da organização, sem conversa).
  for (const [docId, chunkId, agentId, spaceId, orgId, texto] of [
    [IDS.docA, IDS.chunkA, IDS.agentA, IDS.spaceA, IDS.orgA, "segredo da org A"],
    [IDS.docB, IDS.chunkB, IDS.agentB, IDS.spaceB, IDS.orgB, "segredo da org B"],
  ] as const) {
    await client.query(
      `insert into public.knowledge_documents
         (id, agent_id, titulo, scope, knowledge_space_id, organization_id)
       values ($1, $2, $3, 'global', $4, $5)`,
      [docId, agentId, texto, spaceId, orgId]
    );
    await client.query(
      `insert into public.knowledge_chunks
         (id, document_id, agent_id, chunk_index, content, scope, knowledge_space_id, organization_id)
       values ($1, $2, $3, 0, $4, 'global', $5, $6)`,
      [chunkId, docId, agentId, texto, spaceId, orgId]
    );
  }
}
