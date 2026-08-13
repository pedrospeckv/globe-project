# Globo e Mapa — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um globo interativo que desenrola em mapa-múndi, com os países do atlas clicáveis e a rota do Cabral desenhada sobre ele.

**Architecture:** Duas camadas com a mesma projeção D3 — canvas para o mundo de fundo, SVG por cima para os países curados e as rotas. Um único `alpha` interpola a projeção de ortográfica (globo) para equiretangular (mapa plano), animado por GSAP. Toda a lógica geométrica é função pura, testável sem navegador; só a pintura fica em componente.

**Tech Stack:** d3-geo 3.1 · topojson-client 3.1 · world-atlas 2 · GSAP 3.15 · React 19 / Next.js 16

**Spec:** `docs/superpowers/specs/2026-08-13-atlas-design.md` — ler §4 (canvas + SVG) antes de começar.
**Plano anterior:** `docs/superpowers/plans/2026-08-13-fundacao-conteudo.md` — este plano consome o `Acervo` produzido lá.

---

## Contexto que o executor precisa

O plano 1 entregou a camada de conteúdo: `carregarAcervo()` devolve `{ fontes, paises, figuras, viagens }` tipado, lido de `conteudo/`. Este plano desenha isso.

### A decisão central, e por que ela é assim

O globo são **duas camadas alimentadas pela mesma projeção**:

- **Canvas** desenha os ~168 países que o atlas não cobre. Decorativo, redesenhado a cada frame, barato.
- **SVG** desenha os países curados, os marcadores e as rotas. Poucas dezenas de elementos.

Isso não é preciosismo. Resolve três coisas de uma vez: clique e hover em país saem de graça via evento de DOM (sem hit-testing manual em canvas), o DrawSVG do GSAP funciona nas rotas porque elas são elementos reais, e a divisão técnica coincide com a curadoria — o que é interativo é exatamente o que está aceso.

**Regra dura:** existe UM objeto de projeção, criado em um lugar só. As duas camadas leem dele. Se você se pegar criando uma segunda projeção, parou de seguir o plano.

### Descobertas da pesquisa que viram código

**O topojson identifica país por ISO numérico.** `world-atlas` traz Brasil como `"076"`, não `"BRA"`. Nosso `Pais.iso` é alpha-3. Precisa de mapeamento explícito — Task 2.

**Datasets Natural Earth antigos tinham França com código `-99`.** O `world-atlas@2` corrigiu, mas é falha silenciosa clássica: o país simplesmente não aparece. A Task 2 tem um teste que afirma que **todos** os países do atlas são encontrados no topojson. Se algum sumir, o teste grita.

**Next.js 16:** `params` de rota é `Promise` e precisa de `await`. Não afeta este plano (não temos rota dinâmica ainda), mas afeta o plano 4. Componentes com estado, `useEffect` ou canvas precisam de `"use client"`.

### Decisões já tomadas — não revisitar

- D3, não react-globe.gl nem MapLibre. A transição controlada globo↔mapa é a razão.
- Canvas de fundo + SVG na frente. Não unificar em uma camada só.
- GSAP anima o `alpha`; não escrever `requestAnimationFrame` à mão.

Use @superpowers:test-driven-development nas tarefas 2 a 4, que são lógica pura. As tarefas 5 a 9 são renderização — a verificação lá é visual e está descrita em cada uma.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/geo/iso.ts` | mapa alpha-3 ↔ ISO numérico dos países do atlas |
| `lib/geo/mundo.ts` | carrega o topojson e separa curados de fundo |
| `lib/geo/projecao.ts` | projeção interpolada; a matemática do `alpha` |
| `lib/geo/rota.ts` | converte `Viagem` em GeoJSON LineString, com corte por data |
| `components/atlas/GlobeCanvas.tsx` | pinta o mundo de fundo no canvas |
| `components/atlas/GeoOverlay.tsx` | SVG: países curados, rotas, marcadores |
| `components/atlas/Atlas.tsx` | dono do estado; orquestra as camadas |
| `components/atlas/ControlesModo.tsx` | botão globo ↔ mapa |
| `app/page.tsx` | carrega o acervo no servidor e monta o Atlas |

Lógica pura em `lib/geo/`, pintura em `components/atlas/`. Essa fronteira é o que torna o plano testável.

---

## Chunk 1: Geometria (lógica pura)

### Task 1: Dependências

**Files:** Modify: `package.json`

- [ ] **Step 1: Instalar**

```bash
pnpm add d3-geo topojson-client gsap world-atlas
pnpm add -D @types/d3-geo @types/topojson-client @types/geojson
```

- [ ] **Step 2: Conferir que o topojson veio junto**

```bash
ls node_modules/world-atlas/
```

Esperado: inclui `countries-110m.json`. É o arquivo que vamos usar — ~110 KB, resolução suficiente para globo.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: d3-geo, topojson, gsap e world-atlas"
```

---

### Task 2: Mapa ISO e carregamento do mundo

**Files:**
- Create: `lib/geo/iso.ts`, `lib/geo/mundo.ts`
- Test: `lib/geo/iso.test.ts`, `lib/geo/mundo.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

`lib/geo/iso.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ISO_NUMERICO, alpha3De, PAISES_DO_ATLAS } from "./iso";

describe("ISO_NUMERICO", () => {
  it("cobre os 9 países do atlas", () => {
    expect(PAISES_DO_ATLAS).toHaveLength(9);
    for (const alpha3 of PAISES_DO_ATLAS) {
      expect(ISO_NUMERICO[alpha3]).toMatch(/^\d{3}$/);
    }
  });

  it("faz o caminho de volta", () => {
    expect(alpha3De("076")).toBe("BRA");
    expect(alpha3De("250")).toBe("FRA");
  });

  it("devolve undefined para código fora do atlas", () => {
    expect(alpha3De("032")).toBeUndefined();
  });

  it("normaliza código sem zero à esquerda", () => {
    expect(alpha3De("76")).toBe("BRA");
  });
});
```

`lib/geo/mundo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { carregarMundo, separarPaises } from "./mundo";
import { PAISES_DO_ATLAS } from "./iso";

describe("carregarMundo", () => {
  it("devolve features de país", async () => {
    const mundo = await carregarMundo();
    expect(mundo.length).toBeGreaterThan(150);
    expect(mundo[0].type).toBe("Feature");
  });

  it("ENCONTRA todos os países do atlas no topojson", async () => {
    // Guarda contra o problema clássico de Natural Earth, em que um país vem
    // com código inválido e simplesmente some do mapa sem erro nenhum.
    const mundo = await carregarMundo();
    const { curados } = separarPaises(mundo, PAISES_DO_ATLAS);
    const achados = curados.map((f) => f.alpha3).sort();
    expect(achados).toEqual([...PAISES_DO_ATLAS].sort());
  });

  it("separa curados de fundo sem perder nem duplicar", async () => {
    const mundo = await carregarMundo();
    const { curados, fundo } = separarPaises(mundo, PAISES_DO_ATLAS);
    expect(curados.length + fundo.length).toBe(mundo.length);
  });

  it("cada país curado carrega geometria utilizável", async () => {
    const mundo = await carregarMundo();
    const { curados } = separarPaises(mundo, PAISES_DO_ATLAS);
    for (const c of curados) {
      expect(["Polygon", "MultiPolygon"]).toContain(c.feature.geometry.type);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

```bash
pnpm test lib/geo/
```

Esperado: FAIL — módulos não encontrados.

- [ ] **Step 3: Implementar**

`lib/geo/iso.ts`:

```ts
/**
 * O world-atlas identifica país por ISO 3166-1 numérico ("076"), enquanto o
 * conteúdo do atlas usa alpha-3 ("BRA"). Este é o único lugar que sabe
 * traduzir entre os dois.
 */
export const ISO_NUMERICO = {
  BRA: "076",
  CHN: "156",
  DEU: "276",
  FRA: "250",
  GBR: "826",
  IND: "356",
  JPN: "392",
  RUS: "643",
  USA: "840",
} as const;

export type Alpha3 = keyof typeof ISO_NUMERICO;

export const PAISES_DO_ATLAS = Object.keys(ISO_NUMERICO) as Alpha3[];

const REVERSO: Record<string, Alpha3> = Object.fromEntries(
  Object.entries(ISO_NUMERICO).map(([a3, num]) => [num, a3 as Alpha3])
);

/** Aceita "076" ou "76" — o topojson não é consistente quanto ao zero. */
export function alpha3De(numerico: string | number): Alpha3 | undefined {
  return REVERSO[String(numerico).padStart(3, "0")];
}
```

`lib/geo/mundo.ts`:

```ts
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { alpha3De, type Alpha3 } from "./iso";

export type PaisFeature = Feature<Geometry, { name?: string }>;

export interface PaisCurado {
  alpha3: Alpha3;
  feature: PaisFeature;
}

/**
 * Carrega o world-atlas 110m do pacote — não da rede. Isso mantém o build
 * offline e o teste determinístico.
 */
export async function carregarMundo(): Promise<PaisFeature[]> {
  const topo = (await import("world-atlas/countries-110m.json")) as unknown as {
    default: Topology;
  };
  const topology = topo.default ?? (topo as unknown as Topology);
  const colecao = topology.objects.countries as GeometryCollection;
  return feature(topology, colecao).features as PaisFeature[];
}

/**
 * Divide o mundo em duas listas: os países do atlas (que vão para o SVG
 * interativo) e todo o resto (que vai para o canvas decorativo).
 */
export function separarPaises(
  mundo: PaisFeature[],
  doAtlas: readonly Alpha3[]
): { curados: PaisCurado[]; fundo: PaisFeature[] } {
  const alvo = new Set<string>(doAtlas);
  const curados: PaisCurado[] = [];
  const fundo: PaisFeature[] = [];

  for (const f of mundo) {
    const a3 = f.id === undefined ? undefined : alpha3De(f.id as string | number);
    if (a3 && alvo.has(a3)) {
      curados.push({ alpha3: a3, feature: f });
    } else {
      fundo.push(f);
    }
  }

  return { curados, fundo };
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

```bash
pnpm test lib/geo/
```

Esperado: PASS. **Se o teste "ENCONTRA todos os países" falhar**, anote quais faltaram e pare — significa que o dataset mudou e o mapeamento precisa de ajuste. Não contornar removendo o país da lista.

- [ ] **Step 5: Commit**

```bash
git add lib/geo/iso.ts lib/geo/iso.test.ts lib/geo/mundo.ts lib/geo/mundo.test.ts
git commit -m "feat: mapeamento ISO e carregamento do topojson"
```

---

### Task 3: Projeção interpolada

O coração do projeto. Um `alpha` de 0 a 1 leva a projeção de ortográfica (globo) a equiretangular (mapa plano).

**Files:**
- Create: `lib/geo/projecao.ts`
- Test: `lib/geo/projecao.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { criarProjecao, escalaPara } from "./projecao";

const LARGURA = 800;
const ALTURA = 500;

describe("criarProjecao", () => {
  it("em alpha=0 projeta como globo — o lado oposto some", () => {
    const p = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 0 });
    // Ponto no lado oposto ao centro (rotação 0 => centro em lon 0)
    const oposto = p([180, 0]);
    const frente = p([0, 0]);
    expect(frente).not.toBeNull();
    // No globo, o ponto da frente fica no centro da tela
    expect(frente![0]).toBeCloseTo(LARGURA / 2, 0);
    expect(frente![1]).toBeCloseTo(ALTURA / 2, 0);
    // e o oposto, se projetado, cai longe do centro
    if (oposto) {
      expect(Math.abs(oposto[0] - LARGURA / 2)).toBeGreaterThan(1);
    }
  });

  it("em alpha=1 projeta como mapa plano — longitudes viram x lineares", () => {
    const p = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 1 });
    const oeste = p([-90, 0])!;
    const centro = p([0, 0])!;
    const leste = p([90, 0])!;
    expect(oeste[0]).toBeLessThan(centro[0]);
    expect(centro[0]).toBeLessThan(leste[0]);
    // Equiretangular é linear em longitude: os dois passos são iguais
    expect(centro[0] - oeste[0]).toBeCloseTo(leste[0] - centro[0], 4);
  });

  it("é contínua — alpha intermediário fica ENTRE os extremos", () => {
    const ponto: [number, number] = [90, 0];
    const x = (a: number) =>
      criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: a })(ponto)![0];
    const meio = x(0.5);
    const min = Math.min(x(0), x(1));
    const max = Math.max(x(0), x(1));
    expect(meio).toBeGreaterThanOrEqual(min);
    expect(meio).toBeLessThanOrEqual(max);
  });

  it("centraliza no tamanho informado", () => {
    const p = criarProjecao({ largura: 1000, altura: 600, alpha: 1 });
    const centro = p([0, 0])!;
    expect(centro[0]).toBeCloseTo(500, 0);
    expect(centro[1]).toBeCloseTo(300, 0);
  });

  it("aplica rotação", () => {
    const semRot = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 1 });
    const comRot = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha: 1,
      rotacao: [90, 0],
    });
    expect(comRot([0, 0])![0]).not.toBeCloseTo(semRot([0, 0])![0], 1);
  });
});

describe("escalaPara", () => {
  it("encolhe ao virar mapa, para o mundo inteiro caber", () => {
    expect(escalaPara(1, LARGURA)).toBeLessThan(escalaPara(0, LARGURA));
  });

  it("cresce junto com a largura disponível", () => {
    expect(escalaPara(0, 1600)).toBeGreaterThan(escalaPara(0, 800));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/geo/projecao.test.ts
```

- [ ] **Step 3: Implementar**

```ts
import {
  geoProjectionMutator,
  geoOrthographicRaw,
  geoEquirectangularRaw,
  type GeoProjection,
} from "d3-geo";

export interface OpcoesProjecao {
  largura: number;
  altura: number;
  /** 0 = globo, 1 = mapa plano. */
  alpha: number;
  /** [lambda, phi] em graus. */
  rotacao?: [number, number];
}

/**
 * Escala em função do alpha: o globo ocupa mais tela que o mapa desenrolado,
 * senão o mundo plano vaza pelas bordas.
 */
export function escalaPara(alpha: number, largura: number): number {
  const base = largura / 4;
  return base * (1 - 0.4 * alpha);
}

/**
 * Interpola linearmente entre duas projeções BRUTAS (raw) do d3.
 *
 * Precisa ser no espaço raw, antes de escala e translação: interpolar as
 * projeções já compostas produziria distorção em vez de desenrolamento.
 */
export function criarProjecao(opcoes: OpcoesProjecao): GeoProjection {
  const { largura, altura, alpha, rotacao = [0, 0] } = opcoes;

  const mutate = geoProjectionMutator(
    (t: number) => (x: number, y: number) => {
      const [x0, y0] = geoOrthographicRaw(x, y);
      const [x1, y1] = geoEquirectangularRaw(x, y);
      return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)];
    }
  );

  return mutate(alpha)
    .scale(escalaPara(alpha, largura))
    .translate([largura / 2, altura / 2])
    .rotate([rotacao[0], rotacao[1]])
    .precision(0.5);
}
```

Nota sobre `precision(0.5)`: valor mais alto que o padrão do d3, de propósito. Reduz o número de pontos por caminho, que é o principal custo de redesenho. Se as bordas ficarem visivelmente facetadas, baixar para 0.3 — **não** para 0.1, que é caro.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/geo/projecao.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/geo/projecao.ts lib/geo/projecao.test.ts
git commit -m "feat: projeção interpolada globo <-> mapa"
```

---

### Task 4: Rota como GeoJSON, cortada por data

Converte `Viagem` em LineString. O corte por data é o que faz a rota se desenhar conforme o tempo avança.

**Files:**
- Create: `lib/geo/rota.ts`
- Test: `lib/geo/rota.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { rotaCompleta, rotaAte, paradasAte } from "./rota";
import type { Viagem } from "@/lib/conteudo/viagem";

const cabral: Viagem = {
  id: "cabral-1500",
  titulo: "Frota de Cabral",
  fontes: [],
  paradas: [
    { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
    { local: "Cabo Verde", data: "1500-03-22", coords: [-23.51, 14.93] },
    { local: "Monte Pascoal", data: "1500-04-22", coords: [-39.42, -16.89] },
    { local: "Porto Seguro", data: "1500-04-24", coords: [-39.06, -16.45] },
  ],
};

describe("rotaCompleta", () => {
  it("vira um LineString com todas as paradas", () => {
    const r = rotaCompleta(cabral);
    expect(r.type).toBe("Feature");
    expect(r.geometry.type).toBe("LineString");
    expect(r.geometry.coordinates).toHaveLength(4);
  });
});

describe("paradasAte", () => {
  it("inclui só o que já aconteceu", () => {
    expect(paradasAte(cabral, "1500-03-22")).toHaveLength(2);
  });

  it("inclui a parada que acontece exatamente na data", () => {
    const p = paradasAte(cabral, "1500-03-09");
    expect(p).toHaveLength(1);
    expect(p[0].local).toBe("Lisboa");
  });

  it("DESEMPATA por mês — o caso do Cabral", () => {
    // Se a comparação fosse só por ano, abril e março de 1500 empatariam e
    // a rota inteira apareceria de uma vez.
    expect(paradasAte(cabral, "1500-04-22")).toHaveLength(3);
    expect(paradasAte(cabral, "1500-04-24")).toHaveLength(4);
  });

  it("devolve vazio antes da partida", () => {
    expect(paradasAte(cabral, "1499")).toHaveLength(0);
  });

  it("devolve tudo depois da chegada", () => {
    expect(paradasAte(cabral, "1600")).toHaveLength(4);
  });
});

describe("rotaAte", () => {
  it("devolve null quando não há trecho para desenhar", () => {
    expect(rotaAte(cabral, "1499")).toBeNull();
    // Uma parada só ainda não é linha
    expect(rotaAte(cabral, "1500-03-09")).toBeNull();
  });

  it("desenha o trecho parcial", () => {
    const r = rotaAte(cabral, "1500-03-22")!;
    expect(r.geometry.coordinates).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/geo/rota.test.ts
```

- [ ] **Step 3: Implementar**

```ts
import type { Feature, LineString } from "geojson";
import { comparaData } from "@/lib/conteudo/primitivos";
import type { Viagem, Parada } from "@/lib/conteudo/viagem";

export type RotaFeature = Feature<LineString, { viagemId: string; titulo: string }>;

function paraFeature(viagem: Viagem, paradas: Parada[]): RotaFeature {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: paradas.map((p) => p.coords),
    },
    properties: { viagemId: viagem.id, titulo: viagem.titulo },
  };
}

export function rotaCompleta(viagem: Viagem): RotaFeature {
  return paraFeature(viagem, viagem.paradas);
}

/** Paradas que já tinham acontecido na data informada. */
export function paradasAte(viagem: Viagem, data: string): Parada[] {
  return viagem.paradas.filter((p) => comparaData(p.data, data) <= 0);
}

/**
 * Trecho percorrido até a data. `null` com menos de duas paradas — uma linha
 * de um ponto só não existe.
 */
export function rotaAte(viagem: Viagem, data: string): RotaFeature | null {
  const paradas = paradasAte(viagem, data);
  return paradas.length < 2 ? null : paraFeature(viagem, paradas);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/geo/
```

- [ ] **Step 5: Commit**

```bash
git add lib/geo/rota.ts lib/geo/rota.test.ts
git commit -m "feat: rota como LineString com corte por data"
```

---

## Chunk 2: Renderização

> A partir daqui a verificação é visual, no navegador. Cada tarefa diz o que
> você deve ver. Se não vir, pare e investigue — não siga adiante.

### Task 5: GlobeCanvas — o mundo de fundo

**Files:** Create: `components/atlas/GlobeCanvas.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { geoPath, geoGraticule10 } from "d3-geo";
import { criarProjecao } from "@/lib/geo/projecao";
import type { PaisFeature } from "@/lib/geo/mundo";

interface Props {
  fundo: PaisFeature[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
}

/**
 * Camada decorativa: os países que o atlas não cobre, mais a malha de
 * meridianos e o contorno da esfera. Redesenhada a cada frame.
 */
export function GlobeCanvas({ fundo, largura, altura, alpha, rotacao }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    canvas.style.width = `${largura}px`;
    canvas.style.height = `${altura}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    const projecao = criarProjecao({ largura, altura, alpha, rotacao });
    const path = geoPath(projecao, ctx);

    // Contorno do planeta
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = "#0b1220";
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Malha de meridianos e paralelos
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Países não cobertos pelo atlas
    ctx.beginPath();
    for (const f of fundo) path(f);
    ctx.fillStyle = "#16203a";
    ctx.fill();
    ctx.strokeStyle = "#243049";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }, [fundo, largura, altura, alpha, rotacao]);

  return <canvas ref={ref} className="absolute inset-0" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/atlas/GlobeCanvas.tsx
git commit -m "feat: camada de canvas do globo"
```

---

### Task 6: GeoOverlay — países do atlas e rotas

**Files:** Create: `components/atlas/GeoOverlay.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { useMemo } from "react";
import { geoPath } from "d3-geo";
import { criarProjecao } from "@/lib/geo/projecao";
import type { PaisCurado } from "@/lib/geo/mundo";
import type { RotaFeature } from "@/lib/geo/rota";
import type { Alpha3 } from "@/lib/geo/iso";

interface Props {
  curados: PaisCurado[];
  rotas: RotaFeature[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  selecionado: Alpha3 | null;
  onSelecionar: (a: Alpha3) => void;
}

/**
 * Camada interativa. Poucos elementos, então SVG compensa: clique e hover
 * saem de graça pelo DOM, e as rotas viram <path> reais — que é o que o
 * DrawSVG do GSAP precisa para desenhá-las progressivamente.
 */
export function GeoOverlay({
  curados,
  rotas,
  largura,
  altura,
  alpha,
  rotacao,
  selecionado,
  onSelecionar,
}: Props) {
  const path = useMemo(
    () => geoPath(criarProjecao({ largura, altura, alpha, rotacao })),
    [largura, altura, alpha, rotacao]
  );

  return (
    <svg
      width={largura}
      height={altura}
      className="absolute inset-0"
      style={{ overflow: "visible" }}
    >
      <g>
        {curados.map(({ alpha3, feature }) => {
          const d = path(feature);
          if (!d) return null;
          const ativo = selecionado === alpha3;
          return (
            <path
              key={alpha3}
              d={d}
              fill={ativo ? "#38bdf8" : "#0ea5e9"}
              fillOpacity={ativo ? 0.9 : 0.55}
              stroke="#7dd3fc"
              strokeWidth={ativo ? 1.5 : 0.75}
              className="cursor-pointer transition-[fill-opacity] duration-200 hover:fill-opacity-80"
              onClick={() => onSelecionar(alpha3)}
            >
              <title>{alpha3}</title>
            </path>
          );
        })}
      </g>

      <g>
        {rotas.map((rota) => {
          const d = path(rota);
          if (!d) return null;
          return (
            <path
              key={rota.properties.viagemId}
              d={d}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="5 4"
            />
          );
        })}
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/atlas/GeoOverlay.tsx
git commit -m "feat: camada SVG com países do atlas e rotas"
```

---

### Task 7: Atlas — estado e arrastar para girar

**Files:** Create: `components/atlas/Atlas.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { GlobeCanvas } from "./GlobeCanvas";
import { GeoOverlay } from "./GeoOverlay";
import { separarPaises, type PaisFeature } from "@/lib/geo/mundo";
import { PAISES_DO_ATLAS, type Alpha3 } from "@/lib/geo/iso";
import { rotaCompleta } from "@/lib/geo/rota";
import type { Viagem } from "@/lib/conteudo/viagem";

const LARGURA = 900;
const ALTURA = 560;

interface Props {
  mundo: PaisFeature[];
  viagens: Viagem[];
}

/**
 * Único dono do estado. Tudo abaixo recebe props e não guarda estado próprio,
 * o que torna impossível globo, rotas e seleção dessincronizarem.
 */
export function Atlas({ mundo, viagens }: Props) {
  const [alpha, setAlpha] = useState(0);
  const [rotacao, setRotacao] = useState<[number, number]>([-40, -10]);
  const [selecionado, setSelecionado] = useState<Alpha3 | null>(null);

  const arrastando = useRef(false);
  const ultimo = useRef<[number, number]>([0, 0]);

  const { curados, fundo } = separarPaises(mundo, PAISES_DO_ATLAS);
  const rotas = viagens.map(rotaCompleta);

  const aoPressionar = useCallback((e: React.PointerEvent) => {
    arrastando.current = true;
    ultimo.current = [e.clientX, e.clientY];
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const aoMover = useCallback((e: React.PointerEvent) => {
    if (!arrastando.current) return;
    const [px, py] = ultimo.current;
    const dx = e.clientX - px;
    const dy = e.clientY - py;
    ultimo.current = [e.clientX, e.clientY];
    setRotacao(([lambda, phi]) => [
      lambda + dx * 0.35,
      Math.max(-90, Math.min(90, phi - dy * 0.35)),
    ]);
  }, []);

  const aoSoltar = useCallback(() => {
    arrastando.current = false;
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative cursor-grab active:cursor-grabbing touch-none"
        style={{ width: LARGURA, height: ALTURA }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
      >
        <GlobeCanvas
          fundo={fundo}
          largura={LARGURA}
          altura={ALTURA}
          alpha={alpha}
          rotacao={rotacao}
        />
        <GeoOverlay
          curados={curados}
          rotas={rotas}
          largura={LARGURA}
          altura={ALTURA}
          alpha={alpha}
          rotacao={rotacao}
          selecionado={selecionado}
          onSelecionar={setSelecionado}
        />
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-300">
        <span className="min-w-32">
          {selecionado ? `País: ${selecionado}` : "Clique num país aceso"}
        </span>
        <button
          onClick={() => setAlpha((a) => (a === 0 ? 1 : 0))}
          className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800"
        >
          {alpha === 0 ? "Desenrolar" : "Enrolar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/atlas/Atlas.tsx
git commit -m "feat: Atlas com estado e arrastar para girar"
```

---

### Task 8: Página — carregar o acervo e montar

**Files:** Modify: `app/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
import path from "node:path";
import { Atlas } from "@/components/atlas/Atlas";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { carregarMundo } from "@/lib/geo/mundo";

export default async function Home() {
  const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
  const mundo = await carregarMundo();

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        <header className="text-center">
          <h1 className="font-serif text-4xl tracking-tight">Atlas</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
            {acervo.paises.length} PAÍSES · {acervo.viagens.length} VIAGENS
          </p>
        </header>

        <Atlas mundo={mundo} viagens={acervo.viagens} />
      </div>
    </main>
  );
}
```

Componente de servidor: lê o disco no build e passa dados prontos ao cliente. Nenhuma requisição em runtime.

- [ ] **Step 2: Subir e OLHAR**

```bash
pnpm dev
```

Abrir `http://localhost:3000`. Você deve ver:

- um globo escuro com malha de meridianos
- **Brasil e França acesos em azul**, o resto do mundo em cinza-azulado
- a rota do Cabral em âmbar tracejado, ligando Lisboa a Porto Seguro
- arrastar com o mouse gira o globo
- clicar no Brasil escreve "País: BRA" embaixo
- o botão "Desenrolar" achata o globo em mapa-múndi

Se o globo aparecer mas os países acesos não, o problema é o mapeamento ISO da Task 2 — volte lá.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: página do atlas montando globo, países e rotas"
```

---

### Task 9: Transição animada com GSAP

Trocar o pulo seco do `setAlpha` por uma transição de verdade.

**Files:** Modify: `components/atlas/Atlas.tsx`

- [ ] **Step 1: Substituir o botão por um tween**

Adicionar ao topo do arquivo:

```tsx
import { useEffect } from "react";
import gsap from "gsap";
```

Trocar o `onClick` do botão por:

```tsx
const alvoAlpha = useRef({ v: 0 });

const alternarModo = useCallback(() => {
  const destino = alvoAlpha.current.v === 0 ? 1 : 0;
  gsap.to(alvoAlpha.current, {
    v: destino,
    duration: 1.2,
    ease: "power2.inOut",
    onUpdate: () => setAlpha(alvoAlpha.current.v),
  });
}, []);
```

E no botão: `onClick={alternarModo}`.

O ponto: GSAP anima um objeto JavaScript comum, não o DOM. O `onUpdate` empurra o valor pro React a cada frame, e o React redesenha as duas camadas. Some o `requestAnimationFrame` manual e ganhamos easing de verdade.

- [ ] **Step 2: Verificar no navegador**

Com `pnpm dev` rodando, clicar em "Desenrolar". O globo deve **desenrolar suavemente** ao longo de ~1,2 s, com a rota do Cabral acompanhando a deformação.

Se estiver travado, medir antes de otimizar: subir `precision` para 1.0 em `projecao.ts` e comparar.

- [ ] **Step 3: Rodar tudo**

```bash
pnpm test && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add components/atlas/Atlas.tsx
git commit -m "feat: transição globo <-> mapa animada com GSAP"
```

---

## Critério de conclusão

- [ ] `pnpm test` passa, incluindo o teste que acha os 9 países no topojson
- [ ] `pnpm build` passa
- [ ] O globo aparece em `localhost:3000` e gira ao arrastar
- [ ] Brasil e França estão acesos e clicáveis
- [ ] A rota do Cabral aparece sobre o globo
- [ ] "Desenrolar" transforma globo em mapa com animação suave

---

## Fora deste plano

Barra de tempo e desenho progressivo da rota (plano 3) — aqui a rota aparece
inteira. Páginas de país, dossiê e alegações (plano 4). Os outros 7 países só
acendem quando ganharem arquivo em `conteudo/paises/`; a estrutura já os
suporta.
