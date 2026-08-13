import { partesDe } from "./primitivos";
import type { Pais, Periodo } from "./pais";
import type { Viagem } from "./viagem";

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Converte ano fracionário em DataHistorica.
 *
 * Aproximação de 365 dias, sem bissexto: isto é um controle de navegação, não
 * um calendário. Precisão de dia não muda nada na leitura da barra.
 */
export function dataDeAnoFracionario(anoFrac: number): string {
  const ano = Math.floor(anoFrac);
  const diaDoAno = Math.min(364, Math.max(0, Math.floor((anoFrac - ano) * 365)));

  let mes = 0;
  let restante = diaDoAno;
  while (mes < 11 && restante >= DIAS_POR_MES[mes]) {
    restante -= DIAS_POR_MES[mes];
    mes++;
  }

  const mm = String(mes + 1).padStart(2, "0");
  const dd = String(restante + 1).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

/** DataHistorica em ano fracionário. Granularidade ausente conta como início. */
export function anoFracionarioDe(data: string): number {
  const [ano, mes, dia] = partesDe(data);
  const diasAntes = DIAS_POR_MES.slice(0, Math.max(0, mes - 1)).reduce(
    (a, b) => a + b,
    0
  );
  const diaDoAno = diasAntes + Math.max(0, dia - 1);
  return ano + diaDoAno / 365;
}

/**
 * Período do país vigente naquele instante, ou null se o país não existia.
 *
 * O null é a parte importante: é o que faz o globo apagar o Brasil em 843, em
 * vez de fingir que ele sempre esteve lá. É a expressão visual da decisão
 * país × período.
 */
export function periodoVigente(pais: Pais, anoFrac: number): Periodo | null {
  let achado: Periodo | null = null;

  for (const p of pais.periodos) {
    const ini = anoFracionarioDe(p.inicio);
    const fim = p.fim === undefined ? Infinity : anoFracionarioDe(p.fim);
    if (anoFrac >= ini && anoFrac <= fim) {
      // Na virada, o período que COMEÇA vence o que termina.
      if (!achado || ini > anoFracionarioDe(achado.inicio)) achado = p;
    }
  }

  return achado;
}

/** Do período mais antigo do acervo até hoje. */
export function intervaloDoAcervo(paises: Pais[]): [number, number] {
  const hoje = new Date().getFullYear() + 1;
  const inicios = paises.flatMap((p) =>
    p.periodos.map((x) => anoFracionarioDe(x.inicio))
  );
  if (inicios.length === 0) return [1900, hoje];
  return [Math.floor(Math.min(...inicios)), hoje];
}

/**
 * Intervalo da viagem, com folga de 20% em cada lado.
 *
 * Existe porque numa barra de 843 até hoje os 46 dias do Cabral ocupam menos
 * de um pixel — a rota se desenhando seria invisível.
 */
export function intervaloDaViagem(viagem: Viagem): [number, number] {
  const datas = viagem.paradas.map((p) => anoFracionarioDe(p.data));
  const ini = Math.min(...datas);
  const fim = Math.max(...datas);
  const folga = Math.max((fim - ini) * 0.2, 0.02);
  return [ini - folga, fim + folga];
}

/** Rótulo adequado à escala: só o ano em escala longa, mês e ano em curta. */
export function rotuloDeAno(anoFrac: number, amplitude: number): string {
  const ano = Math.floor(anoFrac);
  if (amplitude > 5) return String(ano);
  const [, mes] = partesDe(dataDeAnoFracionario(anoFrac));
  return `${MESES[Math.max(0, mes - 1)]} de ${ano}`;
}
