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
  const pct = amplitude === 0 ? 0 : ((valor - ini) / amplitude) * 100;

  const tocando = useRef<gsap.core.Tween | null>(null);
  useEffect(() => () => void tocando.current?.kill(), []);

  /**
   * Escala longa anda de ano em ano; escala curta é contínua.
   *
   * O `step` precisa ser 1 — não `amplitude/1000` — porque o navegador ancora
   * os passos em `min`. Com passo fracionário, nenhuma posição cai num ano
   * inteiro: pedir 1400 entrega 1399,48, e arredondar depois não recupera o
   * ano perdido. Num atlas histórico, o rótulo e a lógica de período precisam
   * concordar com o que o usuário pediu.
   */
  const passo = amplitude > 5 ? 1 : amplitude / 1000;
  const normalizar = useCallback(
    (v: number) => (amplitude > 5 ? Math.round(v) : v),
    [amplitude]
  );

  const parar = useCallback(() => {
    tocando.current?.kill();
    tocando.current = null;
  }, []);

  const tocar = useCallback(() => {
    parar();
    // Se já está no fim, recomeça — senão o botão não faria nada.
    const partida = valor >= fim - amplitude * 0.01 ? ini : valor;
    const alvo = { v: partida };
    tocando.current = gsap.to(alvo, {
      v: fim,
      duration: 6,
      ease: "none",
      onUpdate: () => onChange(normalizar(alvo.v)),
    });
  }, [valor, ini, fim, amplitude, onChange, parar, normalizar]);

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-lg text-amber-400">
          {rotuloDeAno(valor, amplitude)}
        </span>
        <div className="flex gap-2 text-xs">
          <button
            onClick={tocar}
            className="rounded border border-slate-600 px-2 py-1 text-slate-300 transition-colors hover:bg-slate-800"
          >
            Reproduzir
          </button>
          <button
            onClick={parar}
            className="rounded border border-slate-600 px-2 py-1 text-slate-300 transition-colors hover:bg-slate-800"
          >
            Pausar
          </button>
        </div>
      </div>

      <div className="relative py-3">
        <div className="h-1 rounded bg-slate-700">
          <div
            className="h-1 rounded bg-amber-500"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
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
          step={passo}
          value={valor}
          onChange={(e) => {
            parar();
            onChange(normalizar(Number(e.target.value)));
          }}
          className="absolute inset-x-0 top-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Linha do tempo"
        />

        <span
          className="pointer-events-none absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"
          style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>

      {/* As pontas usam o mesmo formatador do rótulo, senão 221 a.C. vaza como "-220". */}
      <div className="flex justify-between font-mono text-[10px] text-slate-500">
        <span>{rotuloDeAno(ini, 900)}</span>
        <span>{rotuloDeAno(fim, 900)}</span>
      </div>
    </div>
  );
}
