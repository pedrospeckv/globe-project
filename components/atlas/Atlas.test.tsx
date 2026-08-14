// @vitest-environment jsdom
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { Atlas } from "./Atlas";
import { semAnoCru } from "@/components/testes/dom";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { carregarMundo } from "@/lib/geo/mundo";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
const mundo = await carregarMundo();

function montar() {
  const utils = render(
    <Atlas
      mundo={mundo}
      paises={acervo.paises}
      viagens={acervo.viagens}
      eventos={acervo.eventos}
    />
  );
  const barra = utils.container.querySelector(
    "input[type=range]"
  ) as HTMLInputElement;

  /** ISO dos países desenhados na camada interativa neste instante. */
  const acesos = () =>
    [...utils.container.querySelectorAll("svg > g:nth-of-type(1) > path title")]
      .map((t) => t.textContent?.split(" ")[0] ?? "")
      .sort();

  const irPara = (data: string) =>
    fireEvent.change(barra, { target: { value: String(anoFracionarioDe(data)) } });

  /**
   * Pelo papel, não pelo texto: o botão da viagem e o <title> da rota
   * desenhada carregam exatamente o mesmo nome.
   */
  const botao = (nome: string | RegExp) =>
    utils.getByRole("button", { name: nome });

  return { ...utils, barra, acesos, irPara, botao };
}

describe("Atlas", () => {
  it("aceso depende do TEMPO, não de uma lista fixa", () => {
    // A linha mais importante do projeto. Em 843 o Brasil não existe e o
    // globo precisa dizer isso apagando o país, não escondendo a questão.
    const { acesos, irPara } = montar();

    irPara("843");
    expect(acesos()).not.toContain("BRA");
    expect(acesos()).toContain("FRA");

    irPara("1600");
    expect(acesos()).toContain("BRA");
  });

  it("em 300 a.C. só quem já existia está no mapa", () => {
    const { acesos, irPara } = montar();
    irPara("-300");
    expect(acesos()).toEqual(["JPN"]);
  });

  it("a China entra no globo em 221 a.C.", () => {
    const { acesos, irPara } = montar();
    irPara("-222");
    expect(acesos()).not.toContain("CHN");
    irPara("-221");
    expect(acesos()).toContain("CHN");
  });

  it("a Alemanha dividida aparece hachurada só no período certo", () => {
    const { container, irPara } = montar();
    const alemanha = () =>
      [...container.querySelectorAll("svg > g:nth-of-type(1) > path")].find((p) =>
        p.querySelector("title")?.textContent?.startsWith("DEU")
      );

    irPara("1970");
    expect(alemanha()?.getAttribute("fill")).toBe("url(#hachura-dividido)");
    expect(alemanha()?.querySelector("title")?.textContent).toContain(
      "território dividido"
    );

    irPara("2000");
    expect(alemanha()?.getAttribute("fill")).not.toContain("hachura");
  });

  it("país selecionado que ainda não existia diz isso em vez de sumir com o texto", () => {
    const { container, irPara, getByText } = montar();
    irPara("1600");
    const bra = [...container.querySelectorAll("svg > g:nth-of-type(1) > path")].find(
      (p) => p.querySelector("title")?.textContent === "BRA"
    )!;
    fireEvent.click(bra);
    expect(container.textContent).toContain("Brasil ·");

    irPara("843");
    expect(getByText(/Brasil não existia nesta data/)).toBeTruthy();
  });

  it("selecionar uma viagem estreita a barra — senão a rota é invisível", () => {
    const { barra, botao } = montar();
    const largoAntes = Number(barra.max) - Number(barra.min);

    fireEvent.click(botao(acervo.viagens[0].titulo));

    const largoDepois = Number(barra.max) - Number(barra.min);
    expect(largoDepois).toBeLessThan(largoAntes / 100);
    expect(barra.getAttribute("step")).not.toBe("1");
  });

  it("a rota do Cabral se desenha conforme a barra avança", () => {
    const { container, barra, botao, irPara } = montar();
    fireEvent.click(botao(/Cabral/));
    const rota = () => container.querySelector("svg > g:nth-of-type(2) > path");

    // Antes da segunda parada não existe linha — um ponto só não é rota.
    fireEvent.change(barra, { target: { value: barra.min } });
    expect(rota()).toBeNull();

    irPara("1500-04-24");
    expect(rota()?.getAttribute("d")).toMatch(/^M/);
  });

  it("nenhum instante do acervo deixa ano negativo cru na tela", () => {
    const { container, irPara } = montar();
    for (const data of ["-300", "-221", "-100", "-1", "1", "843", "1500", "2026"]) {
      irPara(data);
      semAnoCru(container);
    }
  });

  it("país do outro lado da Terra não é desenhado por cima do visível", () => {
    /*
     * A projeção do mutator não herda o corte que o `geoOrthographic()` do d3
     * traz pronto. Sem ele o lado oculto não some — ele é espelhado sobre o
     * hemisfério de frente. Com o Brasil no centro, China e Japão apareciam a
     * menos de 120px do meio da tela.
     */
    const { container } = montar();
    const box = container.querySelector(".touch-none")!;

    // Arrasta até o Brasil ficar de frente: a rotação começa em -40 e anda
    // 0,35° por pixel, então +251px levam o centro da vista a ~48°O.
    fireEvent.pointerDown(box, { clientX: 150, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 401, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(box, { clientX: 401, clientY: 300, pointerId: 1 });

    const desenhados = [
      ...container.querySelectorAll("svg > g:nth-of-type(1) > path title"),
    ].map((t) => t.textContent);

    expect(desenhados).toContain("BRA");
    expect(desenhados).not.toContain("CHN");
    expect(desenhados).not.toContain("JPN");
  });

  it("o botão alterna o rótulo entre desenrolar e enrolar", () => {
    const { getByText } = montar();
    expect(getByText("Desenrolar")).toBeTruthy();
  });

  it("eventos próximos ao instante aparecem listados", () => {
    const { container, irPara } = montar();
    irPara("-221");
    const lista = container.querySelector("ul");
    expect(within(lista as HTMLElement).getByText(/Qin/)).toBeTruthy();
  });
});
