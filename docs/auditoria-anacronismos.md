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
— quase certamente uma feição mal rotulada.

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

## O caminho que continua aberto

Corrigir de fato os cinco casos de 1914–1945 é trabalho de **fatia local** — não se
conserta a base baixada, escreve-se a própria, com fonte e para o período que
estiver sendo estudado. A infraestrutura existe (`scripts/fatias-locais.ts`,
`conteudo/fatias/manifesto.json`, hash conferido no build). Cinco casos num
intervalo de trinta anos é exatamente o tamanho de uma fatia local.

## Como repetir

Para cada fatia, decodificar o TopoJSON, coletar `properties.n` passado por
`nomeCanonico(n, ano)`, e montar `Map<nome, anos[]>`. Daí:

- **piscam**: `anos.length < indice(último) - indice(primeiro) + 1`
- **antes de existir**: comparar `anos[0]` com a data de fundação
- **uma fatia só**: `anos.length === 1` (foram 1.604, e a maioria é entidade
  efêmera legítima — só vira suspeita quando é Estado moderno)
