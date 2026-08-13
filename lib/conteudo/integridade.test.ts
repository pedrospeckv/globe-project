import { describe, it, expect } from "vitest";
import { verificarIntegridade, type Acervo } from "./integridade";

function acervoBase(): Acervo {
  return {
    fontes: [
      {
        id: "stf-hc-193726",
        tipo: "decisao-judicial",
        titulo: "HC 193.726",
      },
    ],
    paises: [
      {
        iso: "BRA",
        nome: "Brasil",
        periodos: [
          {
            id: "br-atual",
            inicio: "1985",
            rotulo: "Nova República",
            regime: "democracia",
          },
        ],
      },
    ],
    figuras: [
      {
        id: "lula",
        nome: "Lula",
        paisIso: "BRA",
        cargos: [],
        alegacoes: [
          {
            id: "lula-triplex",
            enunciado: "Recebeu o triplex do Guarujá",
            status: "anulado",
            fontes: ["stf-hc-193726"],
          },
        ],
      },
    ],
    viagens: [],
  };
}

describe("verificarIntegridade", () => {
  it("não acusa nada quando tudo referencia corretamente", () => {
    expect(verificarIntegridade(acervoBase())).toEqual([]);
  });

  it("ACUSA alegação que cita fonte inexistente", () => {
    const a = acervoBase();
    a.figuras[0].alegacoes[0].fontes = ["fonte-que-nao-existe"];
    const erros = verificarIntegridade(a);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/fonte-que-nao-existe/);
    expect(erros[0]).toMatch(/lula-triplex/);
  });

  it("ACUSA figura de país que não está no atlas", () => {
    const a = acervoBase();
    a.figuras[0].paisIso = "ARG";
    expect(verificarIntegridade(a).some((e) => /ARG/.test(e))).toBe(true);
  });

  it("ACUSA ids de fonte duplicados", () => {
    const a = acervoBase();
    a.fontes.push({ ...a.fontes[0] });
    expect(verificarIntegridade(a).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("ACUSA ids de figura duplicados", () => {
    const a = acervoBase();
    a.figuras.push({ ...a.figuras[0] });
    expect(verificarIntegridade(a).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("ACUSA iso de país duplicado", () => {
    const a = acervoBase();
    a.paises.push({ ...a.paises[0] });
    expect(verificarIntegridade(a).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("ACUSA viagem que cita fonte inexistente", () => {
    const a = acervoBase();
    a.viagens.push({
      id: "cabral-1500",
      titulo: "Frota de Cabral",
      paradas: [
        { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
        { local: "Porto Seguro", data: "1500-04-22", coords: [-39.06, -16.45] },
      ],
      fontes: ["fonte-fantasma"],
    });
    expect(verificarIntegridade(a).some((e) => /fonte-fantasma/.test(e))).toBe(true);
  });

  it("acumula todos os erros em vez de parar no primeiro", () => {
    const a = acervoBase();
    a.figuras[0].alegacoes[0].fontes = ["inexistente-a", "inexistente-b"];
    expect(verificarIntegridade(a)).toHaveLength(2);
  });
});
