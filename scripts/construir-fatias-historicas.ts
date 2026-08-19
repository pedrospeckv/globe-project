#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { quantize, feature } from "topojson-client";
import { geoArea } from "d3-geo";
import type { Objects, Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  anoDoNome,
  aplicarSubstituicoes,
  conferirFatiasLocais,
  hashDoArquivo,
  lerFeicoesLocais,
  lerManifesto,
  PASTA_LOCAIS,
  type Atribuicao,
  type FatiaLocal,
} from "./fatias-locais";

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
 * As fatias locais moram num diretório próprio.
 *
 * Duas razões. A primeira é prática: uma fatia local que CORRIGE uma baixada tem o
 * mesmo nome dela, e no mesmo diretório uma sobrescreveria a outra — e a baixada
 * precisa continuar existindo, porque é dela que a correção é derivada. A segunda é
 * de procedência: `/geo/fatias/locais/1945.json` diz na própria URL que aquela
 * geometria não veio do upstream.
 */
const DESTINO_LOCAIS = path.join(DESTINO, "locais");

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

interface Entrada {
  nome: string;
  ano: number;
  feicoes: number;
  bytes: number;
  /** Ausente quando a entrada vem reaproveitada do índice anterior. */
  cruBytes?: number;
  precisoes: Record<string, number>;
  /** Fatia de geometria própria, e não baixada. */
  local?: boolean;
  /** Impressão digital do `.geojson` de origem, só nas locais. */
  hash?: string;
  /** Procedência própria; ausente quer dizer a do upstream. */
  atribuicao?: Atribuicao;
}

/** Distribuição de precisão de fronteira, já sobre as propriedades podadas. */
function contarPrecisoes(colecao: FeatureCollection): Record<string, number> {
  const precisoes: Record<string, number> = {};
  for (const f of colecao.features) {
    const chave = String((f.properties as { p?: number } | null)?.p ?? "?");
    precisoes[chave] = (precisoes[chave] ?? 0) + 1;
  }
  return precisoes;
}

/**
 * Área acima da qual a feição é artefato, não território — o mesmo limite de
 * `lib/geo/fatias.ts`, repetido aqui porque este script não pode importar do
 * runtime sem arrastar o índice que ele próprio gera.
 */
const AREA_ABSURDA = 1.0;

function feicoesAbsurdas(topo: TopoFatia): string[] {
  const decodificadas = feature(
    topo as unknown as Topology,
    topo.objects.mundo as GeometryCollection
  ).features as Feature<Geometry, { n?: string }>[];
  return decodificadas
    .filter((f) => f.geometry !== null && geoArea(f) > AREA_ABSURDA)
    .map((f) => f.properties?.n ?? "sem nome");
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

/**
 * Constrói uma fatia de geometria própria.
 *
 * Sem `presimplify`, sem `simplify` e sem `quantize`, e essa é a diferença que
 * importa. As três existem para fazer 85 MB de download caberem em 4,4 MB, e é
 * justamente elas que degeneram anéis pequenos e produzem as feições que o
 * `d3-geo` lê como o planeta inteiro. Uma fatia local é um arquivo pequeno que
 * não precisa do ganho — então não paga o risco.
 *
 * A contrapartida é que aqui a checagem é dura: se sair feição absurda mesmo
 * sem redução, o build para. No upstream isso não é possível, porque 38 das 53
 * fatias já vêm assim e o runtime filtra; aqui não há de onde vir.
 */
async function converterLocal(entrada: FatiaLocal): Promise<Entrada> {
  const colecao = lerFeicoesLocais(entrada);
  const cruBytes = Buffer.byteLength(JSON.stringify(colecao));
  const topo = topology({ mundo: colecao }) as unknown as TopoFatia;

  const absurdas = feicoesAbsurdas(topo);
  if (absurdas.length > 0) {
    throw new Error(
      `${entrada.arquivo}: ${absurdas.length} feição(ões) cobrindo mais de ` +
        `${AREA_ABSURDA} sr — ${absurdas.slice(0, 3).join(", ")}. ` +
        `Provável anel invertido ou degenerado no arquivo de origem.`
    );
  }

  const json = JSON.stringify(topo);
  await fs.writeFile(
    path.join(DESTINO_LOCAIS, `${entrada.nome}.json`),
    json,
    "utf8"
  );

  return {
    nome: entrada.nome,
    ano: entrada.ano,
    feicoes: colecao.features.length,
    bytes: Buffer.byteLength(json),
    cruBytes,
    precisoes: contarPrecisoes(colecao),
    local: true,
    hash: hashDoArquivo(path.join(PASTA_LOCAIS, entrada.arquivo)),
    atribuicao: entrada.atribuicao,
  };
}

/**
 * `--locais` reconstrói só as fatias próprias, preservando as baixadas.
 *
 * Existe porque as duas metades têm custos muito diferentes: as 53 fatias do
 * upstream são 53 idas à rede, e uma fatia local é um arquivo em disco. Obrigar
 * um download completo para corrigir um polígono escrito aqui é o tipo de
 * atrito que faz o dado ficar sem correção.
 */
const SOMENTE_LOCAIS = process.argv.includes("--locais");

async function main() {
  await fs.mkdir(DESTINO, { recursive: true });
  await fs.mkdir(DESTINO_LOCAIS, { recursive: true });

  const locais = lerManifesto();
  const daRede = new Set<string>(FATIAS);
  for (const l of locais) {
    /*
     * Nome igual ao de uma baixada só é legítimo quando a local declara que a
     * SUBSTITUI. Sem isso é colisão: duas fatias disputariam o mesmo ano no índice.
     */
    if (daRede.has(l.nome) && l.substitui !== l.nome) {
      throw new Error(
        `a fatia local ${l.nome} tem o nome de uma fatia do upstream — ` +
          `uma sobrescreveria a outra em public/geo/fatias/`
      );
    }
  }

  const entradas: Entrada[] = [];

  if (SOMENTE_LOCAIS) {
    /* As baixadas vêm do índice anterior, intactas. */
    const anterior = JSON.parse(await fs.readFile(INDICE, "utf8")) as {
      fatias: Entrada[];
    };
    entradas.push(...anterior.fatias.filter((f) => !f.local));
    console.log(`  · ${entradas.length} fatias baixadas, mantidas do índice`);
  } else {
    for (const nome of FATIAS) {
      const e = await converter(nome);
      entradas.push(e);
      const pct = Math.round((e.bytes / (e.cruBytes ?? e.bytes)) * 100);
      console.log(
        `  · ${nome.padEnd(9)} ano ${String(e.ano).padStart(7)}  ` +
          `${String(e.feicoes).padStart(4)} feições  ` +
          `${String(Math.round(e.bytes / 1024)).padStart(4)} kB (${pct}% do cru)`
      );
    }
  }

  /*
   * Fatia local que declara `substitui` tira a baixada do índice.
   *
   * Antes de acrescentar, e não depois, porque a conferência de ano repetido logo
   * abaixo é o que impede duas fatias na mesma data — e sem retirar a baixada
   * primeiro ela pararia o build em vez de deixar a correção entrar.
   *
   * O arquivo da baixada FICA no disco: é dele que a corrigida é derivada.
   */
  const substituidas = aplicarSubstituicoes(entradas, locais, daRede);
  entradas.length = 0;
  entradas.push(...substituidas.entradas);
  for (const r of substituidas.removidas) {
    console.log(`  · ${r.local.padEnd(9)} substitui a baixada ${r.baixada}`);
  }

  for (const entrada of locais) {
    const e = await converterLocal(entrada);
    entradas.push(e);
    console.log(
      `  · ${e.nome.padEnd(9)} ano ${String(e.ano).padStart(7)}  ` +
        `${String(e.feicoes).padStart(4)} feições  ` +
        `${String(Math.round(e.bytes / 1024)).padStart(4)} kB  ` +
        `LOCAL (${e.atribuicao?.fonte}, sem redução)`
    );
  }

  entradas.sort((a, b) => a.ano - b.ano);

  const anos = new Set<number>();
  for (const e of entradas) {
    if (anos.has(e.ano)) throw new Error(`duas fatias no ano ${e.ano}`);
    anos.add(e.ano);
  }

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
      /* Só nas locais, e é por isso que o runtime consegue creditar a fonte
         certa em vez de atribuir tudo ao upstream. */
      ...(e.local ? { local: true, hash: e.hash, atribuicao: e.atribuicao } : {}),
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
      ...(locais.length > 0
        ? [
            "## Fatias de geometria própria",
            "",
            "Estas NÃO vêm do upstream e não estão sob a licença acima. Cada uma",
            "traz a sua no índice, e a origem está em `conteudo/fatias/manifesto.json`.",
            "",
            ...locais.map(
              (l) =>
                `- \`${l.nome}.json\` — ${l.atribuicao.fonte}, de ` +
                `${l.atribuicao.autor}, ${l.atribuicao.licenca}`
            ),
            "",
          ]
        : []),
      "> São aproximações destinadas a estudo. Fronteira histórica é objeto de",
      "> disputa acadêmica, e a propriedade `p` de cada polígono carrega a",
      "> estimativa de precisão declarada pela fonte original.",
      "",
    ].join("\n"),
    "utf8"
  );

  /* O script confere o próprio resultado com a mesma função que o build usa. */
  const problemas = conferirFatiasLocais(indice.fatias, DESTINO);
  if (problemas.length > 0) {
    throw new Error(`índice inconsistente:\n  ${problemas.join("\n  ")}`);
  }

  const total = entradas.reduce((s, e) => s + e.bytes, 0);
  console.log(
    `\n✓ ${entradas.length} fatias (${locais.length} locais), ` +
      `${(total / 1024 / 1024).toFixed(1)} MB, ` +
      `de ${entradas[0].ano} a ${entradas[entradas.length - 1].ano}`
  );
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
