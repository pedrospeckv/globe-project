import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import type { FeatureCollection } from "geojson";

/**
 * Fatias de geometria PRÓPRIA, para datas que o upstream não cobre.
 *
 * ## Por que existem
 *
 * As 53 fatias baixadas de `historical-basemaps` são a espinha do mapa, mas o
 * vão entre elas é grande: 70 anos de mediana depois de 500 a.C., e nada entre
 * 2010 e hoje. Quando uma data importa e a base não a tem, a saída não pode ser
 * esperar que o upstream mude — tem de ser possível dar geometria a ela aqui.
 *
 * ## O que uma fatia local é, e o que não é
 *
 * É um `FeatureCollection` versionado em `conteudo/fatias/`, com procedência
 * declarada no manifesto. NÃO é lugar para desenhar fronteira a olho: a regra
 * do atlas é que geometria tenha origem, e um polígono inventado à mão sem
 * fonte é exatamente a afirmação sem procedência que o projeto recusa em prosa.
 * O caminho legítimo é geometria de uma base real — e o manifesto obriga a
 * dizer qual.
 *
 * ## Diferenças de tratamento em relação às fatias baixadas
 *
 * 1. **Não passam por simplificação nem quantização.** São arquivos pequenos,
 *    não precisam, e é precisamente a redução que degenera anéis e produz as
 *    feições que o `d3-geo` lê como o planeta inteiro (ver `lib/geo/fatias.ts`).
 *    Geometria autoral não deve ser exposta ao defeito conhecido do pipeline.
 * 2. **Exigem nome e precisão em toda feição.** No upstream, feição anônima é
 *    informação — território que a fonte não atribui a ninguém. Numa fatia
 *    escrita aqui, anônimo é esquecimento, e precisão ausente é uma declaração
 *    de confiança que ninguém fez.
 * 3. **Não podem produzir feição absurda.** Para o upstream isso é medido e
 *    filtrado em tempo de execução, porque 38 das 53 fatias já vêm estragadas.
 *    Aqui o build falha: não há motivo para aceitar de fábrica um defeito que
 *    a própria ausência de redução deveria evitar.
 */

/** Onde as fatias locais moram, junto do resto do conteúdo autoral. */
export const PASTA_LOCAIS = path.join(process.cwd(), "conteudo", "fatias");
export const MANIFESTO = path.join(PASTA_LOCAIS, "manifesto.json");

/**
 * `bc323` vira -323; `1492` vira 1492. Não existe ano zero.
 *
 * Serve às duas origens: o nome de arquivo do upstream e o de uma fatia local
 * seguem a mesma convenção, e é isso que permite as duas conviverem num índice
 * só, ordenadas por ano, sem o runtime saber de onde cada uma veio.
 */
export function anoDoNome(nome: string): number {
  const bc = nome.startsWith("bc");
  const n = Number.parseInt(bc ? nome.slice(2) : nome, 10);
  if (!Number.isFinite(n) || n === 0) {
    throw new Error(`nome de fatia não reconhecido: ${nome}`);
  }
  return bc ? -n : n;
}

/**
 * Procedência da geometria, obrigatória.
 *
 * É o mesmo princípio do schema `Imagem`, onde `credito` e `licenca` não são
 * opcionais: o custo de uma atribuição faltando não é estético, é jurídico —
 * e no caso de uma base share-alike, é violação.
 */
export const Atribuicao = z.object({
  fonte: z.string().min(1),
  autor: z.string().min(1),
  url: z.string().url().optional(),
  licenca: z.string().min(1),
});

export type Atribuicao = z.infer<typeof Atribuicao>;

export const FatiaLocal = z
  .object({
    /** Mesma convenção do upstream: `bc310`, `2011`. */
    nome: z.string().regex(/^(bc)?[1-9]\d*$/, "use `bc310` ou `2011`"),
    ano: z.number().int(),
    arquivo: z.string().endsWith(".geojson"),
    /**
     * Por que esta fatia existe. Não é ornamento: uma fatia local desloca o
     * mapa de todo um intervalo da linha do tempo, e quem mexer nela depois
     * precisa saber o que ela estava consertando.
     */
    nota: z.string().min(40),
    atribuicao: Atribuicao,
  })
  /*
   * O ano tem de ser o que o nome diz. São dois campos para o mesmo fato — o
   * nome porque é o arquivo servido, o ano porque é o que ordena o índice — e
   * dois campos para um fato divergem calados. Aqui não: o build para.
   */
  .refine((f) => f.ano === anoDoNome(f.nome), {
    message: "o ano tem de ser o que o nome da fatia diz",
  });

export type FatiaLocal = z.infer<typeof FatiaLocal>;

export const Manifesto = z.object({ fatias: z.array(FatiaLocal) });

/**
 * Lê e valida o manifesto. Sem arquivo, não há fatia local — não é erro.
 *
 * O caminho é parâmetro para que o teste possa montar um manifesto de mentira
 * numa pasta temporária. Sem isso, a única forma de testar as recusas seria
 * estragar o manifesto de verdade.
 */
export function lerManifesto(caminho: string = MANIFESTO): FatiaLocal[] {
  if (!fs.existsSync(caminho)) return [];
  const bruto = JSON.parse(fs.readFileSync(caminho, "utf8"));
  const m = Manifesto.parse(bruto);

  const nomes = new Set<string>();
  for (const f of m.fatias) {
    if (nomes.has(f.nome)) {
      throw new Error(`fatia local repetida no manifesto: ${f.nome}`);
    }
    nomes.add(f.nome);
  }
  return m.fatias;
}

/**
 * Impressão digital do arquivo de origem.
 *
 * Doze hexadecimais do sha256 dos bytes crus. É o que fecha o buraco mais
 * provável deste subsistema: editar o `.geojson`, esquecer de rodar o script, e
 * publicar um mapa que não corresponde ao arquivo versionado ao lado dele. Com
 * o hash no índice, a validação do build acusa.
 */
export function hashDoArquivo(caminho: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(caminho))
    .digest("hex")
    .slice(0, 12);
}

/**
 * Lê a coleção de uma fatia local, exigindo o que o upstream pode não ter.
 *
 * Aceita o vocabulário dos dois lados: `NAME`/`SUBJECTO`/`BORDERPRECISION`, que
 * é o do `historical-basemaps` e sobrevive quando a fatia nasce de uma cópia
 * editada de lá, e `n`/`s`/`p`, que é o do atlas depois da poda. A forma podada
 * ganha quando as duas estão presentes.
 */
export function lerFeicoesLocais(
  entrada: FatiaLocal,
  pasta: string = PASTA_LOCAIS
): FeatureCollection {
  const caminho = path.join(pasta, entrada.arquivo);
  const colecao = JSON.parse(fs.readFileSync(caminho, "utf8")) as FeatureCollection;

  if (colecao.type !== "FeatureCollection" || !Array.isArray(colecao.features)) {
    throw new Error(`${entrada.arquivo}: não é um FeatureCollection`);
  }
  if (colecao.features.length === 0) {
    throw new Error(`${entrada.arquivo}: nenhuma feição`);
  }

  colecao.features.forEach((f, i) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const nome = (p.n ?? p.NAME) as unknown;
    const precisao = (p.p ?? p.BORDERPRECISION) as unknown;
    const sujeito = (p.s ?? p.SUBJECTO) as unknown;
    const onde = `${entrada.arquivo} feição ${i}`;

    if (!f.geometry) throw new Error(`${onde}: sem geometria`);
    if (typeof nome !== "string" || nome.trim() === "") {
      throw new Error(`${onde}: sem nome — numa fatia local, anônimo é esquecimento`);
    }
    if (
      typeof precisao !== "number" ||
      !Number.isInteger(precisao) ||
      precisao < 1 ||
      precisao > 5
    ) {
      throw new Error(
        `${onde} (${nome}): precisão de fronteira ausente ou fora de 1–5 — ` +
          `declare se a linha é registro ou conjectura`
      );
    }

    const podado: Record<string, unknown> = { n: nome, p: precisao };
    if (typeof sujeito === "string" && sujeito && sujeito !== nome) {
      podado.s = sujeito;
    }
    f.properties = podado;
  });

  return colecao;
}

export interface EntradaDeIndice {
  nome: string;
  ano: number;
  local?: boolean;
  hash?: string;
}

/**
 * Confere se o construído corresponde ao manifesto. Roda no build.
 *
 * Devolve a lista de problemas em vez de estourar no primeiro, porque quem
 * roda o build quer saber tudo o que precisa reconstruir, não só o primeiro
 * arquivo fora de sincronia.
 */
export function conferirFatiasLocais(
  indice: readonly EntradaDeIndice[],
  destino: string,
  manifesto: string = MANIFESTO
): string[] {
  const problemas: string[] = [];
  const declaradas = lerManifesto(manifesto);
  const pasta = path.dirname(manifesto);

  for (const entrada of declaradas) {
    const origem = path.join(pasta, entrada.arquivo);
    if (!fs.existsSync(origem)) {
      problemas.push(`fatia local ${entrada.nome}: falta ${entrada.arquivo}`);
      continue;
    }

    const noIndice = indice.find((f) => f.nome === entrada.nome);
    if (!noIndice) {
      problemas.push(
        `fatia local ${entrada.nome} não está no índice — rode ` +
          `\`tsx scripts/construir-fatias-historicas.ts --locais\``
      );
      continue;
    }
    if (!fs.existsSync(path.join(destino, `${entrada.nome}.json`))) {
      problemas.push(`fatia local ${entrada.nome}: falta o TopoJSON construído`);
      continue;
    }
    const atual = hashDoArquivo(origem);
    if (noIndice.hash !== atual) {
      problemas.push(
        `fatia local ${entrada.nome}: ${entrada.arquivo} mudou desde a ` +
          `construção (${noIndice.hash ?? "sem hash"} → ${atual}) — ` +
          `reconstrua com \`--locais\``
      );
    }
  }

  /* O contrário também é problema: entrada local no índice sem manifesto que a
     explique é geometria sem procedência servida ao público. */
  const doManifesto = new Set(declaradas.map((f) => f.nome));
  for (const f of indice) {
    if (f.local && !doManifesto.has(f.nome)) {
      problemas.push(
        `índice traz a fatia local ${f.nome}, que não está no manifesto`
      );
    }
  }

  return problemas;
}
