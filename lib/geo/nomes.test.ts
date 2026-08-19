import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { RENOMEACOES, canonicas, nomeCanonico } from "./nomes";
import { FATIAS, caminhoRelativoDaFatia, type FatiaFeature } from "./fatias";

const PASTA = path.join(process.cwd(), "public", "geo", "fatias");

/*
 * O arquivo de uma fatia é resolvido pelo ÍNDICE, e não montado a partir do nome:
 * uma fatia local que corrige uma baixada tem o mesmo nome dela e mora em
 * `locais/`. Montar à mão — o que este arquivo fazia — lia a baixada NÃO corrigida
 * de 1938 e 1945 enquanto o mapa servia a corrigida.
 */
const arquivoDaFatia = (nome: string) =>
  path.join(
    PASTA,
    caminhoRelativoDaFatia(FATIAS.find((f) => f.nome === nome) ?? { nome })
  );

/** Nomes crus de uma fatia, sem normalização. */
function nomesCrus(nome: string): string[] {
  const topo = JSON.parse(
    fs.readFileSync(arquivoDaFatia(nome), "utf8")
  ) as Topology;
  const feicoes = feature(topo, topo.objects.mundo as GeometryCollection)
    .features as FatiaFeature[];
  return feicoes.map((f) => f.properties?.n).filter((n): n is string => !!n);
}

const canonicosDe = (fatia: { nome: string; ano: number }) =>
  new Set(nomesCrus(fatia.nome).map((n) => nomeCanonico(n, fatia.ano)));

describe("tabela de grafias", () => {
  it("não repete a grafia de origem", () => {
    const de = RENOMEACOES.map((r) => r.de);
    expect(new Set(de).size).toBe(de.length);
  });

  /*
   * Sem cadeia. Se uma canônica fosse origem de outra, o resultado passaria a
   * depender da ordem de aplicação — e `nomeCanonico` aplica uma vez só, então o
   * nome pararia num meio de caminho que não é grafia de ninguém.
   */
  it("nenhuma grafia canônica é origem de outra troca", () => {
    const origens = new Set(RENOMEACOES.map((r) => r.de));
    for (const para of canonicas()) expect(origens.has(para), para).toBe(false);
  });

  it("nenhuma troca é para si mesma", () => {
    for (const r of RENOMEACOES) expect(r.de).not.toBe(r.para);
  });

  it("toda troca declara por que é legítima", () => {
    for (const r of RENOMEACOES) expect(r.razao.length, r.de).toBeGreaterThan(20);
  });

  /*
   * Guarda contra entrada morta e contra erro de digitação. Uma linha cuja
   * origem não existe em nenhuma fatia não normaliza nada, e a única forma de
   * descobrir seria olhar o mapa e não achar o efeito.
   */
  it("toda grafia de origem existe em alguma fatia", () => {
    const vistos = new Set<string>();
    for (const f of FATIAS) for (const n of nomesCrus(f.nome)) vistos.add(n);
    for (const r of RENOMEACOES) expect(vistos.has(r.de), r.de).toBe(true);
  });

  /*
   * A recíproca: a canônica também tem de existir em alguma fatia, ou eu a
   * inventei. As duas exceções são expansões de abreviação do Natural Earth que
   * não têm forma concorrente em nenhuma outra base — e é justamente por isso
   * que a lista de exceções é explícita, e não uma condição solta.
   */
  it("toda grafia canônica existe em alguma fatia, salvo as expansões declaradas", () => {
    const expansoes = new Set([
      "South Sudan",
      "Solomon Islands",
      "Democratic Republic of the Congo",
      "Trinidad and Tobago",
    ]);
    const vistos = new Set<string>();
    for (const f of FATIAS) for (const n of nomesCrus(f.nome)) vistos.add(n);
    for (const r of RENOMEACOES) {
      if (expansoes.has(r.para)) continue;
      expect(vistos.has(r.para), r.para).toBe(true);
    }
  });
});

describe("nomeCanonico", () => {
  it("deixa passar o que não está na tabela", () => {
    expect(nomeCanonico("Roman Empire", -100)).toBe("Roman Empire");
  });

  it("expande abreviação em qualquer data", () => {
    expect(nomeCanonico("Eq. Guinea", 2018)).toBe("Equatorial Guinea");
    expect(nomeCanonico("Eq. Guinea", 1914)).toBe("Equatorial Guinea");
  });

  /*
   * O coração da tabela: a troca datada. Estes três casos são a razão de existir
   * o campo `desde` em vez de um mapa simples de nome para nome.
   */
  it("respeita a data da renomeação", () => {
    expect(nomeCanonico("Burma", 1800)).toBe("Burma");
    expect(nomeCanonico("Burma", 1960)).toBe("Burma");
    expect(nomeCanonico("Burma", 1994)).toBe("Myanmar");

    /* Zaire existiu de 1971 a 1997. */
    expect(nomeCanonico("Zaire", 1994)).toBe("Zaire");
    expect(nomeCanonico("Zaire", 2000)).toBe("Democratic Republic of the Congo");

    /* Antes da independência de 1962, o upstream nomeia a ilha. */
    expect(nomeCanonico("Trinidad", 1715)).toBe("Trinidad");
    expect(nomeCanonico("Trinidad", 1994)).toBe("Trinidad and Tobago");
  });

  /* Os três casos deixados de fora de propósito. Ver o cabeçalho de `nomes.ts`. */
  it("não unifica grafias que estão certas cada uma na sua data", () => {
    expect(nomeCanonico("Swaziland", 2010)).toBe("Swaziland");
    expect(nomeCanonico("eSwatini", 2018)).toBe("eSwatini");
    expect(nomeCanonico("Czech Republic", 2010)).toBe("Czech Republic");
    expect(nomeCanonico("Czechia", 2018)).toBe("Czechia");
  });

  it("não escolhe lado em soberania contestada", () => {
    expect(nomeCanonico("N. Cyprus", 2018)).toBe("N. Cyprus");
    expect(nomeCanonico("Turkish Cypriot-administered area", 2010)).toBe(
      "Turkish Cypriot-administered area"
    );
    expect(nomeCanonico("Falkland Is.", 2018)).toBe("Falkland Is.");
  });

  it("é idempotente — aplicar duas vezes não muda mais nada", () => {
    for (const r of RENOMEACOES) {
      const ano = r.desde ?? 2018;
      const uma = nomeCanonico(r.de, ano);
      expect(nomeCanonico(uma, ano)).toBe(uma);
    }
  });
});

describe("o efeito medido nas fatias", () => {
  const de2010 = FATIAS.find((f) => f.nome === "2010")!;
  const de2018 = FATIAS.find((f) => f.nome === "2018")!;

  /*
   * A medida que justifica a tabela. Sem normalizar, 2010 e 2018 concordam em
   * 148 dos 176 nomes do Natural Earth, e cada divergência é um país que troca
   * de cor ao cruzar de uma fatia para a outra sem que nada tenha acontecido.
   */
  it("aumenta a concordância entre 2010 e 2018", () => {
    const cru2010 = new Set(nomesCrus("2010"));
    const cru2018 = new Set(nomesCrus("2018"));
    const antes = [...cru2018].filter((n) => cru2010.has(n)).length;

    const can2010 = canonicosDe(de2010);
    const can2018 = canonicosDe(de2018);
    const depois = [...can2018].filter((n) => can2010.has(n)).length;

    expect(antes).toBe(148);
    expect(depois).toBeGreaterThan(antes + 12);
  });

  /*
   * A inconsistência interna do upstream, que existia antes de haver fatia local
   * nenhuma: os Estados Unidos alternavam entre duas grafias ao longo da linha do
   * tempo, e cada alternância era uma troca de cor.
   */
  it("unifica a grafia dos Estados Unidos ao longo do tempo", () => {
    const formas = new Set<string>();
    for (const f of FATIAS) {
      for (const n of nomesCrus(f.nome)) {
        if (/^United States( of America)?$/.test(n)) {
          formas.add(nomeCanonico(n, f.ano));
        }
      }
    }
    expect([...formas]).toEqual(["United States"]);
  });

  /* Nenhuma normalização pode fundir duas entidades numa. */
  it("não faz duas entidades distintas virarem a mesma", () => {
    for (const f of FATIAS) {
      const crus = nomesCrus(f.nome);
      const distintosCrus = new Set(crus).size;
      const distintosCanonicos = new Set(
        crus.map((n) => nomeCanonico(n, f.ano))
      ).size;
      expect(distintosCanonicos, `${f.nome} fundiu entidades`).toBe(distintosCrus);
    }
  });

  /*
   * "Congo" é entidade distinta da República Democrática do Congo e aparece de
   * 1492 a 2018 — expandir a abreviação do Natural Earth em vez de a encurtar é o
   * que mantém as duas separadas na tela.
   */
  it("mantém Congo e República Democrática do Congo separados", () => {
    const em2018 = canonicosDe(de2018);
    expect(em2018.has("Congo")).toBe(true);
    expect(em2018.has("Democratic Republic of the Congo")).toBe(true);
  });
});
