# Fundação de Conteúdo — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a camada de conteúdo do Atlas — schemas tipados, um validador que quebra o build quando há afirmação sem fonte, e um loader que entrega dados prontos para as telas.

**Architecture:** Todo conteúdo vive em arquivos versionados sob `conteudo/`. Schemas zod são a única definição de forma — os tipos TypeScript são inferidos deles, nunca escritos à mão. O validador roda antes do build do Next.js e falha com mensagem apontando arquivo e campo. Não há banco de dados nem validação em runtime.

**Tech Stack:** Next.js (App Router) · TypeScript · zod · Vitest · pnpm

**Spec:** `docs/superpowers/specs/2026-08-13-atlas-design.md` — ler §5 (modelo de dados), §6 (alegações) e §10 (tratamento de erro) antes de começar.

---

## Contexto que o executor precisa

Você está construindo um atlas histórico. A ideia estruturante: a unidade de conteúdo é
**país × período**. "França 1420" e "França 2026" são o mesmo tipo de objeto — um retrato
datado.

A regra mais importante do projeto: **uma alegação contestada não pode existir sem fonte.**
Isso não é validação defensiva de rotina — é a promessa editorial do produto. O site trata
temas politicamente adversariais (corrupção, tentativa de golpe) e a única forma de o leitor
de qualquer lado confiar nele é que toda afirmação carregue status processual explícito e
fonte rastreável. Por isso a regra vive no **build**, não em runtime: conteúdo sem fonte não
chega ao ar porque o deploy falha.

Use @superpowers:test-driven-development em todas as tarefas. Teste primeiro, sempre.

### Decisões já tomadas — não revisitar

- Sem banco de dados. Conteúdo é arquivo no repo.
- `status` de alegação é enum fechado. Não aceitar string livre.
- Fonte é entidade com id próprio, referenciada por id. Não é string inline.
- Datas históricas precisam suportar ano isolado e anos de 3 dígitos (843, por exemplo).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conteudo/primitivos.ts` | tipos base reusados: `DataHistorica`, `Id` |
| `lib/conteudo/fonte.ts` | schema de `Fonte` |
| `lib/conteudo/alegacao.ts` | schema de `Alegacao` + enum de status |
| `lib/conteudo/figura.ts` | schema de `Figura` |
| `lib/conteudo/pais.ts` | schemas de `Pais` e `Periodo` |
| `lib/conteudo/viagem.ts` | schemas de `Viagem` e `Parada` |
| `lib/conteudo/indicador.ts` | schema de `Indicador` + parser de CSV |
| `lib/conteudo/carregar.ts` | lê `conteudo/` do disco e parseia |
| `lib/conteudo/integridade.ts` | checagens entre arquivos (ids referenciados existem) |
| `scripts/validar-conteudo.ts` | entrypoint CLI; sai com código 1 em falha |

Um arquivo por entidade. Eles mudam por motivos diferentes e ficam pequenos o bastante para
serem lidos de uma vez.

---

## Chunk 1: Fundação

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Criar o projeto Next.js**

Rodar na raiz de `D:\Globe Project`:

```bash
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

Se reclamar que o diretório não está vazio, é esperado — `docs/`, `.gitignore` e os zips já
existem. Aceitar e manter os arquivos existentes.

- [ ] **Step 2: Instalar dependências do plano**

```bash
pnpm add zod@^3.23.8
pnpm add -D vitest @vitest/coverage-v8 tsx
```

Nota: zod fixado na linha 3.x de propósito. A 4.x depreciou parte da API usada aqui
(`z.string().url()`), e este plano usa a sintaxe 3.x de forma consistente.

- [ ] **Step 3: Configurar o Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Adicionar aos scripts do `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"validar": "tsx scripts/validar-conteudo.ts"
```

- [ ] **Step 4: Verificar que tudo sobe**

```bash
pnpm test
```

Esperado: `No test files found` — sem erro de configuração. Isso confirma que o Vitest
resolve o config e o alias.

```bash
pnpm build
```

Esperado: build do Next.js conclui com sucesso.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest"
```

---

### Task 2: Primitivos — data histórica

Datas históricas não são datas comuns. Precisam aceitar `1500-04-22`, `1500-04`, `1500` e
`843` — ano de três dígitos. `Date` do JavaScript e `z.string().datetime()` não servem.

**Files:**
- Create: `lib/conteudo/primitivos.ts`
- Test: `lib/conteudo/primitivos.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { DataHistorica, anoDe } from "./primitivos";

describe("DataHistorica", () => {
  it.each(["1500-04-22", "1500-04", "1500", "843", "2026-08-13"])(
    "aceita %s",
    (entrada) => {
      expect(DataHistorica.safeParse(entrada).success).toBe(true);
    }
  );

  it.each(["", "15/04/1500", "1500-4-22", "abc", "1500-13-01"])(
    "rejeita %s",
    (entrada) => {
      expect(DataHistorica.safeParse(entrada).success).toBe(false);
    }
  );

  it("extrai o ano de qualquer granularidade", () => {
    expect(anoDe("1500-04-22")).toBe(1500);
    expect(anoDe("843")).toBe(843);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/primitivos.test.ts
```

Esperado: FAIL — `Cannot find module './primitivos'`.

- [ ] **Step 3: Implementar o mínimo**

```ts
import { z } from "zod";

const RE_DATA = /^(\d{1,4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;

/** Aceita AAAA, AAAA-MM ou AAAA-MM-DD. Anos de 1 a 4 dígitos. */
export const DataHistorica = z
  .string()
  .regex(RE_DATA, "data deve ser AAAA, AAAA-MM ou AAAA-MM-DD");

export type DataHistorica = z.infer<typeof DataHistorica>;

/** Ano numérico, para ordenar e comparar independente da granularidade. */
export function anoDe(data: string): number {
  const m = RE_DATA.exec(data);
  if (!m) throw new Error(`data inválida: ${data}`);
  return Number(m[1]);
}

export const Id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "id deve ser minúsculo, sem espaço, separado por hífen");
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/primitivos.test.ts
```

Esperado: PASS, 3 blocos de teste.

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/primitivos.ts lib/conteudo/primitivos.test.ts
git commit -m "feat: data histórica com granularidade variável"
```

---

### Task 3: Fonte

Fonte é a entidade da qual todo o resto depende. É referenciada por id para que a mesma
sentença citada em cinco alegações exista uma vez só.

**Files:**
- Create: `lib/conteudo/fonte.ts`
- Test: `lib/conteudo/fonte.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { Fonte } from "./fonte";

const valida = {
  id: "stf-hc-193726",
  tipo: "decisao-judicial",
  titulo: "HC 193.726 — Segunda Turma",
  publicacao: "Supremo Tribunal Federal",
  data: "2021-03-23",
  url: "https://portal.stf.jus.br/exemplo",
};

describe("Fonte", () => {
  it("aceita uma fonte completa", () => {
    expect(Fonte.safeParse(valida).success).toBe(true);
  });

  it("exige título", () => {
    const r = Fonte.safeParse({ ...valida, titulo: "" });
    expect(r.success).toBe(false);
  });

  it("rejeita tipo fora do enum", () => {
    const r = Fonte.safeParse({ ...valida, tipo: "post-de-twitter" });
    expect(r.success).toBe(false);
  });

  it("rejeita url malformada", () => {
    const r = Fonte.safeParse({ ...valida, url: "portal.stf.jus.br" });
    expect(r.success).toBe(false);
  });

  it("aceita fonte sem url — livro impresso não tem link", () => {
    const { url, ...semUrl } = valida;
    expect(Fonte.safeParse({ ...semUrl, tipo: "livro" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/fonte.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o mínimo**

```ts
import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";

export const TipoFonte = z.enum([
  "decisao-judicial",
  "documento-oficial",
  "livro",
  "artigo-academico",
  "reportagem",
  "dataset",
]);

export const Fonte = z.object({
  id: Id,
  tipo: TipoFonte,
  titulo: z.string().min(1, "fonte precisa de título"),
  autor: z.string().optional(),
  publicacao: z.string().optional(),
  data: DataHistorica.optional(),
  url: z.string().url().optional(),
  citacao: z.string().optional(),
});

export type Fonte = z.infer<typeof Fonte>;
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/fonte.test.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/fonte.ts lib/conteudo/fonte.test.ts
git commit -m "feat: schema de Fonte"
```

---

### Task 4: Alegação — a regra central do projeto

Esta é a tarefa mais importante do plano. O teste de fonte obrigatória é o que sustenta a
promessa editorial descrita na §6 do spec.

**Files:**
- Create: `lib/conteudo/alegacao.ts`
- Test: `lib/conteudo/alegacao.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { Alegacao, StatusAlegacao } from "./alegacao";

const valida = {
  id: "lula-triplex",
  enunciado: "Recebeu o triplex do Guarujá como propina da OAS",
  status: "anulado",
  fontes: ["stf-hc-193726"],
};

describe("Alegacao", () => {
  it("aceita uma alegação com fonte", () => {
    expect(Alegacao.safeParse(valida).success).toBe(true);
  });

  it("REJEITA alegação sem nenhuma fonte", () => {
    const r = Alegacao.safeParse({ ...valida, fontes: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/fonte/i);
    }
  });

  it("REJEITA alegação com o campo fontes ausente", () => {
    const { fontes, ...semFontes } = valida;
    expect(Alegacao.safeParse(semFontes).success).toBe(false);
  });

  it("rejeita status fora do enum", () => {
    const r = Alegacao.safeParse({ ...valida, status: "culpado" });
    expect(r.success).toBe(false);
  });

  it.each([
    "transito-julgado",
    "em-julgamento",
    "investigacao",
    "anulado",
    "prescrito",
    "alegacao-sem-processo",
    "desmentido",
  ])("aceita o status %s", (status) => {
    expect(Alegacao.safeParse({ ...valida, status }).success).toBe(true);
  });

  it("expõe exatamente os 7 status previstos no spec", () => {
    expect(StatusAlegacao.options).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/alegacao.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o mínimo**

```ts
import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";

/**
 * Lista fechada, definida na §6 do spec.
 * As distinções que os campos políticos mais confundem vivem aqui, no rótulo,
 * em vez de diluídas na prosa: anulado ≠ inocentado, prescrito ≠ desmentido.
 */
export const StatusAlegacao = z.enum([
  "transito-julgado",
  "em-julgamento",
  "investigacao",
  "anulado",
  "prescrito",
  "alegacao-sem-processo",
  "desmentido",
]);

export const Alegacao = z.object({
  id: Id,
  enunciado: z.string().min(1, "alegação precisa de enunciado"),
  status: StatusAlegacao,
  /** Ids de Fonte. Nunca vazio — é a promessa editorial do projeto. */
  fontes: z
    .array(Id)
    .min(1, "alegação precisa de ao menos uma fonte"),
  data: DataHistorica.optional(),
  /** Explica por que o status é esse. Ex: por que anulado ≠ inocentado. */
  nota: z.string().optional(),
});

export type Alegacao = z.infer<typeof Alegacao>;
export type StatusAlegacao = z.infer<typeof StatusAlegacao>;
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/alegacao.test.ts
```

Esperado: PASS, incluindo os 7 casos de status.

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/alegacao.ts lib/conteudo/alegacao.test.ts
git commit -m "feat: alegação com status fechado e fonte obrigatória"
```

---

### Task 5: Figura, Período e País

**Files:**
- Create: `lib/conteudo/figura.ts`, `lib/conteudo/pais.ts`
- Test: `lib/conteudo/figura.test.ts`, `lib/conteudo/pais.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

`lib/conteudo/pais.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Pais, Periodo } from "./pais";

const periodo = {
  id: "br-republica-nova",
  inicio: "1985",
  fim: "1989",
  rotulo: "Nova República",
  regime: "democracia presidencialista",
};

describe("Periodo", () => {
  it("aceita um período fechado", () => {
    expect(Periodo.safeParse(periodo).success).toBe(true);
  });

  it("aceita período aberto — o atual não tem fim", () => {
    const { fim, ...aberto } = periodo;
    expect(Periodo.safeParse(aberto).success).toBe(true);
  });

  it("REJEITA período que termina antes de começar", () => {
    const r = Periodo.safeParse({ ...periodo, inicio: "1989", fim: "1985" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/antes/i);
  });

  it("aceita ano de três dígitos", () => {
    expect(
      Periodo.safeParse({ ...periodo, inicio: "843", fim: "987" }).success
    ).toBe(true);
  });
});

describe("Pais", () => {
  it("aceita país com períodos", () => {
    const r = Pais.safeParse({
      iso: "BRA",
      nome: "Brasil",
      periodos: [periodo],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita iso fora do formato de 3 letras maiúsculas", () => {
    const r = Pais.safeParse({ iso: "br", nome: "Brasil", periodos: [periodo] });
    expect(r.success).toBe(false);
  });

  it("REJEITA país sem nenhum período — país sem retrato não existe no atlas", () => {
    const r = Pais.safeParse({ iso: "BRA", nome: "Brasil", periodos: [] });
    expect(r.success).toBe(false);
  });
});
```

`lib/conteudo/figura.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Figura } from "./figura";

const valida = {
  id: "lula",
  nome: "Luiz Inácio Lula da Silva",
  paisIso: "BRA",
  cargos: [{ titulo: "Presidente", inicio: "2003", fim: "2010" }],
  alegacoes: [
    {
      id: "lula-triplex",
      enunciado: "Recebeu o triplex do Guarujá como propina da OAS",
      status: "anulado",
      fontes: ["stf-hc-193726"],
    },
  ],
};

describe("Figura", () => {
  it("aceita figura completa", () => {
    expect(Figura.safeParse(valida).success).toBe(true);
  });

  it("aceita figura sem alegações", () => {
    expect(Figura.safeParse({ ...valida, alegacoes: [] }).success).toBe(true);
  });

  it("propaga a exigência de fonte para as alegações aninhadas", () => {
    const r = Figura.safeParse({
      ...valida,
      alegacoes: [{ ...valida.alegacoes[0], fontes: [] }],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

```bash
pnpm test lib/conteudo/pais.test.ts lib/conteudo/figura.test.ts
```

Esperado: FAIL nos dois — módulos não encontrados.

- [ ] **Step 3: Implementar o mínimo**

`lib/conteudo/pais.ts`:

```ts
import { z } from "zod";
import { DataHistorica, Id, anoDe } from "./primitivos";

export const Periodo = z
  .object({
    id: Id,
    inicio: DataHistorica,
    /** Ausente significa período em curso. */
    fim: DataHistorica.optional(),
    /** Nome da entidade política na época. Ex: "Reino da Inglaterra". */
    rotulo: z.string().min(1),
    regime: z.string().min(1),
    textoMdx: z.string().optional(),
  })
  .refine((p) => !p.fim || anoDe(p.fim) >= anoDe(p.inicio), {
    message: "período não pode terminar antes de começar",
    path: ["fim"],
  });

export const Pais = z.object({
  iso: z.string().regex(/^[A-Z]{3}$/, "iso deve ter 3 letras maiúsculas"),
  nome: z.string().min(1),
  periodos: z.array(Periodo).min(1, "país precisa de ao menos um período"),
});

export type Periodo = z.infer<typeof Periodo>;
export type Pais = z.infer<typeof Pais>;
```

`lib/conteudo/figura.ts`:

```ts
import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";
import { Alegacao } from "./alegacao";

export const Cargo = z.object({
  titulo: z.string().min(1),
  inicio: DataHistorica,
  fim: DataHistorica.optional(),
});

export const Figura = z.object({
  id: Id,
  nome: z.string().min(1),
  paisIso: z.string().regex(/^[A-Z]{3}$/),
  cargos: z.array(Cargo).default([]),
  alegacoes: z.array(Alegacao).default([]),
  textoMdx: z.string().optional(),
});

export type Figura = z.infer<typeof Figura>;
```

- [ ] **Step 4: Rodar e confirmar que passam**

```bash
pnpm test lib/conteudo/
```

Esperado: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/pais.ts lib/conteudo/pais.test.ts lib/conteudo/figura.ts lib/conteudo/figura.test.ts
git commit -m "feat: schemas de País, Período e Figura"
```

---

### Task 6: Viagem com paradas datadas

A rota é derivada das paradas, nunca digitada. Como cada parada tem data, o cliente consegue
desenhar a rota até onde a frota havia chegado (§8 do spec).

**Files:**
- Create: `lib/conteudo/viagem.ts`
- Test: `lib/conteudo/viagem.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { Viagem, coordenadasDe } from "./viagem";

const cabral = {
  id: "cabral-1500",
  titulo: "Frota de Cabral",
  paradas: [
    { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
    { local: "Porto Seguro", data: "1500-04-22", coords: [-39.06, -16.45] },
  ],
};

describe("Viagem", () => {
  it("aceita viagem com paradas", () => {
    expect(Viagem.safeParse(cabral).success).toBe(true);
  });

  it("REJEITA viagem com menos de duas paradas — não é percurso", () => {
    const r = Viagem.safeParse({ ...cabral, paradas: [cabral.paradas[0]] });
    expect(r.success).toBe(false);
  });

  it("REJEITA paradas fora de ordem cronológica", () => {
    const r = Viagem.safeParse({
      ...cabral,
      paradas: [cabral.paradas[1], cabral.paradas[0]],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/cronol/i);
  });

  it.each([
    [[-181, 0], "longitude abaixo do limite"],
    [[0, 91], "latitude acima do limite"],
  ])("rejeita coordenada inválida %s", (coords) => {
    const r = Viagem.safeParse({
      ...cabral,
      paradas: [{ ...cabral.paradas[0], coords }, cabral.paradas[1]],
    });
    expect(r.success).toBe(false);
  });

  it("deriva a lista de coordenadas na ordem das paradas", () => {
    expect(coordenadasDe(cabral)).toEqual([
      [-9.14, 38.72],
      [-39.06, -16.45],
    ]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/viagem.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o mínimo**

```ts
import { z } from "zod";
import { DataHistorica, Id, anoDe } from "./primitivos";

/** [longitude, latitude] — ordem GeoJSON, que é a que o d3-geo espera. */
export const Coordenada = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const Parada = z.object({
  local: z.string().min(1),
  data: DataHistorica,
  coords: Coordenada,
  textoMdx: z.string().optional(),
});

export const Viagem = z
  .object({
    id: Id,
    titulo: z.string().min(1),
    paradas: z.array(Parada).min(2, "viagem precisa de ao menos duas paradas"),
    fontes: z.array(Id).default([]),
  })
  .refine(
    (v) =>
      v.paradas.every(
        (p, i) => i === 0 || anoDe(p.data) >= anoDe(v.paradas[i - 1].data)
      ),
    { message: "paradas devem estar em ordem cronológica", path: ["paradas"] }
  );

export type Viagem = z.infer<typeof Viagem>;
export type Parada = z.infer<typeof Parada>;

/** Coordenadas na ordem das paradas — vira o LineString do geoPath. */
export function coordenadasDe(v: Viagem): [number, number][] {
  return v.paradas.map((p) => p.coords);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/viagem.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/viagem.ts lib/conteudo/viagem.test.ts
git commit -m "feat: viagem com paradas datadas e ordem cronológica"
```

---

## Chunk 2: Carregamento e integridade

### Task 7: Integridade referencial

Cada schema valida a si mesmo, mas ninguém verifica se `fontes: ["stf-hc-193726"]` aponta para
uma fonte que existe. Sem esta tarefa, a regra de fonte obrigatória é contornável digitando um
id inventado — o que anularia toda a garantia.

**Files:**
- Create: `lib/conteudo/integridade.ts`
- Test: `lib/conteudo/integridade.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { verificarIntegridade } from "./integridade";

const base = {
  fontes: [
    { id: "stf-hc-193726", tipo: "decisao-judicial" as const, titulo: "HC 193.726" },
  ],
  paises: [
    { iso: "BRA", nome: "Brasil", periodos: [
      { id: "br-atual", inicio: "1985", rotulo: "Nova República", regime: "democracia" },
    ] },
  ],
  figuras: [
    { id: "lula", nome: "Lula", paisIso: "BRA", cargos: [], alegacoes: [
      { id: "lula-triplex", enunciado: "...", status: "anulado" as const, fontes: ["stf-hc-193726"] },
    ] },
  ],
  viagens: [],
};

describe("verificarIntegridade", () => {
  it("não acusa nada quando tudo referencia corretamente", () => {
    expect(verificarIntegridade(base)).toEqual([]);
  });

  it("ACUSA alegação que cita fonte inexistente", () => {
    const dados = structuredClone(base);
    dados.figuras[0].alegacoes[0].fontes = ["fonte-que-nao-existe"];
    const erros = verificarIntegridade(dados);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/fonte-que-nao-existe/);
    expect(erros[0]).toMatch(/lula-triplex/);
  });

  it("ACUSA figura de país que não está no atlas", () => {
    const dados = structuredClone(base);
    dados.figuras[0].paisIso = "ARG";
    const erros = verificarIntegridade(dados);
    expect(erros.some((e) => /ARG/.test(e))).toBe(true);
  });

  it("ACUSA ids de fonte duplicados", () => {
    const dados = structuredClone(base);
    dados.fontes.push({ ...dados.fontes[0] });
    expect(verificarIntegridade(dados).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("acumula todos os erros em vez de parar no primeiro", () => {
    const dados = structuredClone(base);
    dados.figuras[0].alegacoes[0].fontes = ["inexistente-a", "inexistente-b"];
    expect(verificarIntegridade(dados)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/integridade.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o mínimo**

```ts
import type { Fonte } from "./fonte";
import type { Figura } from "./figura";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";

export interface Acervo {
  fontes: Fonte[];
  paises: Pais[];
  figuras: Figura[];
  viagens: Viagem[];
}

function duplicados(ids: string[]): string[] {
  const vistos = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) dup.add(id);
    vistos.add(id);
  }
  return [...dup];
}

/**
 * Checagens que nenhum schema isolado consegue fazer, por cruzarem arquivos.
 * Retorna todos os erros — não para no primeiro, para que uma rodada mostre
 * tudo que precisa ser corrigido.
 */
export function verificarIntegridade(acervo: Acervo): string[] {
  const erros: string[] = [];

  const idsFonte = new Set(acervo.fontes.map((f) => f.id));
  const isoPaises = new Set(acervo.paises.map((p) => p.iso));

  for (const id of duplicados(acervo.fontes.map((f) => f.id))) {
    erros.push(`fonte com id duplicado: ${id}`);
  }
  for (const id of duplicados(acervo.figuras.map((f) => f.id))) {
    erros.push(`figura com id duplicado: ${id}`);
  }

  for (const figura of acervo.figuras) {
    if (!isoPaises.has(figura.paisIso)) {
      erros.push(
        `figura "${figura.id}" referencia país ${figura.paisIso}, que não está no atlas`
      );
    }
    for (const alegacao of figura.alegacoes) {
      for (const fonteId of alegacao.fontes) {
        if (!idsFonte.has(fonteId)) {
          erros.push(
            `alegação "${alegacao.id}" cita fonte inexistente: ${fonteId}`
          );
        }
      }
    }
  }

  for (const viagem of acervo.viagens) {
    for (const fonteId of viagem.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`viagem "${viagem.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
  }

  return erros;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/integridade.test.ts
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/integridade.ts lib/conteudo/integridade.test.ts
git commit -m "feat: integridade referencial entre arquivos de conteúdo"
```

---

### Task 8: Loader

Lê `conteudo/` do disco e devolve um `Acervo` tipado, ou lança com mensagem que aponta o
arquivo culpado.

**Files:**
- Create: `lib/conteudo/carregar.ts`
- Test: `lib/conteudo/carregar.test.ts`
- Create: fixtures em `lib/conteudo/__fixtures__/`

- [ ] **Step 1: Criar as fixtures**

`lib/conteudo/__fixtures__/valido/fontes/fontes.json`:

```json
[
  {
    "id": "ibge-pnad",
    "tipo": "dataset",
    "titulo": "PNAD Contínua",
    "publicacao": "IBGE"
  }
]
```

`lib/conteudo/__fixtures__/valido/paises/brasil.json`:

```json
{
  "iso": "BRA",
  "nome": "Brasil",
  "periodos": [
    {
      "id": "br-nova-republica",
      "inicio": "1985",
      "rotulo": "Nova República",
      "regime": "democracia presidencialista"
    }
  ]
}
```

`lib/conteudo/__fixtures__/quebrado/fontes/fontes.json`: mesmo conteúdo do válido.

`lib/conteudo/__fixtures__/quebrado/paises/brasil.json`:

```json
{
  "iso": "br",
  "nome": "Brasil",
  "periodos": []
}
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { carregarAcervo } from "./carregar";

const fixture = (nome: string) =>
  path.join(__dirname, "__fixtures__", nome);

describe("carregarAcervo", () => {
  it("carrega um acervo válido", async () => {
    const acervo = await carregarAcervo(fixture("valido"));
    expect(acervo.paises).toHaveLength(1);
    expect(acervo.paises[0].nome).toBe("Brasil");
    expect(acervo.fontes[0].id).toBe("ibge-pnad");
  });

  it("lança apontando o arquivo quando o schema não bate", async () => {
    await expect(carregarAcervo(fixture("quebrado"))).rejects.toThrow(
      /brasil\.json/
    );
  });

  it("devolve coleções vazias para diretórios ausentes", async () => {
    const acervo = await carregarAcervo(fixture("valido"));
    expect(acervo.viagens).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/carregar.test.ts
```

Esperado: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o mínimo**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { Fonte } from "./fonte";
import { Figura } from "./figura";
import { Pais } from "./pais";
import { Viagem } from "./viagem";
import type { Acervo } from "./integridade";

async function lerJsonDoDiretorio<T extends z.ZodTypeAny>(
  dir: string,
  schema: T
): Promise<z.infer<T>[]> {
  let arquivos: string[];
  try {
    arquivos = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // diretório ausente é coleção vazia, não erro
  }

  const itens: z.infer<T>[] = [];
  for (const arquivo of arquivos.sort()) {
    const caminho = path.join(dir, arquivo);
    const bruto = JSON.parse(await fs.readFile(caminho, "utf8"));
    const lista = Array.isArray(bruto) ? bruto : [bruto];

    for (const item of lista) {
      const r = schema.safeParse(item);
      if (!r.success) {
        const detalhe = r.error.issues
          .map((i) => `  ${i.path.join(".") || "(raiz)"}: ${i.message}`)
          .join("\n");
        throw new Error(`conteúdo inválido em ${arquivo}\n${detalhe}`);
      }
      itens.push(r.data);
    }
  }
  return itens;
}

export async function carregarAcervo(raiz: string): Promise<Acervo> {
  const [fontes, paises, figuras, viagens] = await Promise.all([
    lerJsonDoDiretorio(path.join(raiz, "fontes"), Fonte),
    lerJsonDoDiretorio(path.join(raiz, "paises"), Pais),
    lerJsonDoDiretorio(path.join(raiz, "figuras"), Figura),
    lerJsonDoDiretorio(path.join(raiz, "viagens"), Viagem),
  ]);
  return { fontes, paises, figuras, viagens };
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/carregar.test.ts
```

Esperado: PASS, 3 testes.

- [ ] **Step 6: Commit**

```bash
git add lib/conteudo/carregar.ts lib/conteudo/carregar.test.ts lib/conteudo/__fixtures__
git commit -m "feat: loader de conteúdo com erro apontando o arquivo"
```

---

### Task 9: O validador que quebra o build

**Files:**
- Create: `scripts/validar-conteudo.ts`
- Modify: `package.json` (script `build`)

- [ ] **Step 1: Escrever o script**

```ts
#!/usr/bin/env tsx
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import { verificarIntegridade } from "../lib/conteudo/integridade";

async function main() {
  const raiz = path.join(process.cwd(), "conteudo");

  let acervo;
  try {
    acervo = await carregarAcervo(raiz);
  } catch (e) {
    console.error("\n✗ conteúdo inválido\n");
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const erros = verificarIntegridade(acervo);
  if (erros.length > 0) {
    console.error(`\n✗ ${erros.length} problema(s) de integridade\n`);
    for (const erro of erros) console.error(`  • ${erro}`);
    console.error("");
    process.exit(1);
  }

  console.log(
    `✓ conteúdo válido — ${acervo.paises.length} países, ` +
      `${acervo.figuras.length} figuras, ${acervo.fontes.length} fontes, ` +
      `${acervo.viagens.length} viagens`
  );
}

main();
```

- [ ] **Step 2: Ligar o validador ao build**

Em `package.json`, trocar o script `build`:

```json
"build": "tsx scripts/validar-conteudo.ts && next build"
```

Agora conteúdo inválido impede o deploy. É o mecanismo descrito na §10 do spec.

- [ ] **Step 3: Verificar que falha quando deve**

Criar temporariamente `conteudo/figuras/quebrada.json`:

```json
{
  "id": "teste",
  "nome": "Teste",
  "paisIso": "BRA",
  "cargos": [],
  "alegacoes": [
    { "id": "sem-fonte", "enunciado": "Afirmação grave sem lastro", "status": "em-julgamento", "fontes": [] }
  ]
}
```

```bash
pnpm validar
```

Esperado: sai com código 1, mensagem citando `quebrada.json` e "alegação precisa de ao menos
uma fonte".

Confirmar o código de saída:

```bash
pnpm validar; echo "exit=$?"
```

Esperado: `exit=1`.

Depois apagar o arquivo:

```bash
rm conteudo/figuras/quebrada.json
```

- [ ] **Step 4: Commit**

```bash
git add scripts/validar-conteudo.ts package.json
git commit -m "feat: validador de conteúdo bloqueando o build"
```

---

### Task 10: Conteúdo semente

Um acervo mínimo, real e verificado, que passa na validação. Serve de referência viva de
formato para todo o conteúdo futuro.

**Files:**
- Create: `conteudo/fontes/fontes.json`, `conteudo/paises/brasil.json`,
  `conteudo/paises/franca.json`, `conteudo/viagens/cabral-1500.json`

- [ ] **Step 1: Escrever o conteúdo semente**

Preencher com dados **verificados na fonte primária**. Não inventar id de decisão judicial,
número de processo nem data.

Escopo mínimo: 2 países (Brasil, França) com 1 período cada, 1 viagem (Cabral), e as fontes
que sustentam o que for afirmado.

> **Alegações ficam fora da semente.** Elas exigem checagem processual caso a caso, e o
> andamento dos casos brasileiros mudou recentemente. Entram depois, uma a uma, com a fonte
> conferida na hora. O schema já está pronto e testado — é só o dado que precisa de cuidado.

- [ ] **Step 2: Validar**

```bash
pnpm validar
```

Esperado: `✓ conteúdo válido — 2 países, 0 figuras, N fontes, 1 viagens`

- [ ] **Step 3: Rodar a suíte inteira**

```bash
pnpm test
```

Esperado: PASS em todos os arquivos.

- [ ] **Step 4: Build completo**

```bash
pnpm build
```

Esperado: validador passa, depois Next.js compila.

- [ ] **Step 5: Commit**

```bash
git add conteudo/
git commit -m "feat: conteúdo semente com Brasil, França e a viagem de Cabral"
```

---

## Critério de conclusão

O plano está completo quando:

- [ ] `pnpm test` passa inteiro
- [ ] `pnpm build` roda o validador antes do Next.js
- [ ] Uma alegação sem fonte **quebra o build**, com mensagem citando o arquivo
- [ ] Um id de fonte inventado **quebra o build**
- [ ] `conteudo/` tem exemplo real de cada entidade implementada

O último item é o mais importante para o que vem depois: o plano 2 (globo) vai consumir o
`Acervo` deste plano, e precisa de dado real para renderizar.

---

## Fora deste plano

Indicadores e CSV, MDX e prosa, e qualquer renderização. Indicadores foram deixados para o
plano 4, junto do componente que os desenha — o parser de CSV sem o gráfico não entrega nada
verificável, e o formato pode mudar quando o gráfico existir.
