import { partesDe, DataHistorica } from "./primitivos";
import type { Pais, Periodo } from "./pais";
import type { Viagem } from "./viagem";

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * O ano escrito vira posição numa linha numérica contínua, e vice-versa.
 *
 * Não existe ano zero: 1 a.C. é seguido diretamente por 1 d.C. Para que a
 * aritmética funcione sem caso especial, 1 a.C. ocupa o intervalo [0,1), 2
 * a.C. ocupa [-1,0), e assim por diante. Logo o ano N a.C. começa em 1-N.
 *
 *   221 a.C. → escrito "-221" → posição -220
 *     1 a.C. → escrito  "-1"  → posição    0
 *     1 d.C. → escrito   "1"  → posição    1
 */
function anoEscritoParaLinha(ano: number): number {
  return ano < 0 ? ano + 1 : ano;
}

function linhaParaAnoEscrito(anoLinha: number): number {
  return anoLinha <= 0 ? anoLinha - 1 : anoLinha;
}

/**
 * Converte ano fracionário em DataHistorica.
 *
 * Aproximação de 365 dias, sem bissexto: isto é um controle de navegação, não
 * um calendário. Precisão de dia não muda nada na leitura da barra.
 */
export function dataDeAnoFracionario(anoFrac: number): string {
  const anoLinha = Math.floor(anoFrac);
  const diaDoAno = Math.min(364, Math.max(0, Math.floor((anoFrac - anoLinha) * 365)));

  let mes = 0;
  let restante = diaDoAno;
  while (mes < 11 && restante >= DIAS_POR_MES[mes]) {
    restante -= DIAS_POR_MES[mes];
    mes++;
  }

  const mm = String(mes + 1).padStart(2, "0");
  const dd = String(restante + 1).padStart(2, "0");
  return `${linhaParaAnoEscrito(anoLinha)}-${mm}-${dd}`;
}

/** DataHistorica em ano fracionário. Granularidade ausente conta como início. */
export function anoFracionarioDe(data: string): number {
  const [ano, mes, dia] = partesDe(data);
  const diasAntes = DIAS_POR_MES.slice(0, Math.max(0, mes - 1)).reduce(
    (a, b) => a + b,
    0
  );
  const diaDoAno = diasAntes + Math.max(0, dia - 1);
  return anoEscritoParaLinha(ano) + diaDoAno / 365;
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

/**
 * Formata uma DataHistorica para exibição.
 *
 * Existe porque o sinal negativo NUNCA deve chegar à tela: "-300" é 300 a.C.,
 * não menos trezentos. Todo lugar que renderiza data crua passa por aqui.
 *
 * Datas d.C. saem inalteradas, para não mexer no que já estava certo.
 */
/**
 * Lê uma data escrita à mão e devolve a forma do acervo, ou null.
 *
 * Aceita o que uma pessoa realmente digita: `2014`, `1500-04-22`,
 * `221 a.C.`, `221 aC`, `-221`, `44 d.C.`. É a volta do `rotuloDeData` — o
 * que a tela mostra tem que poder ser digitado de novo.
 */
export function interpretarData(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;

  const antes = /^(\d{1,4})\s*a\.?\s*c\.?$/i.exec(t);
  if (antes) {
    const ano = Number(antes[1]);
    return ano === 0 ? null : `-${ano}`;
  }

  const depois = /^(\d{1,4})\s*d\.?\s*c\.?$/i.exec(t);
  if (depois) {
    const ano = Number(depois[1]);
    return ano === 0 ? null : String(ano);
  }

  const r = DataHistorica.safeParse(t);
  return r.success ? r.data : null;
}

export function rotuloDeData(data: string): string {
  const [ano] = partesDe(data);
  if (ano >= 0) return data;

  const resto = data.replace(/^-\d{1,4}/, "");
  return `${Math.abs(ano)} a.C.${resto ? ` (${resto.slice(1)})` : ""}`;
}

/**
 * Rótulo adequado à escala: só o ano em escala longa, mês e ano em curta.
 * O sinal negativo nunca aparece na tela — vira o sufixo "a.C.".
 */
export function rotuloDeAno(anoFrac: number, amplitude: number): string {
  const anoEscrito = linhaParaAnoEscrito(Math.floor(anoFrac));
  const rotuloAno =
    anoEscrito < 0 ? `${Math.abs(anoEscrito)} a.C.` : String(anoEscrito);

  if (amplitude > 5) return rotuloAno;

  const [, mes] = partesDe(dataDeAnoFracionario(anoFrac));
  return `${MESES[Math.max(0, mes - 1)]} de ${rotuloAno}`;
}
