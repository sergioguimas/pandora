# Dívida Técnica & Backlog — Pandora

Backlog **rastreável** dos problemas identificados na avaliação do código. Cada item
tem id, severidade, arquivos e ação recomendada. Use os ids (`PD-xx`) em commits e PRs.

**Legenda de severidade**
🔴 Alta — bug funcional ou risco de segurança/dados · 🟠 Média — manutenção/divergência ·
🟡 Baixa — housekeeping/otimização.

---

## Ordem de ataque

1. ~~`PD-01` reescrever README~~ ✅
2. ~~`PD-02` extrair runtime de IA compartilhado~~ ✅
3. ~~`PD-05` corrigir autorização do retry~~ ✅
4. ~~`PD-03` remover código morto / caminho legado~~ ✅
5. ~~`PD-08` refresh de sessão (proxy)~~ ✅
6. ~~`PD-17` + `PD-15` + `PD-06`/`PD-06b` + `PD-16` — multi-tenant + RLS + RPC~~ ✅ *(aplicado e verificado contra o banco em 2026-07-15)*
7. ~~`PD-09` fechar o Storage~~ ✅ *(aplicado e verificado em 2026-07-15)*
8. ~~`PD-07` extrair a orquestração do handler~~ ✅ *(com 10 testes cobrindo a rodada)*
9. ~~`PD-10` + `PD-19` — modo de resposta por agente e o piso de 40 chars~~ ✅
10. ~~`PD-04` cobrir o núcleo com testes + CI~~ ✅ *(81 testes; GitHub Actions)*
11. ~~`PD-18` baseline — migrations voltam a reproduzir produção~~ ✅ *(verificado do zero)*
12. ~~`PD-11` `taskType` nos embeddings · `PD-12` terreno multi-provider · `PD-21` `retryable`~~ ✅
13. ~~`PD-20` re-embeddar a base (27/27)~~ ✅
14. ~~`PD-22` baseline defasado~~ ✅ *(dump novo de prod; baseline regerado e verificado
    sem circularidade em 2026-07-16)*
15. ~~`PD-04b` testes de RLS~~ ✅ *(33 testes + job de CI; mordida provada por mutação)*
16. `PD-23` `scope='space'` impossível de inserir — ✅ **corrigido no código**;
    ⏳ **falta aplicar em produção** (`20260717000000`) e reverificar com um dump novo
17. `PD-25` provisionamento de organização + `PD-26` chave por tenant ← **em andamento**
    (🔴 — schema e testes prontos; falta o código e a UI)
18. `PD-24` publication do Realtime ausente do baseline (🔴 — bloqueia ambiente novo)

---

## 🔴 Alta

### PD-29 — Conta nova nasceu `is_platform_admin = true` em produção 🔴
Descoberto testando o PD-25/27: o dono de uma org recém-criada tinha acesso ao painel de
admin de plataforma (criar/gerir organizações) — escalonamento de privilégio.

**O código está correto** (verificado): a migration cria a coluna com `default false`, o
trigger `handle_new_user` não toca nela, e nada no app grava `true` (só o `update` manual
de bootstrap). Logo, o **default da coluna em produção** não deve estar `false` — provável
resíduo da aplicação manual e fora de ordem das migrations (`add column if not exists` não
corrige o default de uma coluna que já existia).

**Ação** (só no banco de prod, o código não muda):
```sql
select column_default from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name='is_platform_admin';
-- se != false:
alter table public.profiles alter column is_platform_admin set default false;
-- e zerar os dados errados, mantendo só o admin real:
update public.profiles set is_platform_admin = false where id <> '<uuid-do-admin>';
```
Corrigido pontualmente no teste (update escopado). **Falta confirmar o default e travar**,
para contas futuras não reincidirem. Reavaliar se um dump novo de prod deve regerar o
baseline (o default divergente indica drift entre `migrations/` e prod).



### PD-25 — Cadastro aberto + todo usuário na mesma organização 🔴

> **Estado (2026-07-17)**: schema, servidor e **UI de admin e membros prontos**. Feito:
> RPC `create_organization` (migration `20260717020000`, atômico), `organizations-repository`
> (criar org com dono, convidar, remover, listar, `isPlatformAdmin`), reescrita do
> `getOrganizationIdForUser` (sem o funil para a Base Geral), **`/cadastro` removido**, e as
> telas `/admin` (só plataforma: cria org + convida dono), `/configuracoes/membros`
> (owner/admin: convida/remove) e a nav entre elas. 66 testes de RLS (5 do RPC).
>
> 🔑 **Dois passos de DADO em produção antes de você usar o painel** (são dado, não
> migration — rode no SQL Editor com seu uuid):
> 1. `update public.profiles set is_platform_admin = true where id = '<seu-uuid>';`
>    — sem isto, `/admin` te redireciona.
> 2. Confirme que você é `owner` da sua org (Base Geral), senão `/configuracoes/*` te barra:
>    `select role from public.organization_members where user_id = '<seu-uuid>';`
>    Se vier `member`, `update ... set role='owner' where user_id='<seu-uuid>'`.
>
> ⚠️ **A migration `20260717010000` foi aplicada em produção fora de ordem** (via SQL
> Editor, 2026-07-17), antes do código. Não quebrou nada — o `ensureUserInDefaultOrganization`
> no código ainda funilava para a Base Geral, então o comportamento não mudou e o buraco
> **continuou aberto** até este código. Pendências desse descompasso: (a) confirmar se o
> `20260717000000` (PD-23) também está em prod; (b) aplicar `020000`; (c) registrar as três
> como aplicadas se voltar a usar `db push`.
>
> **Follow-up do orgless user — resolvido (2026-07-17)**: o guard foi centralizado no
> **layout do dashboard** (`getOrganizationIdForUserOrNull` → tela `NoOrganization` com
> saída), que protege TODAS as páginas de uma vez — chat, agentes, config. Isso cobre o
> caminho de UI dos 3 chamadores (a página de chat chama `createConversationForAgent`, a de
> agentes chama `createAgent`; nenhuma renderiza sem org). A rota `api/conversations` fica
> fora do layout e ganhou guarda própria (**403** claro em vez de 500). Os dois server
> actions só são alcançáveis por páginas já protegidas; um POST direto de um usuário sem org
> ainda lança o erro cru (benigno, sem risco de dado) — aceitável.

Descoberto ao responder "já dá para uma empresa usar isso?". O fluxo era:

**qualquer pessoa** → `/cadastro` (público) → conta criada → trigger
`handle_new_user_default_organization` insere na org `11111111-…` ("Base Geral") →
`can_read_org` aprova → **lê todos os agentes, `prompt_base` incluso, e todo o
conhecimento.**

É o `PD-17` outra vez, trocando *"basta a URL do projeto"* por *"basta um cadastro
grátis"*. **A RLS nunca esteve errada** — os 33 testes do `PD-04b` provam que ela isola
organizações. O problema é que havia **uma** organização, e o formulário de cadastro era a
porta dela. Parede perfeita em volta de uma sala com um inquilino só.

Uma armadilha fechava até a saída manual: `getOrganizationIdForUser` fazia
`order by created_at asc limit 1` — a associação **mais antiga**. Como o trigger insere no
instante do cadastro, ela vence sempre. Criar uma org à mão e adicionar o usuário **não
adiantaria**: ele continuaria resolvendo para a Base Geral.

**Decisões (2026-07-17)**: convite apenas (o `/cadastro` público sai); **uma org por
usuário** (é o que o código já assume; erro alto se houver zero ou mais de uma — sem
constraint no banco, porque não dá para conferir o dado de produção daqui); Base Geral vira
a organização admin/teste do dono.

**Agente 0 / Oráculo: nada a fazer.** Confirmado em produção: estão em `Pandora System`
com `is_system = true`. O `can_read_org()` (= `is_system_org OR is_org_member`) já os torna
visíveis a toda org sem clonagem, e o `is_org_member()` os mantém read-only. Está travado
por `agentes-universais.test.ts`.

**O admin de plataforma é uma flag, não um membro da org do sistema.** Seria o caminho
curto e quebraria os universais: o read-only deles vem de a org do sistema **não ter
membros**. Por isso `profiles.is_platform_admin`, e as ações de admin passam pelo client
admin depois de checar a flag — porta explícita **ao lado** da parede, não um buraco nela.
Um teste garante que a flag não dá poder algum via RLS.

**Descoberta de caminho**: um usuário **sem organização** ainda lê os agentes universais —
`is_system_org()` não olha o usuário. Está correto (eles são públicos para autenticados por
definição), mas não era o que eu esperava, e agora está escrito num teste.

**Falta**: `createOrganization` (org + membro `owner` + `knowledge_space` padrão numa
transação), convite via `inviteUserByEmail`, reescrita do `getOrganizationIdForUser`,
fechar o `/cadastro`, UI de membros e painel de admin.

### PD-26 — Chave de API por tenant 🔴

> **Estado (2026-07-17)**: **completo, ponta a ponta.** A chave do tenant já é usada na
> geração (`stream` e `retry`). Feito: `provider-key-cipher` (AES-256-GCM, 8 testes puros),
> `provider-keys-repository` (grava cifrado + lê/decifra para o motor), `provider-keys-actions`
> (autoriza `owner`/`admin`), página `/configuracoes/chaves` com aviso de sensibilidade e
> valor censurado (`••••4f2c`), e a injeção da chave no `streamModel`.
>
> **Como a chave chega ao modelo**: resolvida UMA vez por request, pela organização **da
> conversa** (o tenant que usa é quem paga — um agente universal numa conversa do tenant
> roda com a chave do tenant). O orquestrador embrulha `deps.streamModel` para injetar a
> chave por `provider`; o retry resolve e passa direto. `getGeminiClient(apiKey?)` usa a do
> tenant quando vem, a da plataforma quando não. Presença = BYOK, ausência = plataforma —
> por provider (chave de openai não vale para agente gemini). 3 testes cobrem a fiação.
>
> **Decisão de robustez**: chave que não decifra (ex.: `PROVIDER_KEY_SECRET` rotacionado) é
> **ignorada com log**, caindo na chave da plataforma — o chat não quebra; perde-se o BYOK
> daquela chave até ser regravada.
>
> **Detalhe de import**: `orchestrate-conversation.ts` é importado pelos testes (vitest,
> node), e `provider-keys-repository` tem `import "server-only"` (lança fora do Next). Por
> isso o orquestrador importa só o **tipo** estaticamente e a função real por **import
> dinâmico** no `defaultDeps` — que os testes nunca exercitam.
>
> ⚙️ **Nova env obrigatória**: `PROVIDER_KEY_SECRET` (string longa e aleatória). O módulo
> de cifra **falha alto** sem ela — de propósito, um default seria o mesmo que texto puro.
> Precisa estar no ambiente do servidor de deploy **e** no job de build do CI.

Modelo de preço: o cliente usa a chave dele (mais barato) ou a da plataforma (mais caro).
`organization_provider_keys (organization_id, provider, chave_cifrada, ultimos_4)`, única
por par. **Presença da chave = BYOK; ausência = chave da plataforma.** Sem flag de modo — a
presença é o modo. Respeita a porta multi-provider do `PD-12`.

**Cifra, não hash.** O pedido original era "guardar como hash, igual senha". Não funciona:
hash é via de mão única e serve para senha, que só precisa ser **comparada**. A API key
precisa ser **reenviada** ao Google/OpenAI a cada chamada — de um hash não sai nada, e a
funcionalidade deixaria de existir. A experiência pedida ("após incluir, nem o dono vê")
se cumpre com cifra + **nenhum caminho de leitura**: a UI mostra `AIza••••4f2c` a partir de
`ultimos_4`, sem decifrar nada. Ressalva honesta e registrada: quem tiver o banco **e** o
segredo da aplicação recupera a chave — é inerente a qualquer sistema que chame API de
terceiro em nome do cliente.

**Cifra na aplicação (AES-GCM, segredo em env), não `vault`/pgsodium**: o Vault amarra ao
Supabase, e sair do Cloud está em avaliação (ver `PD-24`).

**RLS fail-closed: zero policies, de propósito.** Nem o dono lê a própria chave pelo banco.
O acesso mais fino que a RLS oferece é por **linha**, e o que precisa ser negado é uma
**coluna** — RLS é a ferramenta errada. A resposta certa é não dar acesso nenhum e mediar
no servidor. Mesma decisão do `PD-09`.

> **A régua aqui é outra**: no resto da suíte, um furo vaza **conteúdo**. Nesta tabela,
> vaza **dinheiro** — a chave é crédito e a fatura é do cliente.

### PD-24 — A publication do Realtime não está no baseline 🔴
A migration arquivada `20260425004924_enable_realtime_for_messages` fazia
`alter publication supabase_realtime add table public.messages`. O baseline **não tem
isso** — e não por descuido: um `pg_dump --schema=public` **não inclui publications**, que
são objetos do banco, não do schema.

**Consequência**: um banco novo criado a partir de `migrations/` nasce com o Realtime
**desligado** para `messages`, e o chat para de atualizar ao vivo — em silêncio, sem erro.
Produção está bem (a publication foi aplicada em abril). O risco é para qualquer ambiente
**novo**: auto-hospedado, staging, ou um projeto Supabase separado.

**O `scripts/verify-baseline.mjs` tem o mesmo ponto cego** — ele compara
`--schema=public`. Conferir publications faz parte do conserto.

**Ação**: migration que adiciona a tabela à publication (idempotente), e estender o
verificador para comparar publications. Confirmar antes em produção:
```sql
select * from pg_publication_tables where pubname = 'supabase_realtime';
```

> **Lição**: "o dump reproduz o banco" vale para o que o dump **cobre**. Publications,
> papéis e extensões vivem fora de um dump de schema — e o `PD-22` só olhou dentro dele.

### PD-23 — `scope='space'` é impossível de inserir, e a opção está na UI 🔴

> **Estado (2026-07-17)**: corrigido no código pela migration
> [`20260717000000_fix_knowledge_scope_constraint.sql`](../supabase/migrations/20260717000000_fix_knowledge_scope_constraint.sql),
> com 11 testes cobrindo os três escopos (`tests/rls/escopo-conhecimento.test.ts`).
> **Continua 🔴 aberto até ser aplicado em produção** — o item não é o arquivo, é o
> banco. Passos no fim desta seção.

Descoberto ao ler o schema para as fixtures do `PD-04b`. A constraint em
`knowledge_documents` **e** `knowledge_chunks`:

```sql
CHECK ( (scope = 'global'       AND conversation_id IS NULL)
     OR (scope = 'conversation' AND conversation_id IS NOT NULL) )
```

`scope='space'` não satisfaz **nenhum** dos dois ramos — com ou sem
`conversation_id`. Toda inserção é rejeitada.

**Provado**, não deduzido — num banco limpo com o baseline aplicado:

| scope | resultado |
|---|---|
| `global` | inseriu |
| `space` | **rejeitado**: `violates check constraint "knowledge_documents_scope_conversation_check"` |
| `conversation` (sem `conversation_id`) | rejeitado — correto, esse é o objetivo da constraint |

**Está exposto ao usuário**: `knowledge-ingest-form.tsx` tem
`<option value="space">Base do contexto/produto</option>`, e
`ingest-agent-knowledge.ts` aceita `scope: "space"` e insere direto. Escolher
essa opção na interface bate na constraint. *(A cadeia de código foi lida; falta
dirigir a UI ponta a ponta para ver a mensagem que o usuário recebe.)*

**Produção tem zero linhas `scope='space'`** — isso é prova, não estimativa: a
constraint está **VALID** no dump (sem `NOT VALID`), e o Postgres só aceita criar
uma CHECK válida se **todas** as linhas existentes a satisfizerem.

**Isto reescreve o `PD-15`.** Ele diz que conhecimento de espaço *"era ingerido,
chunkado, embeddado e nunca usado"* e unificou o `match_agent_knowledge` para
recuperá-lo — a função consulta `kc.scope = 'space'` até hoje. Mas o dado nunca
existiu: a escrita já estava barrada pela constraint. O `PD-15` consertou a
leitura de algo que não tem como ser escrito, e o ramo `space` do RAG é código
morto na prática.

**A causa exata** (arqueologia nas migrations arquivadas): duas constraints governam o
`scope`. A migration original `20260418xxxxxx_add_knowledge_base` criou **as duas** quando
só existiam dois escopos. Depois, `20260425211116_update_match_agent_knowledge_for_spaces`
adicionou o `space` — atualizou o enum (`..._scope_check`) e o RPC, e **nunca tocou na
irmã** (`..._scope_conversation_check`), que também enumera escopos. O `space` nasceu morto
naquele commit, em abril.

**A intenção era inequívoca.** O autor construiu a tabela `knowledge_spaces`, a coluna
`agents.knowledge_space_id`, o ramo do RPC, o enum, a UI com seletor de espaço e a
validação no server action. Verificado também que o caminho de escrita está **completo**:
`insertKnowledgeChunks` propaga `knowledge_space_id` para os chunks, e `matchKnowledge`
passa o espaço do agente ao RPC. Faltava **uma linha**.

**Decisão de produto (2026-07-17): consertar, não remover.** `space` é o **único**
mecanismo de compartilhar conhecimento entre agentes — o `global` filtra por `agent_id`,
então cada agente é um silo. E como o `PD-06b` faz o `createAgent` apontar todo agente novo
para o espaço padrão da org, `space` significa na prática **"base de conhecimento da
organização"**. Removê-lo apagaria essa capacidade e deixaria `knowledge_spaces` e
`agents.knowledge_space_id` como decoração.

**A correção** — a constraint volta a dizer a intenção em vez de listar escopos:

```sql
check ((scope = 'conversation') = (conversation_id is not null))
```

Um quarto escopo amanhã não a quebra. Enumerar valores foi exatamente o que a fez apodrecer
— e o `scope_check` ao lado já enumera, que é o papel dele. A migration soma o invariante
que faltava (`space` exige `knowledge_space_id`): sem espaço, o chunk é ingerido,
embeddado, custa chamada de embedding e o RPC nunca o acha — a doença do `PD-15`, agora
barrada pelo banco. É implicação e não equivalência, então não pode abortar por linha
antiga.

**Cobertura**: 11 testes em `tests/rls/escopo-conhecimento.test.ts` — os três escopos
inserem, os dois invariantes rejeitam, e as constraints gêmeas de `knowledge_chunks` são
testadas junto (o `PD-23` nasceu de uma divergir da outra; testar só uma repetiria o erro).
**Mordida provada**: removendo a migration, falham exatamente os 4 testes de `space` e
nenhum outro.

**Falta aplicar em produção** — o item só fecha aí:
1. `npx supabase db push`. Se o CLI não alcançar o projeto (403, ver `PD-18`), rode o SQL
   da migration direto no pgAdmin — ela é **re-executável** (todo `add constraint` tem um
   `drop ... if exists` antes), o que foi verificado aplicando duas vezes num banco limpo.
   Nesse caso, registre: `npx supabase migration repair --status applied 20260717000000`.
2. Dump novo do schema `public` (mesma receita do `PD-22`: botão direito **no nó `public`**).
3. `node scripts/verify-baseline.mjs` → tem de dizer **IDÊNTICOS**. Enquanto produção
   estiver atrás, ele acusa a divergência e diz qual é.

> **Lição**: uma constraint e um enum discordando não fazem barulho até alguém tentar a
> combinação proibida. O `PD-15` inspecionou o RPC e o app, mas não a constraint — e
> concluiu sobre o **dado** sem checar se o dado podia existir.

> **Lição 2**: ao afrouxar uma constraint para caber um valor novo, procure **todas** as
> que falam daquela coluna. Aqui eram duas, com nomes parecidos, criadas no mesmo arquivo.

---

## 🟠 Média

> Nenhum item 🟠 em aberto.

---

## 🟡 Baixa

### PD-14 — README ↔ código (manter sincronizado)
- **Ação**: `PD-01` corrigiu o descompasso principal. Manter a regra: **toda mudança
  de arquitetura/stack atualiza `README.md` e o doc relevante em `docs/`** no mesmo PR.

---

---

## ✅ Concluídos

### PD-04b — RLS coberta por testes 🟠
De **zero** verificação automatizada da fronteira de segurança para **33 testes** em
`tests/rls/`, rodando em ~4s contra o schema real de produção.

**Abordagem**: vitest + `pg` falando SQL direto — não pgTAP, não `supabase-js`. Cada teste
roda em transação e termina em rollback:

```sql
begin;
select set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
set local role authenticated;
-- ...
rollback;
```

Isso funciona porque `auth.uid()` é, no dump real, apenas
`current_setting('request.jwt.claims')::jsonb ->> 'sub'`. **O "JWT forjado" é um
`set_config`** — não há nada para assinar e o PostgREST não participa da decisão de
acesso. Ele só escolhe o papel e preenche esse setting; quem decide é a policy, e é ela
que os testes exercitam. Era o que dispensava subir a stack (e, com ela, o `supabase start`).

| Arquivo | Cobre |
|---|---|
| `isolamento-org.test.ts` | agentes, conhecimento e conversas não cruzam a fronteira da org; `prompt_base` e conteúdo de chunk não vazam; insert/update/delete na org alheia falham |
| `participantes.test.ts` | Bob (participante, **não dono**) lê e escreve; Carol (mesma org, **fora da conversa**) não |
| `agentes-universais.test.ts` | o universal aparece para as duas orgs e é read-only; ninguém injeta conhecimento nele |
| `policies-abertas.test.ts` | zero `USING (true)`, RLS habilitada em toda tabela, `anon` não lê nada |

**Carol é a peça de projeto que importa**: sem alguém da mesma org e fora da conversa, uma
policy que filtrasse só por organização passaria como se filtrasse por participante. Ela é
o que dá sentido ao teste do `PD-05`.

**Provado que os testes mordem** — três mutações no baseline, cada uma revertida depois:

| Mutação | Quem falhou |
|---|---|
| Policy `USING (true)` para `anon` (PD-17/PD-22) | 2 testes: a asserção de `pg_policies` e `anon` lendo os 3 agentes |
| Dropar as policies de participante (PD-05) | 2 testes: exatamente os do Bob |
| `can_read_org()` retornando `true` (PD-06) | 5 testes de isolamento — inclusive o vazamento literal (`content: 'segredo da org A'` para o Dan) |

A terceira mutação é a que prova mais: ela quebra o isolamento **sem** criar policy aberta,
e o teste de policy aberta corretamente **não** a pegou. Cada teste carrega o próprio peso,
em vez de um só cobrir a aparência de todos.

**A mutação também achou um defeito no guard**, e o guard foi consertado: ele fixava
"exatamente 43 policies", então qualquer mudança de schema abortava a suíte com um erro
sem relação com RLS. Agora é **exato para o que a suíte possui** (as fixtures) e **frouxo
para o que ela não possui** (o schema) — fidelidade de schema tem dono, e é o
`verify-baseline.mjs`. Dois donos para a mesma asserção é dívida.

**Guard contra aprovação vazia**: metade desta suíte afirma AUSÊNCIA ("`anon` não lê nada",
"nenhuma policy é aberta"). Num banco vazio, tudo isso passa — e passa por vergonha: não há
o que ler nem policy para ser aberta. O `global-setup` se recusa a rodar se o cenário não
estiver montado. É o mesmo vício que produziu o `PD-22`.

**CI**: job `rls` separado no `ci.yml`, com `services: pgvector/pgvector:pg17`. Fora do
`npm test`, que segue em ~4s sem Docker — é o loop de desenvolvimento e não se sacrifica.
O harness usa o service container quando `RLS_DATABASE_URL` está definida e sobe um
container próprio quando não está; os dois caminhos foram exercitados.

> **Lição**: teste que nunca foi visto falhar não é verificação, é decoração. As três
> mutações custaram minutos e mudaram o que a suíte significa — uma delas consertou o
> guard, e nenhuma teria sido escrita se "33 verdes" fosse aceito como prova.

### PD-22 — O baseline do `PD-18` não reproduzia produção 🔴
Descoberto ao planejar o `PD-04b`. O baseline saíra de um dump
(`20260715_schema_public.sql`, `-- Started on 2026-07-15 09:12:27`) **anterior** às
migrations `150000` (`PD-09`) e `160000` (`PD-10`) — apesar de o cabeçalho afirmar
*"capturado depois de aplicados PD-06/09/10/15/16/17"*.

**A prova não precisou de banco**: o app lê `agents.modo_resposta` em ~10 pontos e
produção tem a coluna (o `PD-10` está em uso pela UI). O baseline não a criava. Logo, um
banco levantado só de `migrations/` **não rodava o app**.

**Por que o `PD-18` não pegou — a verificação era circular.** A tabela "prod 43 / local
43 ✓" comparava o banco gerado *a partir do dump* com *o próprio dump*: verde por
construção. O método era bom; a **entrada** é que estava velha.

**Resolução** (2026-07-16):
1. Dump novo de produção (`20260716_schema_public.sql` + `_auth.sql`), com `OWNER` e
   `GRANT` preservados — os 32 `GRANT ... TO anon` são a superfície do `PD-17` e não
   podem sumir do baseline.
2. Baseline **regerado por script** ([`scripts/build-baseline.mjs`](../scripts/build-baseline.mjs)),
   não editado à mão. Auto-teste: rodando no dump **velho**, o script reproduz o baseline
   antigo com zero diferença em linhas de código — prova de que a transformação é a mesma.
3. Verificado por [`scripts/verify-baseline.mjs`](../scripts/verify-baseline.mjs), **sem
   circularidade**: dois bancos do mesmo andaime, `db_baseline` ← `migrations/` e
   `db_prod` ← dump de produção, dumpados pelo **mesmo** `pg_dump` e comparados.

```
✅ IDÊNTICOS — o baseline reproduz produção.
   13 tabelas · 43 policies · 12 funções · 37 índices · 2 triggers em auth.users
   policies abertas (USING (true)): 0
```

**O drift era exatamente o previsto e nada mais.** O diff `public` entre os dois dumps de
prod deu 30 linhas: a troca 3-por-3 de policies do `PD-09` (sai a aberta
`agent_knowledge_files_select_authenticated` e as duas `message_attachments` da Era 1) e a
coluna `modo_resposta` + `CHECK` do `PD-10`. Funções, tabelas, índices e triggers:
idênticos. O `auth` não mudou desde 15/07.

**Limpeza junto**: os dumps de 15/07 saíram do repositório (`git rm` — seguem no
histórico). O defasado `20260715_schema_public.sql` era literalmente a mina que causou
este item; `20260715_schema_auth.sql` era byte a byte igual ao de 16/07; e
`20260715_schema_pgdump.sql` era uma duplicata mais velha de `public`. Fica **um dump de
cada vez** em `supabase/schema/`, e o `build-baseline.mjs` agora **recusa rodar** se achar
mais de um `*_schema_public.sql` — foi assim que o baseline saiu do arquivo errado com o
certo ao lado. Os dumps de **dados** (`*_data_*.sql`, com `auth.users` e conversas) seguem
ignorados pelo `.gitignore` e nunca foram rastreados — conferido.

**Achados de caminho:**
- **Os dumps de `public` e `auth` são circulares entre si**: `public` referencia
  `auth.users` por FK, e `auth` referencia `public` de volta em exatamente duas linhas —
  os triggers `on_auth_user_created*`. Nenhuma ordem de aplicação crua funciona. O footer
  do baseline existe justamente porque **o baseline é o dono** desses triggers.
- **Contagem é verificação fraca.** `43 = 43` bate mesmo se o *corpo* de uma policy mudar
  — e o corpo é onde mora a fronteira de segurança. Por isso o verificador compara texto,
  dumpando os dois lados com o mesmo binário para eliminar ruído de formato.

> **Lição**: "verificado" só vale se a fonte da verdade for **independente** do artefato
> verificado. Comparar o gerado com aquilo de que ele foi gerado sempre dá verde.

> **Lição 2**: o `PD-04b` é o teste do `PD-18`. Uma asserção de `pg_policies` sem
> `qual = 'true'` teria pego isto no dia seguinte.

### PD-01 — README alinhado ao código
README reescrito para refletir a stack real (Next 16 + Gemini; não Fastify/OpenAI/Vite)
e criada a pasta `docs/`.

### PD-05 — Retry ignorava o modelo de participantes 🔴
`src/app/api/chat/retry/route.ts` exigia ser o **dono** (`conversations.user_id =
auth.uid()`), resquício da Era 1 — um participante convidado conseguia conversar mas
levava 404 no "Tentar novamente". O filtro por `user_id` foi removido: o acesso agora é
validado pela **RLS** (`is_conversation_participant`), igual ao `stream`.

### PD-03 — Código morto e caminho legado concorrente 🟠
Havia um segundo motor de resposta (não-streaming, single-agent, sem RAG) convivendo
com o `stream`. Removidos:
- `sendMessage` em `server/actions/chat-actions.ts` (sem nenhum chamador)
- `server/services/ai/generate-agent-response.ts`
- `server/services/ai/providers/gemini-provider.ts`
- `server/services/mock-agent-response.ts`
- `types/ai.ts` (ficou órfão)
- `planAgentExecution` + `extractJsonObject` no `stream/route.ts` (estavam desativados
  com `void planAgentExecution`)

Resultado: **um único motor de resposta**, sem referências mortas.

### PD-02 — Duplicação do runtime de IA entre `stream` e `retry` 🟠
`classifyModelError`, `getErrorStatus`, `withRetryBeforeStreaming`, `withTimeout`,
`sleep`, `sse`, `sanitizeJson`, `saveMessage`, `normalizeText`, `removeActionJson`,
`isProbablyIncompleteAnswer`, `ModelGenerationError` e o tipo `Message` estavam
copiados nos dois handlers — e já divergiam (`maxOutputTokens` 2000 vs 1800).

Extraídos para [`src/server/services/ai/runtime.ts`](../src/server/services/ai/runtime.ts),
com constantes compartilhadas (`MODEL_MAX_OUTPUT_TOKENS` — depois substituída pelos
presets do `PD-10` —, `MODEL_TIMEOUT_MS`,
`RETRY_DELAYS_MS`, `MODEL_MAX_RETRIES`). Ambos os handlers consomem o módulo.

| Arquivo | Antes | Depois |
|---|---|---|
| `api/chat/stream/route.ts` | 1224 linhas | 939 |
| `api/chat/retry/route.ts` | 697 linhas | 489 |

**Regra a partir daqui:** comportamento de geração muda no `runtime.ts`, não nos handlers.

### PD-08 — Sessão não era renovada 🟠
Não havia refresh de token: o padrão `@supabase/ssr` exige interceptar cada request,
senão a sessão expira em navegação longa e o usuário cai no `/login`.

Criado [`src/proxy.ts`](../src/proxy.ts), que só renova o cookie — **não decide
acesso** (isso segue no layout do dashboard + RLS).

> ⚠️ **Armadilha do Next 16**: a convenção `middleware.ts` foi **renomeada para
> `proxy.ts`** (função exportada `proxy`). Com o nome antigo o Next emite apenas um
> aviso de deprecação, mas o app passa a responder **`200` com corpo vazio** — as
> requisições nem chegam às rotas. Se algo assim reaparecer, verifique o nome do arquivo.

### PD-17 — 🚨 RLS do banco estava aberta, inclusive para `anon` 🔴
Descoberto **no dump real, não nas migrations** — que descreviam policies escopadas
que não eram as vigentes.

- `agents_select_anon_temp` / `agent_knowledge_files_select_anon_temp` davam
  `SELECT ... TO anon USING (true)`. Como `anon` é o papel da chave pública (que vai
  no bundle do browser), **qualquer pessoa com a URL do projeto lia todos os agentes,
  incluindo `prompt_base`**.
- `knowledge_documents`/`chunks`/`spaces` tinham policies `USING (true)` convivendo com
  as escopadas. Policies permissivas se somam com **`OR`** → a aberta vencia e anulava
  todo o escopo.

Fechado em duas migrations (`20260715120000` e `20260715130000`). Verificado no dump
pós-aplicação: **zero** policies abertas nessas tabelas, nenhuma `_anon_temp`.

> **Lição**: uma policy permissiva `USING (true)` esquecida **anula** todas as outras
> da mesma tabela. Ao endurecer RLS, dropar por nome e conferir no `pg_policies`.

### PD-06 / PD-06b — Multi-tenant real + agentes universais 🔴
`organization_id NOT NULL` em `agents`, `knowledge_spaces`, `knowledge_documents` e
`knowledge_chunks`, com backfill por procedência (conversa > space > agente).

Agentes universais resolvidos com **organização do sistema** (`00000000-…-0000`,
`organizations.is_system = true`) em vez de flag no agente:
- leitura via `can_read_org()` = org do sistema **ou** membro da org → `Agente 0` e
  `Oráculo` aparecem para toda org, **sem clonagem**;
- escrita via `is_org_member()` → como a org do sistema não tem membros, os universais
  são read-only no app e ninguém injeta conhecimento `global` neles.

Também: `slug` passou a ser único **por org** (`uq_agents_org_slug`); `createAgent`
resolve o space padrão da org do usuário em vez do UUID fixo da Base Geral.

### PD-15 — `match_agent_knowledge` duplicada: `space` nunca era recuperado 🔴
Havia **3 overloads** (4, 5 e 6 args). O app chamava a de 5, que não filtrava
`scope='space'` → conhecimento de espaço era ingerido, chunkado, embeddado e **nunca
usado**; o fallback textual falhava pelo mesmo motivo. A de 6 args ainda tinha bug de
precedência (o threshold ligava só ao último `OR`) e perdera o guard de embedding nulo.

Unificado em **uma** assinatura canônica (6 args, parênteses explícitos, guard de nulo),
com `matchKnowledge` passando o `knowledge_space_id` do agente e o fallback cobrindo os
três escopos.

> **Lição**: `create or replace function` com assinatura diferente **cria overload, não
> substitui**. Ao mudar assinatura, `drop` explícito da antiga.

### PD-09 — Storage aberto para um recurso que não existe 🟠
As 6 policies de `storage.objects` só checavam `bucket_id` → qualquer autenticado
subia/lia/apagava **qualquer** objeto dos dois buckets, sem teto de tamanho nem de MIME
(`file_size_limit` e `allowed_mime_types` eram `null`).

O diagnóstico virou a chave: **a funcionalidade de arquivos nunca foi construída** —
nenhuma referência a `.storage`/`storage_path` no código, `message_attachments` e
`agent_knowledge_files` com 0 linhas, `storage.objects` com 0 objetos. Era superfície de
abuso (upload arbitrário) para nada.

Resolvido com **fail-closed** em `20260715150000`: policies removidas (sem policy = sem
acesso), teto de 25 MB nos buckets como rede de segurança, `agent_knowledge_files`
escopada por org (tinha `USING (true)`) e `message_attachments` alinhada ao modelo de
participantes (era da Era 1, por dono — mesmo resquício do `PD-05`).

A convenção de path e o checklist para quando o upload nascer estão em
`docs/BANCO-DE-DADOS.md`.

> **Lição**: antes de "consertar" a policy de um recurso, confirme se o recurso existe.
> Aqui o certo não era escopar — era fechar.

### PD-07 — Orquestração extraída do handler HTTP 🟠
O `stream/route.ts` tinha ~940 linhas misturando HTTP, auth, RAG, cadeia de agentes,
síntese, persistência e erro. Só rodava dentro de uma request com Gemini real — não
havia como testar nada.

A orquestração virou
[`services/ai/orchestrate-conversation.ts`](../src/server/services/ai/orchestrate-conversation.ts),
um **async generator que emite eventos** em vez de escrever num `ReadableStream`. O
handler ficou com **76 linhas**: autentica, persiste a mensagem do usuário e serializa
os eventos como SSE.

Dependências (banco, embeddings, Gemini) entram por um objeto `deps` com
implementação padrão — testes injetam fakes.

| Arquivo | Antes | Depois |
|---|---|---|
| `api/chat/stream/route.ts` | 939 | **76** |
| `services/ai/orchestrate-conversation.ts` | — | 852 |

**Detalhe estrutural**: os tokens eram emitidos de dentro de uma IIFE aninhada dentro de
`withTimeout` — e não se pode `yield` de dentro de função aninhada. Resolvido com
`streamAnswer`, um generator que corre cada passo da iteração contra um *deadline*.
É equivalente ao `withTimeout` anterior (mesmo teto de 75s, mesma mensagem, e estouro
segue descartando o parcial), só que permite emitir token a token.

**Aceite provado**: 10 testes cobrem agente único, cadeia + síntese, fallback de agente,
503 retryable, stream cortado, falha do RAG e truncamento — em ~3s, sem HTTP, sem banco
e sem Gemini. Foi o que validou que o refactor preservou o comportamento.

### PD-10 — Tamanho da resposta configurável por agente 🟡
`maxOutputTokens` era uma constante global (2000): agentes que respondem com tabelas
longas truncavam no meio, e a única saída era editar código e fazer deploy.

Virou um **preset nomeado por agente** (`agents.modo_resposta`), editável em
**Agentes → Geral → Tamanho da resposta**:

| Modo | tokens | Uso |
|---|---|---|
| `leve` | 800 | respostas diretas, menor custo |
| `medio` | 2000 | **padrão** — idêntico ao teto anterior |
| `alto` | 8000 | tabelas e comparativos longos |

`medio = 2000` de propósito: **nada muda até o agente optar** por outro modo. A síntese
segue o modo do primeiro agente da cadeia (mesma regra do modelo). Valor
ausente/desconhecido cai no padrão.

Os presets vivem em [`src/lib/response-mode.ts`](../src/lib/response-mode.ts) — módulo
puro — e não no `runtime.ts`, porque o editor de agentes é **client component** e o
runtime importa o client Supabase de servidor (`next/headers`); importá-lo do cliente
quebra o build. O runtime reexporta para os consumidores de servidor.

> **Lição**: `next build` pega esse tipo de erro; `tsc --noEmit` não.

### PD-19 — `isProbablyIncompleteAnswer` acusava toda resposta curta 🟡
`if (trimmed.length < 40) return true;` marcava **qualquer** resposta curta como
truncada. "Sim, o plano custa R$ 100." (26 chars) virava `status: "partial"`, disparava
`agent_warning` e mostrava "tentar novamente" — como se o agente tivesse falhado.

O piso agora só vale quando a resposta **também** não termina de forma conclusiva
(`ENDS_CONCLUSIVELY`), o que preserva a detecção real ("O plano Essencial" — cortado,
sem pontuação) sem punir respostas curtas legítimas.

> **Como apareceu**: escrevendo os testes do `PD-07`. O fake de resposta tinha 19 chars
> e a rodada emitia um `agent_warning` inesperado — o teste estava "errado" pelo motivo
> certo. Bug que existia em produção e ninguém tinha isolado.

### PD-04 — Cobertura de testes + CI 🟡
De **zero** testes para **81**, rodando em ~4s sem HTTP, sem banco e sem Gemini.

| Arquivo | Cobre |
|---|---|
| `orchestrate-conversation.test.ts` | rodada completa: cadeia, síntese, `modo_resposta`, falha do provedor, RAG fora do ar |
| `orchestration-helpers.test.ts` | filtro de histórico (isolamento entre agentes), `tryParseAgentAction`, `findTargetAgent` |
| `runtime.test.ts` | `classifyModelError`, `isProbablyIncompleteAnswer`, `withRetryBeforeStreaming`, `withTimeout`, `removeActionJson` |
| `knowledge-repository.test.ts` | fallback textual do RAG (`extractSearchTerms`, `scoreKeywordMatch`) |
| `chunk-text.test.ts` | fatiamento, overlap, regressão de laço infinito |
| `response-mode.test.ts` | presets e fallback para o padrão |

**CI** em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): lint → testes →
type-check → build, em push na `main` e em PR. Node 22 (mesma major do Dockerfile).

O passo de **build** é proposital: é o único que pega import de módulo server-only em
client component (`tsc --noEmit` passa nesse caso — foi o que quase aconteceu no
`PD-10`). Usa variáveis fictícias — o build não conecta em nada, mas os módulos são
avaliados e o `admin.ts` constrói o client no import. **Validado**: build roda com
`.env.local` ausente, como no CI.

**Comportamentos que os testes documentaram** (eram desconhecidos):
- `extractSearchTerms("R$100")` → `"r100"`, não `"100"` — o `$` some e o `r` fica colado.
  Só casa se a base escrever exatamente `R$100`; com espaço (`R$ 100`), o `100` tem
  3 chars e é descartado.
- Siglas de 3 letras (`NFe`, `ISS`, `CPF`) não sobrevivem ao piso de 4 chars do fallback.

Nenhum dos dois é bug fatal — o caminho semântico continua funcionando —, mas estão
travados por teste para não mudarem sem querer.

### PD-18 — Baseline: as migrations voltam a reproduzir produção 🟠
As migrations **não replayavam**. Comprovado, não suposto: aplicadas numa a uma num
Postgres limpo, 17 passaram e a 18ª abortou —

```
ERROR: PD-06b: esperados 2 agentes universais (Agente 0, Oráculo), encontrados 0.
Agentes no banco: Analista Documental, Assistente Geral, Consultor Comercial.
```

Três problemas de fundo:
1. **Migration dependente de dados**: a `130000` procurava `Agente 0`/`Oráculo` para
   movê-los à org do sistema. Existem em produção, não num banco novo.
2. **Seed obsoleto**: a migration #2 semeava 3 agentes que foram renomeados/removidos
   pela UI e não existem mais em produção.
3. **Drift**: objetos vivos que nenhuma migration criava.

**Solução**: as 20 migrations foram arquivadas em
[`supabase/schema/archive/`](../supabase/schema/archive/) (via `git mv`, histórico
preservado) e substituídas por um **baseline** gerado do dump real:
[`20260716000000_baseline_schema.sql`](../supabase/migrations/20260716000000_baseline_schema.sql).

Regras do baseline: **só schema, sem seed de dado, sem passo dependente de dados** —
migração de dado é evento único e pertence ao histórico, não a um arquivo replayável.

**Verificação** (banco limpo → aplica só `migrations/` → compara com o dump de prod):

> ⚠️ **Esta tabela não vale — ver `PD-22`.** A comparação foi **circular**: o baseline foi
> gerado *do dump* e comparado *com o mesmo dump*. Todo par bate por construção. E o dump
> era anterior às migrations `150000` (`PD-09`) e `160000` (`PD-10`), que ficaram de fora
> do baseline. A coluna "prod" abaixo é, na verdade, "o dump de 15/07 09:12".

| | prod | local |
|---|---|---|
| Funções | 12 | 12 ✓ |
| Policies | 43 | 43 ✓ |
| Triggers (public+auth) | 6 | 6 ✓ |
| Tabelas | 13 | 13 ✓ |
| Colunas | 101 | 101 ✓ |
| Índices | 52 | 52 ✓ |

> **Em produção o baseline não deve rodar** — o schema já está lá. Registre como
> aplicado: `npx supabase migration repair --status applied 20260716000000`.

**Ressalvas honestas:**
- Verifiquei o schema **`public` + triggers de `auth`**. O `storage` **não**: suas
  tabelas são criadas pelo storage-api e precisei stubá-las. As policies de storage são
  fail-closed (`PD-09`), então não há policy a conferir — mas os buckets não foram
  verificados contra prod.
- A verificação **não** usou `supabase db reset`: o `supabase start` falha neste
  ambiente (Docker Engine 29.1.2 → HTTP 500 em `/images/{name}/json` para todas as
  imagens; `pull` funciona, `inspect` não; forçar a API v1.51→v1.52 não muda). Usei
  container `supabase/postgres` + `psql`, que exercita o mesmo SQL.

  > ⚠️ **Correção (2026-07-16, no `PD-22`)**: a parte do "HTTP 500 em `/images/{name}/json`
  > para todas as imagens" **não reproduz mais**. `docker image inspect` respondeu normal
  > em três imagens locais (`hello-world`, `postgres:15-alpine`, `supabase/gotrue`) e
  > `docker run hello-world` funciona. O que de fato falha aqui é o **pull da imagem
  > `supabase/postgres`** (~4 GB), com `unexpected EOF` — imagens de ~450 MB baixam sem
  > problema. Há também um snapshot órfão do containerd que quebra o `docker system df`
  > (`lstat .../snapshots/2251/fs: no such file or directory`), provável resquício do
  > mesmo episódio.
  >
  > **`supabase start` em si não foi retestado** — pode ser que funcione hoje. Não muda o
  > plano do `PD-04b` (a suíte não precisa do CLI e o job de CI não deve depender dele),
  > mas a justificativa "o Docker está quebrado" não pode mais ser usada sem reconferir.
- O CLI também não alcança o projeto remoto: **403** — a conta autenticada só enxerga
  outro projeto. Por isso o baseline foi gerado do dump, e não por `supabase db pull`.

> **Lição**: migration que lê dados de produção não é replayável. O guard que abortava
> alto (em vez de marcar errado em silêncio) foi justamente o que expôs isso.

### PD-13 — Migration com timestamp placeholder 🟡
`20260418xxxxxx_add_knowledge_base.sql` tinha timestamp placeholder e arriscava a
ordenação do `db push`. Resolvido junto do `PD-18`: o arquivo foi para o archive e não
está mais no caminho da CLI.

### PD-11 — Embeddings sem `taskType` 🟡
Query e documento usavam a mesma chamada, sem `taskType`. A doc do Gemini é explícita:
*"Use RETRIEVAL_QUERY for queries; RETRIEVAL_DOCUMENT for documents to be retrieved.
**Mismatching these produces incomparable embeddings**"*. Agora cada função usa o seu
par, travado por teste (inclusive um que falha se os dois empatarem).

> ⚠️ **Não é uma mudança isolada**: o default do `taskType` omitido **não é
> documentado**, então os chunks antigos estão num espaço vetorial desconhecido. Sem
> re-embeddar, isto **piora** o recall em vez de melhorar — ver `PD-20`.

### PD-12 — Provider: terreno preparado para multi-provider 🟡
A constraint sempre aceitou `provider = 'openai'`, mas o código chamava o Gemini
direto e **ignorava o campo**: um agente marcado como `openai` gerava com Gemini **em
silêncio**. Bug real, não só inconsistência de schema.

Decisão do produto: manter a porta aberta (o roadmap prevê Gemini + OpenAI + outros,
via um "mini MCP caseiro"). Então, em vez de restringir a constraint:

- Criado [`providers/stream.ts`](../src/server/services/ai/providers/stream.ts) — ponto
  único de despacho. `gemini` implementado; qualquer outro **falha alto** com mensagem
  clara, em vez de cair no Gemini escondido.
- Orquestrador e rota de retry passaram a repassar `agent.provider` (nenhum dos dois
  fazia isso).
- Para somar um provider: escrever a função de streaming, registrar no `switch`, incluir
  na constraint e no tipo. O resto (retry, timeout, classificação de erro, SSE) já é
  agnóstico de provider — vive no `runtime.ts`.

### PD-21 — `retryable` era descartado no wrap do erro 🟠
Descoberto ao testar o `PD-12`. O `classifyModelError` decide se vale reenviar, mas o
`ModelGenerationError` não carregava essa decisão e o catch do orquestrador forçava
`retryable: true` para **qualquer** erro dessa classe. Resultado: prompt bloqueado por
safety ou provider inexistente mostravam "tentar novamente" — que nunca funcionaria.

O erro agora carrega `retryable` e o orquestrador o respeita. Corte no meio do stream
segue retentável (é o caso em que reenviar de fato ajuda); o veredito do
`classifyModelError` vale para o resto. Comportamento herdado do god file original e
preservado sem querer no `PD-07` — só apareceu quando um teste cobriu o caso.

### PD-16 — Policies duplicadas em `conversation_agents` 🟠
A última migration recriara regras owner-only via `conversations.user_id` sem remover as
por participante. Removidas as quatro duplicadas; restaram só as de participante/dono.

---

## Histórico

| Data | Item | Nota |
|---|---|---|
| _(inicial)_ | PD-01 | README reescrito para refletir Next 16 + Gemini (não Fastify/OpenAI). |
| _(inicial)_ | docs/ | Criados ARQUITETURA, BANCO-DE-DADOS, FLUXO-DE-CHAT e este backlog. |
| 2026-07-15 | PD-05 | Retry passa a autorizar por participante (via RLS), não por dono. |
| 2026-07-15 | PD-03 | Removido o motor legado, o mock e o `planAgentExecution` morto. |
| 2026-07-15 | PD-02 | Runtime de IA extraído para `services/ai/runtime.ts`; `maxOutputTokens` unificado. |
| 2026-07-15 | PD-08 | Refresh de sessão via `src/proxy.ts` (convenção Next 16, ex-`middleware.ts`). |
| 2026-07-15 | PD-17 (parcial) | Migration `20260715120000` fecha o acesso `anon` a `agents`/`agent_knowledge_files` e remove as funções de busca órfãs. Restante (RLS aberta do conhecimento) vai na migration de multi-tenant. |
| 2026-07-15 | PD-18 | Dump do banco real salvo em `supabase/schema/` (fora de `migrations/`, senão a CLI tentaria aplicá-lo). |
| 2026-07-15 | PD-17 | Migration `20260715120000` aplicada: acesso `anon` fechado, funções órfãs removidas. |
| 2026-07-15 | PD-06/06b/15/16 | Migration `20260715130000` + código aplicados. **Verificado no dump pós-aplicação**: 1 assinatura de RPC, 0 policies abertas, `organization_id NOT NULL` nas 4 tabelas, `Agente 0`/`Oráculo` na org do sistema. |
| 2026-07-15 | infra | `.gitignore` passa a bloquear `supabase/schema/*_data_*.sql` — dumps de dados (com `auth.users` e conversas) nunca vão ao Git. |
| 2026-07-15 | PD-09 | Migration `20260715150000` aplicada. **Verificado**: `storage` com 0 policies, buckets com teto de 25 MB, e **0 policies abertas em todo o schema `public`** — era o último `USING (true)` do banco. |
| 2026-07-15 | PD-07 | Orquestração extraída para `services/ai/orchestrate-conversation.ts` (generator de eventos). Handler: 939 → 76 linhas. **vitest configurado** (`npm test`) com 10 testes verdes. |
| 2026-07-15 | PD-19 | Novo: `isProbablyIncompleteAnswer` marca como truncada qualquer resposta < 40 chars. Descoberto ao escrever os testes do PD-07. |
| 2026-07-15 | PD-10 + PD-19 | Migration `20260715160000` aplicada. `modo_resposta` (leve/medio/alto) por agente, presets em `lib/response-mode.ts`, piso de 40 chars corrigido. |
| 2026-07-15 | PD-04 | Suíte em **81 testes** (RAG fallback, chunkText, runtime, helpers de orquestração) + CI no GitHub Actions (lint/test/typecheck/build). Build validado sem `.env.local`. |
| 2026-07-16 | PD-18 + PD-13 | Migrations 1–20 arquivadas; baseline `20260716000000` gerado do dump real. **Verificado**: banco limpo + só `migrations/` reproduz prod (12 funções, 43 policies, 6 triggers, 13 tabelas, 101 colunas, 52 índices). `migration repair` aplicado: local e remoto listam só o baseline. |
| 2026-07-16 | PD-11 + PD-12 + PD-21 | `taskType` nos embeddings; despacho por provider em `providers/stream.ts` (agente `openai` gerava com Gemini em silêncio); `retryable` deixa de ser descartado no wrap. **89 testes.** |
| 2026-07-16 | PD-20 | `npm run reembed:knowledge` executado: 27/27 chunks regerados com `RETRIEVAL_DOCUMENT`. Query e documento voltam ao mesmo espaço vetorial. |
| 2026-07-16 | PD-22 | **Novo 🔴**: o baseline do `PD-18` não reproduz produção — o dump usado é anterior às migrations `150000`/`160000`, então falta o `PD-09` e o `PD-10` inteiros (inclusive a coluna `modo_resposta`, que o app lê). A verificação do `PD-18` não pegou porque comparava o baseline com o dump de que ele foi gerado. Descoberto ao planejar o `PD-04b`. |
| 2026-07-16 | PD-04b | Abordagem decidida (vitest + `pg` + `set local role`, job de CI separado com service container). Escrita adiada até o `PD-22` — testar contra baseline defasado provaria a fronteira errada. |
| 2026-07-16 | PD-22 | **Fechado.** Dump novo de prod; baseline regerado por `scripts/build-baseline.mjs` (auto-testado: no dump velho, reproduz o baseline antigo byte a byte no código). Verificado por `scripts/verify-baseline.mjs` **sem circularidade** — `db_baseline` vs `db_prod`, mesmo `pg_dump`: **idênticos** (13 tabelas, 43 policies, 12 funções, 37 índices, 2 triggers, 0 policies abertas). Drift confirmado como exatamente PD-09 + PD-10. |
| 2026-07-16 | PD-18 (correção) | O "HTTP 500 em `/images/{name}/json` para todas as imagens" **não reproduz**: `docker image inspect` e `docker run` funcionam. O que falha é o pull da imagem de ~4 GB do `supabase/postgres`. O harness passou a usar `pgvector/pgvector:pg17` + andaime explícito. |
| 2026-07-17 | PD-04b | **Fechado.** 33 testes em `tests/rls/` (vitest + `pg`, `set local role` + `request.jwt.claims`), job `rls` no CI com service container. Mordida provada por 3 mutações no baseline (policy aberta → 2 falhas; policies de participante dropadas → 2; `can_read_org` sempre true → 5). A mutação achou e consertou um defeito no guard de setup. |
| 2026-07-17 | PD-23 | **Novo 🔴**: `scope='space'` viola a CHECK de `knowledge_documents`/`knowledge_chunks` — inserção sempre rejeitada, e a opção está na UI. A constraint é VALID no dump, o que prova que prod tem 0 linhas `space`. Reescreve o `PD-15`: ele consertou a leitura de um dado que nunca pôde ser escrito. Descoberto ao ler o schema para as fixtures do `PD-04b`. |
| 2026-07-17 | CI (pré-existente) | `npm run lint` falha com 12 erros em `src/` — **anteriores** a este arco (confirmado com `git stash`). O passo de Lint do CI deve estar vermelho. Nenhum erro vem dos arquivos novos. |
| 2026-07-17 | PD-23 | Migration `20260717000000` escrita e coberta (44 testes na suíte de RLS). Decisão: **consertar**, não remover — `space` é o único jeito de agentes compartilharem conhecimento. **Ainda não aplicada em produção.** |
| 2026-07-17 | ferramental | `verify-baseline.mjs` e o harness de RLS passam a aplicar **`migrations/` inteira**, em ordem, e não só o baseline — a partir do `PD-23` existe migration depois dele, e o contrato é "`migrations/` reproduz produção". O diff de divergência virou diferença de conjunto (o posicional virava ruído a cada linha inserida). |
| 2026-07-17 | PD-25/26 | Camada de servidor: RPC `create_organization` (`020000`), repos de org/chaves, cifra AES-GCM (8 testes), `/cadastro` fechado, UI de chaves. **66 testes de RLS** (5 do RPC, mordida provada por 2 mutações: policy de leitura "razoável" e o trigger da org padrão ressuscitado). Nova env `PROVIDER_KEY_SECRET`. Falta UI de admin/membros e ligar a chave do tenant no `stream`/`retry`. |
| 2026-07-17 | prod (atenção) | `20260717010000` aplicada em produção fora de ordem, via SQL Editor, antes do código. Sem estrago (o funil no código cobria), mas o `supabase_migrations` não registrou nada. Diagnóstico pendente: confirmar estado de prod e aplicar `000000`/`020000`. |
| 2026-07-17 | prod (diagnóstico) | Confirmado: prod tem baseline + `000000` (PD-23) + `010000` (PD-25/26 schema); só falta `020000` (RPC, novo). `schema_migrations` só registra o baseline. Prod == `migrations/` menos o RPC. |
| 2026-07-17 | PD-26 | **Ponta a ponta.** Chave do tenant injetada no `streamModel` (orquestrador embrulha `deps.streamModel`; retry passa direto), resolvida pela org da conversa, por provider. `getGeminiClient(apiKey?)`. 3 testes de fiação (100 no total). Chave que não decifra cai na plataforma com log. Removido `const ai` morto do retry (warning de lint do PD-12). |
| 2026-07-17 | PD-25 (orgless) | Usuário sem organização vê tela (`NoOrganization`) no layout do dashboard, não um 500; `api/conversations` responde 403. |
| 2026-07-17 | PD-27 | Ciclo de vida da org (migration `20260717030000`): `is_active`, `active_until`, `key_mode`. Painel admin: criar com dias/modo, lista com dias restantes + chave utilizada + desativar/reativar. Bloqueio de org inativa em camada de app (layout `OrgSuspended` + API 403). Enforcement do modo 'own' no motor (sem chave → erro claro, não-retryável). Nav para /admin e /configuracoes no header do chat. **109 testes** (+8 lifecycle puro), **70 RLS** (+4 schema). Decisões: enforcement, bloqueio em app, OpenAI a implementar (#4, próximo). |
| 2026-07-18 | PD-30 (#4) | OpenAI ponta a ponta no motor (`streamWithOpenAI`, SDK `openai`, despacho no `providers/stream.ts`; adapta contents Gemini→OpenAI; exige chave própria da org, senão erro claro). Picker de provider/modelo no editor de agentes (`src/lib/model-catalog.ts`), com OpenAI só se a org tem chave OpenAI. `updateAgent` passa a gravar+validar provider/model. **114 testes** (+4: catálogo puro + openai sem chave). RLS inalterada (sem schema). Decisões: OpenAI own-key only; picker no editor. |
| 2026-07-17 | PD-29 | **Novo 🔴**: conta nova nasceu `is_platform_admin=true` em prod. Código correto (default false, trigger não toca, nada grava true). Suspeita: default da coluna divergente em prod (aplicação manual das migrations). Diagnóstico+fix de banco no item. |
| 2026-07-17 | PD-28 (hash) | Rede de segurança para o fluxo implícito: `AuthHashHandler` no /login lê `#access_token=…`, faz `setSession` e vai a /definir-senha — funciona mesmo com o template padrão (`{{ .ConfirmationURL }}`). |
| 2026-07-17 | PD-28 | Fluxo de definição/recuperação de senha: rota `/auth/confirm` (verifyOtp com token_hash — não PKCE, que não serve para link de e-mail), página `/definir-senha` (updateUser), `/recuperar-senha` (resetPasswordForEmail). Faltava a página que processa o token do e-mail — o link caía no /login e falhava. **Exige config no Supabase**: templates de e-mail apontando para `/auth/confirm?token_hash=…&type=…&next=/definir-senha`, além de SMTP e Site URL. |
