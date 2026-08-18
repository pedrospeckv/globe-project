# Prompt para a sessão de conteúdo — política brasileira

Cole o texto abaixo numa sessão nova, aberta **em `D:\Globe Project`** (não em `D:\`).

---

Você vai trabalhar no Atlas, um atlas histórico e geopolítico pessoal, sem fins
comerciais, em `D:\Globe Project`. Esta sessão é só de **conteúdo sobre política
brasileira** — outra sessão cuida do mapa, então não mexa em `lib/geo/`,
`components/atlas/` nem em `conteudo/fatias/`.

**Leia primeiro, antes de propor qualquer coisa:**
`docs/superpowers/specs/2026-08-13-atlas-design.md`. Ele tem o modelo de dados, os
componentes e um registro de decisões com as alternativas descartadas e o porquê.
Depois leia `AGENTS.md` na raiz: esta versão do Next tem mudanças de API, e a
orientação é consultar `node_modules/next/dist/docs/` antes de escrever código.

## O que já existe

- `conteudo/paises/brasil.json` — 7 períodos: Brasil Colônia, Império do Brasil,
  República Velha, Era Vargas, República de 1946, Regime Militar, Nova República.
  Cada período tem `id`, `inicio`, `rotulo`, `regime`, `textoMdx` e `fontes`.
- `conteudo/figuras/`, `conteudo/eventos/`, `conteudo/notas/`,
  `conteudo/indicadores/`, `conteudo/fontes/fontes.json` (255 fontes).
- Validação no build: `pnpm validar` roda `scripts/validar-conteudo.ts`, e
  `pnpm build` só passa se o conteúdo passar. Testes: `pnpm test` (664 passando).

## As três regras que não se negociam

1. **Toda alegação precisa de ao menos uma fonte**, validado no build. Conteúdo
   sem lastro não chega ao ar porque o deploy falha. É a promessa editorial do
   projeto.

2. **`status` de alegação é enum fechado** (`lib/conteudo/alegacao.ts`):
   `transito-julgado`, `em-julgamento`, `investigacao`, `investigacao-arquivada`,
   `anulado`, `prescrito`, `alegacao-sem-processo`, `desmentido`. As distinções
   que o debate político mais confunde vivem no rótulo, não diluídas na prosa:
   *anulado ≠ inocentado* (caiu por vício, não por mérito), *prescrito ≠
   desmentido* (extinto por prazo, não refutado), *investigação ≠ em julgamento*,
   *investigação arquivada ≠ desmentido*. Quando o status precisar de explicação,
   use o campo `nota` — é para isso que ele existe.

   O objetivo declarado é que **leitor de esquerda e de direita vejam a mesma
   tela**. Não proponha layout de "dois lados" em colunas iguais: foi avaliado e
   recusado por fabricar falso equilíbrio.

3. **Nunca invente URL.** Livro entra sem URL; só documento cuja localização se
   conhece recebe link. Se não tem certeza do endereço, deixe sem — inventar link
   é pior que não ter. Vale também para número de processo, data e citação: na
   dúvida, diga que não confirmou.

## As duas fontes que o Pedro indicou

- **https://atlas.fgv.br/** — Atlas Histórico do Brasil, da FGV.
- **https://cartografiahistorica.fflch.usp.br/** — Biblioteca de cartografia
  histórica da FFLCH/USP.

Ele gostou das duas por explicarem bem o Brasil para estudantes e entusiastas.
Comece **visitando as duas e relatando o que de fato há nelas** — que períodos
cobrem, que tipo de material (texto, mapa digitalizado, cronologia), e se há
condições de uso declaradas. Não presuma o conteúdo pelo nome do site.

**Cuidado com imagem.** O projeto proíbe hotlink de imagem de terceiros; o schema
`Imagem` exige `credito` e `licenca` como campos obrigatórios, e material da USP e
da FGV é digitalização com direitos próprios. Mapa histórico escaneado quase nunca
é livre só por ser antigo — o objeto digitalizado tem direitos do digitalizador.
Se for usar imagem, prefira Wikimedia Commons com crédito e licença explícitos, e
registre a licença no arquivo.

## O que fazer primeiro

Não comece escrevendo. Comece assim:

1. Leia `conteudo/paises/brasil.json` inteiro e diga o que **já** está coberto e
   com que profundidade, período por período.
2. Visite as duas fontes e relate o que elas oferecem de concreto.
3. Proponha um recorte pequeno — **um** período ou **um** tema — e diga por que
   esse primeiro. Espere o Pedro concordar antes de escrever conteúdo.

Ele prefere ver renderizado a ler descrição: quando houver algo pronto, mostre na
tela em vez de resumir. O gargalo reconhecido do projeto é escrita, não código.

## Duas coisas do histórico que evitam retrabalho

- As alegações hoje no acervo são **todas brasileiras**, e há um item de backlog
  para equilibrar isso. Se for adicionar mais, vale dizer ao Pedro que a
  assimetria aumenta.
- As notas do Asimov sobre Egito, Gregos e Roma estão guardadas para quando cada
  país ganhar dossiê. `os-gregos` segue cru de propósito; `o-mundo-de-sofia` não
  depende de país nenhum.
