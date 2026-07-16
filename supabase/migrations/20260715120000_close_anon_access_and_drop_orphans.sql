-- ============================================================================
-- Hotfix de segurança + limpeza de resquícios de debug.
--
-- SEGURO APLICAR ISOLADO: não há mudança de código acoplada a esta migration.
-- Contexto: docs/DIVIDA-TECNICA.md → PD-17 (RLS aberta), PD-15/PD-18 (drift).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Fecha o acesso anônimo a agentes e arquivos de conhecimento
-- ----------------------------------------------------------------------------
-- O papel `anon` é o da chave pública (NEXT_PUBLIC_SUPABASE_ANON_KEY), que é
-- enviada ao browser. Com `USING (true)` para `anon`, qualquer pessoa com a URL
-- do projeto conseguia ler TODOS os agentes — incluindo `prompt_base`, ou seja,
-- toda a engenharia de prompt do produto — e a listagem de arquivos de
-- conhecimento.
--
-- Remoção é segura: nenhum fluxo do app lê agentes deslogado (o `/` redireciona
-- e o dashboard exige sessão). Usuários autenticados continuam cobertos por
-- `agents_select_authenticated` / `agent_knowledge_files_select_authenticated`.

drop policy if exists agents_select_anon_temp on public.agents;

drop policy if exists agent_knowledge_files_select_anon_temp
  on public.agent_knowledge_files;


-- ----------------------------------------------------------------------------
-- 2. Remove funções de busca órfãs (drift: existem no banco, em nenhuma migration)
-- ----------------------------------------------------------------------------
-- Nenhuma das duas é chamada pela aplicação. O `matchKnowledge` usa a assinatura
-- de 5 argumentos de `match_agent_knowledge`, que é preservada aqui e será
-- substituída pela versão canônica na migration de multi-tenant.

-- Quarta função de busca, sem chamador e sem filtro de `scope`.
drop function if exists public.match_knowledge_chunks(
  extensions.vector, double precision, integer, uuid, uuid, uuid
);

-- Overload antigo de `match_agent_knowledge` (4 args, sem conversation_id).
drop function if exists public.match_agent_knowledge(
  uuid, extensions.vector, double precision, integer
);


-- ----------------------------------------------------------------------------
-- Verificação (rode depois de aplicar)
-- ----------------------------------------------------------------------------
-- Deve retornar ZERO linhas:
--
--   select polname, polroles::regrole[]
--   from pg_policy
--   where polname like '%anon_temp%';
--
-- Deve retornar apenas a assinatura de 5 args (p_agent_id, p_conversation_id,
-- p_query_embedding, p_match_threshold, p_match_count) e a de 6 args:
--
--   select p.oid::regprocedure
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('match_agent_knowledge', 'match_knowledge_chunks');
