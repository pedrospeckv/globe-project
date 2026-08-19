# Onde o Globe Project parou

Resumo das sessões encerradas em **19 de agosto de 2026**. Serve para retomar
sem precisar reler o histórico.

Duas sessões correram em paralelo neste dia, com fronteira combinada: uma no
mapa (`lib/geo/`, `components/atlas/`, `conteudo/fatias/`) e outra no conteúdo.
O que está descrito abaixo em detalhe é a de **conteúdo**; da sessão do mapa
ficam registrados apenas os commits, porque quem escreve aqui não os fez e não
tem como narrar as decisões por trás deles — `git log 19456fe..4a17b42` conta.

---

## A sessão de conteúdo — episódios, e o Brasil entre 1808 e 1822

Pedro pediu duas coisas de uma vez: o buraco entre a Colônia e o Império, e a
ocupação holandesa em Pernambuco como "curiosidade geopolítica". Junto veio um
ZIP (`world-war-ii-timeline-memorial.zip`) com o pedido de que as páginas
tivessem imagens que se aproximam e se afastam conforme a rolagem.

**O ZIP não faz isso.** Ele tem `group-hover:scale-105` — zoom no hover, com o
mouse parado em cima. Paralaxe de rolagem é outro efeito, e foi ele que entrou.
O ZIP também faz hotlink de imagens da Britannica, do New York Times, do
Guardian e da NPR, o que `lib/conteudo/imagem.ts` já proibia por escrito.

### `Episodio`: o tipo de conteúdo que faltava

Recorte geopolítico narrado em blocos datados, cada um com imagem de época.
Existe porque a unidade país × período não dá conta: o Brasil holandês durou 24
anos dentro de um período colonial de três séculos.

As alternativas foram descartadas com motivo, e o motivo está no cabeçalho de
`lib/conteudo/episodio.ts`:

| descartado | por quê |
|---|---|
| `Evento` | é ponto no mapa numa data, e tem fonte **opcional** de propósito |
| `Nota` | é rascunho de estudo declarado, sem revisão — o oposto disto |
| `Entidade` do período | vale para o período inteiro; marcaria a Colônia como dividida de 1500 a 1822 |
| período próprio | fatiaria a Colônia em pedaços que só existem para acomodar um caso |

Três regras do schema que valem lembrar:

- **Fonte é obrigatória** (`min(1)`), ao contrário de evento e período. Episódio
  é prosa longa sobre assunto escolhido por ser curioso, que é justamente onde a
  narrativa escorrega sem ninguém notar.
- **Bloco fora de ordem cronológica quebra o build.** A página não reordena
  nada, porque reordenar em silêncio esconderia o erro de digitação.
- **`data` e `rotulo` são campos separados.** A data ordena e valida; o rótulo é
  o que aparece na tela, e permite "1637–1644" ou "c. 1640" onde a data exata
  mentiria.

Página em `/episodio/[id]`, com entrada pelo dossiê do período e pela central do
país. O episódio entrou no espaço de nomes das ligações `[[...]]`, e o texto dos
blocos é varrido pela integridade como o resto.

### O que foi escrito

| o quê | tamanho |
|---|---|
| `br-reino-unido` (1808–1822), período novo | 3.896 caracteres, 6 fontes |
| `/episodio/brasil-holandes` (1624–1654) | 8 blocos, 8 imagens, 6.722 caracteres, 7 fontes |
| `/episodio/corte-no-rio` (1807–1821) | 9 blocos, 6 imagens, 5.896 caracteres, 7 fontes |

A Colônia terminava em 1822 e engolia a corte no Rio em dois parágrafos. Agora
termina em **1808**, e o parágrafo de fecho virou passagem de bastão.

Os dois episódios fecham nomeando o que **não** se confirma, no lugar que o
memorial reserva ao "In Memoriam": o Nassau tolerante como personagem moral (a
mesma administração tomou Elmina em 1637 e Luanda em 1641 para abastecer os
engenhos), os Guararapes como nascimento do Exército, o declínio do açúcar como
efeito direto da passagem neerlandesa pelo Caribe — e, no outro, o que a tese da
interiorização da metrópole não resolve.

### Imagens: 14, e nenhum endereço digitado à mão

Todas do Wikimedia Commons. Um script consultou a API e montou `url`, `licenca`,
`credito` e `origem` a partir do que o Commons declara; só `alt` e legenda foram
escritos. **É o passo que impede URL inventada**, e vale repetir em toda imagem
futura. Licenças: domínio público, CC0 e uma CC BY 4.0.

As legendas dizem quando a imagem é posterior ao fato — o Meirelles dos
Guararapes é de 1879, o Parreiras de 1817 é de 1918, a foto da sinagoga Kahal
Zur Israel é de 2020. Pintura de época é documento do olhar, não fotografia do
fato, e a página diz isso uma vez no rodapé.

Os 14 endereços foram conferidos servindo 200. **Cuidado ao repetir a
conferência:** o `upload.wikimedia.org` devolve 429 para rajadas de requisição, e
o 429 se parece com link morto sem ser. Recuo progressivo entre as chamadas.

### A paralaxe, e por que ela foi testada em vez de vista

`components/conteudo/BlocoNarrado.tsx` desloca a foto dentro da moldura em ritmo
diferente do texto e cresce a moldura ~2% quando o bloco passa pelo centro da
tela. Só `transform`, um `requestAnimationFrame` por quadro, e
`prefers-reduced-motion` desliga tudo.

**O efeito não é observável no navegador de verificação.** Sem janela visível a
página não compõe quadros: `requestAnimationFrame` nunca é chamado e o
`loading="lazy"` não resolve — nenhum transform aparece e nenhuma imagem carrega,
e isso *não* é bug. Diagnóstico que custou tempo e é bom não repetir.

A resposta foi mover a conta para uma função pura, `lib/ui/paralaxe.ts`, testada
nos extremos, no centro, na monotonicidade e na garantia de que o deslize nunca
gasta a folga inteira (é o que impede a borda aparecer). Um teste de componente
com rAF síncrono confere que o `transform` chega ao DOM.

---

## Estado atual do acervo

- **85 períodos**, 9 países, **250 mil caracteres**, média de **2.942** por período
- **2 episódios**, 17 blocos, **14 imagens** com crédito e licença
- **267 fontes**
- 4 figuras, 10 alegações, 11 eventos, 2 viagens, 2 indicadores, 17 ilhas
- 29 notas, 27 com fonte
- **729 testes** passando, 39 arquivos de teste
- `pnpm build` gera **135 páginas** estáticas

Comandos: `pnpm validar`, `pnpm test`, `pnpm build`.
Servidor de desenvolvimento: `node scripts/dev.mjs` a partir de `D:\Globe Project`
(ou `.claude/launch.json`, entrada `atlas`, porta 3000).

---

## Armadilhas conhecidas do projeto

- **Vitest não faz typecheck.** Só `pnpm build` pega erro de tipo. Mordeu
  seis vezes.
- **`.default([])` do zod torna o campo obrigatório no tipo de saída** e
  quebra fixtures de teste. Aconteceu 5 vezes — a última foi `Acervo.episodios`,
  que derrubou 21 testes de uma vez em três arquivos de fixture.
- **Next 16 recusa um segundo `next dev` no mesmo diretório.** Ele sobe, diz
  "Another next dev server is already running" com o PID do primeiro, e morre.
  Duas sessões em paralelo compartilham **um** servidor; não adianta mexer em
  porta nem em `autoPort`. Use o que já está de pé.
- **Navegador sem janela visível não compõe quadros.** `requestAnimationFrame`
  nunca dispara e `loading="lazy"` nunca resolve. Efeito de rolagem e imagem
  remota parecem quebrados sem estar. Verificar por teste, não por captura.
- **`document.body.textContent` inclui o payload RSC dentro de `<script>`.**
  Procurar `[[` ali dá falso positivo com o markdown cru do servidor. Use
  `main.innerText`, que é só o que foi renderizado.
- **`upload.wikimedia.org` devolve 429 em rajada de requisições**, e o 429 se
  parece com link morto. Recuo progressivo ao conferir imagens em lote.
- **PowerShell 5.1**: here-string quebra com aspas duplas internas. Usar
  `git commit -F <arquivo>` sempre.
- **Hidratação**: nunca `toLocaleString`; arredondar string numérica montada
  à mão (`toFixed(3)`). Componente cliente não deve escrever `style` no
  primeiro render — só dentro do efeito.
- **Caches por origem.** `http://26.192.204.0:3000` é outra origem com cache
  próprio; já custou uma sessão de depuração de um bug que não existia.
- Escrever conteúdo por script `.mjs` no scratchpad, montando o JSON com
  template literals, evita inferno de escape. Foi assim que entraram os 84
  períodos e os dois episódios.

---

## Aberto — por ordem do que eu faria primeiro

### 1. Episódio só existe para o Brasil
O mecanismo está de pé e testado, e os dois únicos episódios do acervo são
brasileiros. É o mesmo desequilíbrio que as alegações já têm (item 4), agora em
duas entidades em vez de uma. Candidatos que o texto dos períodos já nomeia sem
desenvolver: a partilha de Berlim, a Caxemira de 1947, Okinawa, a fome soviética
de 1932-33.

### 2. Não existe índice de países
A única porta de entrada é clicar num país **aceso** no globo. Quem chega numa
data em que o Japão não está aceso não tem como descobrir que existe página do
Japão. Proposta: página `/paises` com os 9 países e seus períodos, linkada do
topo. URLs diretas hoje: `/pais/BRA`, `/pais/FRA`, `/pais/GBR`, `/pais/USA`,
`/pais/DEU`, `/pais/RUS`, `/pais/CHN`, `/pais/JPN`, `/pais/IND`.

### 3. Data de fonte aparece crua na tela
"1815-12-16" em vez de "16 de dezembro de 1815". `rotuloDeData` só formata anos
a.C. e devolve o resto como veio. Vale para o site inteiro, não só para as
páginas novas — por isso não foi mexido junto com o conteúdo.

### 4. Amarrar fontes de países não-Brasil a alegações específicas
O mecanismo de `Alegacao` (que exige fonte por schema) segue com 10 registros,
todos brasileiros. A sessão de conteúdo de 19 de agosto **não** acrescentou
nenhuma, de propósito, para não aumentar a assimetria.

### 5. Figuras: 4 no acervo, dezenas nomeadas no texto
Só existem Lula, Bolsonaro, Joana d'Arc e Fábio Luís. Os textos nomeiam
Ambedkar, Asoka, Wu Zetian, Bismarck, Nassau, Filipe Camarão, Henrique Dias,
Debret e dezenas de outros sem que nenhum tenha página nem registro de alegações.

### 6. `Entidade.fontes` é campo morto
Validado pelo `verificarLigacoes` e **nunca renderizado** pela página de
período. Hoje está vazio em todas as entidades, então nada some da tela, mas é
campo que aceita dado e esconde.

### 7. Deploy na Vercel — decisão pendente
O app é 100% estático e o plano gratuito serve. O CLI já está instalado e não há
remote git, mas `npx vercel --prod` sobe a pasta direto. Claude não faz o login
(ação de credencial), e o conector Vercel exige sessão interativa.

**Decidido:** as notas vão públicas. Das 29, 27 têm fonte; as duas que faltam
seguem cruas de propósito — `os-gregos` por decisão do Pedro, `o-mundo-de-sofia`
porque não depende de país nenhum. A página diz qual é qual.

Duas coisas do caderno que é bom não redescobrir do zero:

- `o-principe` não tem o que pesquisar: a nota é um método para ler Maquiavel em
  italiano, não afirmação sobre história. A regra da fonte não se aplica a ela.
- `historia-de-joana-d-arc` (23 mil caracteres, ligada à figura da Joana)
  declarava `author: [[ChatGPT]]` e `source: chatgpt.com` no cabeçalho do cofre.
  Publicar como leitura própria não bate. A proveniência foi removida junto com
  o frontmatter e está no histórico do git — **antes de subir, decidir o que
  fazer com essa nota.**

---

## Regras editoriais que valem para todo o acervo

Firmadas na sessão de 17 de agosto, quando os 84 períodos foram escritos, e
seguidas pelo conteúdo de 19 de agosto.

**1. Fonte com lastro fino, não fonte genérica.** Cada país recebeu documentos e
obras escolhidos por sustentar afirmações específicas: constituições, decisões
judiciais, relatórios de comissão, levantamentos estatísticos.

**2. Onde o fato é disputado, entram DUAS fontes que discordam, e as
citações nomeiam uma à outra.** Foi usado quatro vezes:

- Applebaum × Davies-Wheatcroft — a fome soviética de 1932-33 foi genocídio?
- Elvin × Pomeranz — por que a China Song não industrializou?
- Yang Jisheng × Dikötter — 36 ou 45 milhões de mortos no Grande Salto?
- Davis × Roy — o peso do domínio colonial sobre a economia indiana

**3. Ressalva em itálico no fim nomeia a disputa em vez de resolvê-la em
silêncio.** Exceção deliberada: a leitura de "direitos dos estados" para a
secessão americana NÃO é tratada como disputa aberta, porque os documentos de
secessão estão publicados e dizem o que dizem.

**4. Nenhum URL inventado.** Livro entra sem URL; só documento e base de dados
cuja localização se conhece levam endereço. Para imagem, a regra virou
mecanismo: o endereço vem da API do Commons, não do teclado.

**5. Período em curso leva ressalva própria** dizendo por que não há distância
crítica.

**6. Rótulo anacrônico é declarado, não disfarçado.** `br-reino-unido` cobre
1808–1822 com um nome que só existe a partir de dezembro de 1815, e a ressalva
final do período diz isso.

### Convenções de escrita

- 2.400 a 3.500 caracteres por período; 500 a 900 por bloco de episódio
- Lead-in em `**negrito**`, nunca `##` (renderiza sem estilo sob o preflight do Tailwind)
- Ressalva final em `*itálico*`
- `[[wikilinks]]` para outros períodos, países, figuras e episódios

**Regra descoberta na prática:** evento só rende ligação útil quando citado
**de fora** do país dele. `[[magna-carta]]` numa página do Reino Unido
resolve para `/pais/GBR` e vira link para si mesmo. Foi tentado e desfeito
três vezes. Funcionam: `[[hiroshima]]` visto dos EUA, `[[pearl-harbor]]` visto
do Japão, `[[queda-muro-berlim]]` visto da Rússia. Episódio **não** tem esse
problema: ele tem página própria, e o link do período para o episódio dele é
navegação de verdade.

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
hachuraria a Índia inteira e a China inteira.

**`Disputa` virou união discriminada:**

- `recorte: "poligono"` — a base separa. Área hachurada, subtraída do país. Crimeia.
- `recorte: "nenhum"` — a base não separa. **Alfinete** num ponto, e a nota entra no dossiê de todos os países envolvidos. Caxemira aparece na Índia e na China.

Um ponto não afirma fronteira; um polígono desenhado por nós afirmaria, e
traçar a Linha de Controle à mão seria decidir num traço o que está em litígio.

**A trava é a parte que mais importa:** `FRACAO_MAXIMA_RECORTE` (5%) e um
teste que percorre toda disputa recortada e recusa polígono acima disso. Outro
teste registra a premissa medida (Srinagar e Nova Délhi no mesmo polígono); se
o `world-atlas` passar a separar a região, ele quebra, e aí a Caxemira pode
virar recorte.
