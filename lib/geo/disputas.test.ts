import { describe, it, expect } from "vitest";
import { geoArea, geoBounds } from "d3-geo";
import {
  DISPUTAS,
  FRACAO_MAXIMA_RECORTE,
  extrairDisputados,
  disputaDoPoligono,
  disputaVigente,
  disputasRecortadas,
  disputasSemRecorteVigentes,
  idsDeDisputasVigentes,
  paisesDaDisputa,
} from "./disputas";
import { geoContains } from "d3-geo";
import type { Position } from "geojson";
import { carregarMundo, prepararMundo, separarPaises } from "./mundo";
import { alpha3De, PAISES_DO_ATLAS } from "./iso";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";

const mundo = await carregarMundo();
const preparado = prepararMundo(mundo, PAISES_DO_ATLAS);
const russia = mundo.find(
  (f) => f.id !== undefined && alpha3De(f.id as string) === "RUS"
)!;

function paisDaBase(a3: string) {
  return mundo.find((f) => f.id !== undefined && alpha3De(f.id as string) === a3)!;
}

describe("disputas", () => {
  it("toda disputa aponta para país do atlas e tem nota", () => {
    for (const d of DISPUTAS) {
      const paises = paisesDaDisputa(d);
      expect(paises.length).toBeGreaterThan(0);
      for (const p of paises) expect(PAISES_DO_ATLAS).toContain(p);
      expect(d.nota.length).toBeGreaterThan(80);
    }
  });

  it("RECUSA recorte que engole o país — a trava que a Caxemira exigiu", () => {
    /*
     * O erro é fácil e silencioso: basta apontar o `ponto` para dentro do
     * corpo principal de um país e o mecanismo hachura tudo sem reclamar.
     * Foi exatamente o que teria acontecido ao tratar a Caxemira como a
     * Crimeia — a base funde a região ao corpo da Índia e da China, e o
     * mapa passaria a afirmar que 12,5 milhões de km² são de soberania
     * contestada. Este teste existe para que ninguém tente de novo.
     */
    for (const d of disputasRecortadas()) {
      const pais = paisDaBase(d.atribuidoNaBase);
      const { disputados } = extrairDisputados(pais, d.atribuidoNaBase);
      const meu = disputados.find((x) => x.disputa.id === d.id);
      expect(meu, `disputa ${d.id} não achou polígono na base`).toBeDefined();
      expect(
        geoArea(meu!.feature) / geoArea(pais),
        `o recorte de ${d.id} é grande demais para ser um território`
      ).toBeLessThan(FRACAO_MAXIMA_RECORTE);
    }
  });

  it("a base NÃO separa a Caxemira — é por isso que ela não tem polígono", () => {
    /*
     * Medido aqui para que a premissa fique registrada em código executável
     * e não em memória de quem escreveu. Se o world-atlas passar a separar a
     * região, este teste quebra — e aí a Caxemira pode virar recorte.
     */
    const india = paisDaBase("IND");
    const china = paisDaBase("CHN");
    const srinagar: [number, number] = [74.8, 34.08];
    const aksaiChin: [number, number] = [79.0, 35.0];
    const novaDelhi: [number, number] = [77.21, 28.61];
    const pequim: [number, number] = [116.4, 39.9];

    const partes = (f: typeof india): Position[][][] => {
      const g = f.geometry;
      if (g.type === "MultiPolygon") return g.coordinates;
      if (g.type === "Polygon") return [g.coordinates];
      return [];
    };

    const qualPoligono = (f: typeof india, pt: [number, number]) =>
      partes(f).findIndex((coordinates) =>
        geoContains({ type: "Polygon", coordinates }, pt)
      );

    // Srinagar e Nova Délhi no MESMO polígono: recortar um levaria o outro.
    expect(qualPoligono(india, srinagar)).toBe(qualPoligono(india, novaDelhi));
    expect(qualPoligono(china, aksaiChin)).toBe(qualPoligono(china, pequim));
  });

  it("a Caxemira é marcada sem polígono e aparece nos dois países", () => {
    const caxemira = DISPUTAS.find((d) => d.id === "caxemira")!;
    expect(caxemira.recorte).toBe("nenhum");
    expect(paisesDaDisputa(caxemira)).toEqual(["IND", "CHN"]);

    // Ela não entra na camada de áreas em instante nenhum.
    for (const ano of ["1900", "1950", "2020"]) {
      expect(idsDeDisputasVigentes(anoFracionarioDe(ano))).not.toContain("caxemira");
    }

    // Entra na de marcadores, e só a partir de 1947.
    expect(disputasSemRecorteVigentes(anoFracionarioDe("1946")).map((d) => d.id)).toEqual([]);
    expect(disputasSemRecorteVigentes(anoFracionarioDe("1947")).map((d) => d.id)).toEqual([
      "caxemira",
    ]);
  });

  it("marcar a Caxemira não hachura nem um metro a mais de território", () => {
    const r = separarPaises(
      preparado,
      PAISES_DO_ATLAS,
      idsDeDisputasVigentes(anoFracionarioDe("2020"))
    );
    // Uma só área disputada em 2020: a Crimeia. A Caxemira é alfinete.
    expect(r.disputados).toHaveLength(1);
    expect(r.disputados[0].disputa.id).toBe("crimeia");

    const india = r.curados.find((c) => c.alpha3 === "IND")!;
    expect(geoArea(india.feature) / geoArea(paisDaBase("IND"))).toBeGreaterThan(0.99);
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
