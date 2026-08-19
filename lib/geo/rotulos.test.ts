import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Polygon } from "geojson";
import {
  ancoraDe,
  ancorasDe,
  colocarRotulos,
  maiorPoligono,
  resumirFatia,
} from "./rotulos";
import { criarProjecao, escalaPara } from "./projecao";
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

const nomesEm = (
  feicoes: FatiaFeature[],
  largura: number,
  zoom = 1,
  deslocamento: [number, number] = [0, 0]
) =>
  colocarRotulos({
    feicoes,
    projecao: criarProjecao({
      largura,
      altura: Math.round(largura * 0.53),
      alpha: 1,
      rotacao: [0, 0],
      zoom,
      deslocamento,
    }),
    largura,
    altura: Math.round(largura * 0.53),
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

describe("ancorasDe", () => {
  /*
   * A ordem NÃO é por folga, é amostragem do ponto mais distante. Ordenar por folga
   * concentraria as 24 opções na parte mais larga — no Japão, todas em Honshu
   * central — e aproximar numa ponta continuaria sem nome. O que se cobra aqui é
   * COBERTURA: as opções têm de se espalhar pela forma.
   */
  it("espalha as opções pela forma, em vez de agrupá-las no meio", () => {
    const japao = carregar("2018", 2018).find((f) => f.properties?.n === "Japan")!;
    const pol = maiorPoligono(japao)!;
    const alts = ancorasDe(pol);
    expect(alts.length).toBeGreaterThan(10);

    const lats = alts.map((a) => a[1]);
    const [, sul, , norte] = [
      Math.min(...pol.coordinates[0].map((c) => c[0])),
      Math.min(...pol.coordinates[0].map((c) => c[1])),
      Math.max(...pol.coordinates[0].map((c) => c[0])),
      Math.max(...pol.coordinates[0].map((c) => c[1])),
    ];
    /* Cobrem mais da metade da extensão norte-sul da ilha principal. */
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(
      (norte - sul) * 0.5
    );
  });

  it("toda opção cai dentro do polígono", () => {
    for (const f of carregar("2018", 2018).slice(0, 40)) {
      const pol = maiorPoligono(f);
      if (!pol) continue;
      for (const a of ancorasDe(pol)) {
        expect(geoContains(pol, a), f.properties?.n).toBe(true);
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

  /** Deslocamento que põe um ponto do mundo no centro da tela. */
  const centrarEm = (
    centro: [number, number],
    largura: number,
    zoom: number
  ): [number, number] => {
    const k = escalaPara(1, largura) * zoom;
    const RAD = Math.PI / 180;
    return [-centro[0] * RAD * k, centro[1] * RAD * k];
  };

  /*
   * Aproximar não mostra MAIS nomes: mostra os nomes DO LUGAR onde se aproximou.
   *
   * Eu havia afirmado "121 nomes no zoom 3", e estava errado — aquela contagem
   * incluía rótulos colocados fora do enquadramento, que não apareciam na tela. Com
   * o recorte pela tela, o número honesto no mundo inteiro é 53, e ampliar mantém a
   * mesma ordem de grandeza. O que muda é QUEM: sobre a Europa a 6× entram Alemanha,
   * Polônia, Itália e Espanha, que no mundo inteiro nunca caberiam.
   */
  it("aproximar troca quais nomes aparecem, não quantos", () => {
    const feicoes = carregar("2018", 2018);
    const mundo = nomesEm(feicoes, 1472).map((r) => r.nome);
    expect(mundo).not.toContain("Germany");

    const europa = nomesEm(feicoes, 1472, 6, centrarEm([10, 50], 1472, 6)).map(
      (r) => r.nome
    );
    for (const esperado of ["Germany", "Poland", "Italy", "Spain"]) {
      expect(europa, esperado).toContain(esperado);
    }
    /* Não é uma explosão de nomes: é uma troca de recorte. */
    expect(europa.length).toBeLessThan(mundo.length * 1.5);
  });

  /*
   * O conserto que motivou as âncoras alternativas: "aproximei e o país perdeu o
   * nome". A âncora do Japão fica no centro de Honshu, em [136,7; 36,0], e num
   * enquadramento sobre Hokkaido ela projeta em y ≈ 1083 — fora de um canvas de 780
   * px. Antes disso, o Japão ficava sem nome exatamente quando se estava olhando ele.
   */
  it("nomeia o país mesmo quando o centro dele saiu da tela", () => {
    const feicoes = carregar("2018", 2018);
    const largura = 1472;
    const altura = Math.round(largura * 0.53);
    const zoom = 24;
    const desl = centrarEm([142.8, 43.5], largura, zoom);

    const r = resumirFatia(feicoes).get("Japan")!;
    const p = criarProjecao({
      largura,
      altura,
      alpha: 1,
      rotacao: [0, 0],
      zoom,
      deslocamento: desl,
    });
    const principal = p(r.ancora!)!;
    /* A âncora principal está mesmo fora — senão o teste não prova nada. */
    expect(principal[1]).toBeGreaterThan(altura);

    const japao = nomesEm(feicoes, largura, zoom, desl).find(
      (x) => x.nome === "Japan"
    );
    expect(japao, "o Japão tem de ser nomeado pela alternativa").toBeDefined();
    expect(japao!.x).toBeGreaterThan(0);
    expect(japao!.x).toBeLessThan(largura);
    expect(japao!.y).toBeGreaterThan(0);
    expect(japao!.y).toBeLessThan(altura);
  });

  /*
   * Todo nome tem de estar ao menos PARCIALMENTE na tela, em qualquer
   * enquadramento. Parcialmente e não inteiramente: rótulo que atravessa a borda
   * é normal em mapa, e meio nome legível vale mais que nome nenhum — Israel a 6×
   * sobre a Europa cai 0,3 px abaixo da borda inferior, e cortá-lo seria perder a
   * informação para ganhar simetria. O que não pode é nome desenhado inteiro fora,
   * que era o caso antes do recorte: eles não apareciam e ainda ocupavam espaço na
   * detecção de sobreposição, podendo barrar um vizinho visível.
   */
  it("nunca coloca nome inteiramente fora do canvas, nem ampliado e deslocado", () => {
    const feicoes = carregar("2018", 2018);
    const largura = 1472;
    const altura = Math.round(largura * 0.53);
    for (const [zoom, centro] of [
      [1, [0, 0]],
      [6, [10, 50]],
      [24, [142.8, 43.5]],
    ] as [number, [number, number]][]) {
      const rotulos = nomesEm(feicoes, largura, zoom, centrarEm(centro, largura, zoom));
      expect(rotulos.length).toBeGreaterThan(0);
      for (const r of rotulos) {
        const meiaLargura = medir(r.nome) / 2;
        expect(r.x + meiaLargura, r.nome).toBeGreaterThan(0);
        expect(r.x - meiaLargura, r.nome).toBeLessThan(largura);
        expect(r.y + FONTE / 2, r.nome).toBeGreaterThan(0);
        expect(r.y - FONTE / 2, r.nome).toBeLessThan(altura);
      }
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
