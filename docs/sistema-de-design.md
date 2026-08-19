# O sistema de design do atlas

Existe para que país novo entre e saia parecido com os que já estão, sem que
isso dependa de alguém lembrar as classes certas. Antes deste documento, o
cabeçalho de seção estava copiado em dez lugares com as mesmas classes escritas
de novo a cada vez — e já tinha divergido em dois deles.

A regra é curta: **peça nova de tela se monta destas primitivas; classe solta
só quando nenhuma serve, e aí a primitiva é que precisa crescer.**

---

## A linguagem

Vem do memorial da Segunda Guerra, que é o template que o projeto adotou.

| papel | como |
|---|---|
| fundo | `bg-zinc-950`, cartão em `bg-zinc-900/60` |
| borda | `border-zinc-800`, e `border-amber-500/30` no hover |
| título | `font-serif`, `tracking-tight`, `text-zinc-50` |
| metadado | `font-mono`, `tracking-wider`, `text-zinc-600` |
| acento | `amber-500` — **o único**, e sempre para o que é datado ou contável |
| corpo | `text-zinc-400`, `leading-relaxed` |

Amber é acento, não decoração: ele marca data, contagem e o estado de foco.
Espalhá-lo por outra coisa tira dele o poder de dizer "olhe aqui".

A página de figura ainda usa a paleta antiga (`slate`, links em `sky`). É
dívida conhecida, não alternativa.

---

## As primitivas

### `CabecalhoDeSecao` — `components/design/CabecalhoDeSecao.tsx`

Título em serifa, contador em mono amber, régua embaixo, e um canto direito
para controle.

```tsx
<CabecalhoDeSecao
  titulo="Figuras"
  contador={`${figuras.length} PESSOAS`}
  acao={<CampoDeBusca … />}
/>
```

O contador é `ReactNode`, não `string`, porque episódio precisa de dois
números (`8 MOMENTOS · 8 IMAGENS`) e período de um só.

`acao` fica alinhado à base do título. É onde entra a busca, e é sempre o mesmo
lugar em toda seção do atlas — quem procura olha ali primeiro.

### `CampoDeBusca` — `components/design/CampoDeBusca.tsx`

Lupa à esquerda, texto no meio, botão de limpar que só aparece quando há o que
limpar. **Controlado**: quem usa guarda a consulta.

Não é escolha estética:

- `type="search"` dá a semântica certa ao leitor de tela e o teclado de busca
  no celular; `autoComplete="off"` impede o navegador de oferecer endereço
  salvo num campo que só procura nome.
- `<label>` de verdade em `sr-only`. `aria-label` sozinho não é lido por toda
  combinação de navegador e leitor.
- **Escape limpa e mantém o foco.** Sem isso a única saída é apagar caractere
  por caractere.
- **Nunca `autoFocus`.** A seção fica no meio da página; roubar o foco jogaria
  a rolagem de quem chegou para ler o topo.

### `Icones` — `components/design/Icones.tsx`

SVG à mão, traço 1.5, `currentColor`, `aria-hidden`. O projeto não tem
biblioteca de ícones e não vai ter: puxar mil para gastar dois custa mais do
que resolve. Ícone aqui nunca carrega informação que o texto ao lado não dê.

### `busca` — `lib/ui/busca.ts`

`normalizar`, `casa`, `filtrar`. Puro e testado à parte, pela mesma razão de
`paralaxe.ts`: o que pode estar errado é a regra de casamento, não o `<input>`.

**Acento é a parte que importa.** Metade dos nomes deste atlas tem um — Luiz
Inácio, Fábio Luís, João Maurício, Antônio Filipe. Comparar caracteres crus faz
"inacio" não achar "Inácio", e quem digita não tem como saber que o problema é
o acento. A normalização vem antes de qualquer comparação, **dos dois lados**.

Cada palavra da consulta precisa aparecer em algum lugar, e a ordem não importa:
`lula silva` acha `Luiz Inácio Lula da Silva`, e `silva lula` também.

`filtrar` **não reordena por relevância**. A ordem de origem é editorial —
figuras por número de alegações, períodos por cronologia — e um ranking a
embaralharia sem avisar. Filtrar é esconder o que não serve, não reorganizar o
que serve.

---

## Como fazer uma ala buscável

`components/conteudo/GradeDeFiguras.tsx` é o modelo. Três coisas a copiar:

**1. Componente de cliente, lista completa no HTML.** O atlas é estático e não
tem onde rodar consulta. Filtrar no navegador é instantâneo e funciona sem
rede, o que num site de leitura vale mais que qualquer índice.

**2. Um tipo reduzido para a fronteira.** `FiguraNaGrade` tem nome, cargo e a
CONTAGEM de alegações — nunca as alegações. O mapeamento (`paraGrade`) vive na
página, do lado servidor, e é ele que impede o texto mais pesado e mais
sensível do acervo de ser serializado para o navegador só para ser contado.

**3. Três estados, não dois.**

| estado | o que a tela diz |
|---|---|
| lista cheia | `3 PESSOAS` |
| filtrando | `1 DE 3 PESSOAS` |
| nada casou | repete o termo digitado **e** lembra quantas existem |

O terceiro é o que costuma faltar. "Nenhuma figura com *churchill*" lido sem o
"o país tem 3 registradas" vira "este país não tem figuras" na cabeça de quem
lê — e num atlas cuja promessa é não enganar, isso importa.

---

## O que ainda não está aqui

- **Cartão.** O padrão `rounded-lg border border-zinc-800 bg-zinc-900/60 p-4/5
  transition-colors hover:border-amber-500/30` aparece em sete lugares com
  padding e conteúdo diferentes. Vira primitiva quando o oitavo chegar.
- **A página de figura.** Única tela ainda na paleta antiga.
- **Foco visível padronizado.** `CampoDeBusca` tem o seu; os links de cartão
  herdam o do navegador.
