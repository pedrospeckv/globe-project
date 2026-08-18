import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Polygon } from "geojson";
import { ancoraDe, colocarRotulos, maiorPoligono } from "./rotulos";
import { criarProjecao } from "./projecao";
import { nomeCanonico } from "./nomes";
import type { FatiaFeature } from "./fatias";

const PASTA = path.join(process.cwd(), "public", "geo", "fatias");

/** Do jeito que o carregador entrega: com a grafia já normalizada. */
function carregar(nome: string, ano: number): FatiaFeature[] {
  const topo = JSON.parse(
    fs.readFileSync(path.join(PASTA, `${nome}.json`), "utf8")
  ) as Topology;
  const feicoes = feature(topo, topo.objects.mundo as GeometryCollection)
    .features as FatiaFeature[];
  for (const f of feicoes) {
    if (f.properties?.n) f.properties.n = nomeCanonico(f.properties.n, ano);
  }
  return feicoes;
}

const FONTE = 10;
/** Medidor de mentira, estável: o canvas não existe no jsdom. */
const medir = (t: string) => t.length * FONTE * 0.52;

const mapa = (largura: number) =>
  criarProjecao({
    largura,
    altura: Math.round(largura * 0.53),
    alpha: 1,
    rotacao: [0, 0],
  });

const nomesEm = (feicoes: FatiaFeature[], largura: number, zoom = 1) =>
  colocarRotulos({
    feicoes,
    projecao: criarProjecao({
      largura,
      altura: Math.round(largura * 0.53),
      alpha: 1,
      rotacao: [0, 0],
      zoom,
    }),
    medir,
    fonte: FONTE,
  });

/*
 * ATENÇÃO ao sentido dos anéis. O d3-geo trata polígono na ESFERA, onde um anel
 * percorrido ao contrário não é o mesmo polígono: é o complemento dele, a esfera
 * toda menos ele. Escrever estes fixtures no sentido anti-horário fez
 * `geoCentroid` de um quadradinho em (5,5) devolver longitude −175, o centro do
 * resto do planeta. É a mesma armadilha de orientação que está documentada em
 * `fatias.ts` como origem das feições que mediam a esfera inteira — e a razão de
 * os testes contra o dado real passarem é que a base vem enrolada certo.
 */
describe("maiorPoligono", () => {
  it("escolhe a maior parte de um multipolígono", () => {
    const f = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
          [[[10, 10], [10, 16], [16, 16], [16, 10], [10, 10]]],
        ],
      },
    } as unknown as FatiaFeature;
    const p = maiorPoligono(f)!;
    expect(p.coordinates[0][0]).toEqual([10, 10]);
  });

  it("devolve null para geometria ausente", () => {
    const f = { type: "Feature", properties: {}, geometry: null } as unknown as FatiaFeature;
    expect(maiorPoligono(f)).toBeNull();
  });
});

describe("ancoraDe", () => {
  const quadrado: Polygon = {
    type: "Polygon",
    coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
  };

  it("usa o centroide quando ele cai dentro", () => {
    const a = ancoraDe(quadrado)!;
    expect(geoContains(quadrado, a)).toBe(true);
    expect(a[0]).toBeCloseTo(5, 0);
    expect(a[1]).toBeCloseTo(5, 0);
  });

  /*
   * A forma em C é o caso que o centroide erra: ele cai no vão da letra, fora do
   * território. É o que acontece na Croácia, no Vietnã e no Haiti.
   */
  it("acha ponto interior quando o centroide cai fora", () => {
    const c: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0], [0, 10], [10, 10], [10, 7], [3, 7], [3, 3],
          [10, 3], [10, 0], [0, 0],
        ],
      ],
    };
    const centro = ancoraDe(c)!;
    expect(geoContains(c, centro)).toBe(true);
  });

  /*
   * Este é o teste que importa contra o dado real: nome no mar é pior que país
   * sem nome, então toda âncora entregue tem de estar dentro do próprio polígono.
   */
  it("nunca devolve ponto fora do polígono, em nenhuma fatia", () => {
    for (const [nome, ano] of [["2018", 2018], ["1900", 1900], ["bc323", -323]] as const) {
      for (const f of carregar(nome, ano)) {
        const pol = maiorPoligono(f);
        if (!pol) continue;
        const a = ancoraDe(pol);
        if (!a) continue;
        expect(geoContains(pol, a), `${nome}: ${f.properties?.n}`).toBe(true);
      }
    }
  });
});

describe("colocarRotulos", () => {
  it("não repete uma entidade que aparece em várias feições", () => {
    const rotulos = nomesEm(carregar("2018", 2018), 1600);
    const nomes = rotulos.map((r) => r.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("não sobrepõe dois nomes", () => {
    const rotulos = nomesEm(carregar("2018", 2018), 1600);
    for (let i = 0; i < rotulos.length; i++) {
      for (let j = i + 1; j < rotulos.length; j++) {
        const a = rotulos[i];
        const b = rotulos[j];
        const cruzaX =
          Math.abs(a.x - b.x) < (medir(a.nome) + medir(b.nome)) / 2;
        const cruzaY = Math.abs(a.y - b.y) < FONTE;
        expect(cruzaX && cruzaY, `${a.nome} × ${b.nome}`).toBe(false);
      }
    }
  });

  it("coloca todo nome dentro do canvas", () => {
    const largura = 1600;
    const altura = Math.round(largura * 0.53);
    for (const r of nomesEm(carregar("2018", 2018), largura)) {
      expect(r.x).toBeGreaterThan(0);
      expect(r.y).toBeGreaterThan(0);
      expect(r.x).toBeLessThan(largura);
      expect(r.y).toBeLessThan(altura);
    }
  });

  /*
   * Cada nome tem de estar sobre o território que ele nomeia. É a asserção que
   * distingue "rótulo" de "texto solto perto do país".
   */
  it("põe cada nome dentro do território que ele nomeia", () => {
    const largura = 1600;
    const feicoes = carregar("2018", 2018);
    const p = mapa(largura);
    const rotulos = nomesEm(feicoes, largura);

    const maiorPorNome = new Map<string, Polygon>();
    for (const f of feicoes) {
      const n = f.properties?.n;
      if (!n) continue;
      const pol = maiorPoligono(f);
      if (pol && !maiorPorNome.has(n)) maiorPorNome.set(n, pol);
    }

    for (const r of rotulos) {
      const pol = maiorPorNome.get(r.nome)!;
      /* Volta do pixel para lon/lat comparando com a âncora que gerou o ponto. */
      const a = ancoraDe(pol)!;
      const xy = p(a)!;
      expect(geoContains(pol, a), r.nome).toBe(true);
      expect(xy[0]).toBeCloseTo(r.x, 6);
      expect(xy[1]).toBeCloseTo(r.y, 6);
    }
  });

  /*
   * O número medido antes de escrever, e a razão de o mapa ter passado a crescer:
   * a 900 px o mapa nomeia 25 dos 176 países, e a 1600 px nomeia 58.
   */
  it("nomeia mais quanto maior o mapa", () => {
    const feicoes = carregar("2018", 2018);
    const p900 = nomesEm(feicoes, 900).length;
    const p1600 = nomesEm(feicoes, 1600).length;
    expect(p900).toBeGreaterThan(15);
    expect(p1600).toBeGreaterThan(p900 * 1.8);
  });

  /* E o zoom é o que fura o teto: aproximar abre espaço para os pequenos. */
  it("nomeia mais quanto maior o zoom", () => {
    const feicoes = carregar("2018", 2018);
    const inteiro = nomesEm(feicoes, 1200, 1).map((r) => r.nome);
    const perto = nomesEm(feicoes, 1200, 4).map((r) => r.nome);
    /* Ampliado, entram nomes que no mundo inteiro não cabiam. */
    expect(perto.filter((n) => !inteiro.includes(n)).length).toBeGreaterThan(5);
  });

  it("nomeia os países grandes primeiro", () => {
    const nomes = nomesEm(carregar("2018", 2018), 900).map((r) => r.nome);
    for (const grande of ["Russia", "China", "Brazil", "Canada"]) {
      expect(nomes, grande).toContain(grande);
    }
  });

  it("não nomeia feição anônima", () => {
    const feicoes = carregar("bc323", -323);
    const anonimas = feicoes.filter((f) => !f.properties?.n).length;
    expect(anonimas).toBeGreaterThan(0);
    /* Todo rótulo entregue corresponde a um nome que existe na fatia. */
    const nomes = new Set(feicoes.map((f) => f.properties?.n).filter(Boolean));
    for (const r of nomesEm(feicoes, 1600)) expect(nomes.has(r.nome)).toBe(true);
  });

  /*
   * A entrega, no tamanho que a tela de 1080 realmente produz (1472 px, ver
   * `tamanhoDoMapa`). O que se cobra não é a contagem: é que apareçam os nomes da
   * FAIXA DO MEIO. Rússia e Brasil já caberiam em qualquer tamanho; França,
   * Alemanha, Egito, Nigéria e Polônia são os que só entram quando o mapa cresce,
   * e são eles que servem para se orientar estudando.
   */
  it("nomeia a faixa do meio no tamanho de uma tela de 1080", () => {
    const nomes = nomesEm(carregar("2018", 2018), 1472).map((r) => r.nome);
    /*
     * Não é a contagem que importa, é QUAIS. Rússia e Brasil caberiam em qualquer
     * tamanho; estes são os que só entram quando o mapa cresce, e são eles que
     * servem para se orientar estudando.
     */
    for (const esperado of [
      "France",
      "Egypt",
      "Nigeria",
      "Poland",
      "Kenya",
      "Morocco",
      "Ukraine",
      "Tanzania",
    ]) {
      expect(nomes, esperado).toContain(esperado);
    }
    expect(nomes.length).toBeGreaterThan(45);
  });

  /*
   * A Alemanha é o caso difícil — palavra longa em país compacto — e não cabe no
   * mundo inteiro. É para isso que serve aproximar: a 1472 px e zoom 3 são 121
   * nomes, e entram Alemanha, Bélgica e Chéquia, que no mundo inteiro nunca
   * teriam espaço.
   */
  it("aproximar traz os que não cabiam", () => {
    const feicoes = carregar("2018", 2018);
    expect(nomesEm(feicoes, 1472).map((r) => r.nome)).not.toContain("Germany");
    const perto = nomesEm(feicoes, 1472, 3).map((r) => r.nome);
    expect(perto.length).toBeGreaterThan(100);
    for (const esperado of ["Germany", "Belgium", "Czechia"]) {
      expect(perto, esperado).toContain(esperado);
    }
  });

  /* E a grafia que vai para a tela é a canônica, não a crua da base. */
  it("escreve a grafia canônica", () => {
    const nomes = nomesEm(carregar("2010", 2010), 1472).map((r) => r.nome);
    expect(nomes).toContain("Tanzania");
    expect(nomes).not.toContain("Tanzania, United Republic of");
  });

  it("não devolve nada para fatia vazia", () => {
    expect(nomesEm([], 1600)).toEqual([]);
  });
});
