-- ============================================================================
-- PD-09 — Fecha o Storage e alinha as tabelas de arquivo ao modelo vigente.
--
-- SEGURO APLICAR ISOLADO: não há mudança de código acoplada.
--
-- Contexto: a funcionalidade de arquivos NUNCA foi construída. Verificado em
-- 2026-07-15:
--   - nenhuma referência a `.storage` / `storage_path` no código;
--   - `message_attachments` e `agent_knowledge_files`: 0 linhas;
--   - `storage.objects`: 0 objetos.
-- Os buckets e policies são andaime da migration inicial. Como estavam, eram
-- superfície de abuso para nada: qualquer autenticado podia subir arquivo de
-- qualquer tamanho/tipo e ler qualquer objeto sabendo o path.
--
-- Estratégia: FAIL-CLOSED. Sem policy = sem acesso. Quando o upload for
-- construído, escreva as policies junto, seguindo a convenção documentada em
-- docs/BANCO-DE-DADOS.md.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Storage: remove o acesso blanket de `authenticated`
-- ---------------------------------------------------------------------------
-- As 6 policies só checavam `bucket_id`, sem nenhum vínculo com conversa ou
-- organização. Nada quebra ao removê-las: não há código nem objetos.

drop policy if exists authenticated_can_select_attachments     on storage.objects;
drop policy if exists authenticated_can_select_agent_knowledge on storage.objects;
drop policy if exists authenticated_can_upload_attachments     on storage.objects;
drop policy if exists authenticated_can_upload_agent_knowledge on storage.objects;
drop policy if exists authenticated_can_delete_attachments     on storage.objects;
drop policy if exists authenticated_can_delete_agent_knowledge on storage.objects;


-- ---------------------------------------------------------------------------
-- 2. Storage: rede de segurança nos buckets
-- ---------------------------------------------------------------------------
-- Ambos estavam com file_size_limit = NULL (sem teto). Enquanto as policies
-- acima estiverem removidas isso é inócuo, mas deixa o limite pronto para o dia
-- em que alguém reabrir o upload — evita que a ausência de teto passe batida.
-- Ajuste o valor quando o recurso for definido de fato.

update storage.buckets
set file_size_limit = 26214400  -- 25 MB
where id in ('message-attachments', 'agent-knowledge')
  and file_size_limit is null;


-- ---------------------------------------------------------------------------
-- 3. agent_knowledge_files: escopo por organização
-- ---------------------------------------------------------------------------
-- Tinha `USING (true)` — mesma classe do PD-17. A tabela está vazia, então não
-- houve vazamento, mas a policy aberta não pode ficar.
-- Os arquivos pertencem a um agente, então herdam a org dele.

drop policy if exists agent_knowledge_files_select_authenticated
  on public.agent_knowledge_files;

create policy agent_knowledge_files_select_org
  on public.agent_knowledge_files
  for select to authenticated
  using (
    exists (
      select 1
      from public.agents a
      where a.id = agent_knowledge_files.agent_id
        and public.can_read_org(a.organization_id, auth.uid())
    )
  );

-- Escrita permanece sem policy (fail-closed) até o upload existir.


-- ---------------------------------------------------------------------------
-- 4. message_attachments: alinhar ao modelo de participantes
-- ---------------------------------------------------------------------------
-- As policies eram da Era 1 (dono da conversa via `conversations.user_id`) —
-- o mesmo resquício que causou o bug do PD-05 no retry. Um participante
-- convidado não enxergaria os anexos da conversa que ele participa.
-- Alinhado agora para não repetir a inconsistência quando o recurso nascer.

drop policy if exists message_attachments_select_from_own_conversations
  on public.message_attachments;
drop policy if exists message_attachments_insert_into_own_conversations
  on public.message_attachments;

create policy message_attachments_select
  on public.message_attachments
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_attachments.message_id
        and public.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

create policy message_attachments_insert
  on public.message_attachments
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.messages m
      where m.id = message_attachments.message_id
        and public.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );


-- ============================================================================
-- Verificação (rodar depois de aplicar)
-- ============================================================================
--
-- 1) Storage sem nenhuma policy (esperado: 0 linhas):
--    select policyname, cmd, roles::text from pg_policies
--    where schemaname = 'storage';
--
-- 2) Buckets com teto de tamanho:
--    select id, public, file_size_limit from storage.buckets;
--
-- 3) Nenhuma policy aberta sobrando em todo o schema public
--    (esperado: 0 linhas — este era o último `USING (true)`):
--    select tablename, policyname from pg_policies
--    where schemaname = 'public' and qual = 'true';
