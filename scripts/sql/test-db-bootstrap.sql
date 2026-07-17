-- Andaime do Supabase num Postgres cru.
--
-- Recria o que a plataforma fornece e que o dump do schema `public` não inclui:
-- papéis, o schema `extensions` e as extensões. O schema `auth` (com
-- `auth.uid()` e `auth.users`) vem depois, do dump real em
-- `supabase/schema/*_schema_auth.sql` — não reimplementado aqui.
--
-- POR QUE NÃO A IMAGEM `supabase/postgres`
-- Ela traria tudo isto pronto, mas tem ~4 GB e o pull falha nesta máquina
-- (`unexpected EOF`); `pgvector/pgvector:pg17` tem ~450 MB e baixa numa boa.
-- O ganho real é outro: aqui o andaime é EXPLÍCITO e versionado. Nada do que a
-- RLS depende fica escondido dentro de uma imagem — se um papel tiver o atributo
-- errado, está escrito neste arquivo, revisável.
--
-- Papéis são objetos do CLUSTER, não do banco: com dois bancos no mesmo
-- container, este arquivo roda duas vezes. Daí os guards.

do $$
begin
  -- `anon` e `authenticated` são os papéis que a RLS de fato filtra.
  -- SEM superuser e SEM bypassrls — é o ponto inteiro do teste. `anon` é o papel
  -- da chave pública que vai no bundle do browser (foi o buraco do PD-17).
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  -- `service_role` bypassa RLS (é o papel da chave de servidor). Criado para o
  -- dump aplicar; nenhum teste afirma nada sobre ele — os atributos reais de
  -- produção não estão no dump de schema, então seria afirmação sem prova.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;

  -- Donos referenciados pelos dumps de `auth` e `public`.
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin login superuser createrole createdb bypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit createrole;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'dashboard_user') then
    create role dashboard_user nologin;
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;

-- O baseline faz `create extension ... with schema extensions`, então o schema
-- precisa existir antes.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
