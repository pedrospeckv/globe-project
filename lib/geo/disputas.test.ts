import { describe, it, expect } from "vitest";
import { geoArea, geoBounds } from "d3-geo";
import {
  DISPUTAS,
  extrairDisputados,
  disputaDoPoligono,
  disputaVigente,
  idsDeDisputasVigentes,
} from "./disputas";
import { carregarMundo, prepararMundo, separarPaises } from "./mundo";
import { alpha3De, PAISES_DO_ATLAS } from "./iso";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";

const mundo = await carregarMundo();
const preparado = prepararMundo(mundo, PAISES_DO_ATLAS);
const russia = mundo.find(
  (f) => f.id !== undefined && alpha3De(f.id as string) === "RUS"
)!;

describe("disputas", () => {
  it("toda disputa aponta para um país do atlas e tem nota", () => {
    for (const d of DISPUTAS) {
      expect(PAISES_DO_ATLAS).toContain(d.atribuidoNaBase);
      expect(d.nota.length).toBeGreaterThan(80);
    }
  });

  it("o ponto da Crimeia cai dentro de um polígono da Rússia na base", () => {
    // Se o Natural Earth reatribuir a península, isto quebra — e é para
    // quebrar: a premissa do recorte teria mudado.
    const { disputados } = extrairDisputados(russia, "RUS");
    expect(disputados).toHaveLength(1);
    expect(disputados[0].disputa.id).toBe("crimeia");
  });

  it("o polígono recortado é a península, não o país", () => {
    const { disputados, resto } = extrairDisputados(russia, "RUS");
    const crimeia = disputados[0].feature;

    const caixa = geoBounds(crimeia);
    expect(caixa[0][0]).toBeGreaterThan(30);
    expect(caixa[1][0]).toBeLessThan(38);
    expect(caixa[0][1]).toBeGreaterThan(43);
    expect(caixa[1][1]).toBeLessThan(47);

    // E é uma fração ínfima do país — a Sibéria não foi junto.
    expect(geoArea(crimeia) / geoArea(russia)).toBeLessThan(0.005);
    expect(geoArea(resto) / geoArea(russia)).toBeGreaterThan(0.99);
  });

  it("o recorte é estático; só a vigência olha o relógio", () => {
    // Qual polígono é a Crimeia não muda com o ano. Foi confundir as duas
    // coisas que pôs o recorte caro dentro do caminho por instante.
    const crimeia = DISPUTAS.find((d) => d.id === "crimeia")!;
    expect(disputaVigente(crimeia, anoFracionarioDe("2000"))).toBe(false);
    expect(disputaVigente(crimeia, anoFracionarioDe("2014"))).toBe(true);
    expect(disputaVigente(crimeia, anoFracionarioDe("2020"))).toBe(true);
  });

  it("antes de 2014 o polígono desce para o fundo em vez de acender", () => {
    const antes = separarPaises(preparado, PAISES_DO_ATLAS, idsDeDisputasVigentes(anoFracionarioDe("2000")));
    expect(antes.disputados).toHaveLength(0);

    const depois = separarPaises(preparado, PAISES_DO_ATLAS, idsDeDisputasVigentes(anoFracionarioDe("2014")));
    expect(depois.disputados).toHaveLength(1);

    // A península não sumiu num caso nem no outro.
    const area = (fs: { geometry: unknown }[]) =>
      fs.reduce((s, f) => s + geoArea(f as Parameters<typeof geoArea>[0]), 0);
    expect(area(antes.fundo)).toBeCloseTo(
      area(depois.fundo) + area(depois.disputados.map((d) => d.feature)),
      6
    );
  });

  it("país sem disputa passa intacto", () => {
    const brasil = mundo.find(
      (f) => f.id !== undefined && alpha3De(f.id as string) === "BRA"
    )!;
    const r = extrairDisputados(brasil, "BRA");
    expect(r.resto).toBe(brasil);
    expect(r.disputados).toHaveLength(0);
  });

  it("a disputa é do polígono certo — outro pedaço da Rússia não casa", () => {
    const g = russia.geometry;
    const partes = g.type === "MultiPolygon" ? g.coordinates : [];
    const casam = partes.filter((c) => disputaDoPoligono(c, "RUS") !== undefined);
    expect(casam).toHaveLength(1);
  });

  it("sem instante informado, separarPaises não marca disputa nenhuma", () => {
    // A página de país não tem barra de tempo; ela não deve inventar uma data.
    const { disputados } = separarPaises(preparado, PAISES_DO_ATLAS);
    expect(disputados).toHaveLength(0);
  });

  it("nada de terra some por causa do recorte", () => {
    const r = separarPaises(preparado, PAISES_DO_ATLAS, idsDeDisputasVigentes(anoFracionarioDe("2020")));
    const soma = (fs: { geometry: unknown }[]) =>
      fs.reduce((s, f) => s + geoArea(f as Parameters<typeof geoArea>[0]), 0);
    expect(
      soma(r.fundo) +
        soma(r.curados.map((c) => c.feature)) +
        soma(r.disputados.map((d) => d.feature))
    ).toBeCloseTo(soma(mundo), 6);
  });
});
