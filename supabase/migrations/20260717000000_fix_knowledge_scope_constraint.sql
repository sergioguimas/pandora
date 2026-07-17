-- ============================================================================
-- PD-23 — `scope='space'` era impossível de inserir.
--
-- SEGURO APLICAR ISOLADO. Só relaxa constraints: nenhuma linha existente muda e
-- nenhuma mudança de código é necessária. A UI, o server action, o ingest e o
-- `match_agent_knowledge` já tratam `space` desde abril — só o banco recusava.
--
-- O QUE ACONTECEU
-- Duas constraints governam o `scope`. A migration `20260425211116` adicionou o
-- valor 'space' ao enum (`..._scope_check`) e ao `match_agent_knowledge`, mas
-- não tocou na irmã, `..._scope_conversation_check`, criada em
-- `20260418xxxxxx_add_knowledge_base` quando só existiam dois escopos:
--
--   check ( (scope = 'global'       and conversation_id is null)
--        or (scope = 'conversation' and conversation_id is not null) )
--
-- `scope='space'` não satisfaz nenhum dos dois ramos — com ou sem
-- `conversation_id`. Toda inserção era rejeitada. O `space` nasceu morto naquele
-- commit: a tabela `knowledge_spaces`, a coluna `agents.knowledge_space_id`, o
-- ramo do RPC e a UI com seletor de espaço foram construídos, mas o dado nunca
-- pôde existir.
--
-- Produção tem ZERO linhas `space` — isso é prova, não estimativa: a constraint
-- está VALID, e o Postgres só aceita criar uma CHECK válida se TODAS as linhas
-- existentes a satisfizerem. Por isso esta migration não precisa de backfill.
--
-- ISTO REESCREVE O `PD-15`. Ele diz que conhecimento de espaço "era ingerido,
-- chunkado, embeddado e nunca usado" e consertou a LEITURA. Mas a escrita já
-- estava barrada: não havia dado nenhum para ler.
--
-- A CORREÇÃO
-- A constraint volta a dizer a INTENÇÃO em vez de listar escopos:
--   `conversation_id` existe se e somente se o escopo é 'conversation'.
-- Escrita assim, um quarto escopo amanhã não a quebra. Enumerar valores foi
-- exatamente o que a fez apodrecer — e o `scope_check` ao lado já enumera, que
-- é o papel dele.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. `conversation_id` ⟺ scope = 'conversation'
-- ---------------------------------------------------------------------------
-- Toda linha existente já satisfaz: as `global` têm conversation_id nulo
-- (false = false) e as `conversation` têm não-nulo (true = true).

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_scope_conversation_check;

alter table public.knowledge_documents
  add constraint knowledge_documents_scope_conversation_check
  check ((scope = 'conversation') = (conversation_id is not null));

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_scope_conversation_check;

alter table public.knowledge_chunks
  add constraint knowledge_chunks_scope_conversation_check
  check ((scope = 'conversation') = (conversation_id is not null));


-- ---------------------------------------------------------------------------
-- 2. O invariante que faltava: `space` exige um espaço
-- ---------------------------------------------------------------------------
-- Um documento `space` sem `knowledge_space_id` é dado fantasma: é ingerido,
-- chunkado, embeddado, custa chamada de embedding — e o RPC nunca o encontra,
-- porque casa por `kc.knowledge_space_id = p_knowledge_space_id`. É a mesma
-- doença do PD-15 (dado que existe e nunca é recuperado), e o banco passa a
-- impedi-la em vez de confiar na validação do server action.
--
-- Implicação, não equivalência (`scope <> 'space' OR ...`): assim a constraint
-- só fala das linhas `space`, das quais não existe nenhuma — então ela não pode
-- abortar por causa de linha antiga. A versão estrita (`space` ⟺ space_id)
-- exigiria antes conferir se algum documento `global` carrega um
-- knowledge_space_id herdado, e não protege contra o bug que importa aqui.

-- `drop ... if exists` antes de cada `add`, aqui e acima: esta migration pode
-- acabar aplicada à mão (o CLI do Supabase não alcança o projeto remoto — 403,
-- ver a ressalva do PD-18). Rodá-la duas vezes tem de ser inofensivo, senão a
-- segunda tentativa aborta com "constraint already exists" no meio.

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_space_requires_space_id;

alter table public.knowledge_documents
  add constraint knowledge_documents_space_requires_space_id
  check (scope <> 'space' or knowledge_space_id is not null);

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_space_requires_space_id;

alter table public.knowledge_chunks
  add constraint knowledge_chunks_space_requires_space_id
  check (scope <> 'space' or knowledge_space_id is not null);
