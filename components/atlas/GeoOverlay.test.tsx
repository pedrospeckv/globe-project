// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { GeoOverlay } from "./GeoOverlay";
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
  selecionado: null,
  onSelecionar: () => {},
};

function paisesDe(container: HTMLElement) {
  return [...container.querySelectorAll("svg > g:nth-of-type(1) > path")];
}

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
    const path = container.querySelector("svg > g:nth-of-type(2) > path");
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
    expect(container.querySelector("svg > g:nth-of-type(3) title")?.textContent).toBe(
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
    expect(globo.querySelectorAll("svg > g:nth-of-type(3) > g")).toHaveLength(0);

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
    expect(mapa.querySelectorAll("svg > g:nth-of-type(3) > g")).toHaveLength(1);
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
    expect(container.querySelectorAll("svg > g:nth-of-type(3) > g")).toHaveLength(1);
  });

  it("sem eventos, a camada de marcadores fica vazia", () => {
    const { container } = render(<GeoOverlay {...base} curados={curados} rotas={[]} />);
    expect(container.querySelectorAll("svg > g:nth-of-type(3) > *")).toHaveLength(0);
  });

  it("o svg cobre a área do globo e não rouba o clique do arrasto", () => {
    const { container } = render(<GeoOverlay {...base} curados={curados} rotas={[]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("900");
    expect(svg.getAttribute("height")).toBe("560");
    // O SVG inteiro é inerte; só os países reativam o ponteiro.
    expect(svg.getAttribute("class")).toContain("pointer-events-none");
    expect(paisesDe(container)[0].getAttribute("class")).toContain(
      "pointer-events-auto"
    );
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
