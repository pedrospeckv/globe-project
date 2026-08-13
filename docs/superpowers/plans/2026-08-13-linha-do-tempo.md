# Linha do Tempo — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma barra de tempo global que governa o que o globo mostra — acendendo só os países que existiam naquele momento e desenhando a rota até onde a frota havia chegado.

**Architecture:** O tempo entra no estado do `<Atlas>` como **ano fracionário** (1500,31 ≈ abril de 1500), convertido para `DataHistorica` na hora de comparar. A barra opera em dois níveis: por padrão cobre o acervo inteiro; ao selecionar uma viagem, estreita para o intervalo dela. GSAP conduz o play automático.

**Tech Stack:** as mesmas do plano 2 — nada novo entra.

**Spec:** `docs/superpowers/specs/2026-08-13-atlas-design.md`
**Planos anteriores:** fundação de conteúdo e globo/mapa. `rotaAte()` já existe e está testada, esperando ser ligada.

---

## Contexto que o executor precisa

### O problema de escala, e por que a barra tem dois níveis

A França começa em 843. O Cabral navega de 9 de março a 24 de abril de **1500** — 46 dias. Numa barra linear de 843 até hoje, isso é 0,01% da largura: menos de um pixel. A rota se desenhando, que é o motivo deste plano existir, seria invisível.

Por isso a barra tem **domínio variável**:

- **Padrão:** do início do período mais antigo até hoje. Serve para navegar entre eras.
- **Viagem selecionada:** só o intervalo da viagem, com folga. Os 46 dias do Cabral passam a ocupar a barra inteira.

Não é enfeite — sem isso a funcionalidade principal do plano não é perceptível.

### Ano fracionário

O estado do tempo é um `number`, não uma string. `1500,31` significa "por volta de abril de 1500". Isso torna o arrasto contínuo e a interpolação trivial. A conversão para `DataHistorica` acontece só na fronteira, quando é hora de comparar com as datas do conteúdo.

Precisão de dia não importa aqui: é um controle de navegação, não um calendário. Uma aproximação de 365 dias é suficiente e explicitamente aceita.

### O que a barra governa

1. **Rota** — `rotaAte(viagem, data)` já faz o corte; é só passar a data.
2. **Países acesos** — um país só acende se tiver um período cobrindo aquele instante. Em 843 o Brasil não existe, e o globo deve dizer isso. **É a expressão visual da decisão país × período**, a ideia estruturante de todo o projeto.

O item 2 é o mais importante do plano. Ele transforma o globo de "mapa com países marcados" em "retrato do mundo naquele momento".

### Decisões já tomadas — não revisitar

- Tempo é ano fracionário no estado, `DataHistorica` na comparação.
- Aceso significa "tem período cobrindo esta data" — não a lista fixa dos 9.
- GSAP conduz o play; não escrever `setInterval`.

Use @superpowers:test-driven-development nas tarefas 1 e 2, que são lógica pura.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/conteudo/tempo.ts` | ano fracionário ↔ `DataHistorica`; período vigente; intervalos |
| `components/atlas/TimeScrubber.tsx` | a barra: arrastar, play/pause, rótulo |
| `components/atlas/Atlas.tsx` | passa a possuir `tempo` e `dominio` (modificado) |
| `components/atlas/GeoOverlay.tsx` | recebe rotas já cortadas (modificado) |

---

## Chunk 1: Lógica do tempo

### Task 1: Conversão e período vigente

**Files:**
- Create: `lib/conteudo/tempo.ts`
- Test: `lib/conteudo/tempo.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import {
  dataDeAnoFracionario,
  anoFracionarioDe,
  periodoVigente,
  intervaloDoAcervo,
  intervaloDaViagem,
  rotuloDeAno,
} from "./tempo";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";

const brasil: Pais = {
  iso: "BRA",
  nome: "Brasil",
  periodos: [
    { id: "br-colonia", inicio: "1500", fim: "1822", rotulo: "Colônia", regime: "x" },
    { id: "br-imperio", inicio: "1822", fim: "1889", rotulo: "Império", regime: "x" },
    { id: "br-nova", inicio: "1985", rotulo: "Nova República", regime: "x" },
  ],
};

const cabral: Viagem = {
  id: "cabral-1500",
  titulo: "Frota de Cabral",
  fontes: [],
  paradas: [
    { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
    { local: "Porto Seguro", data: "1500-04-24", coords: [-39.06, -16.45] },
  ],
};

describe("dataDeAnoFracionario", () => {
  it("ano inteiro vira 1º de janeiro", () => {
    expect(dataDeAnoFracionario(1500)).toBe("1500-01-01");
  });

  it("meio do ano cai por volta de julho", () => {
    const d = dataDeAnoFracionario(1500.5);
    expect(d.startsWith("1500-07")).toBe(true);
  });

  it("cobre março e abril de forma distinta — o caso do Cabral", () => {
    const marco = dataDeAnoFracionario(1500 + 68 / 365);
    const abril = dataDeAnoFracionario(1500 + 114 / 365);
    expect(marco.slice(0, 7)).toBe("1500-03");
    expect(abril.slice(0, 7)).toBe("1500-04");
  });

  it("preserva ano de três dígitos", () => {
    expect(dataDeAnoFracionario(843)).toBe("843-01-01");
  });

  it("faz o caminho de volta aproximadamente", () => {
    expect(anoFracionarioDe("1500-01-01")).toBeCloseTo(1500, 2);
    expect(anoFracionarioDe("1500")).toBeCloseTo(1500, 2);
  });
});

describe("periodoVigente", () => {
  it("acha o período que cobre a data", () => {
    expect(periodoVigente(brasil, 1600)?.id).toBe("br-colonia");
    expect(periodoVigente(brasil, 1850)?.id).toBe("br-imperio");
  });

  it("período aberto cobre tudo dali em diante", () => {
    expect(periodoVigente(brasil, 2026)?.id).toBe("br-nova");
  });

  it("devolve null ANTES de o país existir", () => {
    // Em 843 o Brasil não existe — e o globo precisa dizer isso.
    expect(periodoVigente(brasil, 843)).toBeNull();
  });

  it("devolve null em lacuna entre períodos", () => {
    expect(periodoVigente(brasil, 1950)).toBeNull();
  });

  it("na virada, o período que começa vence o que termina", () => {
    expect(periodoVigente(brasil, 1822)?.id).toBe("br-imperio");
  });
});

describe("intervaloDoAcervo", () => {
  it("vai do período mais antigo até hoje", () => {
    const [ini, fim] = intervaloDoAcervo([brasil]);
    expect(ini).toBe(1500);
    expect(fim).toBeGreaterThanOrEqual(2026);
  });

  it("devolve intervalo utilizável para acervo vazio", () => {
    const [ini, fim] = intervaloDoAcervo([]);
    expect(fim).toBeGreaterThan(ini);
  });
});

describe("intervaloDaViagem", () => {
  it("cobre a viagem com folga nos dois lados", () => {
    const [ini, fim] = intervaloDaViagem(cabral);
    expect(ini).toBeLessThan(anoFracionarioDe("1500-03-09"));
    expect(fim).toBeGreaterThan(anoFracionarioDe("1500-04-24"));
  });

  it("é MUITO mais estreito que o acervo — senão a rota é invisível", () => {
    const [vi, vf] = intervaloDaViagem(cabral);
    const [ai, af] = intervaloDoAcervo([brasil]);
    expect(vf - vi).toBeLessThan((af - ai) / 10);
  });
});

describe("rotuloDeAno", () => {
  it("mostra só o ano em escala longa", () => {
    expect(rotuloDeAno(1500.4, 900)).toBe("1500");
  });

  it("mostra mês e ano em escala curta", () => {
    expect(rotuloDeAno(1500 + 68 / 365, 1)).toMatch(/mar.*1500/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test lib/conteudo/tempo.test.ts
```

- [ ] **Step 3: Implementar**

```ts
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
  const diasAntes = DIAS_POR_MES.slice(0, Math.max(0, mes - 1)).reduce((a, b) => a + b, 0);
  const diaDoAno = diasAntes + Math.max(0, dia - 1);
  return ano + diaDoAno / 365;
}

/**
 * Período do país vigente naquele instante, ou null se o país não existia.
 *
 * O null é a parte importante: é o que faz o globo apagar o Brasil em 843, em
 * vez de fingir que ele sempre esteve lá.
 */
export function periodoVigente(pais: Pais, anoFrac: number): Periodo | null {
  const alvo = anoFrac;
  let achado: Periodo | null = null;

  for (const p of pais.periodos) {
    const ini = anoFracionarioDe(p.inicio);
    const fim = p.fim === undefined ? Infinity : anoFracionarioDe(p.fim);
    if (alvo >= ini && alvo <= fim) {
      // Na virada, o período que COMEÇA vence o que termina.
      if (!achado || ini > anoFracionarioDe(achado.inicio)) achado = p;
    }
  }

  return achado;
}

/** Do período mais antigo do acervo até hoje. */
export function intervaloDoAcervo(paises: Pais[]): [number, number] {
  const hoje = new Date().getFullYear() + 1;
  const inicios = paises.flatMap((p) => p.periodos.map((x) => anoFracionarioDe(x.inicio)));
  if (inicios.length === 0) return [1900, hoje];
  return [Math.floor(Math.min(...inicios)), hoje];
}

/** Intervalo da viagem, com folga de 20% em cada lado. */
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
pnpm test lib/conteudo/tempo.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/conteudo/tempo.ts lib/conteudo/tempo.test.ts
git commit -m "feat: ano fracionário, período vigente e intervalos da barra"
```

---

## Chunk 2: A barra e a ligação

### Task 2: TimeScrubber

**Files:** Create: `components/atlas/TimeScrubber.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { rotuloDeAno } from "@/lib/conteudo/tempo";

interface Props {
  valor: number;
  dominio: [number, number];
  onChange: (v: number) => void;
  /** Marcas opcionais — inícios de período, paradas de viagem. */
  marcas?: { pos: number; rotulo: string }[];
}

export function TimeScrubber({ valor, dominio, onChange, marcas = [] }: Props) {
  const [ini, fim] = dominio;
  const amplitude = fim - ini;
  const pct = ((valor - ini) / amplitude) * 100;

  const tocando = useRef<gsap.core.Tween | null>(null);
  useEffect(() => () => void tocando.current?.kill(), []);

  const tocar = useCallback(() => {
    tocando.current?.kill();
    const partida = valor >= fim - amplitude * 0.01 ? ini : valor;
    const alvo = { v: partida };
    tocando.current = gsap.to(alvo, {
      v: fim,
      duration: 6,
      ease: "none",
      onUpdate: () => onChange(alvo.v),
    });
  }, [valor, ini, fim, amplitude, onChange]);

  const parar = useCallback(() => tocando.current?.kill(), []);

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-lg text-amber-400">
          {rotuloDeAno(valor, amplitude)}
        </span>
        <div className="flex gap-2 text-xs">
          <button
            onClick={tocar}
            className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
          >
            Reproduzir
          </button>
          <button
            onClick={parar}
            className="rounded border border-slate-600 px-2 py-1 hover:bg-slate-800"
          >
            Pausar
          </button>
        </div>
      </div>

      <div className="relative py-3">
        <div className="h-1 rounded bg-slate-700">
          <div className="h-1 rounded bg-amber-500" style={{ width: `${pct}%` }} />
        </div>

        {marcas.map((m) => (
          <span
            key={`${m.pos}-${m.rotulo}`}
            title={m.rotulo}
            className="absolute top-1.5 h-4 w-px bg-sky-400/70"
            style={{ left: `${((m.pos - ini) / amplitude) * 100}%` }}
          />
        ))}

        <input
          type="range"
          min={ini}
          max={fim}
          step={amplitude / 1000}
          value={valor}
          onChange={(e) => {
            parar();
            onChange(Number(e.target.value));
          }}
          className="absolute inset-x-0 top-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Linha do tempo"
        />

        <span
          className="pointer-events-none absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between font-mono text-[10px] text-slate-500">
        <span>{Math.floor(ini)}</span>
        <span>{Math.floor(fim)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/atlas/TimeScrubber.tsx
git commit -m "feat: barra de tempo com play via GSAP"
```

---

### Task 3: Ligar o tempo ao globo

**Files:** Modify: `components/atlas/Atlas.tsx`, `components/atlas/GeoOverlay.tsx`

- [ ] **Step 1: Atlas passa a possuir tempo e domínio**

Adicionar ao estado:

```tsx
const [paises] = useState(() => paisesDoAcervo);          // vem por prop
const dominioAcervo = useMemo(() => intervaloDoAcervo(paises), [paises]);
const [viagemFoco, setViagemFoco] = useState<string | null>(null);

const dominio = useMemo(() => {
  const v = viagens.find((x) => x.id === viagemFoco);
  return v ? intervaloDaViagem(v) : dominioAcervo;
}, [viagemFoco, viagens, dominioAcervo]);

const [tempo, setTempo] = useState(dominioAcervo[1]);
```

Ao trocar de domínio, recolocar o tempo dentro dele:

```tsx
useEffect(() => {
  setTempo((t) => Math.min(Math.max(t, dominio[0]), dominio[1]));
}, [dominio]);
```

- [ ] **Step 2: Países acesos passam a depender do tempo**

Substituir o cálculo de `acesos`:

```tsx
const acesos = useMemo(
  () =>
    paises
      .filter((p) => periodoVigente(p, tempo) !== null)
      .map((p) => p.iso)
      .filter((iso): iso is Alpha3 => iso in ISO_NUMERICO),
  [paises, tempo]
);
```

**É a linha mais importante do plano.** Em 843 o Brasil apaga; em 1500 acende. O globo passa a ser o retrato do mundo naquele instante.

- [ ] **Step 3: Rotas passam a ser cortadas pela data**

```tsx
const dataAtual = useMemo(() => dataDeAnoFracionario(tempo), [tempo]);

const rotas = useMemo(
  () => viagens.map((v) => rotaAte(v, dataAtual)).filter((r): r is RotaFeature => r !== null),
  [viagens, dataAtual]
);
```

- [ ] **Step 4: Montar a barra abaixo do globo**

```tsx
<TimeScrubber
  valor={tempo}
  dominio={dominio}
  onChange={setTempo}
  marcas={marcas}
/>

<div className="flex gap-2 text-xs">
  {viagens.map((v) => (
    <button
      key={v.id}
      onClick={() => setViagemFoco(viagemFoco === v.id ? null : v.id)}
      className={`rounded border px-2 py-1 ${
        viagemFoco === v.id
          ? "border-amber-500 text-amber-400"
          : "border-slate-600 text-slate-400"
      }`}
    >
      {v.titulo}
    </button>
  ))}
</div>
```

O botão da viagem estreita o domínio — é o que torna os 46 dias do Cabral navegáveis.

- [ ] **Step 5: Passar os países pela página**

Em `app/page.tsx`, trocar `paisesComConteudo` por `paises={acervo.paises}`, e ajustar as props do `Atlas`.

- [ ] **Step 6: Verificar no navegador**

```bash
pnpm dev
```

Roteiro de verificação:

1. Arrastar a barra para **900** → o globo fica só com a França acesa; o Brasil apaga
2. Arrastar para **1600** → os dois acendem
3. Clicar em **Frota de Cabral** → a barra estreita para 1500; o rótulo passa a mostrar mês
4. Arrastar dentro de 1500 → **a rota cresce parada a parada**
5. **Reproduzir** → a rota se desenha sozinha

Se o passo 4 não mostrar crescimento gradual, o problema está no domínio, não no `rotaAte` — ele já tem teste.

- [ ] **Step 7: Rodar tudo e commitar**

```bash
pnpm test && pnpm build
git add components/atlas/ app/page.tsx
git commit -m "feat: tempo governando países acesos e desenho da rota"
```

---

## Critério de conclusão

- [ ] `pnpm test` e `pnpm build` passam
- [ ] Em 900 só a França está acesa; em 1600, França e Brasil
- [ ] Selecionar a viagem estreita a barra e o rótulo passa a mostrar mês
- [ ] A rota cresce parada a parada ao arrastar dentro de 1500
- [ ] "Reproduzir" anima o tempo e a rota se desenha sozinha

---

## Fora deste plano

DrawSVG para suavizar o traço entre paradas — hoje a rota cresce em degraus, uma parada por vez, que já comunica a ideia. Páginas de país e dossiê (plano 4). Trocar o retrato do país conforme o período exige a página de país, então também fica para o plano 4.
