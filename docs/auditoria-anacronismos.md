# Auditoria de anacronismo nas fatias de fronteira

Feita em 2026-08-19 sobre as 54 fatias de `public/geo/fatias/`, com os nomes já
passados por `nomeCanonico`. O script foi de uso único; o método está descrito
aqui para poder ser repetido.

## Por que a auditoria existiu

Uma captura de tela em 1945 mostrava **Paquistão** e **Bangladesh** rotulados. O
Paquistão foi criado em agosto de 1947 e o Bangladesh em 1971. A pergunta era se
havia três casos — uma tabelinha — ou cem, e a resposta muda o remédio.

## Método, e a distinção que importa

**Interno** (só o dado, sem eu afirmar nada): nome que aparece, desaparece e volta
("pisca"), e nome que aparece numa única fatia.

**Externo**: comparação com datas de fundação. São afirmações minhas, e por isso a
lista foi curta e só de casos sem controvérsia razoável — 64 Estados. **Nada disso
entrou no projeto, porque não tem fonte.** Serviu para dimensionar.

## Resultado: 36 de 64 aparecem antes de existir

E a distribuição é o achado, não a contagem:

| entidade | fundação | primeira aparição | erro | é erro da base? |
|---|---|---|---|---|
| Armênia | 1991 | 323 a.C. | 2.314 anos | não — reino armênio antigo |
| Gana | 1957 | 800 | 1.157 anos | não — Império do Gana |
| Sérvia | 2006 | 900 | 1.106 anos | não — principado medieval |
| Geórgia | 1991 | 1000 | 991 anos | não — reino da Geórgia |
| Marrocos | 1956 | 1300 | 656 anos | não — sultanato |
| Filipinas | 1946 | 1492 | 454 anos | discutível — topônimo espanhol de 1543 |
| Argélia | 1962 | 1900 | 62 anos | não — Argélia francesa |
| Nigéria | 1960 | 1914 | 46 anos | não — colônia unificada em 1914 |
| **Bangladesh** | 1971 | 1945 | 26 anos | **sim** |
| **Israel** | 1948 | 1938 | 10 anos | **sim** |
| **Síria** | 1946 | 1945 | 1 ano | limítrofe |
| **Paquistão** | 1947 | 1945 | 2 anos | **sim** |
| **Finlândia** | 1917 | 1914 | 3 anos | **sim** |

A maioria **não é erro**: a base reaproveita o nome moderno para o predecessor
histórico. É prática legítima em cartografia histórica — e engana quem não foi
avisado, porque "Gana" em 800 fica em território que não é o do Gana de hoje.

**Erros de verdade são cinco**, todos entre 1914 e 1945. O do Bangladesh é o mais
claro: ele aparece em 1945 e **desaparece em 1960**, quando era Paquistão Oriental
— quase certamente uma feição mal rotulada. Três foram corrigidos e dois ficaram;
ver as duas seções ao fim, que é onde a distinção entre eles se sustenta.

## O segundo achado: 232 nomes piscam

Aparecem, somem e voltam. Parte é história real — a Polônia não existiu de 1795 a
1918. Mas o padrão dominante é **lacuna de nomeação**:

- **Egito**: aparece de 4000 a.C. a 700 a.C., sai do mapa por dois mil anos, volta
  em 1715. O Egito ptolomaico e o romano existiam; a base só não os chama de Egito.
- **Japão**: falta em 1492, 1500 e 1783.
- **Chipre**: falta de 1600 a 1900.

Nessas fatias o território aparece como cinza anônimo, e sem aviso o cinza afirma
"sem Estado conhecido" onde havia Estado.

## A decisão, e a proposta que ela descartou

Eu havia proposto uma **tabela de existência** — entidade, ano de fundação, fonte —
que esconderia a entidade nas fatias anteriores. A auditoria matou a ideia:
corrigiria cinco casos e apagaria a Armênia antiga, o Império do Gana e a Sérvia
medieval junto. Trinta e um erros novos para consertar cinco.

O que ficou foi **declarar a limitação onde ela é vista**, que é a mesma regra do
aviso de defasagem: uma nota na legenda dizendo que a base reaproveita nomes
modernos para predecessores, e que território sem nome não quer dizer território
sem Estado. Ver a nota em `components/atlas/Atlas.tsx`.

## O que foi feito com os cinco casos

Feito em 2026-08-19, por **fatia local** — não se conserta a base baixada,
deriva-se a própria a partir dela, com a correção registrada. O script é
`scripts/gerar-fatias-corrigidas.ts` e as saídas são `conteudo/fatias/1938.geojson`
e `1945.geojson`, que **substituem** as baixadas de mesmo ano no índice (campo
`substitui` no manifesto). A baixada fica no disco de propósito: é dela que a
corrigida é derivada, e apagá-la tornaria a correção irreproduzível.

Nenhuma coordenada foi inventada. As operações são três, e só a terceira mexe em
geometria: **remover** feição duplicada, **renomear**, e **fundir** — esta última
pelos arcos compartilhados da topologia, que é o que dissolve uma fronteira sem
aproximar nada, conferida por área (4.155.628 km² em três partes viraram os mesmos
4.155.628 km² em uma).

| caso | fatia | o que se fez |
|---|---|---|
| Paquistão 1947 | 1945 | fundido em `British Raj`, com `s=United Kingdom` |
| Bangladesh 1971 | 1945 | fundido no mesmo |
| Israel 1948 | 1945 | renomeado para `Mandatory Palestine (GB)` |
| Israel 1948 | 1938 | removida a **duplicata**: o mesmo território estava desenhado duas vezes, 31.296 km² e a mesma caixa envolvente nas duas |
| Sri Lanka 1972 | 1945 | renomeado para `Ceylon`, que é como a fatia de 1938 já o chama |
| — | 1938 | removido um fragmento chamado `India` com área ZERO na longitude 56,1°, que é Omã |

Fundir e não só renomear, no caso indiano, porque renomear deixaria na tela as
linhas da partição de 1947 dois anos antes de existirem. E o nome é `British Raj`
porque é o que o próprio upstream usa para a mesma entidade em 1880, 1900, 1914,
1920, 1930 e 1938 — chamá-la de `India` daria cor diferente à mesma coisa ao
cruzar de 1938 para 1945, que é o defeito que a tabela de grafias existe para
evitar.

## Os dois casos que ficaram, e por que ficar é a resposta certa

**Finlândia 1914.** Parecia o caso mais barato dos cinco: ela aparece com 333.064
km² e **sem sujeito**, o que na tela lê como Estado soberano, e em 1914 era o
Grão-Ducado da Finlândia, autônomo dentro do Império Russo. Uma linha declarando
`s` resolveria — `s` é o idioma da própria base para dependência, aparece em 32
feições dessa fatia, e não afeta cor, só o texto do hover.

A medição derrubou a ideia. A mesma fatia de 1914 tem **pelo menos uma dúzia de
dependências sem sujeito declarado**, no mesmo pé: `Netherlands Indies`,
`Kamerun`, `German South-West Africa`, `Malaya`, `Uganda`, `Tibet`, `Xinjiang`, e
`Denmark` com 2.122.882 km², que é a Dinamarca com a Groenlândia embutida.
Consertar só a Finlândia seria arbitrário; consertar as doze é reatribuir
soberania na fatia inteira, com uma decisão em cada uma — o Canadá de 1914 era
Domínio autônomo, e ali a omissão é defensável.

E o fundo da questão: **a Finlândia de 1914 existia**, com aquele nome e aquelas
fronteiras. Ela pertence à mesma classe da Armênia de 323 a.C. e do Gana de 800 —
nome real para um predecessor, dependência não anotada —, que é a classe que a
nota da legenda declara. Não à classe do Paquistão de 1945, que não existia sob
nenhuma descrição.

**Síria 1945**, que esta auditoria já tinha marcado como limítrofe. A
independência é datada de 17 de abril de 1946, com a saída das tropas francesas;
mas a Síria assinou a Carta da ONU em 26 de junho de 1945, como membro fundador.
As duas leituras são defensáveis, e trocar uma defensável por outra não é
correção.

## Uma afirmação errada que esta auditoria produziu

Ao escrever a nota de procedência da fatia de 1938, eu afirmei que a Síria dela
tem área zero e portanto é invisível. **Era falso**, e do mesmo jeito do erro da
Antártida: vi a primeira feição que casava com o nome e parei. A fatia traz DUAS
chamadas `Syria (France)` — uma degenerada com 0 km² e outra com 314.505 km², que
é a que se vê. A Síria de 1938 está no mapa. Fica registrado porque o padrão é o
que importa: a primeira correspondência não é a única, e conferir a segunda custa
uma linha.

O que permanece verdadeiro é a outra falha de geometria da mesma fatia: a feição
chamada `Jordan` tem 30 km², e o território tinha cerca de 90.000. Essa não se
conserta sem desenhar fronteira, que é o que a regra proíbe. O nome também está
adiantado — em 1938 era o Emirado da Transjordânia —, mas renomear deixaria uma
linha de 30 km² com o nome certo, o que não conserta nada.

## Como repetir

Para cada fatia, decodificar o TopoJSON, coletar `properties.n` passado por
`nomeCanonico(n, ano)`, e montar `Map<nome, anos[]>`. Daí:

- **piscam**: `anos.length < indice(último) - indice(primeiro) + 1`
- **antes de existir**: comparar `anos[0]` com a data de fundação
- **uma fatia só**: `anos.length === 1` (foram 1.604, e a maioria é entidade
  efêmera legítima — só vira suspeita quando é Estado moderno)
