# Pandora — Brief para criativos

Reúne o que é preciso saber sobre o produto para criar peças de marketing
consistentes. Use como contexto ao pedir criativos. Este produto é filho
da **SolaSoftware** — ver `../SolaSoftware/brand/BRANDING.md` para as regras
de propagação da marca-mãe (selo de rodapé, vermelho lacre reservado,
tipografia condensada categoria), que também valem aqui.

**Diferente do Axios Calc e do SolaBridge, o Pandora já passou por um
redesign visual recente e o sistema de design já está implementado em
código** (`src/app/globals.css`) — este documento majoritariamente
*documenta* o que já existe, com poucos ajustes/adições.

## Sobre o produto

**Pandora** é um hub de agentes de IA especializados, com orquestração
multi-agente (vários agentes respondem e a resposta final é sintetizada),
memória de conversa e conhecimento próprio por agente (RAG).

**Para quem é** (divulgação atual): profissionais de produtividade em
geral — não é preciso entender arquitetura de IA pra usar. Evitar jargão
técnico ("multi-agente", "RAG", "orquestração", "embeddings") no material
de marketing; traduzir sempre pra benefício em linguagem simples.

**Dor que resolve**: hoje as pessoas usam vários assistentes/agentes de IA
separados (um "Gem" pra isso, um GPT customizado pra aquilo) e esbarram
num problema chato — compartilhar a conversa com alguém não deixa a pessoa
continuar a partir dali, e compartilhar só o prompt zera todo o contexto
que o agente já tinha acumulado. O Pandora resolve isso: os agentes vivem
numa conversa em comum, com memória e contexto preservados, como se fosse
"um WhatsApp com vários especialistas de IA dentro".

**Diferencial**: não é um chatbot único genérico — é vários agentes
especializados, cada um com seu próprio conhecimento, conversando junto
com você no mesmo lugar.

## Identidade visual (já implementada)

Sistema já em produção — escuro neutro (grafite/slate, sem brilhos) com um
único accent verde-sálvia dessaturado. Segue exatamente a linha "nada de
cor viva/neon" reforçada no SolaBridge — aqui já foi aplicado de forma
independente.

| Token | Hex | Uso |
|---|---|---|
| `background` | `#0D0E11` | fundo padrão (modo escuro) |
| `surface-1` | `#15171A` | painéis |
| `surface-2` | `#1E2124` | elementos elevados |
| `surface-3` | `#272A2E` | elementos mais elevados ainda |
| `foreground` | `#EFF0F2` | texto principal |
| `muted-foreground` | `#9C9FA2` | texto secundário |
| `primary` (accent) | `#60BA8D` | verde-sálvia dessaturado — cor de marca do produto |
| `bubble-user` | `#1F4634` | fundo do balão de mensagem do usuário |
| `destructive` | `#E1595B` | erro/exclusão, uso pontual |
| `border` | `#2C2E31` | bordas finas |

- **Tipografia**: **IBM Plex Sans** (interface) + **IBM Plex Mono**
  (código/dados técnicos) — já implementada, já técnica e distintiva.
- **Textura**: grid de pontos sutil no fundo da área de conversa
  (`chat-wallpaper`), sem glow — mantém a linha "limpo, sem elemento
  chamativo" da casa.
- **Forma — ajuste recomendado**: o raio de borda atual é `0.5rem` (8px).
  Ajustar para algo entre `2px` e `4px` — suaviza a diferença em relação
  ao "cantos retos" dos outros produtos sem descaracterizar o redesign
  recente. *(Mudança de código pendente — não aplicada ainda, fazer numa
  sessão dedicada.)*
- **Modo claro**: também existe e está implementado (`:root` sem `.dark`)
  — não documentado aqui em detalhe porque a divulgação deve usar o modo
  escuro como padrão, como os demais produtos.

## Símbolo (novo — a desenhar)

Uma caixa estilizada, geométrica e minimalista, ligeiramente entreaberta,
com pequenos traços/raios finos saindo da fresta (linha, não brilho/glow —
respeita a regra "sem glow" já estabelecida no código). Monocromática no
`primary` (#60BA8D). Não é uma caixa "de presente" nem ornamentada —
formas retas, poucos detalhes, mesmo espírito técnico do resto da marca.
Não existe ainda como arquivo — este documento serve de briefing pra gerar
as primeiras versões.

## Tom de voz

Acessível e direto, sem jargão de IA. Fala de benefício concreto
("continue de onde parou", "todos os seus assistentes de IA, numa
conversa só"), não de arquitetura. Evita a palavra "agente" com muita
frequência no material de divulgação — pra quem não é técnico, prefira
"assistente" ou "especialista".

## Prompts prontos para gerar criativos

Cole a seção **Identidade visual** antes de um destes prompts.

### 1. Ícone/símbolo do produto (caixa estilizada, 512×512, fundo transparente)

```
Crie um ícone minimalista (512x512, fundo transparente) de uma caixa
geométrica estilizada, ligeiramente entreaberta, com finos traços/linhas
retas saindo da fresta (não é um brilho difuso, são linhas finas retas,
poucas, como pequenos raios). Monocromático em verde-sálvia dessaturado
(#60BA8D) sobre fundo transparente. Estilo técnico, poucos detalhes,
cantos levemente arredondados (raio pequeno), nada ornamentado ou
"caixa de presente".
```

### 2. Carrossel de apresentação (Instagram, 1080×1350, 5 slides)

```
Crie um carrossel de 5 slides para Instagram (1080x1350 cada) apresentando
o Pandora, um hub que reúne vários assistentes de IA especializados numa
conversa só, com memória preservada.

Identidade visual: fundo escuro neutro (#0D0E11), painéis em #15171A,
texto em #EFF0F2, único acento em verde-sálvia dessaturado (#60BA8D) —
nada de verde vivo/neon. Tipografia técnica (estilo IBM Plex), cantos
levemente arredondados (raio pequeno, não 100% quadrado nem
arredondado demais), sem brilho/glow. Tom acessível, sem jargão técnico
de IA.

Estrutura:
1. Capa: "Cansado de perder o contexto toda vez que muda de assistente de
   IA?" — gancho de dor.
2. O problema: cada assistente de IA vive isolado, compartilhar conversa
   não deixa continuar dali.
3. A solução: Pandora reúne vários assistentes especializados numa
   conversa só, com memória preservada.
4. Diferencial: cada especialista tem seu próprio conhecimento, e todos
   conversam com você ao mesmo tempo.
5. CTA: chamada para testar, nome do produto em destaque.

Gere as 5 imagens.
```

### 3. Post único — conceito "tudo num lugar só" (1080×1080)

```
Crie uma imagem quadrada (1080x1080) para Instagram com o conceito de
vários assistentes de IA reunidos numa conversa só, sem parecer caótico.

Identidade visual: fundo escuro (#0D0E11), acento verde-sálvia dessaturado
(#60BA8D), símbolo de caixa estilizada entreaberta com pequenos traços
saindo dela, tipografia técnica, cantos levemente arredondados, tom sóbrio
e acessível, sem brilho/glow.

Texto sugerido: "Seus assistentes de IA, numa conversa só." com o nome
Pandora em destaque.
```

## Selo de marca-mãe

Todo material inclui o selo padrão "by SolaSoftware" (símbolo cruz+circuito
monocromático + texto discreto) no rodapé — ver
`../SolaSoftware/brand/BRANDING.md`.

## Pendências

- Ajustar `--radius` de `0.5rem` para algo entre `2px`–`4px` no código
  (`globals.css`) — fazer em sessão dedicada ao Pandora, junto com a
  suavização de verde/azul pendente no SolaBridge.
- Símbolo da caixa estilizada ainda não existe como arquivo — gerar
  primeira versão a partir do prompt acima.
