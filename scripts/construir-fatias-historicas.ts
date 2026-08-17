#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { quantize } from "topojson-client";
import type { Objects, Topology } from "topojson-specification";
import type { FeatureCollection } from "geojson";

/**
 * As propriedades que sobrevivem à poda.
 *
 * Declaradas aqui porque `topojson-simplify` e `quantize` trabalham sobre
 * `Topology<Objects<T>>` com `T` não nulo, e o `Topology` padrão usa
 * `GeoJsonProperties`, que admite `null`. Nomear a forma resolve os três
 * passos da cadeia de uma vez, em vez de um cast por chamada.
 */
interface PropsPodadas {
  n?: string;
  s?: string;
  p?: number;
}

type TopoFatia = Topology<Objects<PropsPodadas>>;

/**
 * Baixa e converte as fatias históricas de fronteira para TopoJSON leve.
 *
 * Este é o único script do projeto que depende de rede. Ele roda à mão, o
 * resultado é versionado em `public/geo/fatias/`, e o build não o chama — se
 * o repositório do upstream sair do ar, o atlas continua construindo.
 *
 * ## Por que uma camada de fundo separada dos períodos
 *
 * O atlas desenha nove países modernos com dossiê escrito. Estas fatias são
 * CONTEXTO: o que mais existia no mundo naquela data. Elas não são clicáveis
 * e não têm id do atlas, e é justamente isso que as torna baratas — polígono
 * que ninguém aponta não precisa entrar no espaço de nomes de `iso.ts`.
 *
 * ## Procedência e licença
 *
 * Fonte: github.com/aourednik/historical-basemaps, de A. Ourednik, sob
 * CC-BY-SA 4.0. Share-alike: a geometria derivada herda a licença, e o
 * crédito é obrigatório — não é cortesia. Por isso o índice carrega a
 * atribuição junto dos dados, do mesmo modo que o schema `Imagem` faz
 * `credito` e `licenca` serem campos obrigatórios em vez de opcionais.
 *
 * O nome do arquivo é o do upstream (`bc323`, `1492`) e não o ano numérico,
 * para que qualquer fatia daqui seja rastreável até o arquivo de origem.
 * O ano fica no índice.
 *
 * ## Precisão declarada pela própria fonte
 *
 * O dataset traz `BORDERPRECISION` por polígono. É a estimativa do autor
 * sobre quanto aquela linha é confiável, e ela sobrevive à conversão como a
 * propriedade `p`. Isso é o que permite o mapa desenhar fronteira incerta
 * como incerta em vez de como fato — a mesma disciplina do status de uma
 * alegação.
 */

const BASE =
  "https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson";

/** Os TopoJSON, servidos estaticamente e buscados um por vez. */
const DESTINO = path.join(process.cwd(), "public", "geo", "fatias");

/**
 * O índice, ao lado do código e não dos dados.
 *
 * Ele é pequeno (53 entradas) e precisa estar em memória para decidir QUAL
 * fatia buscar — se fosse servido como asset, escolher a fatia custaria uma
 * ida à rede antes da ida que interessa.
 */
const INDICE = path.join(process.cwd(), "lib", "geo", "fatias-indice.json");

export const ATRIBUICAO = {
  fonte: "historical-basemaps",
  autor: "A. Ourednik",
  url: "https://github.com/aourednik/historical-basemaps",
  licenca: "CC-BY-SA-4.0",
} as const;

/**
 * Simplificação e quantização.
 *
 * Calibrado contra a fatia de 1900: crua tem 1267 kB, e este par a deixa em
 * torno de 70 kB — a mesma ordem do `world-atlas` 110m que o globo já usa,
 * então a densidade de vértices das duas camadas casa em tela.
 *
 * Baixar `QUANTIL` engrossa a costa e começa a somir com ilha pequena;
 * subir engorda o arquivo sem diferença visível na escala de um globo.
 */
const QUANTIL = 0.1;
const QUANTIZACAO = 1e4;

/** Os arquivos `world_*.geojson` do upstream, do mais antigo ao mais recente. */
const FATIAS = [
  "bc123000", "bc10000", "bc8000", "bc5000", "bc4000", "bc3000", "bc2000",
  "bc1500", "bc1000", "bc700", "bc500", "bc400", "bc323", "bc300", "bc200",
  "bc100", "bc1",
  "100", "200", "300", "400", "500", "600", "700", "800", "900", "1000",
  "1100", "1200", "1279", "1300", "1400", "1492", "1500", "1530", "1600",
  "1650", "1700", "1715", "1783", "1800", "1815", "1880", "1900", "1914",
  "1920", "1930", "1938", "1945", "1960", "1994", "2000", "2010",
] as const;

/** `bc323` vira -323; `1492` vira 1492. Não existe ano zero. */
export function anoDoNome(nome: string): number {
  const bc = nome.startsWith("bc");
  const n = Number.parseInt(bc ? nome.slice(2) : nome, 10);
  if (!Number.isFinite(n) || n === 0) {
    throw new Error(`nome de fatia não reconhecido: ${nome}`);
  }
  return bc ? -n : n;
}

interface PropsBrutas {
  NAME?: string;
  SUBJECTO?: string;
  BORDERPRECISION?: number;
}

/**
 * Poda as propriedades ao que a tela usa.
 *
 * `NAME` rotula, `SUBJECTO` diz a quem o território era subordinado — e só
 * entra quando difere do nome, porque na maioria dos polígonos os dois são
 * iguais e repetir a string em 270 feições custa mais que o dado vale.
 * `BORDERPRECISION` é a confiança da linha.
 */
function podar(colecao: FeatureCollection): { precisoes: Record<string, number> } {
  const precisoes: Record<string, number> = {};
  for (const f of colecao.features) {
    const p = (f.properties ?? {}) as PropsBrutas;
    const chave = String(p.BORDERPRECISION ?? "?");
    precisoes[chave] = (precisoes[chave] ?? 0) + 1;

    /*
     * Cerca de 17% das feições vêm com todas as propriedades em `null` — em
     * `bc323` é metade delas. São regiões que a fonte desenha sem atribuir a
     * ninguém, e isso é informação, não defeito: em 323 a.C. boa parte do
     * mundo não tinha Estado conhecido pelo dataset.
     *
     * A chave é OMITIDA em vez de gravada como `null`. Gravar `n: null`
     * ocuparia espaço para dizer nada e obrigaria cada leitor a testar dois
     * casos de ausência; ausente é um caso só.
     */
    const podado: Record<string, unknown> = {};
    if (p.NAME) podado.n = p.NAME;
    if (p.SUBJECTO && p.SUBJECTO !== p.NAME) podado.s = p.SUBJECTO;
    if (p.BORDERPRECISION !== undefined && p.BORDERPRECISION !== null) {
      podado.p = p.BORDERPRECISION;
    }
    f.properties = podado;
  }
  return { precisoes };
}

async function converter(nome: string) {
  const resposta = await fetch(`${BASE}/world_${nome}.geojson`);
  if (!resposta.ok) {
    throw new Error(`world_${nome}.geojson: HTTP ${resposta.status}`);
  }
  const colecao = (await resposta.json()) as FeatureCollection;
  const cruBytes = Buffer.byteLength(JSON.stringify(colecao));
  const { precisoes } = podar(colecao);

  /*
   * Topologia ANTES de simplificar, e é a ordem que importa.
   *
   * Fronteira entre dois países é um arco só na topologia. Simplificado uma
   * vez, os dois polígonos continuam coincidentes. Simplificar polígono a
   * polígono moveria cada lado da linha para um lugar diferente e abriria
   * fenda branca entre vizinhos — o defeito clássico deste pipeline.
   */
  let topo = topology({ mundo: colecao }) as unknown as TopoFatia;
  topo = presimplify(topo);
  const peso = quantile(topo, QUANTIL);
  topo = simplify(topo, peso);

  /*
   * Quantizar por último. Ela troca coordenada de ponto flutuante por inteiro
   * sobre uma grade, e é de longe o maior ganho de tamanho — na calibração,
   * 218 kB caíram para 69 kB. Feita antes da simplificação, o arredondamento
   * estragaria os pesos que a simplificação usa para decidir o que cortar.
   */
  topo = quantize(topo, QUANTIZACAO);

  const json = JSON.stringify(topo);
  await fs.writeFile(path.join(DESTINO, `${nome}.json`), json, "utf8");

  return {
    nome,
    ano: anoDoNome(nome),
    feicoes: colecao.features.length,
    bytes: Buffer.byteLength(json),
    cruBytes,
    precisoes,
  };
}

async function main() {
  await fs.mkdir(DESTINO, { recursive: true });

  const entradas: Awaited<ReturnType<typeof converter>>[] = [];
  for (const nome of FATIAS) {
    const e = await converter(nome);
    entradas.push(e);
    const pct = Math.round((e.bytes / e.cruBytes) * 100);
    console.log(
      `  · ${nome.padEnd(9)} ano ${String(e.ano).padStart(7)}  ` +
        `${String(e.feicoes).padStart(4)} feições  ` +
        `${String(Math.round(e.bytes / 1024)).padStart(4)} kB (${pct}% do cru)`
    );
  }

  entradas.sort((a, b) => a.ano - b.ano);

  const indice = {
    atribuicao: ATRIBUICAO,
    simplificacao: { quantil: QUANTIL, quantizacao: QUANTIZACAO },
    fatias: entradas.map((e) => ({
      nome: e.nome,
      ano: e.ano,
      feicoes: e.feicoes,
      bytes: e.bytes,
      /** Distribuição de BORDERPRECISION nesta fatia, do upstream. */
      precisoes: e.precisoes,
    })),
  };
  await fs.writeFile(INDICE, `${JSON.stringify(indice, null, 2)}\n`, "utf8");

  /*
   * A licença fica ao lado dos dados, e não só no índice: quem copiar a pasta
   * leva a obrigação junto. Share-alike sem o arquivo é violação silenciosa.
   */
  await fs.writeFile(
    path.join(DESTINO, "LICENCA.md"),
    [
      "# Fatias históricas de fronteira",
      "",
      `Derivadas de [${ATRIBUICAO.fonte}](${ATRIBUICAO.url}), de ${ATRIBUICAO.autor},`,
      `sob **${ATRIBUICAO.licenca}**.`,
      "",
      "Alterações feitas: poda de propriedades, extração de topologia,",
      `simplificação (quantil ${QUANTIL}) e quantização (${QUANTIZACAO}).`,
      "",
      "Share-alike: esta geometria derivada permanece sob a mesma licença.",
      "",
      "> São aproximações destinadas a estudo. Fronteira histórica é objeto de",
      "> disputa acadêmica, e a propriedade `p` de cada polígono carrega a",
      "> estimativa de precisão declarada pela fonte original.",
      "",
    ].join("\n"),
    "utf8"
  );

  const total = entradas.reduce((s, e) => s + e.bytes, 0);
  console.log(
    `\n✓ ${entradas.length} fatias, ${(total / 1024 / 1024).toFixed(1)} MB, ` +
      `de ${entradas[0].ano} a ${entradas[entradas.length - 1].ano}`
  );
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
