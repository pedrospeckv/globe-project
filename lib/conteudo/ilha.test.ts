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
  it("carrega o Atlântico Sul e o Pacífico", () => {
    expect(acervo.ilhas.map((i) => i.id).sort()).toEqual([
      "acores",
      "cabo-verde",
      "chuuk",
      "fernando-de-noronha",
      "guadalcanal",
      "guam",
      "iwo-jima",
      "kwajalein",
      "madeira",
      "malvinas-falklands",
      "midway",
      "okinawa",
      "peleliu",
      "saipan",
      "santa-helena",
      "tarawa",
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

  /*
   * O risco real na coordenada é a troca de longitude por latitude. Para as
   * ilhas do Pacífico o schema já pega — longitude 145 não passa como latitude
   * —, mas Santa Helena em [-5,7; -15,9] sobreviveria invertida sem que nada
   * acusasse. Daí a tabela de conferência por ilha, com tolerância de 1 grau.
   */
  it("as coordenadas conhecidas estão na ordem [longitude, latitude]", () => {
    const esperado: Record<string, [number, number]> = {
      "santa-helena": [-5.71, -15.96],
      "fernando-de-noronha": [-32.42, -3.85],
      "tristao-da-cunha": [-12.28, -37.11],
      guam: [144.75, 13.45],
      /*
       * Corrigido em 2026-08-18: estava [127.98, 26.33], que cai no MAR a 7 km da
       * costa. Apareceu quando a extração de geometria por "ilha única" reprovou —
       * ela pega o polígono que contém o ponto, e nenhum continha. O valor novo é o
       * centroide da própria ilha no land-10m, conferido como interior.
       */
      okinawa: [127.97, 26.5],
      midway: [-177.37, 28.21],
      guadalcanal: [160.15, -9.61],
    };
    for (const [id, [lon, lat]] of Object.entries(esperado)) {
      const p = ilha(id).ponto;
      expect(p[0], `${id} longitude`).toBeCloseTo(lon, 0);
      expect(p[1], `${id} latitude`).toBeCloseTo(lat, 0);
    }
  });

  it("nenhuma ilha repete a mesma posição", () => {
    const chaves = acervo.ilhas.map((i) => i.ponto.join(","));
    expect(new Set(chaves).size).toBe(chaves.length);
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

describe("vínculo", () => {
  const vinculoEm = (id: string, data: string) =>
    soberaniaEm(ilha(id), anoFracionarioDe(data))?.vinculo ?? null;

  /*
   * O campo existe por causa deste caso. Entre 1941 e 1944 quem mandava em
   * Guam era o Japão e quem detinha título era Washington. Sem `vinculo`, o
   * registro diria "Japão" e afirmaria posse que nenhum documento dá.
   */
  it("separa ocupar de possuir em Guam", () => {
    expect(em("guam", "1940")).toBe("Estados Unidos");
    expect(vinculoEm("guam", "1940")).toBe("soberania");

    expect(em("guam", "1943")).toBe("Japão");
    expect(vinculoEm("guam", "1943")).toBe("ocupacao-militar");

    expect(em("guam", "1950")).toBe("Estados Unidos");
    expect(vinculoEm("guam", "1950")).toBe("soberania");
  });

  it("registra mandato e tutela como administração, não como soberania", () => {
    expect(vinculoEm("saipan", "1930")).toBe("mandato");
    expect(em("saipan", "1930")).toBe("Japão");
    expect(vinculoEm("saipan", "1960")).toBe("tutela");
    expect(em("saipan", "1960")).toBe("Estados Unidos");
    /* Só em 1986 a soberania americana passa a ser afirmada. */
    expect(vinculoEm("saipan", "1990")).toBe("soberania");
  });

  /* Artigo 3 do Tratado de São Francisco: nem ocupação nem tutela. */
  it("distingue a administração estrangeira de Okinawa e Iwo Jima", () => {
    expect(vinculoEm("okinawa", "1950")).toBe("ocupacao-militar");
    expect(vinculoEm("okinawa", "1960")).toBe("administracao-estrangeira");
    expect(vinculoEm("okinawa", "1980")).toBe("soberania");
    expect(em("okinawa", "1980")).toBe("Japão");

    expect(vinculoEm("iwo-jima", "1960")).toBe("administracao-estrangeira");
    expect(vinculoEm("iwo-jima", "1970")).toBe("soberania");
  });

  it("registra protetorado onde havia protetorado", () => {
    expect(vinculoEm("guadalcanal", "1900")).toBe("protetorado");
    expect(vinculoEm("kwajalein", "1900")).toBe("protetorado");
    expect(em("kwajalein", "1900")).toBe("Alemanha");
  });

  /*
   * Estado em livre associação é soberano, e classificá-lo de outro modo
   * rebaixaria o que ele é. Marshall, Micronésia e Palau são membros da ONU.
   */
  it("trata livre associação como soberania do próprio país", () => {
    expect(em("kwajalein", "2020")).toBe("Ilhas Marshall");
    expect(vinculoEm("kwajalein", "2020")).toBe("soberania");
    expect(em("chuuk", "2020")).toBe("Micronésia");
    expect(em("peleliu", "2020")).toBe("Palau");
    /* Palau saiu da tutela oito anos depois das outras duas. */
    expect(em("peleliu", "1990")).toBe("Estados Unidos");
    expect(vinculoEm("peleliu", "1990")).toBe("tutela");
  });

  it("Midway nunca mudou de mão — é o contraste do conjunto", () => {
    expect(ilha("midway").soberania).toHaveLength(1);
    for (const ano of ["1900", "1942", "2020"]) {
      expect(em("midway", ano)).toBe("Estados Unidos");
    }
  });

  it("Chuuk foi contornada: mandato japonês até a rendição de 1945", () => {
    /* Hailstone destruiu a frota em fevereiro de 1944 e não tomou a ilha. */
    expect(em("chuuk", "1944-06")).toBe("Japão");
    expect(vinculoEm("chuuk", "1944-06")).toBe("mandato");
    expect(em("chuuk", "1946")).toBe("Estados Unidos");
  });

  it("todo trecho declara vínculo, e o padrão é soberania", () => {
    for (const i of acervo.ilhas) {
      for (const s of i.soberania) {
        expect(s.vinculo, `${i.id} em ${s.desde}`).toBeTruthy();
      }
    }
    /* Os arquivos do Atlântico foram escritos antes do campo existir. */
    expect(soberaniaEm(ilha("madeira"), anoFracionarioDe("1500"))?.vinculo).toBe(
      "soberania"
    );
  });
});
