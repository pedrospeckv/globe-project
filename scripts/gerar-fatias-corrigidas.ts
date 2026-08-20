#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { feature, merge } from "topojson-client";
import { geoArea } from "d3-geo";
import type { Topology, GeometryCollection, GeometryObject } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Position } from "geojson";
import { repararFeicao, type FatiaFeature } from "../lib/geo/fatias";

/**
 * Deriva fatias CORRIGIDAS das fatias baixadas, para consertar anacronismo.
 *
 * ## O que a auditoria achou
 *
 * `docs/auditoria-anacronismos.md`. Nas fatias de 1938 e 1945 o upstream nomeia
 * Estados que não existiam, e num caso desenha o mesmo território duas vezes.
 *
 * ## Por que derivar, e não desenhar
 *
 * A regra da fatia local é que geometria tenha origem. Aqui a origem é a própria
 * fatia baixada: as correções são de NOME e de FUSÃO, e nenhuma coordenada é
 * inventada. Fundir é o que dissolve a fronteira da partição de 1947, que em 1945
 * não existia — e o `merge` do topojson faz isso pelos arcos compartilhados, não
 * por aproximação geométrica.
 *
 * A fatia baixada continua no disco e continua sendo a origem reproduzível. O que
 * ela deixa de ser é a que vai à tela, por causa do `substitui` no manifesto.
 *
 * ## O que NÃO foi consertado, e por quê
 *
 * 1. **A Jordânia de 1938, com 30 km².** Tinha cerca de 90.000. É falha de
 *    geometria, não de nome, e consertá-la exigiria desenhar fronteira — que é
 *    justamente o que a regra proíbe. (O nome também está adiantado: em 1938 era
 *    o Emirado da Transjordânia, e "Jordânia" só a partir de 1946. Renomear seria
 *    barato, mas deixaria uma linha de 30 km² com nome certo, o que não é
 *    consertar nada.)
 * 2. **A Finlândia de 1914**, que a auditoria listou entre os cinco. Ela aparece
 *    com 333.064 km² e SEM sujeito, o que na tela lê como Estado soberano — e em
 *    1914 era o Grão-Ducado da Finlândia, autônomo dentro do Império Russo.
 *    Parecia caso de uma linha: declarar `s`. Mas a fatia de 1914 tem 32 feições
 *    com sujeito declarado e pelo menos uma dúzia de dependências SEM, no mesmo
 *    pé: Netherlands Indies, Kamerun, German South-West Africa, Malaya, Uganda,
 *    Tibet, Xinjiang, e "Denmark" com 2.122.882 km², que é a Dinamarca com a
 *    Groenlândia embutida. Consertar só a Finlândia seria arbitrário, e consertar
 *    as doze é reatribuir soberania fatia inteira, com uma decisão em cada uma
 *    (o Canadá de 1914 era Domínio autônomo — a omissão ali é defensável).
 *    Sobretudo: a Finlândia de 1914 EXISTIA, com aquele nome e aquelas
 *    fronteiras. Está na classe que a nota da legenda já declara — nome moderno
 *    para predecessor, dependência não anotada —, não na classe do Paquistão de
 *    1945, que não existia sob nenhuma descrição.
 * 3. **A Síria de 1945**, o caso que a própria auditoria chamou de limítrofe. A
 *    independência é datada de 17 de abril de 1946, quando saíram as tropas
 *    francesas; mas a Síria assinou a Carta da ONU em 26 de junho de 1945, como
 *    membro fundador. As duas leituras são defensáveis, e trocar uma por outra
 *    não é correção.
 *
 * ## Uma afirmação minha que estava errada
 *
 * A primeira versão desta nota dizia que a Síria de 1938 tem área ZERO e portanto
 * é invisível. Falso, e do jeito de sempre: eu vi a primeira feição que casava com
 * o nome e parei. A fatia traz DUAS chamadas "Syria (France)" — uma degenerada com
 * 0 km² e outra com 314.505 km², que é a que se vê. A Síria de 1938 está no mapa.
 */

const R = 6371;
const km2 = (sr: number) => sr * R * R;
const CASAS = 4;

function arredondar(v: unknown): unknown {
  if (typeof v === "number") return Number(v.toFixed(CASAS));
  if (Array.isArray(v)) return v.map(arredondar);
  return v;
}

/** Renomear: o nome da esquerda vira o da direita, com a razão registrada. */
interface Renome {
  de: string;
  para: string;
  sujeito?: string;
  razao: string;
}

/** Fundir vários nomes num só, dissolvendo as fronteiras entre eles. */
interface Fusao {
  nomes: string[];
  para: string;
  sujeito?: string;
  razao: string;
}

interface Correcao {
  fatia: string;
  remover: { nome: string; razao: string }[];
  renomear: Renome[];
  fundir: Fusao[];
}

const CORRECOES: Correcao[] = [
  {
    fatia: "1938",
    remover: [
      {
        nome: "Israel",
        razao:
          "duplicata: a fatia traz o MESMO território duas vezes, como 'Israel' e " +
          "como 'Mandatory Palestine (GB)', com 31.296 km² e a mesma caixa " +
          "envolvente nas duas. Em 1938 o território era o Mandato Britânico da " +
          "Palestina; Israel foi declarado em 14 de maio de 1948. Fica a feição que " +
          "já está correta, e sai a duplicata",
      },
      {
        nome: "India",
        razao:
          "fragmento mal rotulado: área ZERO, numa linha vertical na longitude " +
          "56,1° — que é Omã, no Golfo Pérsico, a mil quilômetros da Índia. A " +
          "entidade indiana desta fatia é 'British Raj', com 4.810.497 km² e " +
          "s=United Kingdom. O mesmo fragmento aparece em 1900 com 15.586 km² na " +
          "costa do Makran, e é o que faz 'India' constar de 1900 e 1938 no índice " +
          "de nomes sem ser a Índia",
      },
    ],
    renomear: [],
    fundir: [],
  },
  {
    fatia: "1945",
    remover: [],
    renomear: [
      {
        de: "Israel",
        para: "Mandatory Palestine (GB)",
        sujeito: "United Kingdom",
        razao:
          "Israel foi declarado em 14 de maio de 1948. Em 1945 o território era o " +
          "Mandato Britânico da Palestina, e é assim que a própria fatia de 1938 o " +
          "nomeia — a grafia adotada é a dela, para as duas datas concordarem",
      },
      {
        de: "Sri Lanka",
        para: "Ceylon",
        razao:
          "a ilha se chamou Ceilão até 1972, quando a nova constituição adotou Sri " +
          "Lanka. A fatia de 1938 já diz 'Ceylon'; a de 1945 é que está adiantada " +
          "em 27 anos",
      },
    ],
    fundir: [
      {
        nomes: ["India", "Pakistan", "Bangladesh"],
        para: "British Raj",
        sujeito: "United Kingdom",
        razao:
          "o Paquistão foi criado em agosto de 1947 pelo Indian Independence Act, e " +
          "o Bangladesh em 1971. Em 1945 os três territórios eram a Índia " +
          "britânica, sem fronteira entre eles — daí FUNDIR e não apenas renomear: " +
          "renomear deixaria na tela as linhas da partição de 1947 dois anos antes " +
          "de existirem. O nome é 'British Raj' e não 'India' porque é o que o " +
          "próprio upstream usa para a mesma entidade em 1880, 1900, 1914, 1920, " +
          "1930 e 1938 — chamá-la de India aqui daria cor diferente à mesma coisa " +
          "ao cruzar de 1938 para 1945, que é o defeito que a tabela de grafias " +
          "existe para evitar",
      },
    ],
  },
];

const DESTINO = path.join("conteudo", "fatias");

for (const c of CORRECOES) {
  const topo = JSON.parse(
    fs.readFileSync(path.join("public", "geo", "fatias", `${c.fatia}.json`), "utf8")
  ) as Topology;
  const colecao = topo.objects.mundo as GeometryCollection;
  const geometrias = colecao.geometries as GeometryObject[];
  const feicoes = feature(topo, colecao).features as FatiaFeature[];

  console.log(`\n=== ${c.fatia} ===`);
  const saida: Feature<Geometry, Record<string, unknown>>[] = [];
  const fundidos = new Set(c.fundir.flatMap((f) => f.nomes));
  const removidos = new Set(c.remover.map((r) => r.nome));

  /* As fusões primeiro, pelos ARCOS: é o que dissolve a fronteira interna. */
  for (const f of c.fundir) {
    const alvo = geometrias.filter((g, i) => {
      const n = feicoes[i]?.properties?.n;
      return n !== undefined && f.nomes.includes(n);
    });
    if (alvo.length !== f.nomes.length) {
      throw new Error(
        `${c.fatia}: esperava ${f.nomes.length} feições para fundir (${f.nomes.join(", ")}), achei ${alvo.length}`
      );
    }
    /*
     * O tipo de `merge` pede polígonos, e `geometries` é um vetor de geometria
     * qualquer — o filtro acima já garante que são os três países.
     */
    const geometria = merge(
      topo,
      alvo as unknown as Parameters<typeof merge>[1]
    ) as MultiPolygon;
    const antes = alvo
      .map((_, i) => feicoes[geometrias.indexOf(alvo[i])])
      .reduce((s, x) => s + (x?.geometry ? km2(geoArea(x)) : 0), 0);
    const depois = km2(geoArea(geometria));
    console.log(
      `  fundido ${f.nomes.join(" + ")} → ${f.para}: ` +
        `${antes.toFixed(0)} km² em ${alvo.length} partes → ${depois.toFixed(0)} km² em ` +
        `${geometria.coordinates.length} partes`
    );
    /* A fusão não pode criar nem destruir território: só apagar linha interna. */
    if (Math.abs(depois - antes) / antes > 0.01) {
      throw new Error(
        `${c.fatia}: a fusão mudou a área em mais de 1% (${antes.toFixed(0)} → ${depois.toFixed(0)})`
      );
    }
    const precisao = feicoes.find((x) => x.properties?.n === f.nomes[0])?.properties?.p ?? 3;
    const propsFusao: Record<string, unknown> = { n: f.para, p: precisao };
    if (f.sujeito) propsFusao.s = f.sujeito;
    saida.push({
      type: "Feature",
      properties: propsFusao,
      geometry: {
        type: "MultiPolygon",
        coordinates: arredondar(geometria.coordinates) as Position[][][],
      },
    });
  }

  for (const bruta of feicoes) {
    const nome = bruta.properties?.n;
    if (nome && (fundidos.has(nome) || removidos.has(nome))) continue;

    /* Anéis invertidos pela redução: consertados aqui, senão o build local para. */
    const f = repararFeicao(bruta);
    if (!f.geometry || geoArea(f) > 1) {
      console.log(`  descartada por área impossível: ${nome ?? "(anônima)"}`);
      continue;
    }

    const renome = c.renomear.find((r) => r.de === nome);
    const props: Record<string, unknown> = {
      n: renome ? renome.para : nome,
      p: bruta.properties?.p ?? 1,
    };
    if (renome?.sujeito) props.s = renome.sujeito;
    else if (bruta.properties?.s) props.s = bruta.properties.s;

    /*
     * A fatia local exige NOME em toda feição, e o upstream deixa ~17% anônimas.
     * Anônimo aqui não é esquecimento — é o dado de origem —, então recebe a
     * marca de terra sem soberano, que é o que a tela já sabe desenhar em cinza.
     */
    if (!props.n) {
      props.n = "sem atribuição no upstream";
      props.ss = true;
    }

    saida.push({
      type: "Feature",
      properties: props,
      geometry: {
        ...f.geometry,
        coordinates: arredondar(
          (f.geometry as { coordinates: unknown }).coordinates
        ),
      } as Geometry,
    });
  }

  for (const r of c.remover) console.log(`  removida: ${r.nome}`);
  for (const r of c.renomear) console.log(`  renomeada: ${r.de} → ${r.para}`);

  const colecaoSaida: FeatureCollection = {
    type: "FeatureCollection",
    features: saida.sort((a, b) =>
      String(a.properties?.n).localeCompare(String(b.properties?.n))
    ) as Feature[],
  };
  const arquivo = path.join(DESTINO, `${c.fatia}.geojson`);
  fs.writeFileSync(arquivo, `${JSON.stringify(colecaoSaida)}\n`, "utf8");
  console.log(
    `  → ${saida.length} feições, ${(fs.statSync(arquivo).size / 1024).toFixed(0)} kB`
  );
}
