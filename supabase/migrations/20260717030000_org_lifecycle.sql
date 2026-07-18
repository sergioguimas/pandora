-- ============================================================================
-- PD-27 — Ciclo de vida da organização: ativação por prazo, desativação manual
-- e modo da chave de API (plataforma vs própria).
--
-- SEGURO APLICAR ISOLADA (só adiciona colunas com default). Faz par com código:
-- o enforcement (bloqueio de org inativa, modo da chave) vai junto.
--
-- Colunas novas em `organizations`:
--   is_active     — desativação MANUAL (o "desativar org" do painel). Bloqueia o
--                   acesso dos membros sem excluir nada.
--   active_until  — expiração por PRAZO ("dias ativos"). NULL = sem expiração.
--   key_mode      — 'platform' (usa a chave da plataforma; você cobra mais) ou
--                   'own' (o tenant DEVE cadastrar a própria; enforcement no
--                   motor: sem chave, a geração falha com aviso claro).
--
-- ACESSO EFETIVO = is_active AND (active_until IS NULL OR active_until > now()).
--
-- A org do sistema (Pandora System) e a Base Geral nascem com is_active=true,
-- active_until=NULL (sem expiração) e key_mode='platform' — os defaults abaixo.
-- Não são afetadas. Orgs novas criadas pelo painel recebem active_until e
-- key_mode escolhidos na criação.
-- ============================================================================

alter table public.organizations
  add column if not exists is_active boolean not null default true;

alter table public.organizations
  add column if not exists active_until timestamptz;

alter table public.organizations
  add column if not exists key_mode text not null default 'platform';

alter table public.organizations
  drop constraint if exists organizations_key_mode_check;

alter table public.organizations
  add constraint organizations_key_mode_check
  check (key_mode in ('platform', 'own'));
