import { describe, expect, it } from "vitest";
import path from "node:path";
import { Ilha, conhecidaEm, soberaniaEm } from "./ilha";
import { carregarAcervo } from "./carregar";
import { anoFracionarioDe } from "./tempo";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
const ilha = (id: string) => {
  const i = acervo.ilhas.find((x) => x.id === id);
  if (!i) throw new Error(`ilha ${id} não está no acervo`);
  return i;
};
const em = (id: string, data: string) =>
  soberaniaEm(ilha(id), anoFracionarioDe(data))?.poder ?? null;

describe("acervo de ilhas", () => {
  it("carrega as sete do Atlântico Sul", () => {
    expect(acervo.ilhas.map((i) => i.id).sort()).toEqual([
      "acores",
      "cabo-verde",
      "fernando-de-noronha",
      "madeira",
      "malvinas-falklands",
      "santa-helena",
      "tristao-da-cunha",
    ]);
  });

  /*
   * Sem polígono de origem para conferir contra, a fonte é a única garantia de
   * que a soberania afirmada tem lastro. Por isso todo trecho precisa de uma.
   */
  it("todo trecho de soberania tem fonte", () => {
    for (const i of acervo.ilhas) {
      for (const t of i.soberania) {
        expect(t.fontes.length, `${i.id} em ${t.desde}`).toBeGreaterThan(0);
      }
    }
  });

  it("as coordenadas caem no Atlântico, não em terra firme continental", () => {
    for (const i of acervo.ilhas) {
      const [lon, lat] = i.ponto;
      expect(lon, i.id).toBeGreaterThan(-70);
      expect(lon, i.id).toBeLessThan(0);
      expect(lat, i.id).toBeGreaterThan(-60);
      expect(lat, i.id).toBeLessThan(45);
    }
  });
});

describe("soberaniaEm", () => {
  it("responde quem exercia, por data", () => {
    expect(em("santa-helena", "1600")).toBe("Portugal");
    expect(em("santa-helena", "1700")).toBe("Companhia Inglesa das Índias Orientais");
    expect(em("santa-helena", "1900")).toBe("Reino Unido");
  });

  /* Início inclusivo, fim exclusivo: a data de virada pertence a um só. */
  it("não deixa a data de virada pertencer a dois poderes", () => {
    expect(em("cabo-verde", "1975-07-04")).toBe("Portugal");
    expect(em("cabo-verde", "1975-07-05")).toBe("Cabo Verde");
  });

  it("cobre a guerra de 1982 nos dois sentidos", () => {
    expect(em("malvinas-falklands", "1982-03")).toBe("Reino Unido");
    expect(em("malvinas-falklands", "1982-05")).toBe("Argentina");
    expect(em("malvinas-falklands", "1983")).toBe("Reino Unido");
  });

  /*
   * A lacuna é o dado. Tristão da Cunha foi avistada em 1506 e ficou três
   * séculos sem ninguém exercendo posse; preencher esse vazio com um dono
   * inventaria soberania que não existiu.
   */
  it("devolve 'nenhum' onde a fonte não atribui posse", () => {
    expect(em("tristao-da-cunha", "1600")).toBe("nenhum");
    expect(em("tristao-da-cunha", "1900")).toBe("Reino Unido");
  });

  it("devolve null antes de a ilha ser conhecida", () => {
    expect(em("fernando-de-noronha", "1400")).toBeNull();
    expect(conhecidaEm(ilha("fernando-de-noronha"), anoFracionarioDe("1400"))).toBe(false);
    expect(conhecidaEm(ilha("fernando-de-noronha"), anoFracionarioDe("1600"))).toBe(true);
  });

  /* Lacuna real no meio da lista: a França sai em 1737 e Portugal entra. */
  it("atravessa a ocupação francesa de Fernando de Noronha", () => {
    expect(em("fernando-de-noronha", "1700")).toBe("Portugal");
    expect(em("fernando-de-noronha", "1736-06")).toBe("França");
    expect(em("fernando-de-noronha", "1800")).toBe("Portugal");
    expect(em("fernando-de-noronha", "2020")).toBe("Brasil");
  });
});

describe("schema", () => {
  const base = {
    id: "teste",
    nome: "Teste",
    ponto: [0, 0],
    soberania: [{ desde: "1500", poder: "X", fontes: ["f"] }],
  };

  it("recusa trecho que termina antes de começar", () => {
    const r = Ilha.safeParse({
      ...base,
      soberania: [{ desde: "1600", ate: "1500", poder: "X", fontes: ["f"] }],
    });
    expect(r.success).toBe(false);
  });

  it("recusa trechos fora de ordem", () => {
    const r = Ilha.safeParse({
      ...base,
      soberania: [
        { desde: "1700", poder: "A", fontes: ["f"] },
        { desde: "1500", poder: "B", fontes: ["f"] },
      ],
    });
    expect(r.success).toBe(false);
  });

  /* Marcar disputa e não explicar é o que o atlas recusa em alegação. */
  it("recusa ilha disputada sem nota", () => {
    expect(Ilha.safeParse({ ...base, disputada: true }).success).toBe(false);
    expect(
      Ilha.safeParse({ ...base, disputada: true, nota: "porque tal" }).success
    ).toBe(true);
  });

  it("recusa coordenada fora do planeta", () => {
    expect(Ilha.safeParse({ ...base, ponto: [200, 0] }).success).toBe(false);
    expect(Ilha.safeParse({ ...base, ponto: [0, 100] }).success).toBe(false);
  });
});
