// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TimeScrubber } from "./TimeScrubber";
import { semAnoCru } from "@/components/testes/dom";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";

/** Escala do acervo: de 300 a.C. até hoje. */
const LONGA: [number, number] = [anoFracionarioDe("-300"), 2026];
/** Escala de uma viagem: os 46 dias do Cabral. */
const CURTA: [number, number] = [
  anoFracionarioDe("1500-03-01"),
  anoFracionarioDe("1500-05-01"),
];

function barra(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector("input[type=range]");
  if (!el) throw new Error("barra de tempo não renderizou");
  return el as HTMLInputElement;
}

describe("TimeScrubber", () => {
  it("as pontas mostram a.C. em vez do sinal", () => {
    const { container } = render(
      <TimeScrubber valor={1500} dominio={LONGA} onChange={() => {}} />
    );
    semAnoCru(container);
    expect(container.textContent).toContain("300 a.C.");
    expect(container.textContent).toContain("2026");
  });

  it("o rótulo do valor atual também passa pelo formatador", () => {
    const { container } = render(
      <TimeScrubber
        valor={anoFracionarioDe("-221")}
        dominio={LONGA}
        onChange={() => {}}
      />
    );
    semAnoCru(container);
    expect(container.textContent).toContain("221 a.C.");
  });

  it("passo é 1 na escala longa — senão pedir 1400 entrega 1399", () => {
    // O navegador ancora os passos em `min`. Com passo fracionário nenhuma
    // posição cai num ano inteiro, e arredondar depois não recupera o ano.
    // jsdom não reproduz esse encaixe, então o teste guarda o atributo.
    const { container } = render(
      <TimeScrubber valor={1500} dominio={LONGA} onChange={() => {}} />
    );
    expect(barra(container).getAttribute("step")).toBe("1");
  });

  it("passo é fino na escala de uma viagem — senão a rota não anda", () => {
    const { container } = render(
      <TimeScrubber valor={CURTA[0]} dominio={CURTA} onChange={() => {}} />
    );
    const passo = Number(barra(container).getAttribute("step"));
    expect(passo).toBeGreaterThan(0);
    expect(passo).toBeLessThan(1 / 300);
  });

  it("na escala longa entrega ano inteiro a quem escuta", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeScrubber valor={1500} dominio={LONGA} onChange={onChange} />
    );
    fireEvent.change(barra(container), { target: { value: "1399.48" } });
    expect(onChange).toHaveBeenCalledWith(1399);
  });

  it("na escala curta preserva a fração — é o que separa março de abril", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeScrubber valor={CURTA[0]} dominio={CURTA} onChange={onChange} />
    );
    const abril = anoFracionarioDe("1500-04-24");
    fireEvent.change(barra(container), { target: { value: String(abril) } });
    expect(onChange).toHaveBeenCalledWith(abril);
    expect(onChange.mock.calls[0][0]).not.toBe(Math.round(abril));
  });

  it("o domínio vira min e max da barra", () => {
    const { container } = render(
      <TimeScrubber valor={1500} dominio={LONGA} onChange={() => {}} />
    );
    const b = barra(container);
    expect(Number(b.getAttribute("min"))).toBeCloseTo(LONGA[0], 3);
    expect(Number(b.getAttribute("max"))).toBe(LONGA[1]);
  });

  it("marcas viram tooltips sem vazar sinal", () => {
    const { container } = render(
      <TimeScrubber
        valor={1500}
        dominio={LONGA}
        onChange={() => {}}
        marcas={[
          { pos: anoFracionarioDe("-221"), rotulo: "China · Qin (221 a.C.)" },
          { pos: 1500, rotulo: "Brasil · Colônia" },
        ]}
      />
    );
    semAnoCru(container);
    const titulos = [...container.querySelectorAll("[title]")].map((e) =>
      e.getAttribute("title")
    );
    expect(titulos).toContain("China · Qin (221 a.C.)");
    expect(titulos).toContain("Brasil · Colônia");
  });

  it("marca antes do início do domínio não é posicionada fora à esquerda", () => {
    const { container } = render(
      <TimeScrubber
        valor={1500}
        dominio={LONGA}
        onChange={() => {}}
        marcas={[{ pos: LONGA[0], rotulo: "primeira" }]}
      />
    );
    const marca = container.querySelector("[title=primeira]") as HTMLElement;
    expect(marca.style.left).toBe("0%");
  });

  describe("ir para a data digitada", () => {
    // Com 3.600 anos em 900px cada pixel vale quatro anos: arrastar não
    // alcança 2014. A barra percorre; o campo chega.
    function digitar(container: HTMLElement, valor: string) {
      const campo = container.querySelector(
        "input[aria-label='Ir para a data']"
      ) as HTMLInputElement;
      fireEvent.change(campo, { target: { value: valor } });
      fireEvent.submit(campo.closest("form")!);
      return campo;
    }

    it("leva ao ano exato que a barra não alcança", () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimeScrubber valor={1500} dominio={LONGA} onChange={onChange} />
      );
      digitar(container, "2014");
      expect(onChange).toHaveBeenCalledWith(2014);
    });

    it("entende a data antes de Cristo escrita como se lê", () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimeScrubber valor={1500} dominio={LONGA} onChange={onChange} />
      );
      digitar(container, "221 a.C.");
      expect(onChange).toHaveBeenCalledWith(anoFracionarioDe("-221"));
    });

    it("na escala de uma viagem preserva o dia digitado", () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimeScrubber valor={CURTA[0]} dominio={CURTA} onChange={onChange} />
      );
      digitar(container, "1500-04-24");
      expect(onChange).toHaveBeenCalledWith(anoFracionarioDe("1500-04-24"));
    });

    it("fora do domínio encosta na ponta em vez de recusar calado", () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimeScrubber valor={CURTA[0]} dominio={CURTA} onChange={onChange} />
      );
      digitar(container, "1900");
      expect(onChange).toHaveBeenCalledWith(CURTA[1]);
    });

    it("texto inválido marca o campo e não move a barra", () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimeScrubber valor={1500} dominio={LONGA} onChange={onChange} />
      );
      const campo = digitar(container, "ontem");
      expect(onChange).not.toHaveBeenCalled();
      expect(campo.getAttribute("aria-invalid")).toBe("true");
    });

    it("corrigir o texto limpa o erro", () => {
      const onChange = vi.fn();
      const { container } = render(
        <TimeScrubber valor={1500} dominio={LONGA} onChange={onChange} />
      );
      const campo = digitar(container, "ontem");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      fireEvent.change(campo, { target: { value: "1206" } });
      expect(campo.getAttribute("aria-invalid")).toBe("false");
    });
  });

  it("a barra tem nome acessível — ela é invisível por cima do traço", () => {
    const { container } = render(
      <TimeScrubber valor={1500} dominio={LONGA} onChange={() => {}} />
    );
    expect(barra(container).getAttribute("aria-label")).toBe("Linha do tempo");
  });
});
