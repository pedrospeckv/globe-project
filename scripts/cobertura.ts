#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { Pais } from "../lib/conteudo/pais";
import { alpha3De } from "../lib/geo/iso";

/**
 * Gera `docs/cobertura.md` — quais países têm dossiê e quais não.
 *
 * ## Por que isto existe
 *
 * A meta do atlas é conhecimento geral, o que significa cobrir o mundo. Hoje são
 * nove de 174. A lista dos 165 que faltam não é motivo de vergonha: é a única
 * coisa que permite alguém de fora escolher um e começar, sem ler o repositório
 * inteiro para descobrir o que falta.
 *
 * ## De onde sai a lista do mundo
 *
 * Do `world-atlas` que o projeto já empacota — as mesmas feições que o mapa
 * desenha, com `id` numérico ISO 3166-1 e `properties.name`. São 177 feições, das
 * quais 174 têm código e nome. Não é uma lista de
 * países inventada aqui, e é deliberado: se o mapa não desenha, não há onde o
 * dossiê acender, então a lista de candidatos é exatamente a do mapa.
 *
 * O que ela NÃO é: uma opinião sobre quem é país. O Natural Earth resolve casos
 * disputados de um jeito que não é o único possível, e o atlas herda essas
 * escolhas em vez de refazê-las. Kosovo, Somalilândia e Saara Ocidental são os
 * exemplos de sempre.
 */

const MUNDO = path.join(
  process.cwd(),
  "node_modules",
  "world-atlas",
  "countries-110m.json"
);
const PAISES = path.join(process.cwd(), "conteudo", "paises");
const SAIDA = path.join(process.cwd(), "docs", "cobertura.md");

interface NoMapa {
  numerico: string;
  nome: string;
}

function doMapa(): NoMapa[] {
  const topo = JSON.parse(fs.readFileSync(MUNDO, "utf8")) as Topology;
  const colecao = topo.objects.countries as GeometryCollection;
  const feicoes = feature(topo, colecao).features;
  return feicoes
    .map((f) => ({
      numerico: String(f.id ?? ""),
      nome: String((f.properties as { name?: string } | null)?.name ?? ""),
    }))
    .filter((x) => x.numerico && x.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

interface ComDossie {
  iso: string;
  nome: string;
  periodos: number;
  comTexto: number;
  arquivo: string;
}

function comDossie(): ComDossie[] {
  if (!fs.existsSync(PAISES)) return [];
  return fs
    .readdirSync(PAISES)
    .filter((a) => a.endsWith(".json"))
    .map((arquivo) => {
      const bruto = JSON.parse(fs.readFileSync(path.join(PAISES, arquivo), "utf8"));
      const p = Pais.parse(bruto);
      return {
        iso: p.iso,
        nome: p.nome,
        periodos: p.periodos.length,
        comTexto: p.periodos.filter((x) => x.textoMdx).length,
        arquivo,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

const mapa = doMapa();
const dossies = comDossie();
const isosComDossie = new Set(dossies.map((d) => d.iso));

/*
 * O casamento é por CÓDIGO ISO, e a primeira versão disto errou: casava por nome,
 * e falhou em 8 dos 9 países porque o conteúdo está em português ("Alemanha") e o
 * `world-atlas` em inglês ("Germany"). Só a China casou, por coincidência de
 * grafia.
 *
 * A tradução numérico → alpha-3 vem de `lib/geo/iso.ts`, e é aqui que a limitação
 * dele fica visível: aquela tabela é escrita à mão e tem só os nove países do
 * atlas, então um país novo é invisível para esta conta até alguém acrescentá-lo
 * lá. É o que a seção de gargalo do CONTRIBUTING descreve.
 */
const naoCasaram = dossies.filter(
  (d) => !mapa.some((m) => alpha3De(m.numerico) === d.iso)
);

const faltando = mapa.filter((m) => {
  const a3 = alpha3De(m.numerico);
  return !a3 || !isosComDossie.has(a3);
});
const pct = ((dossies.length / mapa.length) * 100).toFixed(1);
const periodos = dossies.reduce((s, d) => s + d.periodos, 0);

const linhas: string[] = [
  "<!-- GERADO por scripts/cobertura.ts — não editar à mão. -->",
  "",
  "# Cobertura do atlas",
  "",
  `**${dossies.length} de ${mapa.length} países** desenhados no mapa têm dossiê ` +
    `(${pct}%), somando **${periodos} períodos**.`,
  "",
  "A lista do mundo vem do `world-atlas` que o projeto empacota — as mesmas",
  "feições que o mapa desenha. Reproduzir: `pnpm tsx scripts/cobertura.ts`.",
  "",
  "## Com dossiê",
  "",
  "| país | iso | períodos | com texto |",
  "|---|---|---|---|",
  ...dossies.map(
    (d) => `| ${d.nome} | \`${d.iso}\` | ${d.periodos} | ${d.comTexto} |`
  ),
  "",
  "## Sem dossiê",
  "",
  "Escolher um daqui é a forma mais direta de contribuir. Ver",
  "[CONTRIBUTING.md](../CONTRIBUTING.md) e",
  "[docs/adicionar-um-pais.md](adicionar-um-pais.md).",
  "",
];

/* Em colunas, porque 168 linhas de tabela empurram o resto da página para fora. */
const COLUNAS = 4;
const porLinha: string[][] = [];
for (let i = 0; i < faltando.length; i += COLUNAS) {
  porLinha.push(faltando.slice(i, i + COLUNAS).map((m) => m.nome));
}
linhas.push(
  `| | | | |`,
  `|---|---|---|---|`,
  ...porLinha.map((l) => `| ${[...l, "", "", ""].slice(0, COLUNAS).join(" | ")} |`),
  ""
);

if (naoCasaram.length > 0) {
  linhas.push(
    "## Atenção: dossiê que não casou com o mapa",
    "",
    "Estes têm dossiê mas o nome não corresponde a nenhuma feição do mapa, então",
    "aparecem como faltando na lista acima. É descasamento de grafia a resolver,",
    "não país inexistente.",
    "",
    ...naoCasaram.map((d) => `- ${d.nome} (\`${d.iso}\`, ${d.arquivo})`),
    ""
  );
}

fs.writeFileSync(SAIDA, `${linhas.join("\n")}\n`, "utf8");
console.log(
  `✓ docs/cobertura.md — ${dossies.length}/${mapa.length} países (${pct}%), ` +
    `${periodos} períodos, ${faltando.length} sem dossiê` +
    (naoCasaram.length ? `, ${naoCasaram.length} com nome descasado` : "")
);
