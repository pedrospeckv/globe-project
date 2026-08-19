# Contribuir

Obrigado por chegar até aqui. Este atlas cobre **9 de 174 países**, e o caminho até
o resto é escrever — não programar. Se você quer ajudar, escrever um país é a
contribuição mais valiosa que existe aqui, e a que menos depende de qualquer outra
pessoa.

Comece por [`docs/cobertura.md`](docs/cobertura.md): é a lista de quem falta.

## A regra que resume o projeto

**Toda afirmação precisa de fonte, e nenhuma URL pode ser inventada.**

Não é formalidade. O atlas existe porque mapas históricos costumam desenhar linhas
sem dizer de onde vieram, e porque um texto sobre política sem lastro é opinião com
cara de fato. O `pnpm validar` cobra isso antes de você abrir o PR, e o CI cobra de
novo.

Três consequências práticas:

- **Livro entra sem URL.** Se você não sabe onde o documento está publicado
  online, ele entra sem `url`, com autor, título e data. Uma URL plausível que você
  não abriu é pior que nenhuma.
- **Citação é resumo do que a fonte sustenta**, escrito por você, não trecho
  copiado. Ver os exemplos em `conteudo/fontes/fontes.json`.
- **Imagem só do Wikimedia Commons**, com crédito e licença. Não se hotlinka imagem
  de veículo de imprensa, e não se sobe imagem cuja licença não se sabe.

## O que dá para contribuir

| tipo | onde | dificuldade |
|---|---|---|
| **um país novo** | `conteudo/paises/` | escrever muito, programar quase nada |
| um período novo num país que já existe | `conteudo/paises/<pais>.json` | menor ainda |
| corrigir erro de fato, com fonte | qualquer lugar | pequena |
| nota, figura, evento, ilha | `conteudo/notas/`, `figuras/`, ... | pequena |
| fatia de fronteira de uma data que falta | `conteudo/fatias/` | precisa de base real, ver abaixo |
| mapa, interface, desempenho | `lib/geo/`, `components/` | precisa de TypeScript |

### Um país novo

O guia passo a passo, com um exemplo real, está em
[`docs/adicionar-um-pais.md`](docs/adicionar-um-pais.md). O resumo:

1. Escolha um país de `docs/cobertura.md`, e **abra uma issue dizendo qual** — para
   duas pessoas não escreverem o mesmo.
2. Crie `conteudo/paises/<nome-em-portugues>.json`.
3. Divida a história dele em **períodos**. Período é um recorte com rótulo próprio
   — "Grão-Principado de Moscou", não "Idade Média". Entre 6 e 16 é a faixa dos que
   já existem.
4. Cada período com prosa precisa de pelo menos uma fonte em
   `conteudo/fontes/fontes.json`.
5. Acrescente o país a `lib/geo/iso.ts` (uma linha — ver o gargalo abaixo).
6. `pnpm validar && pnpm test`.

### Uma fatia de fronteira

Precisa vir de **base real**, com procedência declarada no manifesto. Desenhar
fronteira à mão sem fonte é exatamente a afirmação sem lastro que o projeto recusa
em prosa, e o build recusa em geometria. Ver `scripts/fatias-locais.ts`, que
explica o contrato, e `scripts/gerar-fatias-corrigidas.ts`, que mostra o caso de
derivar uma fatia corrigida de outra.

## Gargalo conhecido: `lib/geo/iso.ts`

Hoje adicionar um país exige uma linha em `lib/geo/iso.ts`, uma tabela escrita à
mão que traduz o código numérico do mapa (`"076"`) para o alpha-3 do conteúdo
(`"BRA"`). É o único arquivo compartilhado que um PR de país precisa tocar — e com
165 países pela frente, é onde os PRs vão colidir uns com os outros.

**Está previsto mudar**: o código numérico passa a morar no próprio arquivo do
país, conferido no build contra a geometria que tem de existir. Aí um país novo
será *um arquivo novo* e nada mais. Se você pegar um PR e der conflito nessa
tabela, é isso — resolva mantendo as duas linhas.

## O fluxo

```bash
pnpm install
pnpm validar   # o que mais importa para quem escreve conteúdo
pnpm test
```

Depois: branch, commit, PR. O CI roda `validar`, tipos, testes, lint e build em
cada PR, e a Vercel publica um preview — dá para ver o seu país no mapa antes de
alguém revisar.

### Sobre as mensagens de commit

O projeto escreve mensagens que explicam **por que**, não o que o diff já mostra, e
que registram o que foi considerado e descartado. Não é exigência para aceitar um
PR de conteúdo, mas é o costume da casa e ajuda muito quem vier depois. Veja
`git log` para calibrar.

### Idioma

O conteúdo é em **português**. O código, os identificadores e os comentários também
— `periodos`, `fontes`, `rotulo`. Nomes de países dentro da geometria ficam como a
base os traz, em inglês, e é `lib/geo/nomes.ts` que cuida das grafias.

## O que provavelmente será recusado

Dito com antecedência para ninguém perder trabalho:

- **Afirmação sem fonte**, ou com fonte que não sustenta o que a frase diz.
- **URL não conferida.** Acontece com quem escreve com ajuda de IA: o modelo produz
  um link verossímil que nunca existiu. Abra cada link que você citar.
- **Fronteira desenhada à mão** sem base de origem.
- **Apagar território para "limpar" o mapa.** A base nomeia 627 entidades na
  América do Sul de 1492; apagá-las afirmaria vazio onde a fonte afirma povos. O
  ruído visual se resolve por tamanho, não por omissão.
- **Tom de campanha.** Em assunto contestado o objetivo declarado é que leitor de
  esquerda e de direita vejam a mesma tela. Alegação contestada é uma entidade com
  `status` e fonte obrigatória, não um adjetivo na prosa.
- **Nome moderno para entidade histórica** onde a diferença importa. Em 1938
  aquele território era o Mandato Britânico da Palestina, e o atlas já corrigiu a
  base nesse ponto.

## Código de convivência

Assunto histórico e geopolítico é assunto que as pessoas sentem. A régua aqui é
simples: discuta a **fonte** e o **texto**, não a pessoa que escreveu. Quem não
conseguir, não vai contribuir aqui.

## Licença da sua contribuição

Ao abrir um PR você concorda em licenciar o que enviou sob as licenças do projeto:
**MIT** para código, **CC BY-SA 4.0** para texto e geometria. Ver
[`LICENSE-CONTEUDO.md`](LICENSE-CONTEUDO.md).
