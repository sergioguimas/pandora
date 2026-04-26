create or replace function public.match_agent_knowledge(
  p_agent_id uuid,
  p_conversation_id uuid,
  p_knowledge_space_id uuid,
  p_query_embedding vector(768),
  p_match_threshold float default 0.5,
  p_match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  agent_id uuid,
  conversation_id uuid,
  knowledge_space_id uuid,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.agent_id,
    kc.conversation_id,
    kc.knowledge_space_id,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks kc
  where
    (
      kc.scope = 'global'
      and kc.agent_id = p_agent_id
    )
    or
    (
      kc.scope = 'conversation'
      and kc.conversation_id = p_conversation_id
    )
    or
    (
      p_knowledge_space_id is not null
      and kc.knowledge_space_id = p_knowledge_space_id
    )
    and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  order by kc.embedding <=> p_query_embedding
  limit p_match_count;
$$;

alter table public.knowledge_documents
drop constraint if exists knowledge_documents_scope_check;

alter table public.knowledge_documents
add constraint knowledge_documents_scope_check
check (scope in ('global', 'conversation', 'space'));

alter table public.knowledge_chunks
drop constraint if exists knowledge_chunks_scope_check;

alter table public.knowledge_chunks
add constraint knowledge_chunks_scope_check
check (scope in ('global', 'conversation', 'space'));