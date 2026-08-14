# Páginas de Conteúdo — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o acervo em páginas navegáveis — dossiê de país por período, página de figura com alegações rotuladas por status, e gráfico de indicador com fonte.

**Architecture:** Rotas estáticas do App Router lendo o mesmo `Acervo` do plano 1. Clicar num país aceso no globo navega para o dossiê. Nenhum dado novo em runtime; tudo continua vindo de `conteudo/`.

**Tech Stack:** Next.js 16 (App Router) · react-markdown · o que já existe

**Spec:** `docs/superpowers/specs/2026-08-13-atlas-design.md` — ler §6 (alegações) e §7 (indicadores).

---

## Restrição editorial — leia antes de tudo

Este plano constrói a máquina de alegações e indicadores. **Ele não preenche essa máquina com dados políticos contestados.**

Motivo: as alegações sobre Lula e Bolsonaro dependem de andamento processual que mudou recentemente, próximo ou além do limite de conhecimento do assistente. E um gráfico do IBGE com números inventados seria exatamente aquilo que a §7 do spec existe para impedir — o projeto perderia sua razão de ser na primeira página publicada.

Então:

| O quê | Como entra na v1 |
|---|---|
| Componentes de alegação, status, indicador | **Construídos e testados** |
| Alegação de exemplo | **Joana d'Arc** — condenação de 1431 anulada em 1456. Documentada, não partidária, e exercita a distinção `anulado` |
| Lula e Bolsonaro | Figuras criadas com **cargos apenas**, `alegacoes: []` |
| Dados de indicador | **Nenhum arquivo em `conteudo/indicadores/`.** Parser e gráfico testados com fixture |

Preencher alegações políticas e baixar séries do IBGE é trabalho seguinte, feito com o Pedro conferindo cada fonte na hora. A infraestrutura fica pronta esperando.

**Não contorne isto inventando dados para "ver a tela funcionando".** A fixture de teste serve para isso.

---

## Notas de Next.js 16

Confirmado nos docs em `node_modules/next/dist/docs/`:

```tsx
export default async function Page({ params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;   // params é Promise e PRECISA de await
}
```

Isso mudou em relação a versões anteriores. `generateStaticParams` continua igual.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conteudo/indicador.ts` | schema de `Indicador` + parser de CSV |
| `lib/conteudo/carregar.ts` | passa a carregar indicadores (modificado) |
| `lib/conteudo/integridade.ts` | valida `paisIso` de indicador (modificado) |
| `components/conteudo/StatusBadge.tsx` | rótulo colorido do status |
| `components/conteudo/AlegacaoCard.tsx` | uma alegação com status, nota e fontes |
| `components/conteudo/IndicadorChart.tsx` | série com faixa de mandato e atribuição |
| `components/conteudo/Prosa.tsx` | markdown renderizado |
| `app/pais/[iso]/page.tsx` | dossiê do país |
| `app/figura/[id]/page.tsx` | página de figura |

---

## Chunk 1: Indicadores

### Task 1: Schema e parser de CSV

**Files:**
- Create: `lib/conteudo/indicador.ts`
- Test: `lib/conteudo/indicador.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { Indicador, parseSerieCsv, valorEm } from "./indicador";

const CSV = `ano,valor
2012,25.4
2013,24.1
2014,23.8
`;

describe("parseSerieCsv", () => {
  it("lê ano e valor", () => {
    const s = parseSerieCsv(CSV);
    expect(s).toHaveLength(3);
    expect(s[0]).toEqual({ ano: 2012, valor: 25.4 });
  });

  it("ignora linhas em branco no fim", () => {
    expect(parseSerieCsv(CSV + "\n\n")).toHaveLength(3);
  });

  it("LANÇA se faltar a coluna valor", () => {
    expect(() => parseSerieCsv("ano\n2012\n")).toThrow(/valor/);
  });

  it("LANÇA em número inválido em vez de virar NaN", () => {
    expect(() => parseSerieCsv("ano,valor\n2012,abc\n")).toThrow(/2012/);
  });

  it("ordena por ano", () => {
    const s = parseSerieCsv("ano,valor\n2014,1\n2012,2\n");
    expect(s.map((p) => p.ano)).toEqual([2012, 2014]);
  });
});

describe("Indicador", () => {
  const base = {
    id: "br-pobreza",
    paisIso: "BRA",
    nome: "Pobreza",
    unidade: "% da população",
    fonte: "ibge-pnad",
    serie: [{ ano: 2012, valor: 25.4 }],
  };

  it("aceita indicador completo", () => {
    expect(Indicador.safeParse(base).success).toBe(true);
  });

  it("EXIGE fonte — gráfico sem atribuição é opinião com eixo", () => {
    const { fonte: _f, ...semFonte } = base;
    expect(Indicador.safeParse(semFonte).success).toBe(false);
  });

  it("exige série não vazia", () => {
    expect(Indicador.safeParse({ ...base, serie: [] }).success).toBe(false);
  });

  it("exige unidade", () => {
    expect(Indicador.safeParse({ ...base, unidade: "" }).success).toBe(false);
  });
});

describe("valorEm", () => {
  const serie = [
    { ano: 2012, valor: 25.4 },
    { ano: 2014, valor: 23.8 },
  ];

  it("devolve o valor exato do ano", () => {
    expect(valorEm(serie, 2012)).toBe(25.4);
  });

  it("devolve null fora da série — não extrapola", () => {
    expect(valorEm(serie, 2020)).toBeNull();
    expect(valorEm(serie, 2000)).toBeNull();
  });

  it("devolve null em ano faltante no meio", () => {
    expect(valorEm(serie, 2013)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/indicador.test.ts
```

- [ ] **Step 3: Implementar**

```ts
import { z } from "zod";
import { Id } from "./primitivos";

export const Ponto = z.object({ ano: z.number().int(), valor: z.number() });

export const Indicador = z.object({
  id: Id,
  paisIso: z.string().regex(/^[A-Z]{3}$/),
  nome: z.string().min(1),
  unidade: z.string().min(1, "indicador precisa de unidade"),
  /** Id de Fonte. Gráfico sem atribuição é opinião com eixo. */
  fonte: Id,
  serie: z.array(Ponto).min(1, "indicador precisa de ao menos um ponto"),
});

export type Ponto = z.infer<typeof Ponto>;
export type Indicador = z.infer<typeof Indicador>;

/** CSV mínimo: cabeçalho `ano,valor`. Sem aspas, sem separador decimal local. */
export function parseSerieCsv(texto: string): Ponto[] {
  const linhas = texto.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length === 0) throw new Error("CSV vazio");

  const cab = linhas[0].split(",").map((c) => c.trim().toLowerCase());
  const iAno = cab.indexOf("ano");
  const iValor = cab.indexOf("valor");
  if (iAno === -1) throw new Error('CSV precisa da coluna "ano"');
  if (iValor === -1) throw new Error('CSV precisa da coluna "valor"');

  const pontos = linhas.slice(1).map((linha) => {
    const col = linha.split(",");
    const ano = Number(col[iAno]);
    const valor = Number(col[iValor]);
    if (!Number.isFinite(ano)) throw new Error(`ano inválido: ${col[iAno]}`);
    if (!Number.isFinite(valor)) {
      throw new Error(`valor inválido no ano ${col[iAno]}: ${col[iValor]}`);
    }
    return { ano, valor };
  });

  return pontos.sort((a, b) => a.ano - b.ano);
}

/** Valor exato daquele ano, ou null. Nunca interpola — inventar ponto mente. */
export function valorEm(serie: Ponto[], ano: number): number | null {
  return serie.find((p) => p.ano === ano)?.valor ?? null;
}
```

- [ ] **Step 4: Rodar, confirmar que passa, commitar**

```bash
pnpm test lib/conteudo/indicador.test.ts
git add lib/conteudo/indicador.ts lib/conteudo/indicador.test.ts
git commit -m "feat: schema de indicador e parser de CSV"
```

---

### Task 2: Carregar indicadores

**Files:** Modify `lib/conteudo/carregar.ts`, `lib/conteudo/integridade.ts`; test: adicionar casos

- [ ] **Step 1: Adicionar teste de integridade**

Em `integridade.test.ts`:

```ts
it("ACUSA indicador que cita fonte inexistente", () => {
  const a = acervoBase();
  a.indicadores.push({
    id: "br-pobreza", paisIso: "BRA", nome: "Pobreza",
    unidade: "%", fonte: "fonte-fantasma", serie: [{ ano: 2012, valor: 25 }],
  });
  expect(verificarIntegridade(a).some((e) => /fonte-fantasma/.test(e))).toBe(true);
});

it("ACUSA indicador de país fora do atlas", () => {
  const a = acervoBase();
  a.indicadores.push({
    id: "ar-pobreza", paisIso: "ARG", nome: "Pobreza",
    unidade: "%", fonte: "stf-hc-193726", serie: [{ ano: 2012, valor: 25 }],
  });
  expect(verificarIntegridade(a).some((e) => /ARG/.test(e))).toBe(true);
});
```

Ajustar `acervoBase()` para incluir `indicadores: []`.

- [ ] **Step 2: Implementar**

Em `integridade.ts`, adicionar `indicadores: Indicador[]` à interface `Acervo` e o laço de verificação equivalente ao de viagens, mais a checagem de `paisIso`.

Em `carregar.ts`, adicionar ao `Promise.all`:

```ts
lerJsonDoDiretorio(path.join(raiz, "indicadores"), Indicador),
```

- [ ] **Step 3: Rodar tudo e commitar**

```bash
pnpm test && pnpm validar
git add lib/conteudo/
git commit -m "feat: indicadores no acervo e na integridade referencial"
```

---

## Chunk 2: Componentes e páginas

### Task 3: StatusBadge e AlegacaoCard

**Files:** Create `components/conteudo/StatusBadge.tsx`, `components/conteudo/AlegacaoCard.tsx`

- [ ] **Step 1: StatusBadge**

```tsx
import type { StatusAlegacao } from "@/lib/conteudo/alegacao";

const ROTULOS: Record<StatusAlegacao, { texto: string; classe: string }> = {
  "transito-julgado": { texto: "Trânsito em julgado", classe: "border-red-500/40 bg-red-500/10 text-red-400" },
  "em-julgamento": { texto: "Em julgamento", classe: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  investigacao: { texto: "Investigação", classe: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500" },
  anulado: { texto: "Anulado", classe: "border-sky-500/40 bg-sky-500/10 text-sky-400" },
  prescrito: { texto: "Prescrito", classe: "border-sky-500/40 bg-sky-500/10 text-sky-400" },
  "alegacao-sem-processo": { texto: "Alegação sem processo", classe: "border-slate-600 bg-slate-700/40 text-slate-300" },
  desmentido: { texto: "Desmentido", classe: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
};

export function StatusBadge({ status }: { status: StatusAlegacao }) {
  const { texto, classe } = ROTULOS[status];
  return (
    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}>
      {texto}
    </span>
  );
}
```

- [ ] **Step 2: AlegacaoCard**

```tsx
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import type { Alegacao } from "@/lib/conteudo/alegacao";
import type { Fonte } from "@/lib/conteudo/fonte";

export function AlegacaoCard({ alegacao, fontes }: { alegacao: Alegacao; fontes: Fonte[] }) {
  const citadas = fontes.filter((f) => alegacao.fontes.includes(f.id));

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-slate-100">{alegacao.enunciado}</h3>
        <StatusBadge status={alegacao.status} />
      </header>

      {alegacao.data && <p className="mt-1 font-mono text-[11px] text-slate-500">{alegacao.data}</p>}

      {alegacao.nota && (
        <p className="mt-2 border-l-2 border-slate-700 pl-3 text-xs leading-relaxed text-slate-400">
          {alegacao.nota}
        </p>
      )}

      <footer className="mt-3 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-600">Fontes</p>
        <ul className="space-y-1">
          {citadas.map((f) => (
            <li key={f.id} className="text-xs text-slate-400">
              {f.url ? (
                <Link href={f.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                  {f.titulo}
                </Link>
              ) : (
                f.titulo
              )}
              {f.publicacao && <span className="text-slate-600"> · {f.publicacao}</span>}
            </li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
```

Toda alegação renderiza suas fontes. Como o schema exige ao menos uma e a integridade garante que existem, esta lista **nunca** fica vazia.

- [ ] **Step 3: Commit**

```bash
git add components/conteudo/
git commit -m "feat: StatusBadge e AlegacaoCard"
```

---

### Task 4: IndicadorChart

**Files:** Create `components/conteudo/IndicadorChart.tsx`

- [ ] **Step 1: Implementar**

SVG puro, sem biblioteca de gráfico — é uma linha com faixas sombreadas.

```tsx
import type { Indicador } from "@/lib/conteudo/indicador";
import type { Fonte } from "@/lib/conteudo/fonte";
import type { Periodo } from "@/lib/conteudo/pais";

const L = 560, A = 160, PAD = 28;

export function IndicadorChart({
  indicador, fonte, periodos = [],
}: { indicador: Indicador; fonte?: Fonte; periodos?: Periodo[] }) {
  const anos = indicador.serie.map((p) => p.ano);
  const vals = indicador.serie.map((p) => p.valor);
  const [a0, a1] = [Math.min(...anos), Math.max(...anos)];
  const [v0, v1] = [Math.min(...vals), Math.max(...vals)];
  const spanA = a1 - a0 || 1;
  const spanV = v1 - v0 || 1;

  const x = (ano: number) => PAD + ((ano - a0) / spanA) * (L - PAD * 2);
  const y = (v: number) => A - PAD - ((v - v0) / spanV) * (A - PAD * 2);

  const d = indicador.serie.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ano)},${y(p.valor)}`).join("");

  return (
    <figure className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-slate-100">{indicador.nome}</p>
        <p className="text-[11px] text-slate-500">{indicador.unidade}</p>
      </figcaption>

      <svg viewBox={`0 0 ${L} ${A}`} className="w-full">
        {/* Faixas de mandato: quem estava no poder, não o que "conquistou" */}
        {periodos.map((p) => {
          const ini = Number(p.inicio.slice(0, 4));
          const fim = p.fim ? Number(p.fim.slice(0, 4)) : a1;
          if (fim < a0 || ini > a1) return null;
          const xi = x(Math.max(ini, a0));
          const xf = x(Math.min(fim, a1));
          return (
            <g key={p.id}>
              <rect x={xi} y={PAD - 10} width={Math.max(0, xf - xi)} height={A - PAD * 2 + 20}
                fill="rgba(56,189,248,0.07)" stroke="rgba(56,189,248,0.25)" strokeDasharray="3 3" />
              <text x={xi + 3} y={PAD - 2} fontSize="8" fill="#38bdf8">{p.rotulo}</text>
            </g>
          );
        })}

        <line x1={PAD} y1={A - PAD} x2={L - PAD} y2={A - PAD} stroke="#334155" />
        <path d={d} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
        {indicador.serie.map((p) => (
          <circle key={p.ano} cx={x(p.ano)} cy={y(p.valor)} r={2} fill="#fbbf24" />
        ))}

        <text x={PAD} y={A - 8} fontSize="9" fill="#64748b">{a0}</text>
        <text x={L - PAD} y={A - 8} fontSize="9" fill="#64748b" textAnchor="end">{a1}</text>
      </svg>

      {/* A atribuição não é opcional. A curva não é do autor. */}
      <p className="mt-2 text-[10px] text-slate-500">
        Fonte: {fonte ? `${fonte.titulo}${fonte.publicacao ? ` — ${fonte.publicacao}` : ""}` : indicador.fonte}
      </p>
    </figure>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/conteudo/IndicadorChart.tsx
git commit -m "feat: gráfico de indicador com mandato sombreado e fonte"
```

---

### Task 5: Página de país e de figura

**Files:** Create `app/pais/[iso]/page.tsx`, `app/figura/[id]/page.tsx`, `components/conteudo/Prosa.tsx`

- [ ] **Step 1: Instalar o renderizador de markdown**

```bash
pnpm add react-markdown
```

`components/conteudo/Prosa.tsx`:

```tsx
import ReactMarkdown from "react-markdown";

export function Prosa({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <div className="prose-atlas space-y-3 text-sm leading-relaxed text-slate-300">
      <ReactMarkdown>{texto}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Página de país**

Atenção ao `await params` — Next 16.

```tsx
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { Prosa } from "@/components/conteudo/Prosa";
import { IndicadorChart } from "@/components/conteudo/IndicadorChart";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.paises.map((p) => ({ iso: p.iso }));
}

export default async function PaisPage({ params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const pais = acervo.paises.find((p) => p.iso === iso);
  if (!pais) notFound();

  const figuras = acervo.figuras.filter((f) => f.paisIso === iso);
  const indicadores = acervo.indicadores.filter((i) => i.paisIso === iso);

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8 px-4">
        <Link href="/" className="font-mono text-xs text-sky-400 hover:underline">← globo</Link>

        <header>
          <h1 className="font-serif text-4xl">{pais.nome}</h1>
          <p className="font-mono text-xs tracking-widest text-amber-500/70">
            {pais.periodos.length} PERÍODOS
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Períodos</h2>
          {pais.periodos.map((p) => (
            <article key={p.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">{p.rotulo}</h3>
                <span className="font-mono text-xs text-amber-500">
                  {p.inicio}{p.fim ? `–${p.fim}` : "–"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{p.regime}</p>
              <Prosa texto={p.textoMdx} />
            </article>
          ))}
        </section>

        {figuras.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">Figuras</h2>
            <ul className="space-y-1">
              {figuras.map((f) => (
                <li key={f.id}>
                  <Link href={`/figura/${f.id}`} className="text-sm text-sky-400 hover:underline">
                    {f.nome}
                  </Link>
                  <span className="ml-2 text-xs text-slate-600">
                    {f.alegacoes.length > 0 ? `${f.alegacoes.length} alegação(ões)` : "sem alegações"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {indicadores.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">Indicadores</h2>
            {indicadores.map((i) => (
              <IndicadorChart key={i.id} indicador={i}
                fonte={acervo.fontes.find((f) => f.id === i.fonte)}
                periodos={pais.periodos} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Página de figura**

Mesma estrutura, listando `<AlegacaoCard>` para cada alegação e os cargos. Quando `alegacoes` está vazio, mostrar explicitamente:

```tsx
<p className="text-xs text-slate-500">
  Nenhuma alegação registrada. Alegações só entram com fonte verificada.
</p>
```

Isso é melhor que uma seção ausente: comunica que o vazio é deliberado, não esquecimento.

- [ ] **Step 4: Ligar o globo**

Em `Atlas.tsx`, o painel de seleção ganha link para o dossiê:

```tsx
{paisSelecionado && (
  <Link href={`/pais/${paisSelecionado.iso}`} className="text-sky-400 hover:underline">
    abrir dossiê →
  </Link>
)}
```

- [ ] **Step 5: Verificar no navegador**

- `/` → clicar num país aceso → link "abrir dossiê" aparece
- `/pais/FRA` → lista os 10 períodos
- `/pais/BRA` → lista os 7 períodos
- `/pais/XXX` → 404

- [ ] **Step 6: Commit**

```bash
pnpm test && pnpm build
git add app/ components/ package.json pnpm-lock.yaml
git commit -m "feat: páginas de país e figura ligadas ao globo"
```

---

## Chunk 3: Conteúdo semente

### Task 6: Figuras

**Files:** Create `conteudo/figuras/*.json`; modify `conteudo/fontes/fontes.json`

- [ ] **Step 1: Fontes do caso Joana d'Arc**

Adicionar a `fontes.json` duas entradas do tipo `documento-oficial`: o processo de condenação de 1431 e o processo de nulidade de 1456. **Sem inventar URL** — se não tiver o link verificado à mão, omitir o campo.

- [ ] **Step 2: Joana d'Arc**

```json
{
  "id": "joana-darc",
  "nome": "Joana d'Arc",
  "paisIso": "FRA",
  "cargos": [],
  "alegacoes": [
    {
      "id": "joana-heresia",
      "enunciado": "Culpada de heresia e relapsia",
      "status": "anulado",
      "data": "1431-05-30",
      "fontes": ["proc-condenacao-1431", "proc-nulidade-1456"],
      "nota": "Condenada por tribunal eclesiástico em Rouen em 1431. O processo de nulidade concluído em 1456, a pedido da família, anulou a sentença por vícios de procedimento. Aqui o anulamento veio acompanhado de reabilitação — diferente do caso em que a anulação decorre apenas de vício de forma e não se pronuncia sobre o mérito."
    }
  ]
}
```

Este é o caso de demonstração porque é documentado, não partidário, e exercita justamente a distinção que a §6 do spec quer tornar visível.

- [ ] **Step 3: Lula e Bolsonaro — cargos apenas**

```json
{
  "id": "lula",
  "nome": "Luiz Inácio Lula da Silva",
  "paisIso": "BRA",
  "cargos": [
    { "titulo": "Presidente da República", "inicio": "2003-01-01", "fim": "2010-12-31" },
    { "titulo": "Presidente da República", "inicio": "2023-01-01" }
  ],
  "alegacoes": []
}
```

Análogo para Bolsonaro (2019-01-01 a 2022-12-31).

**`alegacoes` fica vazio de propósito.** Preencher exige conferir andamento processual na fonte primária, item por item — trabalho para uma sessão com o Pedro, não para este plano.

- [ ] **Step 4: Validar e commitar**

```bash
pnpm validar   # deve contar 3 figuras e 1 alegação
pnpm test && pnpm build
git add conteudo/
git commit -m "conteudo: figuras semente com Joana d'Arc como caso de alegação"
```

---

## Critério de conclusão

- [ ] `pnpm test` e `pnpm build` passam
- [ ] `/pais/FRA` lista 10 períodos; `/pais/BRA` lista 7
- [ ] `/figura/joana-darc` mostra a alegação com selo "Anulado" e as duas fontes
- [ ] `/figura/lula` mostra os cargos e diz explicitamente que não há alegações registradas
- [ ] Clicar num país no globo leva ao dossiê
- [ ] `conteudo/indicadores/` continua **vazio** — o gráfico só tem teste com fixture

---

## Fora deste plano

Alegações políticas do Brasil e séries do IBGE — dependem de verificação de fonte que precisa do Pedro na mesa. Busca, i18n, e trocar o dossiê conforme o período selecionado no globo (hoje a página lista todos os períodos).
