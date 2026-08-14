import { describe, it, expect } from "vitest";
import { geoArea, geoBounds } from "d3-geo";
import { DISPUTAS, separarDisputados, disputaDoPoligono } from "./disputas";
import { carregarMundo, separarPaises } from "./mundo";
import { alpha3De, PAISES_DO_ATLAS } from "./iso";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";

const mundo = await carregarMundo();
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
    const { disputados } = separarDisputados(russia, "RUS", anoFracionarioDe("2020"));
    expect(disputados).toHaveLength(1);
    expect(disputados[0].disputa.id).toBe("crimeia");
  });

  it("o polígono recortado é a península, não o país", () => {
    const { disputados, principal } = separarDisputados(
      russia,
      "RUS",
      anoFracionarioDe("2020")
    );
    const crimeia = disputados[0].feature;

    const caixa = geoBounds(crimeia);
    expect(caixa[0][0]).toBeGreaterThan(30);
    expect(caixa[1][0]).toBeLessThan(38);
    expect(caixa[0][1]).toBeGreaterThan(43);
    expect(caixa[1][1]).toBeLessThan(47);

    // E é uma fração ínfima do país — a Sibéria não foi junto.
    expect(geoArea(crimeia) / geoArea(russia)).toBeLessThan(0.005);
    expect(geoArea(principal!) / geoArea(russia)).toBeGreaterThan(0.99);
  });

  it("antes de 2014 o polígono não é aceso nem marcado", () => {
    const antes = separarDisputados(russia, "RUS", anoFracionarioDe("2000"));
    expect(antes.disputados).toHaveLength(0);
    expect(antes.aindaNao).not.toBeNull();

    const depois = separarDisputados(russia, "RUS", anoFracionarioDe("2014"));
    expect(depois.disputados).toHaveLength(1);
    expect(depois.aindaNao).toBeNull();
  });

  it("país sem disputa passa intacto", () => {
    const brasil = mundo.find(
      (f) => f.id !== undefined && alpha3De(f.id as string) === "BRA"
    )!;
    const r = separarDisputados(brasil, "BRA", anoFracionarioDe("2020"));
    expect(r.principal).toBe(brasil);
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
    const { disputados } = separarPaises(mundo, PAISES_DO_ATLAS);
    expect(disputados).toHaveLength(0);
  });

  it("nada de terra some por causa do recorte", () => {
    const r = separarPaises(mundo, PAISES_DO_ATLAS, anoFracionarioDe("2020"));
    const soma = (fs: { geometry: unknown }[]) =>
      fs.reduce((s, f) => s + geoArea(f as Parameters<typeof geoArea>[0]), 0);
    expect(
      soma(r.fundo) +
        soma(r.curados.map((c) => c.feature)) +
        soma(r.disputados.map((d) => d.feature))
    ).toBeCloseTo(soma(mundo), 6);
  });
});
