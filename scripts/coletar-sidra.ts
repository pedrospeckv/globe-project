/**
 * Coleta séries do SIDRA/IBGE e grava os indicadores do acervo.
 *
 * O atlas não digita número à mão. Este script busca na API pública do IBGE,
 * guarda o CSV bruto para conferência e só então monta o JSON — assim a
 * procedência de cada ponto é auditável e a série se atualiza sozinha quando
 * o IBGE divulga.
 *
 *   pnpm tsx scripts/coletar-sidra.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseSerieCsv, type Ponto } from "../lib/conteudo/indicador";

const RAIZ = path.join(process.cwd(), "conteudo", "indicadores");
const BRUTO = path.join(RAIZ, "bruto");

/** Uma linha da resposta do SIDRA no formato `f/n` (nomes por extenso). */
interface LinhaSidra {
  V: string;
  D2N: string;
  D3N: string;
}

async function buscarSidra(caminho: string): Promise<LinhaSidra[]> {
  const url = `https://apisidra.ibge.gov.br/values/${caminho}`;
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`SIDRA respondeu ${resposta.status} para ${url}`);
  }
  const linhas = (await resposta.json()) as LinhaSidra[];
  // A primeira linha é o cabeçalho descritivo, não um dado.
  return linhas.slice(1);
}

/**
 * `V` vem como string e pode ser "..." (sem informação) ou "-" (não aplicável).
 * Descartar é o certo: interpolar inventaria medição que não existiu.
 */
function valorNumerico(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface Coleta {
  id: string;
  nome: string;
  unidade: string;
  fonte: string;
  caminho: string;
  escala: "linear" | "log";
  /** Extrai o ano de um período, ou null para descartar a linha. */
  ano: (periodo: string) => number | null;
}

const COLETAS: Coleta[] = [
  {
    id: "bra-ipca-anual",
    nome: "IPCA — variação acumulada no ano",
    unidade: "% ao ano",
    fonte: "ibge-sidra-1737",
    // Tabela 1737, variável 69: IPCA acumulado no ano, mês a mês desde 1979.
    caminho: "t/1737/n1/all/v/69/p/all/f/n",
    // 2477% em 1993 contra 4,26% em 2025: no linear, tudo depois do Plano
    // Real vira uma reta colada no chão.
    escala: "log",
    // Dezembro fecha o acumulado: é a inflação daquele ano.
    ano: (p) => {
      const m = /^dezembro (\d{4})$/.exec(p);
      return m ? Number(m[1]) : null;
    },
  },
  {
    id: "bra-desocupacao",
    nome: "Taxa de desocupação — trimestre out–dez",
    unidade: "% da força de trabalho",
    fonte: "ibge-sidra-6381",
    // Tabela 6381, variável 4099: PNAD Contínua, trimestres móveis.
    caminho: "t/6381/n1/all/v/4099/p/all/f/n",
    // Vai de 5,1% a 14,2%: uma ordem de grandeza só, linear serve.
    escala: "linear",
    /*
     * Um trimestre fixo por ano, sempre o mesmo. Os trimestres móveis se
     * sobrepõem, então tirar a média dos doze daria um número que o IBGE não
     * publica — e apresentá-lo como dado do IBGE seria falso. O nome do
     * indicador declara qual trimestre é.
     */
    ano: (p) => {
      const m = /^out-nov-dez (\d{4})$/.exec(p);
      return m ? Number(m[1]) : null;
    },
  },
];

async function coletar(c: Coleta) {
  const linhas = await buscarSidra(c.caminho);

  const pontos: string[] = ["ano,valor"];
  for (const linha of linhas) {
    const ano = c.ano(linha.D3N);
    if (ano === null) continue;
    const valor = valorNumerico(linha.V);
    if (valor === null) continue;
    pontos.push(`${ano},${valor}`);
  }

  const csv = `${pontos.join("\n")}\n`;
  await fs.mkdir(BRUTO, { recursive: true });
  await fs.writeFile(path.join(BRUTO, `${c.id}.csv`), csv, "utf8");

  // Passa pelo mesmo parser que o resto do projeto usa e testa.
  const serie: Ponto[] = parseSerieCsv(csv);

  const indicador = {
    id: c.id,
    paisIso: "BRA",
    nome: c.nome,
    unidade: c.unidade,
    fonte: c.fonte,
    escala: c.escala,
    serie,
  };

  await fs.writeFile(
    path.join(RAIZ, `${c.id}.json`),
    `${JSON.stringify(indicador, null, 2)}\n`,
    "utf8"
  );

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  console.log(
    `✓ ${c.id}: ${serie.length} pontos, ${primeiro.ano} (${primeiro.valor}) → ${ultimo.ano} (${ultimo.valor})`
  );
}

async function main() {
  for (const c of COLETAS) await coletar(c);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
