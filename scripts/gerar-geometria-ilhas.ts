#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import { geoArea, geoContains, geoDistance } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from "geojson";

/**
 * Extrai o desenho das ilhas da base cartográfica que o projeto já empacota.
 *
 * ## Por que existe
 *
 * A ilha é registrada como PONTO, e num mapa-múndi isso é o correto: Fernando de
 * Noronha tem 18 km², e num mapa de 1.472 px ocupa 0,009 px² — polígono fiel é
 * invisível e polígono visível é falso. Mas o mapa passou a aproximar até 8×, e
 * nessa escala o ponto virou omissão: há espaço para a forma real.
 *
 * ## Sem rede
 *
 * A fonte é `node_modules/world-atlas`, que o projeto já usa para desenhar os
 * países com dossiê: `land-10m` (4.061 polígonos de terra) e `countries-10m`. Não
 * há download, então este script não é o caso especial que
 * `construir-fatias-historicas.ts` é — roda a qualquer momento e o resultado é
 * versionado.
 *
 * ## O critério mora no conteúdo
 *
 * Cada `conteudo/ilhas/*.json` declara em `geometria` COMO se acha o seu desenho,
 * por nome da fonte ou por raio, com razão obrigatória. Em arquipélago isso é
 * decisão editorial e não detalhe técnico: Tarawa é um anel de ilhotas e as
 * Malvinas são duas ilhas grandes mais setecentas pequenas, então "o polígono da
 * ilha" não existe — existe o conjunto que se decidiu chamar de Tarawa.
 *
 * ## A armadilha do anel invertido, pela quarta vez
 *
 * O `land-10m` traz um anel de 4 vértices percorrido ao contrário, que na esfera
 * mede 510 milhões de km² — a Terra inteira — e portanto CONTÉM qualquer ponto. Na
 * primeira medição ele capturou 11 das 17 ilhas. Todo polígono acima de 1
 * esterradiano é descartado aqui, e o `geoContains` só é consultado depois.
 */

const R = 6371;
const km2 = (sr: number) => sr * R * R;
const CASAS = 4;

/** Acima disto, o polígono é artefato de orientação e não território. */
const AREA_ABSURDA = 1;

function arredondar(v: unknown): unknown {
  if (typeof v === "number") return Number(v.toFixed(CASAS));
  if (Array.isArray(v)) return v.map(arredondar);
  return v;
}

function partes(g: Geometry | null): Polygon[] {
  if (!g) return [];
  if (g.type === "Polygon") return [g as Polygon];
  if (g.type !== "MultiPolygon") return [];
  return (g as MultiPolygon).coordinates.map((aneis) => ({
    type: "Polygon" as const,
    coordinates: aneis,
  }));
}

const lerTopo = (arquivo: string) =>
  JSON.parse(
    fs.readFileSync(path.join("node_modules", "world-atlas", arquivo), "utf8")
  ) as Topology;

function terras(): Polygon[] {
  const topo = lerTopo("land-10m.json");
  const terra = feature(topo, topo.objects.land as GeometryCollection);
  const geos: (Geometry | null)[] =
    "features" in terra
      ? (terra.features as Feature<Geometry>[]).map((f) => f.geometry)
      : [(terra as Feature<Geometry>).geometry];
  return geos
    .flatMap(partes)
    .filter((p) => geoArea(p) <= AREA_ABSURDA);
}

function paises(): Feature<Geometry, { name?: string }>[] {
  const topo = lerTopo("countries-10m.json");
  return feature(topo, topo.objects.countries as GeometryCollection)
    .features as Feature<Geometry, { name?: string }>[];
}

interface Ilha {
  id: string;
  nome: string;
  ponto: [number, number];
  geometria?:
    | { tipo: "pais"; nome: string; razao: string }
    | { tipo: "raio"; km: number; razao: string }
    | { tipo: "ponto"; razao: string };
}

const ilhas: Ilha[] = fs
  .readdirSync(path.join("conteudo", "ilhas"))
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(
        fs.readFileSync(path.join("conteudo", "ilhas", f), "utf8")
      ) as Ilha
  );

const TERRAS = terras();
const PAISES = paises();

/** Toda terra a até `km` do ponto — o critério de arquipélago e de atol. */
function porRaio(ponto: [number, number], km: number): Polygon[] {
  const limite = km / R;
  return TERRAS.filter((p) =>
    p.coordinates.some((anel) =>
      (anel as Position[]).some((v) => geoDistance(ponto, v as [number, number]) <= limite)
    )
  );
}

/**
 * O MENOR polígono que contém o ponto — a resposta exata para ilha única.
 *
 * Menor, e não o primeiro, porque ilha dentro de lago dentro de continente existe,
 * e porque o anel invertido do `land-10m` contém tudo. Este já foi filtrado em
 * `terras()`, mas "o menor" continua sendo a regra certa.
 */
function porPonto(ponto: [number, number]): Polygon[] {
  let achado: Polygon | null = null;
  let menor = Infinity;
  for (const p of TERRAS) {
    const a = geoArea(p);
    if (a < menor && geoContains(p, ponto)) {
      menor = a;
      achado = p;
    }
  }
  if (!achado) {
    throw new Error(
      `nenhuma terra contém [${ponto[0]}, ${ponto[1]}] — ponto no mar pede raio, não ponto`
    );
  }
  return [achado];
}

/** As partes do país ou território que a fonte nomeia assim. */
function porPais(nome: string): Polygon[] {
  const f = PAISES.find((x) => x.properties?.name === nome);
  if (!f) {
    throw new Error(
      `"${nome}" não existe em countries-10m — confira a grafia do Natural Earth`
    );
  }
  return partes(f.geometry).filter((p) => geoArea(p) <= AREA_ABSURDA);
}

/**
 * O desenho e a área em graus², que é o que a tela usa para decidir se desenha.
 *
 * A área vai gravada e não é medida em tempo de execução pelo mesmo motivo que a
 * das entidades da fatia: a equirretangular é linear em longitude e latitude,
 * então `graus² × (π/180)² × escala²` dá a área exata em pixels por aritmética, e
 * varrer geometria a cada quadro de arrasto é o que deixava o mapa lento.
 */
interface Desenho {
  areaPlana: number;
  geometria: MultiPolygon;
}

/** Área do anel em graus², pela fórmula do sapateiro. */
function areaPlanaDoAnel(anel: Position[]): number {
  let s = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    s += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  }
  return Math.abs(s / 2);
}

const saida: Record<string, Desenho> = {};
const relatorio: string[] = [];

for (const i of ilhas) {
  if (!i.geometria) {
    relatorio.push(`  ${i.id.padEnd(22)} —  só ponto, sem critério declarado`);
    continue;
  }

  const polis =
    i.geometria.tipo === "pais"
      ? porPais(i.geometria.nome)
      : i.geometria.tipo === "ponto"
        ? porPonto(i.ponto)
        : porRaio(i.ponto, i.geometria.km);

  if (polis.length === 0) {
    throw new Error(`${i.id}: o critério não achou nenhuma terra`);
  }

  /*
   * O ponto registrado tem de cair DENTRO DA CAIXA do que foi extraído.
   *
   * A primeira versão exigia o ponto sobre a terra ou a 50 km dela, e Cabo Verde
   * reprovou com razão: o ponto do arquipélago fica no meio dele, no mar, a 65 km
   * da ilha mais próxima. Cinquenta quilômetros é um limite calibrado para ilha
   * única, e arquipélago não tem esse tamanho.
   *
   * A caixa não tem escala fixa e serve aos dois casos: para ilha única ela é
   * apertada, e para arquipélago ela cobre o grupo. É a conferência que pega
   * critério trocado — raio que pegou a ilha vizinha, ou nome que agrupa outra
   * coisa.
   */
  let oeste = 180;
  let sul = 90;
  let leste = -180;
  let norte = -90;
  for (const p of polis) {
    for (const anel of p.coordinates) {
      for (const [x, y] of anel as Position[]) {
        if (x < oeste) oeste = x;
        if (x > leste) leste = x;
        if (y < sul) sul = y;
        if (y > norte) norte = y;
      }
    }
  }
  const MARGEM = 0.25;
  const [px, py] = i.ponto;
  if (
    px < oeste - MARGEM ||
    px > leste + MARGEM ||
    py < sul - MARGEM ||
    py > norte + MARGEM
  ) {
    throw new Error(
      `${i.id}: o ponto [${px}, ${py}] cai fora da caixa da geometria extraída ` +
        `([${oeste.toFixed(2)}, ${sul.toFixed(2)}] a [${leste.toFixed(2)}, ${norte.toFixed(2)}]) — ` +
        `o critério pegou outra terra`
    );
  }

  const contem = polis.some((p) => geoContains(p, i.ponto));
  /** Distância à terra mais próxima, para o relatório mostrar o que se extraiu. */
  let distancia = 0;
  if (!contem) {
    let melhor = Infinity;
    for (const p of polis) {
      for (const anel of p.coordinates) {
        for (const v of anel as Position[]) {
          const d = geoDistance(i.ponto, v as [number, number]);
          if (d < melhor) melhor = d;
        }
      }
    }
    distancia = melhor * R;
  }

  const area = polis.reduce((s, p) => s + km2(geoArea(p)), 0);
  const vertices = polis.reduce(
    (s, p) => s + p.coordinates.reduce((t, a) => t + a.length, 0),
    0
  );

  const coordenadas = polis.map(
    (p) => arredondar(p.coordinates) as Position[][]
  );
  saida[i.id] = {
    areaPlana: coordenadas.reduce(
      (soma, aneis) =>
        soma +
        aneis.reduce(
          (t, anel, j) => t + (j === 0 ? areaPlanaDoAnel(anel) : -areaPlanaDoAnel(anel)),
          0
        ),
      0
    ),
    geometria: { type: "MultiPolygon", coordinates: coordenadas },
  };

  relatorio.push(
    `  ${i.id.padEnd(22)} ${
      i.geometria.tipo === "pais"
        ? "nome"
        : i.geometria.tipo === "ponto"
          ? "ponto"
          : `${i.geometria.km} km`
    }`.padEnd(
      34
    ) +
      `${polis.length} partes  ${area.toFixed(0).padStart(7)} km²  ${String(vertices).padStart(5)} vértices` +
      (contem ? "" : `  (ponto no mar, ${distancia.toFixed(0)} km da terra)`)
  );
}

const destino = path.join("lib", "geo", "ilhas-geometria.json");
fs.writeFileSync(destino, `${JSON.stringify(saida)}\n`, "utf8");

console.log(relatorio.join("\n"));
console.log(
  `\n✓ ${Object.keys(saida).length} de ${ilhas.length} ilhas com desenho, ` +
    `${(fs.statSync(destino).size / 1024).toFixed(0)} kB em ${destino}`
);
