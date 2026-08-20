# Atlas

Um atlas histórico e geopolítico navegável, feito para **estudar**: um mapa que
mostra as fronteiras de qualquer data entre 123.000 a.C. e hoje, e dossiês que
contam o que estava acontecendo dentro delas.

Não é obra acadêmica e não é produto. É uma ferramenta de estudo, aberta, para
quem quiser entender melhor mundo e geografia — e para quem quiser ajudar a
escrevê-la.

**9 de 174 países** têm dossiê. Ver [`docs/cobertura.md`](docs/cobertura.md) para a
lista do que falta, e [`CONTRIBUTING.md`](CONTRIBUTING.md) para pegar um.

## O que ele faz

- **54 fatias de fronteira**, de 123.000 a.C. a 2018. Arrastar a barra do tempo
  troca o mapa do mundo inteiro, não só a data no cabeçalho.
- **Globo e mapa plano** como dois modos. O globo é bonito; o mapa é o que serve
  para estudar, porque mostra o mundo todo de uma vez.
- **Uma cor por entidade**, estável de uma data para a outra, para o olho não
  perder o sujeito ao atravessar o tempo.
- **Dossiê por país × período.** "França 1420" e "França 2026" são o mesmo tipo de
  objeto, e é por isso que geopolítica atual não é um módulo separado: é o último
  período da linha do tempo.
- **Cada afirmação contestada carrega fonte**, e o build recusa conteúdo sem ela.

## O que ele NÃO faz, e assume

Três limitações declaradas na própria tela, porque esconder limitação num atlas é
pior que tê-la:

1. **A fronteira mostrada é a da última fatia anterior à data.** Um aviso graduado
   diz de quanto é a defasagem — em 1650 o vão mediano entre fatias é de 70 anos.
2. **A base reaproveita nomes modernos para predecessores.** "Gana" em 800 é o
   Império do Gana, em território que não é o do Gana de hoje. E território sem
   nome não quer dizer território sem Estado: quer dizer que a fonte não o
   atribui.
3. **A geometria dos países acesos é a moderna.** Desenhar a fronteira interalemã
   de 1961 exigiria geometria histórica própria para cada dossiê; onde ela falta, o
   mapa hachura e admite.

A precisão de cada linha é declarada por fatia, e há duas datas — 1938 e 1945 —
em que o atlas **corrige** a base, com o que foi mudado e por quê registrado em
[`docs/auditoria-anacronismos.md`](docs/auditoria-anacronismos.md).

## Rodar

Precisa de Node 24 e [pnpm](https://pnpm.io).

```bash
pnpm install
```

```bash
pnpm dev
```

Abre em <http://localhost:3000>. O mapa está em `/atlas`.

Os comandos que importam:

| comando | o que faz |
|---|---|
| `pnpm validar` | confere schema, fontes e ligações do conteúdo |
| `pnpm test` | a suíte (781 testes) |
| `pnpm build` | valida o conteúdo e gera as páginas estáticas |
| `pnpm tsx scripts/cobertura.ts` | regera `docs/cobertura.md` |

As 54 fatias de fronteira já vêm versionadas em `public/geo/fatias/` — não é
preciso baixar nada para o mapa funcionar.

## Como está organizado

```
conteudo/     o atlas em si: países, notas, figuras, eventos, fontes, ilhas
lib/conteudo/ os schemas (zod) que dizem o que cada um desses arquivos precisa ter
lib/geo/      fatias de fronteira, cores, rótulos, projeção
components/   a interface; components/atlas/ é o mapa
scripts/      construção das fatias, validação, cobertura
docs/         decisões, auditorias, guias
public/geo/   a geometria servida ao navegador
```

Quem for mexer em conteúdo passa quase todo o tempo em `conteudo/` e
`lib/conteudo/`. Quem for mexer no mapa, em `lib/geo/` e `components/atlas/`.

## Contribuir

Sim, por favor — sobretudo **países**. São 165 sem dossiê, e cada um é um trabalho
independente que não conflita com o de mais ninguém.

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md). A regra que resume o projeto: **toda
afirmação precisa de fonte, e nenhuma URL pode ser inventada.** O `pnpm validar`
cobra isso antes de você abrir o PR, e o CI cobra de novo.

## Créditos e licença

As fronteiras históricas vêm do
[historical-basemaps](https://github.com/aourednik/historical-basemaps), de
A. Ourednik, sob CC BY-SA 4.0. A fatia moderna vem do
[Natural Earth](https://www.naturalearthdata.com/) (domínio público), via
[world-atlas](https://github.com/topojson/world-atlas).

Duas licenças, e [`LICENSE-CONTEUDO.md`](LICENSE-CONTEUDO.md) diz qual pasta segue
qual:

- **código** — [MIT](LICENSE)
- **texto e geometria** — CC BY-SA 4.0

Share-alike não foi escolha estética: a base de fronteiras é BY-SA, o atlas a
deriva, e obra derivada continua sob a mesma licença. Quem usar este atlas tem de
creditar e tem de manter aberto.
