-- ============================================================================
-- PD-25 — Provisionamento de organização, atômico.
--
-- SEGURO APLICAR ISOLADA (só cria função). Mas faz par com o código: a action
-- que chama isto e o fechamento do /cadastro vão na mesma leva.
--
-- POR QUE UM RPC E NÃO TRÊS INSERTS NO APP
-- Criar uma org são três escritas — a org, o dono e o espaço de conhecimento
-- padrão — e elas têm de ser TUDO OU NADA. Via supabase-js seriam três
-- requisições sem transação: se a 2ª falhar, sobra uma org órfã sem dono. Um
-- plpgsql roda como uma instrução só, então é atômico por natureza.
-- ============================================================================

create or replace function public.create_organization(
  p_nome  text,
  p_owner uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid;
begin
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'nome da organização é obrigatório';
  end if;

  -- Invariante "uma org por usuário" (decisão do PD-25), imposta na origem em
  -- vez de por constraint na tabela: não dá para conferir o dado de produção
  -- daqui (PD-18), e um unique(user_id) que falhasse num backfill abortaria a
  -- migration. Aqui a checagem é barata e cobre o caminho que cria vínculo novo.
  if exists (select 1 from public.organization_members where user_id = p_owner) then
    raise exception 'usuário % já pertence a uma organização', p_owner;
  end if;

  insert into public.organizations (name)
    values (trim(p_nome))
    returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
    values (v_org, p_owner, 'owner');

  -- O `createAgent` (PD-06b) resolve o espaço padrão da org do usuário; toda org
  -- precisa nascer com um, senão criar o primeiro agente quebra.
  insert into public.knowledge_spaces (nome, organization_id, is_default)
    values ('Base de conhecimento', v_org, true);

  return v_org;
end;
$$;

alter function public.create_organization(text, uuid) owner to postgres;

-- Só quem bypassa RLS chama isto. A porta de fato é a server action, que antes
-- confere `profiles.is_platform_admin`; revogar de anon/authenticated garante
-- que nem um cliente autenticado forjando a chamada crie org direto.
revoke all on function public.create_organization(text, uuid) from public;
revoke all on function public.create_organization(text, uuid) from anon;
revoke all on function public.create_organization(text, uuid) from authenticated;
grant execute on function public.create_organization(text, uuid) to service_role;
