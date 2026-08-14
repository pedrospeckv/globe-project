// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IndicadorChart } from "./IndicadorChart";
import "@/components/testes/dom";
import type { Indicador } from "@/lib/conteudo/indicador";
import type { Periodo } from "@/lib/conteudo/pais";

const linear: Indicador = {
  id: "desocupacao",
  paisIso: "BRA",
  nome: "Taxa de desocupação",
  unidade: "% da força de trabalho",
  fonte: "ibge-sidra-6381",
  escala: "linear",
  serie: [
    { ano: 2012, valor: 6.9 },
    { ano: 2020, valor: 14.2 },
    { ano: 2025, valor: 5.1 },
  ],
};

/** Três ordens de grandeza, como o IPCA de verdade. */
const logaritmico: Indicador = {
  ...linear,
  id: "ipca",
  nome: "IPCA",
  unidade: "% ao ano",
  escala: "log",
  serie: [
    { ano: 1980, valor: 99.25 },
    { ano: 1993, valor: 2477.15 },
    { ano: 2025, valor: 4.26 },
  ],
};

/** Coordenadas do `d` da curva, na ordem em que foram desenhadas. */
function pontos(container: HTMLElement): [number, number][] {
  const d = container.querySelector("path[stroke='#fbbf24']")!.getAttribute("d")!;
  return [...d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => [+m[1], +m[2]]);
}

describe("IndicadorChart", () => {
  it("mostra nome, unidade e a fonte — curva sem atribuição é opinião com eixo", () => {
    const { container } = render(
      <IndicadorChart
        indicador={linear}
        fonte={{
          id: "ibge-sidra-6381",
          tipo: "dataset",
          titulo: "PNAD Contínua",
          publicacao: "IBGE",
        }}
      />
    );
    expect(container.textContent).toContain("Taxa de desocupação");
    expect(container.textContent).toContain("% da força de trabalho");
    expect(container.textContent).toContain("PNAD Contínua");
    expect(container.textContent).toContain("IBGE");
  });

  it("cai para o id da fonte quando ela não foi resolvida, em vez de omitir", () => {
    const { container } = render(<IndicadorChart indicador={linear} />);
    expect(container.textContent).toContain("ibge-sidra-6381");
  });

  it("desenha um ponto por medição, na ordem dos anos", () => {
    const { container } = render(<IndicadorChart indicador={linear} />);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
    const xs = pontos(container).map(([x]) => x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("valor maior fica mais alto — y do svg cresce para baixo", () => {
    const { container } = render(<IndicadorChart indicador={linear} />);
    const [p2012, p2020, p2025] = pontos(container);
    expect(p2020[1]).toBeLessThan(p2012[1]); // 14,2% acima de 6,9%
    expect(p2025[1]).toBeGreaterThan(p2012[1]); // 5,1% abaixo de 6,9%
  });

  it("rotula os extremos do eixo vertical", () => {
    const { container } = render(<IndicadorChart indicador={linear} />);
    expect(container.textContent).toContain("14,2");
    expect(container.textContent).toContain("5,1");
  });

  it("formata sem locale — locale divergente volta como erro de hidratação", () => {
    const { container } = render(<IndicadorChart indicador={logaritmico} />);
    // 2477,15 arredonda para 2477 e usa vírgula fixa, não separador de milhar.
    expect(container.textContent).toContain("2477");
    expect(container.textContent).not.toContain("2.477");
  });

  it("no log, a distância é proporcional ao expoente", () => {
    /*
     * É o que torna o gráfico legível: no linear, 99 e 4 colariam no chão
     * embaixo do pico de 2477 e o Plano Real sumiria da tela.
     */
    const { container } = render(<IndicadorChart indicador={logaritmico} />);
    const [p1980, p1993, p2025] = pontos(container);
    const alturaDe99 = p2025[1] - p1980[1]; // de 4,26 até 99,25
    const alturaTotal = p2025[1] - p1993[1]; // de 4,26 até 2477,15
    const esperado =
      (Math.log10(99.25) - Math.log10(4.26)) /
      (Math.log10(2477.15) - Math.log10(4.26));
    expect(alturaDe99 / alturaTotal).toBeCloseTo(esperado, 3);
  });

  it("avisa quando o eixo é logarítmico", () => {
    const { container: comLog } = render(<IndicadorChart indicador={logaritmico} />);
    expect(comLog.textContent).toContain("escala logarítmica");

    const { container: semLog } = render(<IndicadorChart indicador={linear} />);
    expect(semLog.textContent).not.toContain("escala logarítmica");
  });

  it("sombreia os mandatos e nomeia cada um", () => {
    const periodos: Periodo[] = [
      {
        id: "br-nova",
        inicio: "1985",
        rotulo: "Nova República",
        regime: "democracia",
        entidades: [], fontes: [],
      },
    ];
    const { container } = render(
      <IndicadorChart indicador={linear} periodos={periodos} />
    );
    expect(container.querySelectorAll("rect")).toHaveLength(1);
    expect(container.textContent).toContain("Nova República");
  });

  it("ignora período que não encosta na série", () => {
    const periodos: Periodo[] = [
      {
        id: "br-colonia",
        inicio: "1500",
        fim: "1822",
        rotulo: "Colônia",
        regime: "x",
        entidades: [], fontes: [],
      },
    ];
    const { container } = render(
      <IndicadorChart indicador={linear} periodos={periodos} />
    );
    expect(container.querySelectorAll("rect")).toHaveLength(0);
    expect(container.textContent).not.toContain("Colônia");
  });

  it("aguenta série de um ponto só sem quebrar o eixo", () => {
    const { container } = render(
      <IndicadorChart
        indicador={{ ...linear, serie: [{ ano: 2020, valor: 14.2 }] }}
      />
    );
    const [p] = pontos(container);
    expect(Number.isFinite(p[0])).toBe(true);
    expect(Number.isFinite(p[1])).toBe(true);
  });
});
