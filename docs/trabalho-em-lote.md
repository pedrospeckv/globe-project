# Trabalho em lote — o que outro modelo precisa saber para escrever aqui

Este documento é feito para ser **entregue inteiro** a um modelo que não conhece
o repositório: GPT, Deepseek, GLM, Qwen, Kimi, qualquer um. Ele contém o que o
atlas exige, o que a máquina confere sozinha, e — mais importante — o que ela
**não** confere, que é onde o trabalho em lote já falhou uma vez.

Quem escreve prosa aqui não precisa saber programar. Precisa saber a regra.

---

## 1. O que é o atlas, em cinco linhas

Um atlas histórico e geopolítico navegável, feito para estudar. Mostra as
fronteiras do mundo em qualquer data entre 123.000 a.C. e hoje, e dossiês que
contam o que estava acontecendo dentro delas. A unidade de conteúdo é
**país × período**: "França 1420" e "França 2026" são o mesmo tipo de objeto.
Não é obra acadêmica e não é produto — é ferramenta de estudo, aberta.

O conteúdo é escrito **em português do Brasil**.

---

## 2. As quatro regras que reprovam

O build recusa conteúdo que quebre qualquer uma. Não é preferência de estilo:
é `pnpm validar` parando o deploy.

1. **Toda afirmação contestada precisa de fonte.** Uma `alegacao` sem `fontes`
   não passa no schema. Uma figura com trajetória escrita e sem fonte não passa.
2. **Nenhuma URL pode ser inventada.** Agora há máquina conferindo isso —
   `pnpm conferir-links` bate em cada endereço do acervo e reprova em 404 e 410.
3. **Toda imagem carrega crédito, licença e descrição para leitor de tela.**
   Foto sob CC BY-SA publicada sem atribuição é violação de licença, não
   descuido de layout. Use **Wikimedia Commons**, onde cada arquivo declara a
   própria licença. Nunca hotlink de imprensa.
4. **Bloco datado fora de ordem cronológica quebra o build.** Em episódio e em
   trajetória de figura, `data` ordena e `rotulo` é o que aparece na tela — é
   por isso que são campos separados: `data: "1637"` com `rotulo: "1637–1644"`.

---

## 3. O erro que já aconteceu — leia esta seção duas vezes

157 dossiês foram escritos em lote. O autor leu e disse que tinham ficado
**"genéricos"**. A diferença contra os nove escritos à mão não é gosto — foi
medida, e são dois tiques específicos, por mil palavras:

| | lote | escrito à mão | teto aceito |
|---|---|---|---|
| futuro-do-pretérito | 15,0 | 3,0 | **5** |
| adjetivo avaliativo | 1,9 | 0,2 | **1** |

**Futuro-do-pretérito** — "seria deposto", "manteria", "culminaria". Narra o
futuro a partir do passado. Uma vez, encadeia; em toda frase, transforma
história em sinopse: o texto para de contar o que aconteceu e passa a anunciar
o que vai acontecer, sempre de fora e sempre em suspenso.

**Adjetivo avaliativo** — "profundamente", "considerável", "drasticamente",
"significativo". Ocupa o lugar do detalhe concreto. *"Repressão considerável"*
não diz nada que *"dinamitar as cavernas onde a população se abrigava"* não
diga melhor — e a segunda pode ser conferida numa fonte.

> **A regra prática:** onde você for escrever um advérbio de intensidade,
> escreva o fato que o justificaria. Se não souber o fato, o advérbio estava
> cobrindo um buraco.

`pnpm validar` mede isso e imprime a fila de reescrita. Não reprova, mas o
número aparece a cada
validação, e é o que separa lote aproveitável de lote a refazer.

---

## 4. O que a máquina confere, e o que ela não confere

Esta é a tabela mais importante do documento, porque define onde a sua
honestidade é a única barreira.

| o que | confere sozinho? | como |
|---|---|---|
| formato do JSON, campos obrigatórios | **sim** | schema zod, `pnpm validar` |
| fonte citada existe no acervo | **sim** | checador de integridade |
| ligação `[[...]]` aponta para algo real | **sim** | checador de integridade |
| ordem cronológica dos blocos | **sim** | schema zod |
| imagem tem crédito, licença e `alt` | **sim** | schema zod |
| **o endereço existe** | **sim** | `pnpm conferir-links` |
| registro da prosa | mede, não reprova | `pnpm validar` |
| **o livro citado existe** | **NÃO** | ninguém |
| **a fonte sustenta o que a frase afirma** | **NÃO** | ninguém |

As duas últimas linhas são o buraco, e ele é grande: das **617 fontes do
acervo, 30 têm URL**. As outras 587 são 355 livros, 195 documentos oficiais e
27 decisões judiciais — sem endereço, e portanto sem nada que uma máquina possa
perguntar. Um link vivo apontando para a página errada também passa.

Daí as três obrigações que só você pode cumprir:

- **Fonte com URL sempre que a fonte tiver URL.** Documento oficial, decisão,
  reportagem e dataset quase sempre têm. Prefira a fonte primária ao noticiário
  sobre ela: o acórdão, não a matéria sobre o acórdão.
- **Livro só se você souber nomear a edição.** Título e autor exatos. Se a
  lembrança for aproximada, **não invente**: escolha outra fonte, ou diga que
  não achou. Um livro inventado é indetectável aqui e envenena o acervo para
  sempre.
- **Se não achou fonte, diga que não achou.** Entregar menos com lastro vale
  mais do que entregar tudo com invenção. Este projeto conta as próprias
  dívidas em voz alta — uma a mais não custa nada; uma fonte falsa custa a
  credibilidade do atlas inteiro.

---

## 5. Os formatos

Todo conteúdo é JSON. Datas seguem `AAAA`, `AAAA-MM` ou `AAAA-MM-DD`; para
antes de Cristo, `-0044`. `textoMdx` aceita markdown: `**negrito**`, `*itálico*`
e ligações internas `[[id-de-outro-objeto]]`.

### Fonte — `conteudo/fontes/fontes.json` (uma lista)

```json
{
  "id": "applebaum-gulag",
  "tipo": "livro",
  "titulo": "Gulag: A History",
  "autor": "Anne Applebaum",
  "data": "2003",
  "citacao": "Reconstruiu o sistema de campos soviético a partir dos arquivos abertos após 1991 e de memórias de sobreviventes: a escala, a função econômica e o papel do trabalho forçado na industrialização. É a base das ordens de grandeza usadas no atlas para o Gulag."
}
```

`tipo` é um de: `decisao-judicial`, `documento-oficial`, `livro`,
`artigo-academico`, `reportagem`, `dataset`.

**`citacao` é obrigatória na prática** — as 617 fontes do acervo têm uma. E ela
não é um resumo do livro: diz **o que aquela fonte sustenta** e, quando é o
caso, o que ela não sustenta. Compare com a de um texto antigo:

> "Tratado de estadística, tributação, espionagem e guerra associado pela
> tradição ao ministro de Chandragupta Máuria. O texto conservado passou por
> redação e acréscimos ao longo de séculos, e a datação é disputada — por isso
> descreve bem o pensamento político indiano antigo e **não serve como registro
> administrativo direto do império**."

Essa última oração é o padrão da casa. Declarar o alcance da fonte é parte de
citá-la.

### Período de país — dentro de `conteudo/paises/<pais>.json`

```json
{
  "id": "br-regime-militar",
  "inicio": "1964-04-01",
  "fim": "1985-03-15",
  "rotulo": "Regime Militar",
  "regime": "ditadura militar",
  "textoMdx": "...",
  "fontes": ["id-de-fonte"],
  "imagem": {
    "url": "https://upload.wikimedia.org/...",
    "alt": "descrição do que a imagem mostra, para leitor de tela",
    "credito": "Autor · Acervo",
    "licenca": "CC BY 3.0 br",
    "origem": "https://commons.wikimedia.org/wiki/File:...",
    "legenda": "contexto que o alt não dá"
  }
}
```

A imagem precisa ser **de época** — feita dentro do período que ilustra. País
pela metade é defeito, não dívida: ou todos os períodos têm imagem, ou nenhum.

### Alegação — dentro de uma figura

Só para o que é **contestado**. `status` é lista fechada, e as distinções são o
ponto:

```
transito-julgado · em-julgamento · investigacao · investigacao-arquivada
anulado · prescrito · alegacao-sem-processo · desmentido
```

- `anulado` ≠ inocentado — caiu por vício, não por mérito
- `prescrito` ≠ desmentido — extinto por prazo, não refutado
- `investigacao` ≠ `em-julgamento` — apuração aberta ≠ denúncia aceita

O campo `nota` existe para explicar **por que** o status é esse. Use.

### Bloco datado — episódio e trajetória de figura

```json
{
  "id": "lula-1980-dops",
  "data": "1980-04",
  "rotulo": "1980",
  "titulo": "O partido, e a prisão",
  "textoMdx": "...",
  "imagem": { }
}
```

---

## 6. Como entregar

- **Um arquivo JSON por objeto**, no caminho certo: país em
  `conteudo/paises/<nome-em-kebab-case>.json`, figura em `conteudo/figuras/`,
  episódio em `conteudo/episodios/`. Fontes vão todas na lista única
  `conteudo/fontes/fontes.json`.
- **`id` em kebab-case, sem acento**, único no acervo inteiro.
- **Um lote por vez, pequeno o bastante para ser revisado.** Dez países é lote;
  cem é despejo. A revisão humana é o gargalo real, e lote grande demais não
  acelera nada — só adia a descoberta do erro sistemático que está em todos os
  cem.
- **Diga, junto com a entrega, o que você não conseguiu.** Fonte que não achou,
  imagem que não existe sob licença livre, data que as fontes divergem. Essa
  lista vale tanto quanto o conteúdo.

---

## 7. O ciclo de verificação

Rodado por quem recebe o lote, nesta ordem:

```bash
pnpm validar
```

Schema, fontes, ligações e as medidas de registro. Segundos, sem rede. É o
primeiro porque a mensagem de erro dele é endereçada a quem escreve: diz o
arquivo, o campo e o que falta.

```bash
pnpm conferir-links
```

Bate em cada endereço do acervo. Reprova em 404 e 410 — o servidor está no ar e
afirma não ter a página. Barreira de robô (403) e limite de taxa (429) saem como
aviso, não como acusação. Leva cerca de dois minutos na primeira vez e guarda o
resultado por 30 dias.

```bash
pnpm test && pnpm build
```

Um lote só está pronto quando os três passam **e** a fila de reescrita de
registro não cresceu.

---

## 8. O primeiro lote recomendado: a fila de reescrita (fechada)

*Atualização de 2026-09: a fila zerou. Os 166 países com dossiê estão todos
dentro dos tetos — o `pnpm validar` imprime "os 166 países medidos estão
dentro dos tetos de registro". A reescrita de registro não é mais trabalho de
entrada; o lote de estreia hoje é país novo (ver `docs/cobertura.md`) ou os
períodos pós-2018.*

Quando houver país novo escrito em lote, vale o mesmo régua de sempre. O
mecanismo, que já fechou uma fila de 123 países, funciona assim:

> **43 dos 166 países estão dentro dos tetos de registro.** Os outros 123 estão
> na fila, e os piores passam de 26 ocorrências de futuro-do-pretérito por mil
> palavras — cinco vezes o teto.

É o melhor lote de estreia por um motivo que não é conveniência:

- **Não pede fonte nova.** Os 824 períodos com texto já têm fonte. Reescrever
  o registro não cria nenhuma afirmação nova, então o buraco da §4 — a
  bibliografia que ninguém consegue conferir — simplesmente não se abre.
- **A máquina dá nota.** `pnpm validar` mede antes e depois, país por país. É o
  único trabalho de prosa deste repositório em que "melhorou" é um número, e
  não uma opinião — o que torna aferível o que cada modelo entrega.
- **A fila já vem ordenada**, do pior para o melhor, que é a ordem em que a
  mesma hora de trabalho muda mais a leitura.

O pedido, para um lote de dez países, é literalmente este:

> Reescreva o `textoMdx` dos períodos deste país eliminando o
> futuro-do-pretérito e o adjetivo avaliativo. **Não acrescente fato novo, não
> remova fato existente e não toque nas fontes** — a mesma informação, contada
> no passado e com o detalhe concreto no lugar do advérbio. Onde o texto disser
> "seria deposto em 1966", diga "foi deposto em 1966". Onde disser "repressão
> considerável", ou nomeie o que aconteceu, ou corte o adjetivo.

Quem recebe confere com `pnpm validar` e compara o número do país antes e
depois. Se caiu abaixo de 5 e de 1 sem perder informação, o lote presta.

---

## 9. O resumo, se você só for ler um parágrafo

Escreva em português direto, sem futuro-do-pretérito e sem advérbio de
intensidade. Toda afirmação contestada leva fonte, e a fonte leva URL sempre
que existir uma. Livro só se você souber a edição exata — a máquina confere
endereço, não confere bibliografia, e é exatamente aí que um lote apressado
envenena um acervo que ninguém mais consegue auditar. O que você não achou,
declare. Este atlas conta as próprias dívidas na tela; ele não tem vergonha de
buraco, tem de invenção.
