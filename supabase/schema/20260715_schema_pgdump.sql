--
-- PostgreSQL database dump
--

\restrict HJuNlgzUxHHbb0c2R0435BFios1IUtK2l0SIJMU9rIBH2ktMpheiaEbyU4rAcmM

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

-- Started on 2026-07-15 08:36:23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 109 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4326 (class 0 OID 0)
-- Dependencies: 109
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 492 (class 1255 OID 17664)
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, nome, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  );

  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- TOC entry 617 (class 1255 OID 18650)
-- Name: handle_new_user_default_organization(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user_default_organization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    '11111111-1111-1111-1111-111111111111',
    new.id,
    'member'
  )
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user_default_organization() OWNER TO postgres;

--
-- TOC entry 613 (class 1255 OID 18302)
-- Name: is_conversation_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_conversation_owner(p_conversation_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
      and cp.role = 'owner'
  );
$$;


ALTER FUNCTION public.is_conversation_owner(p_conversation_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 612 (class 1255 OID 18301)
-- Name: is_conversation_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;


ALTER FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 611 (class 1255 OID 18300)
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_org_member(p_organization_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
  );
$$;


ALTER FUNCTION public.is_org_member(p_organization_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- TOC entry 608 (class 1255 OID 18106)
-- Name: match_agent_knowledge(uuid, extensions.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) RETURNS TABLE(id uuid, document_id uuid, agent_id uuid, chunk_index integer, content text, metadata jsonb, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  select
    kc.id,
    kc.document_id,
    kc.agent_id,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks kc
  where
    kc.agent_id = p_agent_id
    and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  order by kc.embedding <=> p_query_embedding asc
  limit p_match_count;
$$;


ALTER FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) OWNER TO postgres;

--
-- TOC entry 610 (class 1255 OID 18139)
-- Name: match_agent_knowledge(uuid, uuid, extensions.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision DEFAULT 0.45, p_match_count integer DEFAULT 6) RETURNS TABLE(id uuid, document_id uuid, agent_id uuid, conversation_id uuid, scope text, chunk_index integer, content text, metadata jsonb, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  (
    select
      kc.id,
      kc.document_id,
      kc.agent_id,
      kc.conversation_id,
      kc.scope,
      kc.chunk_index,
      kc.content,
      kc.metadata,
      1 - (kc.embedding <=> p_query_embedding) as similarity
    from public.knowledge_chunks kc
    where
      kc.agent_id = p_agent_id
      and kc.scope = 'global'
      and kc.embedding is not null
      and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
    order by kc.embedding <=> p_query_embedding asc
    limit greatest(1, p_match_count / 2)
  )

  union all

  (
    select
      kc.id,
      kc.document_id,
      kc.agent_id,
      kc.conversation_id,
      kc.scope,
      kc.chunk_index,
      kc.content,
      kc.metadata,
      1 - (kc.embedding <=> p_query_embedding) as similarity
    from public.knowledge_chunks kc
    where
      kc.agent_id = p_agent_id
      and kc.scope = 'conversation'
      and kc.conversation_id = p_conversation_id
      and kc.embedding is not null
      and 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
    order by kc.embedding <=> p_query_embedding asc
    limit greatest(1, p_match_count)
  )
  order by similarity desc
  limit p_match_count;
$$;


ALTER FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) OWNER TO postgres;

--
-- TOC entry 614 (class 1255 OID 18525)
-- Name: match_agent_knowledge(uuid, uuid, uuid, extensions.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_knowledge_space_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision DEFAULT 0.5, p_match_count integer DEFAULT 6) RETURNS TABLE(id uuid, document_id uuid, agent_id uuid, conversation_id uuid, knowledge_space_id uuid, chunk_index integer, content text, metadata jsonb, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
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


ALTER FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_knowledge_space_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) OWNER TO postgres;

--
-- TOC entry 615 (class 1255 OID 18556)
-- Name: match_knowledge_chunks(extensions.vector, double precision, integer, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_knowledge_chunks(query_embedding extensions.vector, match_threshold double precision, match_count integer, agent_id uuid, conversation_id uuid, knowledge_space_id uuid) RETURNS TABLE(id uuid, document_id uuid, agent_id uuid, conversation_id uuid, knowledge_space_id uuid, scope text, chunk_index integer, content text, metadata jsonb, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  select
    kc.id,
    kc.document_id,
    kc.agent_id,
    kc.conversation_id,
    kc.knowledge_space_id,
    kc.scope,
    kc.chunk_index,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where
    (
      kc.agent_id = match_knowledge_chunks.agent_id
      or kc.conversation_id = match_knowledge_chunks.conversation_id
      or kc.knowledge_space_id = match_knowledge_chunks.knowledge_space_id
    )
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;


ALTER FUNCTION public.match_knowledge_chunks(query_embedding extensions.vector, match_threshold double precision, match_count integer, agent_id uuid, conversation_id uuid, knowledge_space_id uuid) OWNER TO postgres;

--
-- TOC entry 493 (class 1255 OID 17700)
-- Name: set_agents_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_agents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_agents_updated_at() OWNER TO postgres;

--
-- TOC entry 490 (class 1255 OID 17660)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- TOC entry 491 (class 1255 OID 17662)
-- Name: touch_conversation_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_conversation_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;


ALTER FUNCTION public.touch_conversation_updated_at() OWNER TO postgres;

--
-- TOC entry 609 (class 1255 OID 18137)
-- Name: update_knowledge_documents_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_knowledge_documents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.update_knowledge_documents_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 370 (class 1259 OID 17629)
-- Name: agent_knowledge_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_knowledge_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    nome_arquivo text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    tamanho_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.agent_knowledge_files OWNER TO postgres;

--
-- TOC entry 366 (class 1259 OID 17568)
-- Name: agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nome text NOT NULL,
    descricao text,
    avatar_url text,
    prompt_base text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'gemini'::text NOT NULL,
    model text DEFAULT 'gemini-2.5-flash'::text NOT NULL,
    temperature numeric(3,2) DEFAULT 0.70 NOT NULL,
    max_history_messages integer DEFAULT 12 NOT NULL,
    knowledge_space_id uuid,
    category text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT agents_max_history_messages_check CHECK (((max_history_messages >= 1) AND (max_history_messages <= 100))),
    CONSTRAINT agents_provider_check CHECK ((provider = ANY (ARRAY['gemini'::text, 'openai'::text]))),
    CONSTRAINT agents_temperature_check CHECK (((temperature >= (0)::numeric) AND (temperature <= (2)::numeric)))
);


ALTER TABLE public.agents OWNER TO postgres;

--
-- TOC entry 376 (class 1259 OID 18458)
-- Name: conversation_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    ordem integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.conversation_agents OWNER TO postgres;

--
-- TOC entry 375 (class 1259 OID 18218)
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_participants_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- TOC entry 367 (class 1259 OID 17580)
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    titulo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- TOC entry 372 (class 1259 OID 18083)
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    embedding extensions.vector(768),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id uuid,
    scope text DEFAULT 'global'::text NOT NULL,
    knowledge_space_id uuid,
    CONSTRAINT knowledge_chunks_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'conversation'::text, 'space'::text]))),
    CONSTRAINT knowledge_chunks_scope_conversation_check CHECK ((((scope = 'global'::text) AND (conversation_id IS NULL)) OR ((scope = 'conversation'::text) AND (conversation_id IS NOT NULL))))
);


ALTER TABLE public.knowledge_chunks OWNER TO postgres;

--
-- TOC entry 371 (class 1259 OID 18067)
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    titulo text NOT NULL,
    fonte text,
    mime_type text,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id uuid,
    scope text DEFAULT 'global'::text NOT NULL,
    knowledge_space_id uuid,
    CONSTRAINT knowledge_documents_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'conversation'::text, 'space'::text]))),
    CONSTRAINT knowledge_documents_scope_conversation_check CHECK ((((scope = 'global'::text) AND (conversation_id IS NULL)) OR ((scope = 'conversation'::text) AND (conversation_id IS NOT NULL))))
);


ALTER TABLE public.knowledge_documents OWNER TO postgres;

--
-- TOC entry 377 (class 1259 OID 18488)
-- Name: knowledge_spaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_spaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.knowledge_spaces OWNER TO postgres;

--
-- TOC entry 369 (class 1259 OID 17615)
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    nome_arquivo text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    tamanho_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_attachments OWNER TO postgres;

--
-- TOC entry 368 (class 1259 OID 17600)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 374 (class 1259 OID 18187)
-- Name: organization_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);


ALTER TABLE public.organization_members OWNER TO postgres;

--
-- TOC entry 373 (class 1259 OID 18178)
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- TOC entry 365 (class 1259 OID 17555)
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome text,
    email text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- TOC entry 4034 (class 2606 OID 17637)
-- Name: agent_knowledge_files agent_knowledge_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_knowledge_files
    ADD CONSTRAINT agent_knowledge_files_pkey PRIMARY KEY (id);


--
-- TOC entry 4013 (class 2606 OID 17577)
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- TOC entry 4015 (class 2606 OID 17579)
-- Name: agents agents_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_slug_key UNIQUE (slug);


--
-- TOC entry 4065 (class 2606 OID 18464)
-- Name: conversation_agents conversation_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_agents
    ADD CONSTRAINT conversation_agents_pkey PRIMARY KEY (id);


--
-- TOC entry 4059 (class 2606 OID 18230)
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- TOC entry 4061 (class 2606 OID 18228)
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- TOC entry 4020 (class 2606 OID 17589)
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- TOC entry 4048 (class 2606 OID 18091)
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- TOC entry 4041 (class 2606 OID 18077)
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 4072 (class 2606 OID 18497)
-- Name: knowledge_spaces knowledge_spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_spaces
    ADD CONSTRAINT knowledge_spaces_pkey PRIMARY KEY (id);


--
-- TOC entry 4032 (class 2606 OID 17623)
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 4029 (class 2606 OID 17609)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 4055 (class 2606 OID 18199)
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- TOC entry 4057 (class 2606 OID 18197)
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4051 (class 2606 OID 18186)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 4011 (class 2606 OID 17562)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 4035 (class 1259 OID 17647)
-- Name: idx_agent_knowledge_files_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_knowledge_files_agent_id ON public.agent_knowledge_files USING btree (agent_id);


--
-- TOC entry 4016 (class 1259 OID 18510)
-- Name: idx_agents_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agents_category ON public.agents USING btree (category);


--
-- TOC entry 4017 (class 1259 OID 18509)
-- Name: idx_agents_knowledge_space_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agents_knowledge_space_id ON public.agents USING btree (knowledge_space_id);


--
-- TOC entry 4018 (class 1259 OID 18511)
-- Name: idx_agents_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agents_tags ON public.agents USING gin (tags);


--
-- TOC entry 4066 (class 1259 OID 18560)
-- Name: idx_conversation_agents_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_agents_agent_id ON public.conversation_agents USING btree (agent_id);


--
-- TOC entry 4067 (class 1259 OID 18559)
-- Name: idx_conversation_agents_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_agents_conversation_id ON public.conversation_agents USING btree (conversation_id);


--
-- TOC entry 4068 (class 1259 OID 18487)
-- Name: idx_conversation_agents_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_agents_order ON public.conversation_agents USING btree (conversation_id, ordem, created_at);


--
-- TOC entry 4069 (class 1259 OID 18475)
-- Name: idx_conversation_agents_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_conversation_agents_unique ON public.conversation_agents USING btree (conversation_id, agent_id);


--
-- TOC entry 4062 (class 1259 OID 18241)
-- Name: idx_conversation_participants_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants USING btree (conversation_id);


--
-- TOC entry 4063 (class 1259 OID 18242)
-- Name: idx_conversation_participants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants USING btree (user_id);


--
-- TOC entry 4021 (class 1259 OID 17644)
-- Name: idx_conversations_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_agent_id ON public.conversations USING btree (agent_id);


--
-- TOC entry 4022 (class 1259 OID 18135)
-- Name: idx_conversations_agent_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_agent_user ON public.conversations USING btree (agent_id, user_id);


--
-- TOC entry 4023 (class 1259 OID 18217)
-- Name: idx_conversations_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_organization_id ON public.conversations USING btree (organization_id);


--
-- TOC entry 4024 (class 1259 OID 17643)
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- TOC entry 4025 (class 1259 OID 18136)
-- Name: idx_conversations_user_id_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user_id_id ON public.conversations USING btree (user_id, id);


--
-- TOC entry 4042 (class 1259 OID 18103)
-- Name: idx_knowledge_chunks_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_chunks_agent_id ON public.knowledge_chunks USING btree (agent_id);


--
-- TOC entry 4043 (class 1259 OID 18133)
-- Name: idx_knowledge_chunks_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_chunks_conversation_id ON public.knowledge_chunks USING btree (conversation_id);


--
-- TOC entry 4044 (class 1259 OID 18105)
-- Name: idx_knowledge_chunks_embedding_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_chunks_embedding_hnsw ON public.knowledge_chunks USING hnsw (embedding extensions.vector_cosine_ops);


--
-- TOC entry 4045 (class 1259 OID 18134)
-- Name: idx_knowledge_chunks_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_chunks_scope ON public.knowledge_chunks USING btree (scope);


--
-- TOC entry 4046 (class 1259 OID 18523)
-- Name: idx_knowledge_chunks_space_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_chunks_space_id ON public.knowledge_chunks USING btree (knowledge_space_id);


--
-- TOC entry 4036 (class 1259 OID 18102)
-- Name: idx_knowledge_documents_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_documents_agent_id ON public.knowledge_documents USING btree (agent_id);


--
-- TOC entry 4037 (class 1259 OID 18131)
-- Name: idx_knowledge_documents_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_documents_conversation_id ON public.knowledge_documents USING btree (conversation_id);


--
-- TOC entry 4038 (class 1259 OID 18132)
-- Name: idx_knowledge_documents_scope; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_documents_scope ON public.knowledge_documents USING btree (scope);


--
-- TOC entry 4039 (class 1259 OID 18522)
-- Name: idx_knowledge_documents_space_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_documents_space_id ON public.knowledge_documents USING btree (knowledge_space_id);


--
-- TOC entry 4070 (class 1259 OID 18498)
-- Name: idx_knowledge_spaces_nome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_spaces_nome ON public.knowledge_spaces USING btree (nome);


--
-- TOC entry 4030 (class 1259 OID 17646)
-- Name: idx_message_attachments_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);


--
-- TOC entry 4026 (class 1259 OID 17645)
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- TOC entry 4027 (class 1259 OID 18447)
-- Name: idx_messages_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_user_id ON public.messages USING btree (user_id);


--
-- TOC entry 4052 (class 1259 OID 18215)
-- Name: idx_organization_members_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_members_org_id ON public.organization_members USING btree (organization_id);


--
-- TOC entry 4053 (class 1259 OID 18216)
-- Name: idx_organization_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organization_members_user_id ON public.organization_members USING btree (user_id);


--
-- TOC entry 4049 (class 1259 OID 18104)
-- Name: uq_knowledge_chunks_document_chunk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_knowledge_chunks_document_chunk ON public.knowledge_chunks USING btree (document_id, chunk_index);


--
-- TOC entry 4095 (class 2620 OID 17701)
-- Name: agents trg_agents_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_agents_set_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.set_agents_updated_at();


--
-- TOC entry 4096 (class 2620 OID 17661)
-- Name: conversations trg_conversations_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4098 (class 2620 OID 18138)
-- Name: knowledge_documents trg_knowledge_documents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_documents_updated_at();


--
-- TOC entry 4097 (class 2620 OID 17663)
-- Name: messages trg_messages_touch_conversation_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_messages_touch_conversation_updated_at AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_updated_at();


--
-- TOC entry 4081 (class 2606 OID 17638)
-- Name: agent_knowledge_files agent_knowledge_files_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_knowledge_files
    ADD CONSTRAINT agent_knowledge_files_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- TOC entry 4074 (class 2606 OID 18503)
-- Name: agents agents_knowledge_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_knowledge_space_id_fkey FOREIGN KEY (knowledge_space_id) REFERENCES public.knowledge_spaces(id) ON DELETE SET NULL;


--
-- TOC entry 4093 (class 2606 OID 18470)
-- Name: conversation_agents conversation_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_agents
    ADD CONSTRAINT conversation_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- TOC entry 4094 (class 2606 OID 18465)
-- Name: conversation_agents conversation_agents_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_agents
    ADD CONSTRAINT conversation_agents_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4091 (class 2606 OID 18231)
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4092 (class 2606 OID 18236)
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4075 (class 2606 OID 17595)
-- Name: conversations conversations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- TOC entry 4076 (class 2606 OID 18210)
-- Name: conversations conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4077 (class 2606 OID 17590)
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4085 (class 2606 OID 18097)
-- Name: knowledge_chunks knowledge_chunks_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- TOC entry 4086 (class 2606 OID 18123)
-- Name: knowledge_chunks knowledge_chunks_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4087 (class 2606 OID 18092)
-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- TOC entry 4088 (class 2606 OID 18517)
-- Name: knowledge_chunks knowledge_chunks_knowledge_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_knowledge_space_id_fkey FOREIGN KEY (knowledge_space_id) REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE;


--
-- TOC entry 4082 (class 2606 OID 18078)
-- Name: knowledge_documents knowledge_documents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- TOC entry 4083 (class 2606 OID 18115)
-- Name: knowledge_documents knowledge_documents_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4084 (class 2606 OID 18512)
-- Name: knowledge_documents knowledge_documents_knowledge_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_knowledge_space_id_fkey FOREIGN KEY (knowledge_space_id) REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE;


--
-- TOC entry 4080 (class 2606 OID 17624)
-- Name: message_attachments message_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- TOC entry 4078 (class 2606 OID 17610)
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- TOC entry 4079 (class 2606 OID 18442)
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- TOC entry 4089 (class 2606 OID 18200)
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- TOC entry 4090 (class 2606 OID 18205)
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4073 (class 2606 OID 17563)
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4312 (class 3256 OID 18535)
-- Name: knowledge_chunks Authenticated users can delete knowledge chunks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can delete knowledge chunks" ON public.knowledge_chunks FOR DELETE TO authenticated USING (true);


--
-- TOC entry 4308 (class 3256 OID 18531)
-- Name: knowledge_documents Authenticated users can delete knowledge documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can delete knowledge documents" ON public.knowledge_documents FOR DELETE TO authenticated USING (true);


--
-- TOC entry 4304 (class 3256 OID 18502)
-- Name: knowledge_spaces Authenticated users can delete knowledge spaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can delete knowledge spaces" ON public.knowledge_spaces FOR DELETE TO authenticated USING (true);


--
-- TOC entry 4310 (class 3256 OID 18533)
-- Name: knowledge_chunks Authenticated users can insert knowledge chunks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert knowledge chunks" ON public.knowledge_chunks FOR INSERT TO authenticated WITH CHECK ((scope = ANY (ARRAY['global'::text, 'conversation'::text, 'space'::text])));


--
-- TOC entry 4306 (class 3256 OID 18529)
-- Name: knowledge_documents Authenticated users can insert knowledge documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert knowledge documents" ON public.knowledge_documents FOR INSERT TO authenticated WITH CHECK ((scope = ANY (ARRAY['global'::text, 'conversation'::text, 'space'::text])));


--
-- TOC entry 4302 (class 3256 OID 18500)
-- Name: knowledge_spaces Authenticated users can insert knowledge spaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert knowledge spaces" ON public.knowledge_spaces FOR INSERT TO authenticated WITH CHECK (true);


--
-- TOC entry 4311 (class 3256 OID 18534)
-- Name: knowledge_chunks Authenticated users can update knowledge chunks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update knowledge chunks" ON public.knowledge_chunks FOR UPDATE TO authenticated USING (true) WITH CHECK ((scope = ANY (ARRAY['global'::text, 'conversation'::text, 'space'::text])));


--
-- TOC entry 4307 (class 3256 OID 18530)
-- Name: knowledge_documents Authenticated users can update knowledge documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update knowledge documents" ON public.knowledge_documents FOR UPDATE TO authenticated USING (true) WITH CHECK ((scope = ANY (ARRAY['global'::text, 'conversation'::text, 'space'::text])));


--
-- TOC entry 4303 (class 3256 OID 18501)
-- Name: knowledge_spaces Authenticated users can update knowledge spaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update knowledge spaces" ON public.knowledge_spaces FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4309 (class 3256 OID 18532)
-- Name: knowledge_chunks Authenticated users can view knowledge chunks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view knowledge chunks" ON public.knowledge_chunks FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4305 (class 3256 OID 18528)
-- Name: knowledge_documents Authenticated users can view knowledge documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view knowledge documents" ON public.knowledge_documents FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4301 (class 3256 OID 18499)
-- Name: knowledge_spaces Authenticated users can view knowledge spaces; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view knowledge spaces" ON public.knowledge_spaces FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4286 (class 3256 OID 18252)
-- Name: conversations Members can insert conversations in their organization; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can insert conversations in their organization" ON public.conversations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = conversations.organization_id) AND (om.user_id = auth.uid())))));


--
-- TOC entry 4297 (class 3256 OID 18477)
-- Name: conversation_agents Owners can add agents to conversation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can add agents to conversation" ON public.conversation_agents FOR INSERT TO authenticated WITH CHECK ((public.is_conversation_participant(conversation_id, auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_agents.conversation_id) AND (cp.user_id = auth.uid()) AND (cp.role = 'owner'::text))))));


--
-- TOC entry 4290 (class 3256 OID 18306)
-- Name: conversation_participants Owners can delete participants from their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can delete participants from their conversations" ON public.conversation_participants FOR DELETE USING (public.is_conversation_owner(conversation_id, auth.uid()));


--
-- TOC entry 4291 (class 3256 OID 18334)
-- Name: conversation_participants Owners can insert participants into their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can insert participants into their conversations" ON public.conversation_participants FOR INSERT WITH CHECK ((((role = 'owner'::text) AND (user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_participants.conversation_id) AND (c.user_id = auth.uid()))))) OR public.is_conversation_owner(conversation_id, auth.uid())));


--
-- TOC entry 4298 (class 3256 OID 18478)
-- Name: conversation_agents Owners can remove agents from conversation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can remove agents from conversation" ON public.conversation_agents FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_agents.conversation_id) AND (cp.user_id = auth.uid()) AND (cp.role = 'owner'::text)))));


--
-- TOC entry 4299 (class 3256 OID 18479)
-- Name: conversation_agents Owners can update conversation agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can update conversation agents" ON public.conversation_agents FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_agents.conversation_id) AND (cp.user_id = auth.uid()) AND (cp.role = 'owner'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_agents.conversation_id) AND (cp.user_id = auth.uid()) AND (cp.role = 'owner'::text)))));


--
-- TOC entry 4293 (class 3256 OID 18453)
-- Name: messages Participants can insert messages in shared conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can insert messages in shared conversations" ON public.messages FOR INSERT WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));


--
-- TOC entry 4294 (class 3256 OID 18454)
-- Name: messages Participants can update messages metadata in shared conversatio; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can update messages metadata in shared conversatio" ON public.messages FOR UPDATE USING (public.is_conversation_participant(conversation_id, auth.uid())) WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));


--
-- TOC entry 4287 (class 3256 OID 18308)
-- Name: conversations Participants can update shared conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can update shared conversations" ON public.conversations FOR UPDATE USING (public.is_conversation_participant(id, auth.uid())) WITH CHECK (public.is_conversation_participant(id, auth.uid()));


--
-- TOC entry 4296 (class 3256 OID 18476)
-- Name: conversation_agents Participants can view conversation agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can view conversation agents" ON public.conversation_agents FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id, auth.uid()));


--
-- TOC entry 4295 (class 3256 OID 18456)
-- Name: messages Participants can view messages of shared conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can view messages of shared conversations" ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id, auth.uid()));


--
-- TOC entry 4300 (class 3256 OID 18481)
-- Name: conversations Participants can view shared conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can view shared conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_participant(id, auth.uid()));


--
-- TOC entry 4316 (class 3256 OID 18565)
-- Name: conversation_agents Users can delete conversation agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete conversation agents" ON public.conversation_agents FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_agents.conversation_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4284 (class 3256 OID 18114)
-- Name: knowledge_chunks Users can delete knowledge chunks of their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete knowledge chunks of their agents" ON public.knowledge_chunks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_chunks.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4280 (class 3256 OID 18110)
-- Name: knowledge_documents Users can delete knowledge documents of their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete knowledge documents of their agents" ON public.knowledge_documents FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_documents.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4314 (class 3256 OID 18562)
-- Name: conversation_agents Users can insert conversation agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert conversation agents" ON public.conversation_agents FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_agents.conversation_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4282 (class 3256 OID 18112)
-- Name: knowledge_chunks Users can insert knowledge chunks for their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert knowledge chunks for their agents" ON public.knowledge_chunks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_chunks.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4278 (class 3256 OID 18108)
-- Name: knowledge_documents Users can insert knowledge documents for their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert knowledge documents for their agents" ON public.knowledge_documents FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_documents.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4315 (class 3256 OID 18563)
-- Name: conversation_agents Users can update conversation agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update conversation agents" ON public.conversation_agents FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_agents.conversation_id) AND (c.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_agents.conversation_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4283 (class 3256 OID 18113)
-- Name: knowledge_chunks Users can update knowledge chunks of their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update knowledge chunks of their agents" ON public.knowledge_chunks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_chunks.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4279 (class 3256 OID 18109)
-- Name: knowledge_documents Users can update knowledge documents of their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update knowledge documents of their agents" ON public.knowledge_documents FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_documents.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4313 (class 3256 OID 18561)
-- Name: conversation_agents Users can view conversation agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view conversation agents" ON public.conversation_agents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_agents.conversation_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4281 (class 3256 OID 18111)
-- Name: knowledge_chunks Users can view knowledge chunks of their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view knowledge chunks of their agents" ON public.knowledge_chunks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_chunks.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4277 (class 3256 OID 18107)
-- Name: knowledge_documents Users can view knowledge documents of their agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view knowledge documents of their agents" ON public.knowledge_documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.agent_id = knowledge_documents.agent_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4288 (class 3256 OID 18303)
-- Name: organization_members Users can view organization members of their organizations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view organization members of their organizations" ON public.organization_members FOR SELECT USING (public.is_org_member(organization_id, auth.uid()));


--
-- TOC entry 4292 (class 3256 OID 18345)
-- Name: profiles Users can view organization profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view organization profiles" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.organization_members om_me
     JOIN public.organization_members om_target ON ((om_target.organization_id = om_me.organization_id)))
  WHERE ((om_me.user_id = auth.uid()) AND (om_target.user_id = profiles.id)))));


--
-- TOC entry 4289 (class 3256 OID 18304)
-- Name: conversation_participants Users can view participants of accessible conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view participants of accessible conversations" ON public.conversation_participants FOR SELECT USING (public.is_conversation_participant(conversation_id, auth.uid()));


--
-- TOC entry 4285 (class 3256 OID 18243)
-- Name: organizations Users can view their organizations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their organizations" ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organizations.id) AND (om.user_id = auth.uid())))));


--
-- TOC entry 4252 (class 0 OID 17629)
-- Dependencies: 370
-- Name: agent_knowledge_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_knowledge_files ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4274 (class 3256 OID 17685)
-- Name: agent_knowledge_files agent_knowledge_files_select_anon_temp; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agent_knowledge_files_select_anon_temp ON public.agent_knowledge_files FOR SELECT TO anon USING (true);


--
-- TOC entry 4264 (class 3256 OID 17652)
-- Name: agent_knowledge_files agent_knowledge_files_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agent_knowledge_files_select_authenticated ON public.agent_knowledge_files FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4248 (class 0 OID 17568)
-- Dependencies: 366
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4276 (class 3256 OID 17719)
-- Name: agents agents_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agents_delete_authenticated ON public.agents FOR DELETE TO authenticated USING (true);


--
-- TOC entry 4275 (class 3256 OID 17717)
-- Name: agents agents_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agents_insert_authenticated ON public.agents FOR INSERT TO authenticated WITH CHECK (true);


--
-- TOC entry 4273 (class 3256 OID 17684)
-- Name: agents agents_select_anon_temp; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agents_select_anon_temp ON public.agents FOR SELECT TO anon USING (true);


--
-- TOC entry 4263 (class 3256 OID 17651)
-- Name: agents agents_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agents_select_authenticated ON public.agents FOR SELECT TO authenticated USING (true);


--
-- TOC entry 4270 (class 3256 OID 17718)
-- Name: agents agents_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY agents_update_authenticated ON public.agents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- TOC entry 4258 (class 0 OID 18458)
-- Dependencies: 376
-- Name: conversation_agents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_agents ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4257 (class 0 OID 18218)
-- Dependencies: 375
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4249 (class 0 OID 17580)
-- Dependencies: 367
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4266 (class 3256 OID 17654)
-- Name: conversations conversations_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_insert_own ON public.conversations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4265 (class 3256 OID 17653)
-- Name: conversations conversations_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_select_own ON public.conversations FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- TOC entry 4267 (class 3256 OID 17655)
-- Name: conversations conversations_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_update_own ON public.conversations FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- TOC entry 4254 (class 0 OID 18083)
-- Dependencies: 372
-- Name: knowledge_chunks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4253 (class 0 OID 18067)
-- Dependencies: 371
-- Name: knowledge_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4259 (class 0 OID 18488)
-- Dependencies: 377
-- Name: knowledge_spaces; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.knowledge_spaces ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4251 (class 0 OID 17615)
-- Dependencies: 369
-- Name: message_attachments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4272 (class 3256 OID 17659)
-- Name: message_attachments message_attachments_insert_into_own_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_attachments_insert_into_own_conversations ON public.message_attachments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_attachments.message_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4271 (class 3256 OID 17658)
-- Name: message_attachments message_attachments_select_from_own_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY message_attachments_select_from_own_conversations ON public.message_attachments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = message_attachments.message_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4250 (class 0 OID 17600)
-- Dependencies: 368
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4269 (class 3256 OID 17657)
-- Name: messages messages_insert_into_own_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_insert_into_own_conversations ON public.messages FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4268 (class 3256 OID 17656)
-- Name: messages messages_select_from_own_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_select_from_own_conversations ON public.messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.user_id = auth.uid())))));


--
-- TOC entry 4256 (class 0 OID 18187)
-- Dependencies: 374
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4255 (class 0 OID 18178)
-- Dependencies: 373
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4247 (class 0 OID 17555)
-- Dependencies: 365
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4261 (class 3256 OID 17649)
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- TOC entry 4260 (class 3256 OID 17648)
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- TOC entry 4262 (class 3256 OID 17650)
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- TOC entry 4327 (class 0 OID 0)
-- Dependencies: 109
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 4328 (class 0 OID 0)
-- Dependencies: 492
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- TOC entry 4329 (class 0 OID 0)
-- Dependencies: 617
-- Name: FUNCTION handle_new_user_default_organization(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user_default_organization() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user_default_organization() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user_default_organization() TO service_role;


--
-- TOC entry 4330 (class 0 OID 0)
-- Dependencies: 613
-- Name: FUNCTION is_conversation_owner(p_conversation_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_conversation_owner(p_conversation_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_conversation_owner(p_conversation_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_conversation_owner(p_conversation_id uuid, p_user_id uuid) TO service_role;


--
-- TOC entry 4331 (class 0 OID 0)
-- Dependencies: 612
-- Name: FUNCTION is_conversation_participant(p_conversation_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid) TO service_role;


--
-- TOC entry 4332 (class 0 OID 0)
-- Dependencies: 611
-- Name: FUNCTION is_org_member(p_organization_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_org_member(p_organization_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_org_member(p_organization_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_org_member(p_organization_id uuid, p_user_id uuid) TO service_role;


--
-- TOC entry 4333 (class 0 OID 0)
-- Dependencies: 608
-- Name: FUNCTION match_agent_knowledge(p_agent_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO service_role;


--
-- TOC entry 4334 (class 0 OID 0)
-- Dependencies: 610
-- Name: FUNCTION match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO service_role;


--
-- TOC entry 4335 (class 0 OID 0)
-- Dependencies: 614
-- Name: FUNCTION match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_knowledge_space_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_knowledge_space_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_knowledge_space_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_agent_knowledge(p_agent_id uuid, p_conversation_id uuid, p_knowledge_space_id uuid, p_query_embedding extensions.vector, p_match_threshold double precision, p_match_count integer) TO service_role;


--
-- TOC entry 4336 (class 0 OID 0)
-- Dependencies: 615
-- Name: FUNCTION match_knowledge_chunks(query_embedding extensions.vector, match_threshold double precision, match_count integer, agent_id uuid, conversation_id uuid, knowledge_space_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_knowledge_chunks(query_embedding extensions.vector, match_threshold double precision, match_count integer, agent_id uuid, conversation_id uuid, knowledge_space_id uuid) TO anon;
GRANT ALL ON FUNCTION public.match_knowledge_chunks(query_embedding extensions.vector, match_threshold double precision, match_count integer, agent_id uuid, conversation_id uuid, knowledge_space_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.match_knowledge_chunks(query_embedding extensions.vector, match_threshold double precision, match_count integer, agent_id uuid, conversation_id uuid, knowledge_space_id uuid) TO service_role;


--
-- TOC entry 4337 (class 0 OID 0)
-- Dependencies: 493
-- Name: FUNCTION set_agents_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_agents_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_agents_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_agents_updated_at() TO service_role;


--
-- TOC entry 4338 (class 0 OID 0)
-- Dependencies: 490
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- TOC entry 4339 (class 0 OID 0)
-- Dependencies: 491
-- Name: FUNCTION touch_conversation_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.touch_conversation_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_conversation_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_conversation_updated_at() TO service_role;


--
-- TOC entry 4340 (class 0 OID 0)
-- Dependencies: 609
-- Name: FUNCTION update_knowledge_documents_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_knowledge_documents_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_knowledge_documents_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_knowledge_documents_updated_at() TO service_role;


--
-- TOC entry 4341 (class 0 OID 0)
-- Dependencies: 370
-- Name: TABLE agent_knowledge_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_knowledge_files TO anon;
GRANT ALL ON TABLE public.agent_knowledge_files TO authenticated;
GRANT ALL ON TABLE public.agent_knowledge_files TO service_role;


--
-- TOC entry 4342 (class 0 OID 0)
-- Dependencies: 366
-- Name: TABLE agents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agents TO anon;
GRANT ALL ON TABLE public.agents TO authenticated;
GRANT ALL ON TABLE public.agents TO service_role;


--
-- TOC entry 4343 (class 0 OID 0)
-- Dependencies: 376
-- Name: TABLE conversation_agents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_agents TO anon;
GRANT ALL ON TABLE public.conversation_agents TO authenticated;
GRANT ALL ON TABLE public.conversation_agents TO service_role;


--
-- TOC entry 4344 (class 0 OID 0)
-- Dependencies: 375
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_participants TO anon;
GRANT ALL ON TABLE public.conversation_participants TO authenticated;
GRANT ALL ON TABLE public.conversation_participants TO service_role;


--
-- TOC entry 4345 (class 0 OID 0)
-- Dependencies: 367
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- TOC entry 4346 (class 0 OID 0)
-- Dependencies: 372
-- Name: TABLE knowledge_chunks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.knowledge_chunks TO anon;
GRANT ALL ON TABLE public.knowledge_chunks TO authenticated;
GRANT ALL ON TABLE public.knowledge_chunks TO service_role;


--
-- TOC entry 4347 (class 0 OID 0)
-- Dependencies: 371
-- Name: TABLE knowledge_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.knowledge_documents TO anon;
GRANT ALL ON TABLE public.knowledge_documents TO authenticated;
GRANT ALL ON TABLE public.knowledge_documents TO service_role;


--
-- TOC entry 4348 (class 0 OID 0)
-- Dependencies: 377
-- Name: TABLE knowledge_spaces; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.knowledge_spaces TO anon;
GRANT ALL ON TABLE public.knowledge_spaces TO authenticated;
GRANT ALL ON TABLE public.knowledge_spaces TO service_role;


--
-- TOC entry 4349 (class 0 OID 0)
-- Dependencies: 369
-- Name: TABLE message_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.message_attachments TO anon;
GRANT ALL ON TABLE public.message_attachments TO authenticated;
GRANT ALL ON TABLE public.message_attachments TO service_role;


--
-- TOC entry 4350 (class 0 OID 0)
-- Dependencies: 368
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- TOC entry 4351 (class 0 OID 0)
-- Dependencies: 374
-- Name: TABLE organization_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_members TO anon;
GRANT ALL ON TABLE public.organization_members TO authenticated;
GRANT ALL ON TABLE public.organization_members TO service_role;


--
-- TOC entry 4352 (class 0 OID 0)
-- Dependencies: 373
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- TOC entry 4353 (class 0 OID 0)
-- Dependencies: 365
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- TOC entry 2696 (class 826 OID 16494)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2697 (class 826 OID 16495)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2695 (class 826 OID 16493)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2699 (class 826 OID 16497)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2694 (class 826 OID 16492)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 2698 (class 826 OID 16496)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Completed on 2026-07-15 08:36:37

--
-- PostgreSQL database dump complete
--

\unrestrict HJuNlgzUxHHbb0c2R0435BFios1IUtK2l0SIJMU9rIBH2ktMpheiaEbyU4rAcmM

