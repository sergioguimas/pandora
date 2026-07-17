-- ============================================================================
-- PD-25 (provisionamento de organização) + PD-26 (chave de API por tenant)
--
-- ⚠️ ACOPLADA A CÓDIGO. Não aplique isolada: ao remover o trigger da org padrão,
-- um usuário novo passa a nascer SEM organização. O caminho que cria org e
-- convida (PD-25) precisa ir junto, e o `/cadastro` público precisa sair do ar.
--
-- POR QUE (PD-25)
-- O modelo multi-tenant está pronto desde o PD-06 e provado por 33 testes de
-- RLS. Mas o PROVISIONAMENTO não existia: o trigger abaixo inseria TODO usuário
-- novo na org `11111111-…` ("Base Geral"), e o `/cadastro` era público. Logo:
-- qualquer pessoa criava conta e virava colega de organização do dono do
-- produto — lendo todos os agentes, `prompt_base` incluso, e todo o
-- conhecimento. É o PD-17 outra vez, trocando "basta a URL" por "basta um
-- cadastro grátis". A RLS estava certa; ela isolava uma organização só, e o
-- formulário de cadastro era a porta dela.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. O trigger da organização padrão sai
-- ---------------------------------------------------------------------------
-- Era a causa raiz. A partir daqui um usuário nasce SEM org, e só entra numa
-- por convite (PD-25) — que é o que torna "empresa independente" possível.
--
-- `handle_new_user` (que cria o `profiles`) FICA: esse é legítimo e não decide
-- pertencimento.

drop trigger if exists on_auth_user_created_add_default_organization on auth.users;
drop function if exists public.handle_new_user_default_organization();


-- ---------------------------------------------------------------------------
-- 2. Admin de plataforma
-- ---------------------------------------------------------------------------
-- Papel ACIMA da organização: só ele cria orgs novas. Cada org convida os
-- próprios membros, mas não cria outras orgs.
--
-- POR QUE UMA FLAG, E NÃO MEMBRO DA ORG DO SISTEMA
-- Seria o caminho curto, e quebraria os agentes universais. O read-only do
-- Agente 0 e do Oráculo não vem de policy de escrita: vem de a org do sistema
-- NÃO TER MEMBROS, o que faz `is_org_member()` ser falso para todos. Um membro
-- ali dentro e os universais viram editáveis. O teste
-- `agentes-universais.test.ts › a org do sistema não tem membros` existe para
-- gritar exatamente nesse caso.
--
-- As ações de admin passam pelo client admin (service_role) depois de checar
-- esta flag — porta explícita e auditável AO LADO da parede, não um buraco nela.
-- Por isso não há policy nenhuma aqui concedendo poder a `is_platform_admin`: a
-- RLS continua valendo igual para ele.

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is
  'Papel de plataforma (PD-25): cria organizações. Concedido fora do app, por SQL — '
  'é dado, não schema. Não dá nenhum poder via RLS: as ações de admin passam pelo '
  'client admin depois de checar esta flag.';


-- ---------------------------------------------------------------------------
-- 3. Chave de API por organização (PD-26)
-- ---------------------------------------------------------------------------
-- Presença da chave = o tenant usa a própria (BYOK). Ausência = usa a da
-- plataforma. Sem flag de modo: a presença é o modo, e é o que o preço observa.
--
-- CIFRADA, NÃO HASH. Hash é via de mão única e serve para senha, que só precisa
-- ser COMPARADA. A API key precisa ser REENVIADA ao Google/OpenAI a cada
-- chamada — de um hash não sai nada e a funcionalidade deixaria de existir.
--
-- `ultimos_4` existe para a UI mostrar `AIza••••4f2c` SEM decifrar nada: nenhuma
-- tela precisa do valor em claro, então nenhuma tela o pede.
--
-- Cifra na aplicação (AES-GCM, segredo em env) e não `vault`/pgsodium: o Vault
-- amarra ao Supabase, e sair do Supabase Cloud está em avaliação. Assim o banco
-- nunca vê a chave em claro — um dump vazado sozinho não entrega nada.

create table if not exists public.organization_provider_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  -- Texto cifrado (AES-256-GCM), com iv e authTag embutidos. Ver src/server/services/crypto.
  chave_cifrada text not null,
  -- Só para exibição censurada. Nunca o bastante para reconstruir a chave.
  ultimos_4 text not null,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_provider_keys_provider_check
    check (provider in ('gemini', 'openai')),
  constraint organization_provider_keys_ultimos_4_check
    check (char_length(ultimos_4) <= 4),
  constraint uq_organization_provider unique (organization_id, provider)
);

create index if not exists idx_organization_provider_keys_org
  on public.organization_provider_keys (organization_id);

drop trigger if exists set_organization_provider_keys_updated_at
  on public.organization_provider_keys;
create trigger set_organization_provider_keys_updated_at
  before update on public.organization_provider_keys
  for each row execute function public.set_updated_at();

alter table public.organization_provider_keys enable row level security;

-- ---------------------------------------------------------------------------
-- 3b. RLS: FAIL-CLOSED. Nenhuma policy, de propósito.
-- ---------------------------------------------------------------------------
-- Sem policy = sem acesso para `anon` e `authenticated`. Nem o dono da chave a
-- lê pelo banco. Quem lê é o servidor, pelo client admin (service_role bypassa
-- RLS), no instante da chamada ao provedor.
--
-- POR QUE NÃO UMA POLICY "membro da org lê a chave da org"
-- Porque um `member` passaria a poder exfiltrar a chave da empresa dele. A
-- fatura é do cliente: aqui um furo de RLS deixa de vazar conteúdo e passa a
-- vazar DINHEIRO. O acesso mais fino que a RLS oferece é por linha, e o que
-- precisamos negar é uma COLUNA — então a RLS é a ferramenta errada, e a
-- resposta certa é não dar acesso nenhum e mediar no servidor.
--
-- A UI recebe `provider` e `ultimos_4` por server action, nunca a linha crua.
-- Mesma decisão do PD-09: sem policy é uma escolha, não esquecimento.
--
-- `tests/rls/chaves-por-tenant.test.ts` trava isto: `authenticated` e `anon`
-- leem ZERO linhas, inclusive o dono da org.

grant all on table public.organization_provider_keys to service_role;
