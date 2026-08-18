import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { feature } from "topojson-client";
import { geoArea } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import {
  FatiaLocal,
  Manifesto,
  anoDoNome,
  conferirFatiasLocais,
  hashDoArquivo,
  lerFeicoesLocais,
  lerManifesto,
} from "./fatias-locais";
import { FATIAS, atribuicaoDaFatia, ATRIBUICAO } from "../lib/geo/fatias";

const CONSTRUIDAS = path.join(process.cwd(), "public", "geo", "fatias");

/** Pasta descartável, para poder testar as recusas sem estragar o real. */
const temporarias: string[] = [];
function pastaTemporaria(): string {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), "fatias-"));
  temporarias.push(p);
  return p;
}
afterAll(() => {
  for (const p of temporarias) fs.rmSync(p, { recursive: true, force: true });
});

const ENTRADA_VALIDA = {
  nome: "1650",
  ano: 1650,
  arquivo: "1650.geojson",
  nota: "uma nota longa o bastante para explicar por que esta fatia existe",
  atribuicao: { fonte: "f", autor: "a", licenca: "l" },
};

const poligono = (n: string, p: number, lon: number) => ({
  type: "Feature" as const,
  properties: { n, p },
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [lon, 0],
        [lon + 5, 0],
        [lon + 5, 5],
        [lon, 5],
        [lon, 0],
      ],
    ],
  },
});

describe("anoDoNome", () => {
  it("lê as duas convenções", () => {
    expect(anoDoNome("bc323")).toBe(-323);
    expect(anoDoNome("1492")).toBe(1492);
    expect(anoDoNome("bc123000")).toBe(-123000);
  });

  /* Não existe ano zero no calendário histórico, e o índice não deve tê-lo. */
  it("recusa ano zero e nome ilegível", () => {
    expect(() => anoDoNome("0")).toThrow();
    expect(() => anoDoNome("bc0")).toThrow();
    expect(() => anoDoNome("meio-do-século")).toThrow();
  });
});

describe("schema da fatia local", () => {
  it("aceita uma entrada completa", () => {
    expect(FatiaLocal.parse(ENTRADA_VALIDA).nome).toBe("1650");
  });

  /*
   * Nome e ano são dois campos para o mesmo fato — o nome porque é o arquivo
   * servido, o ano porque é o que ordena o índice. Dois campos para um fato
   * divergem calados, e uma fatia no ano errado desloca o mapa de um intervalo
   * inteiro da linha do tempo sem nada na tela acusar.
   */
  it("recusa ano que não é o do nome", () => {
    expect(() => FatiaLocal.parse({ ...ENTRADA_VALIDA, ano: 1651 })).toThrow();
    expect(() =>
      FatiaLocal.parse({ ...ENTRADA_VALIDA, nome: "bc1650", ano: 1650 })
    ).toThrow();
  });

  it("exige procedência", () => {
    const { atribuicao: _, ...sem } = ENTRADA_VALIDA;
    expect(() => FatiaLocal.parse(sem)).toThrow();
    expect(() =>
      FatiaLocal.parse({
        ...ENTRADA_VALIDA,
        atribuicao: { fonte: "f", autor: "a" },
      })
    ).toThrow();
  });

  it("exige nota que explique a fatia", () => {
    expect(() => FatiaLocal.parse({ ...ENTRADA_VALIDA, nota: "porque sim" })).toThrow();
  });

  it("recusa nome fora da convenção", () => {
    for (const nome of ["bc-310", "310ac", "ad310", "0", ""]) {
      expect(() => FatiaLocal.parse({ ...ENTRADA_VALIDA, nome }), nome).toThrow();
    }
  });

  it("recusa arquivo que não é geojson", () => {
    expect(() =>
      FatiaLocal.parse({ ...ENTRADA_VALIDA, arquivo: "1650.json" })
    ).toThrow();
  });
});

describe("lerManifesto", () => {
  it("sem arquivo, não há fatia local — e isso não é erro", () => {
    expect(lerManifesto(path.join(pastaTemporaria(), "manifesto.json"))).toEqual([]);
  });

  it("recusa duas entradas com o mesmo nome", () => {
    const pasta = pastaTemporaria();
    const caminho = path.join(pasta, "manifesto.json");
    fs.writeFileSync(
      caminho,
      JSON.stringify({ fatias: [ENTRADA_VALIDA, ENTRADA_VALIDA] })
    );
    expect(() => lerManifesto(caminho)).toThrow(/repetida/);
  });

  it("lê o manifesto de verdade", () => {
    const fatias = lerManifesto();
    expect(fatias.length).toBeGreaterThan(0);
    for (const f of fatias) expect(f.ano).toBe(anoDoNome(f.nome));
  });

  /*
   * Nome de fatia local igual ao de uma baixada faria uma sobrescrever a outra
   * em `public/geo/fatias/`, e o índice ficaria apontando para geometria de
   * outra data sem nada acusar.
   */
  it("nenhuma fatia local usa o nome de uma baixada", () => {
    const baixadas = new Set(FATIAS.filter((f) => !f.local).map((f) => f.nome));
    for (const f of lerManifesto()) expect(baixadas.has(f.nome)).toBe(false);
  });

  it("o Manifesto rejeita forma desconhecida", () => {
    expect(() => Manifesto.parse({ fatias: "1650" })).toThrow();
  });
});

describe("lerFeicoesLocais", () => {
  const escrever = (pasta: string, features: unknown[]) => {
    fs.writeFileSync(
      path.join(pasta, ENTRADA_VALIDA.arquivo),
      JSON.stringify({ type: "FeatureCollection", features })
    );
  };

  it("normaliza o vocabulário do upstream", () => {
    const pasta = pastaTemporaria();
    escrever(pasta, [
      {
        type: "Feature",
        properties: { NAME: "Ptolemaic Egypt", SUBJECTO: "Diadochi", BORDERPRECISION: 1 },
        geometry: poligono("x", 1, 0).geometry,
      },
    ]);
    const c = lerFeicoesLocais(ENTRADA_VALIDA, pasta);
    expect(c.features[0].properties).toEqual({
      n: "Ptolemaic Egypt",
      p: 1,
      s: "Diadochi",
    });
  });

  it("não guarda sujeito igual ao nome", () => {
    const pasta = pastaTemporaria();
    escrever(pasta, [
      {
        type: "Feature",
        properties: { n: "Macedon", s: "Macedon", p: 1 },
        geometry: poligono("x", 1, 0).geometry,
      },
    ]);
    expect(lerFeicoesLocais(ENTRADA_VALIDA, pasta).features[0].properties).toEqual({
      n: "Macedon",
      p: 1,
    });
  });

  /*
   * No upstream, feição anônima é informação — território que a fonte não
   * atribui a ninguém. Numa fatia escrita aqui é esquecimento, e a diferença
   * entre as duas leituras é exatamente o que este teste guarda.
   */
  it("recusa feição sem nome", () => {
    const pasta = pastaTemporaria();
    escrever(pasta, [
      { type: "Feature", properties: { p: 1 }, geometry: poligono("x", 1, 0).geometry },
    ]);
    expect(() => lerFeicoesLocais(ENTRADA_VALIDA, pasta)).toThrow(/sem nome/);
  });

  /* Precisão ausente é uma declaração de confiança que ninguém fez. */
  it("recusa precisão ausente ou fora da faixa", () => {
    const pasta = pastaTemporaria();
    for (const p of [undefined, 0, 6, 1.5, "1"]) {
      escrever(pasta, [
        {
          type: "Feature",
          properties: { n: "Macedon", ...(p === undefined ? {} : { p }) },
          geometry: poligono("x", 1, 0).geometry,
        },
      ]);
      expect(() => lerFeicoesLocais(ENTRADA_VALIDA, pasta), String(p)).toThrow(
        /precisão/
      );
    }
  });

  it("recusa feição sem geometria", () => {
    const pasta = pastaTemporaria();
    escrever(pasta, [{ type: "Feature", properties: { n: "Macedon", p: 1 }, geometry: null }]);
    expect(() => lerFeicoesLocais(ENTRADA_VALIDA, pasta)).toThrow(/sem geometria/);
  });

  it("recusa coleção vazia e coleção que não é coleção", () => {
    const pasta = pastaTemporaria();
    escrever(pasta, []);
    expect(() => lerFeicoesLocais(ENTRADA_VALIDA, pasta)).toThrow(/nenhuma feição/);
    fs.writeFileSync(
      path.join(pasta, ENTRADA_VALIDA.arquivo),
      JSON.stringify(poligono("Macedon", 1, 0))
    );
    expect(() => lerFeicoesLocais(ENTRADA_VALIDA, pasta)).toThrow(/FeatureCollection/);
  });
});

describe("hashDoArquivo", () => {
  it("muda quando o byte muda, e não muda quando nada muda", () => {
    const pasta = pastaTemporaria();
    const a = path.join(pasta, "a.geojson");
    fs.writeFileSync(a, "{}");
    const antes = hashDoArquivo(a);
    expect(hashDoArquivo(a)).toBe(antes);
    fs.writeFileSync(a, "{} ");
    expect(hashDoArquivo(a)).not.toBe(antes);
  });
});

describe("conferirFatiasLocais", () => {
  /** Manifesto de mentira, com o arquivo de origem ao lado. */
  const cenario = () => {
    const pasta = pastaTemporaria();
    const destino = pastaTemporaria();
    const manifesto = path.join(pasta, "manifesto.json");
    fs.writeFileSync(manifesto, JSON.stringify({ fatias: [ENTRADA_VALIDA] }));
    const origem = path.join(pasta, ENTRADA_VALIDA.arquivo);
    fs.writeFileSync(origem, JSON.stringify({ type: "FeatureCollection", features: [] }));
    fs.writeFileSync(path.join(destino, "1650.json"), "{}");
    return { manifesto, destino, origem, hash: hashDoArquivo(origem) };
  };

  it("passa quando índice, hash e arquivo construído concordam", () => {
    const c = cenario();
    expect(
      conferirFatiasLocais(
        [{ nome: "1650", ano: 1650, local: true, hash: c.hash }],
        c.destino,
        c.manifesto
      )
    ).toEqual([]);
  });

  /*
   * Esta é a regressão que justifica o subsistema do hash: editar o `.geojson`
   * e não reconstruir publica um mapa que não corresponde ao arquivo versionado
   * ao lado dele — e nada na tela acusaria.
   */
  it("acusa origem editada depois da construção", () => {
    const c = cenario();
    fs.appendFileSync(c.origem, " ");
    const problemas = conferirFatiasLocais(
      [{ nome: "1650", ano: 1650, local: true, hash: c.hash }],
      c.destino,
      c.manifesto
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/mudou desde a construção/);
  });

  it("acusa fatia do manifesto que não entrou no índice", () => {
    const c = cenario();
    expect(conferirFatiasLocais([], c.destino, c.manifesto)[0]).toMatch(
      /não está no índice/
    );
  });

  it("acusa TopoJSON construído que não existe", () => {
    const c = cenario();
    fs.rmSync(path.join(c.destino, "1650.json"));
    expect(
      conferirFatiasLocais(
        [{ nome: "1650", ano: 1650, local: true, hash: c.hash }],
        c.destino,
        c.manifesto
      )[0]
    ).toMatch(/falta o TopoJSON/);
  });

  it("acusa arquivo de origem que não existe", () => {
    const c = cenario();
    fs.rmSync(c.origem);
    expect(
      conferirFatiasLocais(
        [{ nome: "1650", ano: 1650, local: true, hash: c.hash }],
        c.destino,
        c.manifesto
      )[0]
    ).toMatch(/falta 1650\.geojson/);
  });

  /* O contrário também é problema: geometria servida sem procedência. */
  it("acusa fatia local no índice sem manifesto que a explique", () => {
    const c = cenario();
    const problemas = conferirFatiasLocais(
      [
        { nome: "1650", ano: 1650, local: true, hash: c.hash },
        { nome: "1700", ano: 1700, local: true, hash: "x" },
      ],
      c.destino,
      c.manifesto
    );
    expect(problemas.some((p) => /1700, que não está no manifesto/.test(p))).toBe(true);
  });

  it("o estado real do repositório está em ordem", () => {
    expect(conferirFatiasLocais(FATIAS, CONSTRUIDAS)).toEqual([]);
  });
});

describe("as fatias locais construídas", () => {
  const locais = FATIAS.filter((f) => f.local);

  it("existem no índice", () => {
    expect(locais.length).toBeGreaterThan(0);
  });

  it("carregam procedência própria, e não a do upstream", () => {
    for (const f of locais) {
      expect(f.atribuicao).toBeDefined();
      expect(atribuicaoDaFatia(f)).toBe(f.atribuicao);
      expect(atribuicaoDaFatia(f).fonte).not.toBe(ATRIBUICAO.fonte);
    }
  });

  it("as baixadas continuam creditadas ao upstream", () => {
    const baixada = FATIAS.find((f) => !f.local)!;
    expect(atribuicaoDaFatia(baixada)).toBe(ATRIBUICAO);
  });

  /*
   * A promessa da fatia local: sem redução, sem o defeito da redução. As
   * baixadas precisam do filtro de área em tempo de execução porque 38 das 53
   * já vêm com feição cobrindo o planeta; aqui não pode haver nenhuma.
   */
  it("não têm nenhuma feição absurda — é a razão de não passarem por redução", () => {
    for (const f of locais) {
      const topo = JSON.parse(
        fs.readFileSync(path.join(CONSTRUIDAS, `${f.nome}.json`), "utf8")
      ) as Topology;
      const feicoes = feature(topo, topo.objects.mundo as GeometryCollection)
        .features as Feature<Geometry, { n?: string; p?: number }>[];

      expect(feicoes).toHaveLength(f.feicoes);
      const absurdas = feicoes.filter((x) => x.geometry && geoArea(x) > 1);
      expect(absurdas.map((x) => x.properties?.n)).toEqual([]);

      /* E o que o schema exigiu na entrada tem de estar na saída. */
      for (const x of feicoes) {
        expect(x.properties?.n).toBeTruthy();
        expect(x.properties?.p).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
