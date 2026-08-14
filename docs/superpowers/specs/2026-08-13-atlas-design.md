# Atlas — design

**Data:** 2026-08-13
**Status:** aprovado, pronto para plano de implementação
**Tipo:** projeto pessoal, sem fins comerciais

---

## 1. O que é

Um atlas histórico e geopolítico navegável por globo, mapa e linha do tempo. A unidade de
conteúdo é **país × período**: um retrato datado de um lugar.

"França 1420" e "França 2026" são o mesmo tipo de objeto no banco de dados. Essa é a decisão
estruturante do projeto, e a consequência é que **geopolítica atual não é um módulo separado
do atlas histórico** — é apenas o último período da linha do tempo. Um sistema para manter,
não dois.

### Não-objetivos

Estes ficam explicitamente fora, e a arquitetura não precisa acomodá-los:

- Enciclopédia mundial. São 9 países curados, e o globo comunica isso visualmente.
- Rede social. Sem comentários, sem contas, sem contribuição de terceiros.
- Recurso de IA no produto. IA é ferramenta de autoria do projeto, não funcionalidade do site.
- Fonte de notícias. O período atual é atualizado à mão, na mesma cadência dos demais.

---

## 2. Escopo da v1

**Países (9):** França, Rússia, EUA, Alemanha, China, Japão, Índia, **Reino Unido**, Brasil.

Cerca de 3 períodos por país no lançamento. Brasil e França mais profundos, por serem os
casos que motivaram o projeto.

> **Reino Unido, não Inglaterra.** O `world-atlas` traz *United Kingdom* (GBR) como feature;
> Inglaterra não existe como geometria separada. O atlas adota o Reino Unido como país, e os
> períodos ingleses anteriores à união vivem dentro dele — com o `rotulo` do período dizendo
> o nome correto da época ("Reino da Inglaterra", "Grã-Bretanha"), que é justamente para isso
> que o campo existe. A geometria fica anacrônica nos períodos antigos, o que cai sob a
> limitação já assumida de fronteiras modernas (§12).

**Viagens (2):** frota de Cabral (1500) e Colombo. Colombo fez quatro travessias — a v1 cobre
a **terceira (1498)**, que é a que alcança o continente sul-americano, pela costa da atual
Venezuela. As demais entram depois se fizer sentido.

> **Nota factual:** Colombo nunca chegou ao Brasil. Quem aportou na costa brasileira em 1500
> foi Cabral. A confusão é comum e serve de exemplo do motivo pelo qual fonte é campo
> obrigatório neste modelo.

**Alegações:** Lula e Bolsonaro como caso piloto — é o cenário mais adversarial disponível, e
serve de teste de estresse para o modelo.

**Indicadores:** um ou dois do Brasil, começando por pobreza (PNAD/IBGE).

### Fora da v1

Busca, autenticação, comentários, os outros 181 países, viagens adicionais, fronteiras
históricas, exportação, i18n.

---

## 3. Arquitetura

Next.js (App Router) + TypeScript, geração estática. **Sem banco de dados, sem API em runtime,
sem autenticação.** Conteúdo é lido do repositório em tempo de build.

```
conteudo/*.{mdx,json,csv}
   ↓  validador zod (build)      ← quebra o build se faltar fonte ou status for inválido
   ↓  índice tipado gerado
   ↓  páginas SSG  +  payload JSON do globo
   ↓  cliente: D3 projeta · GSAP anima
```

### Dependências

| Biblioteca | Uso | Nota |
|---|---|---|
| `d3-geo` | projeção, `geoPath`, interpolação | `geoProjectionMutator`, `geoOrthographicRaw` e `geoEquirectangularRaw` estão no core; `d3-geo-projection` **não** é necessário |
| `topojson-client` | malha mundial | `world-atlas` 110m |
| `gsap` + `DrawSVGPlugin` | animação | gratuito desde abr/2025 (Webflow/GreenSock) |
| `zod` | validação de conteúdo no build | |
| Tailwind + shadcn/ui | UI | já presente nos templates de origem |

Não entram: Three.js, Leaflet, MapLibre, banco de dados, ORM.

### Por que D3 e não react-globe.gl ou MapLibre

A transição controlada globo ↔ mapa plano só existe em D3, via interpolação de projeção. No
react-globe.gl é impossível — é uma esfera 3D real, não há como desenrolar. No MapLibre existe
transição, mas atrelada ao zoom, não controlável como narrativa.

Essa transição não é ornamento: é o mecanismo pelo qual o leitor sai de "olhando o mundo" para
"acompanhando a rota do Cabral rente à costa". Países e rotas passam pelo **mesmo** `geoPath`,
então a barra de tempo filtra as duas camadas com um código só.

O que se abre mão: zoom até nível de rua (só o MapLibre faz) e conveniência de camadas prontas
(o react-globe.gl traz). Um atlas histórico curado não usa zoom de rua, e escrever a interação
em D3 custa menos que domar o style spec do MapLibre até o visual desejado.

---

## 4. A decisão técnica central: canvas + SVG sobrepostos

O globo é **duas camadas alimentadas pela mesma projeção**:

| Camada | Conteúdo | Custo |
|---|---|---|
| Canvas (fundo) | ~168 países não cobertos, graticule, contorno da esfera | redesenho por frame, barato |
| SVG (frente) | os 9 países curados, marcadores de evento, rotas | poucas dezenas de elementos |

Resolve três problemas simultaneamente:

1. **Clique e hover em país saem de graça** — evento de DOM, sem hit-testing manual em canvas
2. **DrawSVG funciona nas rotas** — rota é elemento SVG real, não pixel desenhado
3. **A divisão técnica coincide com a curadoria** — o que é interativo é exatamente o que está aceso

Um único objeto de projeção alimenta as duas camadas; elas não podem dessincronizar. O `alpha`
da interpolação tem um dono só: o hook `useProjection()`.

---

## 5. Modelo de dados

```
Pais        iso, nome, periodos[]
Periodo     paisId, inicio, fim, rotulo, regime, textoMdx, figuras[], eventos[]
Figura      nome, paisId, cargos[], alegacoes[], textoMdx
Alegacao    enunciado, status, datas, fontes[]        ← fontes obrigatório
Fonte       tipo, titulo, autor, publicacao, data, url, citacao
Evento      data, ponto, paises[], titulo, textoMdx, fontes[]
Viagem      titulo, ano, paradas[]
Parada      local, coords, data, textoMdx
Indicador   paisId, nome, unidade, fonte, serie[]     ← CSV
```

**Fonte é entidade, não string.** A mesma sentença citada em cinco alegações existe uma vez só,
o que viabiliza uma página "tudo que depende desta fonte". Barato agora, impossível de
retroajustar depois.

### Organização em disco

```
conteudo/
  paises/
    brasil/
      periodos.json
      textos/
        1500-colonia.mdx
        2023-lula3.mdx
  figuras/
    lula.json
    bolsonaro.json
  fontes/
    fontes.json
  viagens/
    cabral-1500.json
    colombo.json
  indicadores/
    br-pobreza-pnad.csv
```

O vault do Obsidian aponta para `conteudo/`. Você continua escrevendo no Obsidian; os arquivos
já nascem no lugar certo.

---

## 6. Alegações contestadas

O problema mais difícil do projeto. Duas armadilhas simétricas:

- **Texto corrido** → o site vira panfleto de quem escreveu
- **"Os dois lados" em colunas** → máquina de falso equilíbrio; duas colunas de mesma largura
  afirmam um empate entre uma sentença judicial e um boato viral

### Solução

Alegação é entidade própria com `status` de lista fechada e fontes obrigatórias. Texto de
contexto em prosa vem **por cima**, nunca no lugar.

| Status | Significado |
|---|---|
| `transito-julgado` | decidido, sem recurso possível |
| `em-julgamento` | denúncia aceita, processo correndo |
| `investigacao` | apuração aberta, sem denúncia formal |
| `investigacao-arquivada` | apuração encerrada sem denúncia, por insuficiência de prova |
| `anulado` | decisão derrubada por vício de forma ou competência |
| `prescrito` | extinto por prazo |
| `alegacao-sem-processo` | circula publicamente, nunca virou apuração |
| `desmentido` | checagem documental refuta |

O ganho: as distinções que os dois campos políticos mais confundem ficam **no rótulo**, não
diluídas na prosa.

- anulado ≠ inocentado
- arquivado ≠ desmentido
- denunciado ≠ condenado
- prescrito ≠ absolvido

> **Adendo de 2026-08-13.** O status `investigacao-arquivada` foi acrescentado ao
> escrever as alegações reais. O caso que o exigiu: um inquérito aberto e depois
> arquivado por insuficiência de prova não cabia em `investigacao`, que afirma
> apuração em curso, nem em `desmentido`, que afirma refutação documental do fato.
> Rotular com qualquer um dos dois mentiria. É o tipo de lacuna que só aparece
> com dado real.

O leitor de esquerda e o de direita veem a mesma tela. Ninguém precisa confiar no autor —
status e fonte fazem o trabalho.

> **Aviso de verificação:** todo exemplo usado durante o design (triplex, cartão corporativo,
> tentativa de golpe) foi **ilustrativo do mecanismo**, não verificado. O andamento processual
> desses casos mudou recentemente e está próximo ou além do limite de conhecimento do
> assistente. Cada card precisa ser conferido na fonte primária antes de entrar.

---

## 7. Indicadores

É onde o site mais facilmente mentiria, dos dois lados. A regra: **ninguém escreve "conquistas"**.

| Errado | Certo |
|---|---|
| Lista de bullets: "tirou milhões da pobreza" | Série do IBGE com o mandato sombreado |

Sem número, sem fonte e sem recorte temporal, é opinião com marcador. A série resolve porque a
curva não é do autor — ele apenas sombreia quem estava no poder. O leitor tira a própria
conclusão, e discordar de uma linha com fonte é bem mais difícil.

`<IndicadorChart>` recebe a série e as faixas de mandato, e sempre renderiza a atribuição de
fonte junto ao gráfico.

---

## 8. Viagens e rotas

Viagem é entidade com **paradas datadas**; a linha é derivada das paradas, nunca digitada.

```json
{
  "titulo": "Frota de Cabral",
  "paradas": [
    { "local": "Lisboa",       "data": "1500-03-09", "coords": [-9.14, 38.72] },
    { "local": "Cabo Verde",   "data": "1500-03-22", "coords": [-23.51, 14.93] },
    { "local": "Porto Seguro", "data": "1500-04-22", "coords": [-39.06, -16.45] }
  ]
}
```

Como cada parada tem data própria, arrastar a barra de tempo desenha a rota **até onde a frota
havia chegado**. Com DrawSVG, isso é um `.progress()` sobre o `path`, não um sistema. A viagem
deixa de ser desenho estático e passa a acontecer.

Cada parada é clicável e tem texto próprio.

---

## 9. Componentes

`<Atlas>` é o único dono do estado: `{ tempo, paisSelecionado, modo }`. Todo o resto recebe
props e não guarda estado próprio — assim globo, barra de tempo e dossiê não podem dessincronizar.

| Componente | Responsabilidade | Depende de |
|---|---|---|
| `<Atlas>` | estado e orquestração | — |
| `<GlobeCanvas>` | mundo de fundo, graticule, esfera | `useProjection` |
| `<GeoOverlay>` | 9 países clicáveis, marcadores, rotas | `useProjection` |
| `useProjection()` | projeção interpolada; dono único do `alpha` | d3-geo |
| `<TimeScrubber>` | barra de tempo; controla `gsap.timeline` via `.progress()` | gsap |
| `<PeriodoDossie>` | retrato datado de um país | conteúdo |
| `<FiguraPage>` | trajetória, alegações, indicadores, fontes | conteúdo |
| `<AlegacaoCard>` + `<StatusBadge>` | uma alegação e seu status | — |
| `<IndicadorChart>` | série com mandato sombreado e fonte | conteúdo |
| `<FonteList>` | citações de uma página | conteúdo |

---

## 10. Tratamento de erro

Não há erro de runtime a tratar, porque não há dado em runtime. Toda validação ocorre no build,
via zod:

- Alegação sem fonte → **build falha**
- `status` fora do enum → build falha
- Parada de viagem sem data ou coordenada → build falha
- Período com `fim` anterior a `inicio` → build falha
- CSV de indicador incompatível com o cabeçalho declarado → build falha
- Referência a `fonteId` inexistente → build falha

Conteúdo inválido nunca vai ao ar. A regra "sem fonte não renderiza" deixa de depender de
disciplina e vira mecânica.

---

## 11. Testes

Prioridade por valor, não por cobertura:

1. **Validador de conteúdo** (Vitest) — schema, enum de status, fonte obrigatória, integridade
   referencial. São os testes que impedem o site de publicar afirmação sem lastro.
2. **Matemática da projeção** — `alpha` nos limites (0, 1) e no meio; resolução data → período,
   incluindo bordas e períodos abertos.
3. **Smoke E2E** (Playwright) — globo renderiza; clicar em país abre dossiê; arrastar o tempo
   altera o comprimento da rota.

Sem snapshot de canvas — quebra por diferença de antialiasing e não detecta regressão real.

---

## 12. Limitações aceitas conscientemente

### Fronteiras são modernas

O TopoJSON tem as fronteiras de hoje. A França de 1420 será desenhada com o contorno da França
de 2026 — factualmente errado. Datasets de fronteiras históricas existem, mas são pesados e de
granularidade irregular.

**Decisão v1:** usar fronteiras modernas e **declarar isso na interface**, com aviso no mapa
quando o tempo estiver antes de 1900. Fronteira histórica é item de v2.

Isso destoa do rigor do resto do projeto. Mas mentir em silêncio seria pior que mentir com aviso.

### O gargalo é escrita, não código

O sistema fica pronto muito antes do conteúdo. Nove países × três períodos são 27 dossiês a
escrever, mais figuras, alegações e fontes. É onde projetos assim morrem.

Mitigação: a IA atua como ferramenta de autoria — pesquisa, estruturação e redação dos arquivos
de conteúdo — e não como funcionalidade do produto.

---

## 13. Registro de decisões

| Decisão | Escolha | Alternativas descartadas |
|---|---|---|
| Unidade de conteúdo | país × período | país isolado; evento isolado; nota do Obsidian |
| Escopo | 9 países curados | mundo raso; recorte temático |
| Reino Unido vs Inglaterra | Reino Unido como país; nome de época no `rotulo` do período | geometria separada para a Inglaterra |
| Alegações | entidade com status + fonte, prosa por cima | duas colunas; só prosa com notas |
| Governo | série de indicador com fonte | lista de conquistas |
| Conteúdo | MDX + JSON no repo, vault apontando para `conteudo/` | Obsidian puro; banco + painel admin |
| Globo | D3 geo unificado | react-globe.gl; MapLibre GL v6 |
| Animação | GSAP + DrawSVG | rAF manual |
| 3D | nenhum | img2threejs (exigiria Three.js, contraria a meta de leveza) |
| Rotas | viagem com paradas datadas | LineString única; só pontos |
| IA | ferramenta de autoria | recurso no produto |
