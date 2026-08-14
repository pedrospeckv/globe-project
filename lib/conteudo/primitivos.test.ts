import { describe, it, expect } from "vitest";
import { DataHistorica, anoDe, comparaData, partesDe, Id } from "./primitivos";

describe("DataHistorica", () => {
  it.each(["1500-04-22", "1500-04", "1500", "843", "2026-08-13"])(
    "aceita %s",
    (entrada) => {
      expect(DataHistorica.safeParse(entrada).success).toBe(true);
    }
  );

  it.each(["", "15/04/1500", "1500-4-22", "abc", "1500-13-01", "1500-04-32"])(
    "rejeita %s",
    (entrada) => {
      expect(DataHistorica.safeParse(entrada).success).toBe(false);
    }
  );

  it.each(["-221", "-44-03-15", "-1", "-3200"])("aceita a.C. %s", (entrada) => {
    expect(DataHistorica.safeParse(entrada).success).toBe(true);
  });

  it.each(["0", "-0", "0-01-01", "-0-05"])(
    "REJEITA ano zero %s — ele não existe no calendário histórico",
    (entrada) => {
      expect(DataHistorica.safeParse(entrada).success).toBe(false);
    }
  );
});

describe("datas antes de Cristo", () => {
  it("anoDe devolve o ano como escrito, com sinal", () => {
    expect(anoDe("-221")).toBe(-221);
    expect(anoDe("-44-03-15")).toBe(-44);
  });

  it("partesDe preserva o sinal só no ano", () => {
    expect(partesDe("-44-03-15")).toEqual([-44, 3, 15]);
  });

  it("ordena a.C. corretamente — 221 a.C. vem ANTES de 44 a.C.", () => {
    expect(comparaData("-221", "-44")).toBeLessThan(0);
  });

  it("a.C. vem antes de d.C.", () => {
    expect(comparaData("-44", "14")).toBeLessThan(0);
    expect(comparaData("-1", "1")).toBeLessThan(0);
  });

  it("dentro de um ano a.C., os meses seguem a ordem normal", () => {
    // Março de 44 a.C. vem antes de dezembro de 44 a.C.
    expect(comparaData("-44-03", "-44-12")).toBeLessThan(0);
  });

  it("extrai o ano de qualquer granularidade", () => {
    expect(anoDe("1500-04-22")).toBe(1500);
    expect(anoDe("1500-04")).toBe(1500);
    expect(anoDe("843")).toBe(843);
  });

  it("lança em data inválida em vez de devolver NaN", () => {
    expect(() => anoDe("abc")).toThrow(/inválida/);
  });
});

describe("partesDe", () => {
  it("preenche com 0 as partes ausentes", () => {
    expect(partesDe("1500")).toEqual([1500, 0, 0]);
    expect(partesDe("1500-04")).toEqual([1500, 4, 0]);
    expect(partesDe("1500-04-22")).toEqual([1500, 4, 22]);
  });
});

describe("comparaData", () => {
  it("ordena por ano", () => {
    expect(comparaData("1499", "1500")).toBeLessThan(0);
    expect(comparaData("1500", "1499")).toBeGreaterThan(0);
  });

  it("DESEMPATA por mês dentro do mesmo ano", () => {
    // O caso do Cabral: saiu em março, chegou em abril, mesmo 1500.
    expect(comparaData("1500-03-09", "1500-04-22")).toBeLessThan(0);
    expect(comparaData("1500-04-22", "1500-03-09")).toBeGreaterThan(0);
  });

  it("desempata por dia dentro do mesmo mês", () => {
    expect(comparaData("1500-03-09", "1500-03-22")).toBeLessThan(0);
  });

  it("trata datas iguais como empate", () => {
    expect(comparaData("1500-04-22", "1500-04-22")).toBe(0);
  });

  it("põe o ano isolado antes de qualquer data específica dele", () => {
    expect(comparaData("1500", "1500-01-01")).toBeLessThan(0);
  });
});

describe("Id", () => {
  it.each(["lula", "stf-hc-193726", "br-nova-republica"])(
    "aceita %s",
    (entrada) => {
      expect(Id.safeParse(entrada).success).toBe(true);
    }
  );

  it.each(["", "Lula", "com espaco", "acento_ç", "under_score"])(
    "rejeita %s",
    (entrada) => {
      expect(Id.safeParse(entrada).success).toBe(false);
    }
  );
});
