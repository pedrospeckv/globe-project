// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { GeoOverlay, nitidezDoContornoAtual } from "./GeoOverlay";
import { semAnoCru } from "@/components/testes/dom";
import type { PaisCurado } from "@/lib/geo/mundo";
import type { RotaFeature } from "@/lib/geo/rota";
import type { Evento } from "@/lib/conteudo/evento";

/** Quadrado simples em volta de um ponto — basta para o geoPath ter o que desenhar. */
function quadrado(lon: number, lat: number): PaisCurado["feature"] {
  const d = 6;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon - d, lat - d],
          [lon + d, lat - d],
          [lon + d, lat + d],
          [lon - d, lat + d],
          [lon - d, lat - d],
        ],
      ],
    },
  };
}

const curados: PaisCurado[] = [
  { alpha3: "BRA", feature: quadrado(-47, -15) },
  { alpha3: "DEU", feature: quadrado(10, 51) },
];

const rota: RotaFeature = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [-9.14, 38.72],
      [-39.06, -16.45],
    ],
  },
  properties: { viagemId: "cabral-1500", titulo: "Frota de Cabral" },
};

const base = {
  largura: 900,
  altura: 560,
  alpha: 0,
  rotacao: [-40, -10] as [number, number],
  /* Data da base cartográfica: o contorno atual sai com nitidez cheia. */
  ano: 2018,
  selecionado: null,
  onSelecionar: () => {},
};

function paisesDe(container: HTMLElement) {
  return [...container.querySelectorAll("svg > g[data-camada=paises] > path")];
}

/*
 * O contorno dos países com dossiê é o de HOJE em todas as épocas, porque a
 * geometria histórica ainda não existe. Com a mesma força em qualquer data ele
 * afirma o que não é: numa vista de 573 d.C. a fronteira atual da China aparecia
 * cortando o Toba Wei, e em 1945 as linhas cianas liam igual às fronteiras da época.
 */
describe("nitidez do contorno atual", () => {
  it("é cheia na data da base cartográfica", () => {
    expect(nitidezDoContornoAtual(2018)).toBeCloseTo(1, 6);
  });

  it("não passa de cheia em datas futuras", () => {
    expect(nitidezDoContornoAtual(2027)).toBeCloseTo(1, 6);
  });

  it("cai pela metade a cada 60 anos, e é monotônica", () => {
    const em1958 = nitidezDoContornoAtual(1958);
    /* Metade do caminho entre o piso e o cheio. */
    expect(em1958).toBeCloseTo(0.2 + 0.8 * 0.5, 6);
    for (const [antes, depois] of [
      [2018, 1958],
      [1958, 1900],
      [1900, 1500],
      [1500, 500],
    ]) {
      expect(nitidezDoContornoAtual(antes)).toBeGreaterThan(
        nitidezDoContornoAtual(depois)
      );
    }
  });

  /*
   * O piso não pode ser zero. O contorno é referência geográfica E o aviso de que
   * o país tem dossiê para clicar; apagá-lo em 500 d.C. resolveria a primeira coisa
   * e destruiria a segunda.
   */
  it("nunca apaga de todo, por antiga que seja a data", () => {
    for (const ano of [500, -323, -1600]) {
      expect(nitidezDoContornoAtual(ano)).toBeGreaterThanOrEqual(0.2);
      expect(nitidezDoContornoAtual(ano)).toBeLessThan(0.21);
    }
  });

  it("os anos que motivaram a mudança", () => {
    /* 1945: visível, e claramente secundário. */
    expect(nitidezDoContornoAtual(1945)).toBeCloseTo(0.54, 2);
    /* 573: no piso. */
    expect(nitidezDoContornoAtual(573)).toBeCloseTo(0.2, 2);
  });
});

describe("GeoOverlay", () => {
  it("desenha um caminho por país curado, identificado no tooltip", () => {
    const { container } = render(<GeoOverlay {...base} curados={curados} rotas={[]} />);
    const paths = paisesDe(container);
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.querySelector("title")?.textContent)).toEqual([
      "BRA",
      "DEU",
    ]);
    expect(paths.every((p) => (p.getAttribute("d") ?? "").length > 0)).toBe(true);
  });

  it("clicar num país devolve o alpha3, não o índice", () => {
    const onSelecionar = vi.fn();
    const { container } = render(
      <GeoOverlay {...base} curados={curados} rotas={[]} onSelecionar={onSelecionar} />
    );
    fireEvent.click(paisesDe(container)[1]);
    expect(onSelecionar).toHaveBeenCalledWith("DEU");
  });

  it("o selecionado se destaca do resto", () => {
    const { container } = render(
      <GeoOverlay {...base} curados={curados} rotas={[]} selecionado="BRA" />
    );
    const [bra, deu] = paisesDe(container);
    expect(Number(bra.getAttribute("stroke-width"))).toBeGreaterThan(
      Number(deu.getAttribute("stroke-width"))
    );
    expect(Number(bra.getAttribute("fill-opacity"))).toBeGreaterThan(
      Number(deu.getAttribute("fill-opacity"))
    );
  });

  it("território dividido é hachurado e diz por quê", () => {
    // A Alemanha de 1949–90: o atlas não tem a geometria da fronteira interna
    // e admite isso na tela em vez de inventar uma linha.
    const { container } = render(
      <GeoOverlay {...base} curados={curados} rotas={[]} divididos={["DEU"]} />
    );
    const [bra, deu] = paisesDe(container);
    expect(deu.getAttribute("fill")).toBe("url(#hachura-dividido)");
    expect(deu.querySelector("title")?.textContent).toContain("território dividido");
    expect(bra.getAttribute("fill")).not.toContain("hachura");
    expect(bra.querySelector("title")?.textContent).toBe("BRA");
    expect(container.querySelector("defs #hachura-dividido")).toBeTruthy();
  });

  it("a rota vira caminho de verdade — é o que o DrawSVG precisa", () => {
    const { container } = render(<GeoOverlay {...base} curados={[]} rotas={[rota]} />);
    const path = container.querySelector("svg > g[data-camada=rotas] > path");
    expect(path?.getAttribute("d")).toMatch(/^M/);
    expect(path?.getAttribute("fill")).toBe("none");
    expect(path?.querySelector("title")?.textContent).toBe("Frota de Cabral");
  });

  it("evento antes de Cristo não deixa o sinal chegar ao tooltip", () => {
    const qin: Evento = {
      id: "unificacao-qin",
      data: "-221",
      titulo: "Unificação da China sob os Qin",
      ponto: [108.9, 34.3],
      paises: ["CHN"],
      fontes: [],
    };
    const { container } = render(
      <GeoOverlay {...base} curados={[]} rotas={[]} eventos={[qin]} />
    );
    semAnoCru(container);
    expect(container.querySelector("svg > g[data-camada=eventos] title")?.textContent).toBe(
      "Unificação da China sob os Qin · 221 a.C."
    );
  });

  it("evento no lado oculto do globo não é desenhado por cima do visível", () => {
    /*
     * O `clipAngle` corrige os países porque eles passam pelo `geoPath`. O
     * marcador não: ele chama a projeção direto e recebia coordenada finita
     * para o outro lado da Terra. Este é o mesmo defeito, na outra camada.
     */
    const antipoda: Evento = {
      id: "no-lado-de-la",
      data: "1500",
      titulo: "Evento do outro lado",
      // A ~178° do centro da vista. Não uso o antípoda exato de propósito:
      // o corte para em 179,9° e essa folga de 0,1° é um ponto cego real,
      // embora com menos de um pixel na tela.
      ponto: [-140, -12],
      paises: ["BRA"],
      fontes: [],
    };

    const { container: globo } = render(
      <GeoOverlay {...base} curados={[]} rotas={[]} eventos={[antipoda]} />
    );
    expect(globo.querySelectorAll("svg > g[data-camada=eventos] > g")).toHaveLength(0);

    // Desenrolado, o mundo inteiro aparece — e o marcador volta.
    const { container: mapa } = render(
      <GeoOverlay
        {...base}
        alpha={1}
        curados={[]}
        rotas={[]}
        eventos={[antipoda]}
      />
    );
    expect(mapa.querySelectorAll("svg > g[data-camada=eventos] > g")).toHaveLength(1);
  });

  it("evento na face de frente continua sendo desenhado", () => {
    const perto: Evento = {
      id: "aqui",
      data: "1500",
      titulo: "Evento visível",
      ponto: [40, 10], // no centro da vista
      paises: ["BRA"],
      fontes: [],
    };
    const { container } = render(
      <GeoOverlay {...base} curados={[]} rotas={[]} eventos={[perto]} />
    );
    expect(container.querySelectorAll("svg > g[data-camada=eventos] > g")).toHaveLength(1);
  });

  it("a posição do marcador é arredondada — hidratação não perdoa dígito", () => {
    /*
     * O servidor escrevia `388.6494362206221` e o navegador
     * `388.649436220622`: trigonometria em ponto flutuante pode divergir no
     * último dígito entre o V8 do Node e o do navegador, e o React acusa.
     */
    const ev: Evento = {
      id: "x",
      data: "1500",
      titulo: "Evento",
      ponto: [37, 12],
      paises: ["BRA"],
      fontes: [],
    };
    const { container } = render(
      <GeoOverlay {...base} curados={[]} rotas={[]} eventos={[ev]} />
    );
    const t = container
      .querySelector("svg > g[data-camada=eventos] > g")!
      .getAttribute("transform")!;
    expect(t).toMatch(/^translate\(-?\d+\.\d{3},-?\d+\.\d{3}\)$/);
  });

  it("sem eventos, a camada de marcadores fica vazia", () => {
    const { container } = render(<GeoOverlay {...base} curados={curados} rotas={[]} />);
    expect(container.querySelectorAll("svg > g[data-camada=eventos] > *")).toHaveLength(0);
  });

  it("o svg cobre a área do globo e não rouba o clique do arrasto", () => {
    const { container } = render(<GeoOverlay {...base} curados={curados} rotas={[]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("900");
    expect(svg.getAttribute("height")).toBe("560");
    /*
      O SVG inteiro é inerte; só os países reativam o ponteiro. E reativam com
      `all`, não com o padrão `visiblePainted`: o preenchimento deles é
      transparente — o contorno é referência e não pode cobrir o território da
      época —, e com `visiblePainted` o país viraria clicável só na linha da
      fronteira.
    */
    expect(svg.getAttribute("class")).toContain("pointer-events-none");
    expect(
      (paisesDe(container)[0] as SVGPathElement).style.pointerEvents
    ).toBe("all");
  });

  it("girar o globo move os países — a projeção não fica congelada", () => {
    const { container: a } = render(
      <GeoOverlay {...base} curados={curados} rotas={[]} />
    );
    const antes = paisesDe(a)[0].getAttribute("d");
    const { container: b } = render(
      <GeoOverlay {...base} curados={curados} rotas={[]} rotacao={[140, -10]} />
    );
    expect(paisesDe(b)[0].getAttribute("d")).not.toBe(antes);
  });
});
