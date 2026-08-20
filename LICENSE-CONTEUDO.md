# Licenças do conteúdo

Este repositório tem **duas licenças**, e a divisão não é burocracia: o código e o
conteúdo têm origens diferentes e obrigações diferentes.

| o que | pasta | licença |
|---|---|---|
| código | `app/`, `components/`, `lib/`, `scripts/` | **MIT** — ver [`LICENSE`](LICENSE) |
| texto, dossiês, notas, figuras, ilhas, fontes | `conteudo/` | **CC BY-SA 4.0** |
| geometria de fronteira | `public/geo/`, `conteudo/fatias/` | **CC BY-SA 4.0** (herdada) |
| documentação | `docs/`, `README.md` | **CC BY-SA 4.0** |

O texto integral da CC BY-SA 4.0 está em
<https://creativecommons.org/licenses/by-sa/4.0/legalcode>, e o resumo legível em
<https://creativecommons.org/licenses/by-sa/4.0/deed.pt_BR>. O que segue é a
aplicação dela aqui, não um substituto dela.

## Por que o conteúdo é share-alike, e não algo mais permissivo

Não foi escolha estética. A camada de fronteiras vem do
[historical-basemaps](https://github.com/aourednik/historical-basemaps), de
A. Ourednik, sob **CC BY-SA 4.0**, e o atlas não a copia: ele a **deriva** —
simplifica, quantiza, normaliza grafias e, em duas datas, corrige anacronismo.
Share-alike quer dizer que obra derivada continua sob a mesma licença. Não havia
como o mapa deste projeto ser outra coisa.

Dado isso, deixar a prosa sob licença mais frouxa criaria dois regimes dentro do
mesmo repositório e uma pergunta a cada arquivo. Uma regra só é mais honesta, e ela
protege o que importa aqui: **quem usar este atlas tem de creditar e tem de manter
aberto.** Um estudo que qualquer um pode fechar e vender não era o objetivo.

## Como creditar

Ao reusar texto ou geometria deste projeto:

> Atlas histórico (github.com/pedrospeckv/globe-project), CC BY-SA 4.0.
> Fronteiras derivadas de historical-basemaps, de A. Ourednik, CC BY-SA 4.0.

Se você alterou algo, diga que alterou. É exigência da licença, e é o mesmo
princípio que o projeto aplica a si mesmo: as duas fatias corrigidas declaram no
manifesto o que foi mudado, por quê, e onde está a original.

## Fontes de terceiros, que NÃO passam a ser CC BY-SA

Nada aqui relicencia obra de outros. Três casos importam:

- **Natural Earth** (`public/geo/fatias/locais/2018.json`) — domínio público. Fica
  domínio público.
- **Citações de fontes** (`conteudo/fontes/`) — trechos de livro, decisão judicial,
  reportagem e documento oficial entram sob citação, com autor, publicação e data.
  O direito de cada um é de quem o detém.
- **Imagens** — só entram do Wikimedia Commons, com crédito e licença próprios em
  cada arquivo. **Não se hotlinka imagem de veículo de imprensa**, e não se sobe
  imagem cuja licença não se sabe. O schema `Imagem` exige `credito` e `licenca`
  porque atribuição faltando aqui não é descuido de estilo, é violação.

## O projeto não é comercial

É ferramenta de estudo, feita para entender melhor mundo e geografia. A licença
permite uso comercial por terceiros — CC BY-SA não proíbe — desde que creditem e
mantenham aberto. Quem mantém o projeto não vende nada e não pretende.
