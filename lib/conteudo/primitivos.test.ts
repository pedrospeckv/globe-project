import { describe, it, expect } from "vitest";
import { DataHistorica, anoDe, Id } from "./primitivos";

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

  it("extrai o ano de qualquer granularidade", () => {
    expect(anoDe("1500-04-22")).toBe(1500);
    expect(anoDe("1500-04")).toBe(1500);
    expect(anoDe("843")).toBe(843);
  });

  it("lança em data inválida em vez de devolver NaN", () => {
    expect(() => anoDe("abc")).toThrow(/inválida/);
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
