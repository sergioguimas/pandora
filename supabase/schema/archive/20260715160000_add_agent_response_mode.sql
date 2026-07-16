-- ============================================================================
-- PD-10 — Tamanho de resposta configurável por agente.
--
-- ⚠️ ACOPLADA A CÓDIGO: o app passa a ler `agents.modo_resposta`. Aplicar junto
--    com o deploy correspondente.
--
-- Antes, `maxOutputTokens` era uma constante global (2000) no runtime: agentes
-- que produzem tabelas longas (custos, planos) truncavam no meio, e a única
-- saída era editar código e fazer deploy.
--
-- Em vez de expor um número cru na UI, o tamanho vira um preset nomeado:
--
--   leve  →   800 tokens  — respostas diretas, menor custo/latência
--   medio →  2000 tokens  — DEFAULT, idêntico ao comportamento atual
--   alto  →  8000 tokens  — tabelas e comparativos longos
--
-- `medio` = 2000 de propósito: nada muda até alguém optar por outro modo.
-- O teto de 8000 fica abaixo do limite de saída do gemini-2.0-flash (8192),
-- que é o modelo de fallback da síntese.
-- ============================================================================

alter table public.agents
  add column if not exists modo_resposta text not null default 'medio';

alter table public.agents
  drop constraint if exists agents_modo_resposta_check;

alter table public.agents
  add constraint agents_modo_resposta_check
  check (modo_resposta in ('leve', 'medio', 'alto'));


-- ============================================================================
-- Verificação (rodar depois de aplicar)
-- ============================================================================
--
-- Todos devem sair como 'medio' (comportamento preservado):
--
--   select nome, modo_resposta from public.agents order by nome;
--
-- Deve falhar (constraint ativa):
--
--   update public.agents set modo_resposta = 'gigante' where false;
