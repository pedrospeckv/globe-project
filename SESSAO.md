# Onde o Globe Project parou

Resumo da sessão encerrada em 17 de agosto de 2026. Serve para retomar sem
precisar reler o histórico.

---

## O que esta sessão fez

Uma coisa só, do começo ao fim: **escrever em profundidade os 84 períodos
dos 9 países**, e depois resolver a disputa territorial que sobrou.

Antes da sessão, só o Brasil tinha texto de verdade. Os outros oito países
estavam em resumo de 450 a 1.400 caracteres por período, com uma fonte
genérica por país citada como "base narrativa geral".

Nove commits, nesta ordem:

| commit | o que entrou |
|---|---|
| `8c9ff5b` | França, 10 períodos |
| `bfaf3b2` | Reino Unido, 6 períodos |
| `73e0471` | Estados Unidos, 8 períodos |
| `792f8b0` | Alemanha, 8 períodos + as entidades RFA/RDA |
| `a2761bc` | Rússia, 6 períodos |
| `9d5627a` | China, 16 períodos |
| `e1a7907` | Japão, 12 períodos |
| `d92810b` | Índia, 11 períodos |
| `a1c36d9` | Caxemira no mecanismo de disputas + a trava que ela exigiu |

## Estado atual do acervo

- **84 períodos**, 9 países, **246 mil caracteres**, média de **2.931** por período
- **137 fontes** (eram 29 no começo da sessão)
- 4 figuras, 10 alegações, 11 eventos, 2 viagens, 2 indicadores, 32 notas
- **482 testes** passando, 27 arquivos de teste
- `pnpm build` gera **134 páginas** estáticas

Comandos: `pnpm validar`, `pnpm test`, `pnpm build`.
Servidor de desenvolvimento: `node scripts/dev.mjs` a partir de `D:\Globe Project`
(ou `.claude/launch.json`, entrada `atlas`, porta 3000).

---

## Regras editoriais que a sessão firmou

Estas não estavam escritas antes e passaram a valer para todo o acervo.

**1. Fonte com lastro fino, não fonte genérica.** A dívida declarada em
`4ab85d6` — "esta cobertura é mais grossa que a do Brasil" — está paga. Cada
país recebeu documentos e obras escolhidos por sustentar afirmações
específicas: constituições, decisões judiciais, relatórios de comissão,
levantamentos estatísticos.

**2. Onde o fato é disputado, entram DUAS fontes que discordam, e as
citações nomeiam uma à outra.** Foi usado quatro vezes:

- Applebaum × Davies-Wheatcroft — a fome soviética de 1932-33 foi genocídio?
- Elvin × Pomeranz — por que a China Song não industrializou?
- Yang Jisheng × Dikötter — 36 ou 45 milhões de mortos no Grande Salto?
- Davis × Roy — o peso do domínio colonial sobre a economia indiana

**3. Ressalva em itálico no fim do período nomeia a disputa em vez de
resolvê-la em silêncio.** Exceção deliberada: a leitura de "direitos dos
estados" para a secessão americana NÃO é tratada como disputa aberta,
porque os documentos de secessão estão publicados e dizem o que dizem.

**4. Nenhum URL inventado.** Livro entra sem URL; só documento e base de
dados cuja localização eu conheço levam endereço.

**5. Período em curso leva ressalva própria** dizendo por que não há
distância crítica. O da China acrescenta que os arquivos internos estão
fechados; o da Rússia, que os dois lados de uma guerra em andamento
produzem informação com finalidade militar.

## Convenções de escrita

- 2.400 a 3.500 caracteres por período
- Lead-in em `**negrito**`, nunca `##` (renderiza sem estilo sob o preflight do Tailwind)
- Ressalva final em `*itálico*`
- `[[wikilinks]]` para outros períodos, países e figuras

**Regra descoberta na prática:** evento só rende ligação útil quando citado
**de fora** do país dele. `[[magna-carta]]` numa página do Reino Unido
resolve para `/pais/GBR` e vira link para si mesmo. Foi tentado e desfeito
três vezes (`magna-carta`, `queda-muro-berlim`, `revolucao-outubro`).
Funcionam: `[[hiroshima]]` visto dos EUA, `[[pearl-harbor]]` visto do Japão,
`[[queda-muro-berlim]]` visto da Rússia.

---

## A Caxemira, e o que ela obrigou a mudar

O mecanismo da Crimeia **não serve** para a Caxemira, e a diferença foi
medida antes de escrever qualquer código:

| ponto | 110m | 50m | 10m |
|---|---|---|---|
| Srinagar | polígono 1/1 da Índia (100% do país) | 1/14, **o mesmo de Nova Délhi** | 1/35, o mesmo de Nova Délhi |
| Aksai Chin | polígono 2/2 da China (99,6%) | 12/13, **o mesmo de Pequim** | 1/70, o mesmo de Pequim |
| *Crimeia* | *12/12 da Rússia — 0,2%, 29 mil km²* | | |

A base funde a Caxemira ao corpo dos países que a administram, em todas as
resoluções que o `world-atlas` distribui. Apontar um `ponto` para lá
hachuraria a Índia inteira e a China inteira — 12,5 milhões de km² marcados
como soberania contestada.

**`Disputa` virou união discriminada:**

- `recorte: "poligono"` — a base separa. Área hachurada, subtraída do país. Crimeia.
- `recorte: "nenhum"` — a base não separa. **Alfinete** num ponto, e a nota entra no dossiê de todos os países envolvidos. Caxemira aparece na Índia e na China.

Um ponto não afirma fronteira; um polígono desenhado por nós afirmaria, e
traçar a Linha de Controle à mão seria decidir num traço o que está em litígio.

**A trava é a parte que mais importa:** `FRACAO_MAXIMA_RECORTE` (5%) e um
teste que percorre toda disputa recortada e recusa polígono acima disso. O
erro era fácil e silencioso — o mecanismo hachura o que mandarem sem
reclamar. Outro teste registra a premissa medida (Srinagar e Nova Délhi no
mesmo polígono); se o `world-atlas` passar a separar a região, ele quebra, e
aí a Caxemira pode virar recorte.

Verificado no navegador: alfinete aparece em 1947 e não em 1946; área da
Crimeia em 2014 e não em 2013; independentes entre si.

---

## Aberto — por ordem do que eu faria primeiro

### 1. Frontmatter YAML vazando em 11 das 32 notas
Defeito visível. A página abre com `--- tags: 📚Book / Capa: http://books.google.com/... ---`
antes do texto. O importador (`scripts/importar-obsidian.ts`) não remove o
cabeçalho. Conserto de ~10 minutos, com teste. **Fazer antes de qualquer deploy.**

### 2. Não existe índice de países
A única porta de entrada é clicar num país **aceso** no globo, o que revela
o link "abrir dossiê →". Quem chega numa data em que o Japão não está aceso
não tem como descobrir que existe página do Japão. Os 84 textos e as 137
fontes estão atrás de um clique no lugar certo do mapa na data certa.
Proposta: página `/paises` com os 9 países e seus períodos, linkada do topo.
URLs diretas hoje: `/pais/BRA`, `/pais/FRA`, `/pais/GBR`, `/pais/USA`,
`/pais/DEU`, `/pais/RUS`, `/pais/CHN`, `/pais/JPN`, `/pais/IND`.

### 3. Deploy na Vercel — decisão pendente
O app é 100% estático e o plano gratuito serve. O CLI já está instalado
(58.1.0) e não há remote git, mas `npx vercel --prod` sobe a pasta direto.

**O que Pedro precisa decidir antes:** no plano gratuito a produção é
pública, e as 32 notas do Obsidian vão junto — incluindo notas de leitura
longas (*O Mundo de Sofia*, 57k; *Os Gregos*, 40k; *Vietnã*, 38k). A
densidade (~125 caracteres por página de livro) indica resumo próprio e não
transcrição, então o risco autoral é baixo; a questão é se ele quer notas
pessoais de estudo legíveis na internet aberta.

Claude não faz o login (ação de credencial). O conector Vercel também exige
autorização, que precisa de sessão interativa.

### 4. `Entidade.fontes` é campo morto
Validado pelo `verificarLigacoes` e **nunca renderizado** pela página de
período. Hoje está vazio em todas as entidades — só a Alemanha tem
entidades —, então nada some da tela, mas é campo que aceita dado e esconde.
As fontes da RFA e da RDA foram para o período, onde aparecem.

### 5. Figuras: 4 no acervo, dezenas nomeadas no texto
Só existem Lula, Bolsonaro, Joana d'Arc e Fábio Luís. Os textos novos
nomeiam Ambedkar, Asoka, Wu Zetian, Paxton, Bismarck e dezenas de outros
sem que nenhum tenha página nem registro de alegações.

### 6. Amarrar fontes de países não-Brasil a alegações específicas
Já melhorou muito, mas o mecanismo de `Alegacao` (que exige fonte por
schema) segue com 10 registros, todos brasileiros.

---

## Armadilhas conhecidas do projeto

- **Vitest não faz typecheck.** Só `pnpm build` pega erro de tipo. Mordeu
  seis vezes; nesta sessão pegou duas mudanças de contrato que os 482 testes
  deixaram passar (`paisesDaDisputa` no dossiê e `TerritorioDisputado`
  carregando `DisputaRecortada`).
- **`.default([])` do zod torna o campo obrigatório no tipo de saída** e
  quebra fixtures de teste. Aconteceu 4 vezes.
- **PowerShell 5.1**: here-string quebra com aspas duplas internas. Usar
  `git commit -F <arquivo>` sempre.
- **Hidratação**: nunca `toLocaleString`; arredondar string numérica montada
  à mão (`toFixed(3)`) — trigonometria em ponto flutuante difere no último
  dígito entre o V8 do Node e o do navegador.
- **Caches por origem.** `http://26.192.204.0:3000` é outra origem com cache
  próprio; já custou uma sessão de depuração de um bug que não existia.
- **`preview_start` com `{url}` mata o servidor de desenvolvimento** aberto
  por `{name}`. Usar sempre `{name: "atlas"}`.
- Escrever conteúdo por script `.mjs` no scratchpad, montando o JSON com
  template literals, evita inferno de escape. Foi assim que os 84 períodos
  entraram.
