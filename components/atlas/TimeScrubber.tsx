"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  anoFracionarioDe,
  interpretarData,
  rotuloDeAno,
} from "@/lib/conteudo/tempo";

interface Props {
  /**
   * Largura em pixels, para a barra acompanhar o mapa.
   *
   * Ausente, ela usa `max-w-3xl` como antes. Com 3.600 anos de domínio, cada
   * pixel vale quatro anos, então largura é precisão de arrasto e não estética:
   * numa barra de 768 px o Regime Militar tem cinco pixels.
   */
  largura?: number;
  valor: number;
  dominio: [number, number];
  onChange: (v: number) => void;
  /** Marcas opcionais — inícios de período, paradas de viagem, eventos. */
  marcas?: { pos: number; rotulo: string; tipo?: "periodo" | "evento" }[];
}

export function TimeScrubber({
  largura, valor, dominio, onChange, marcas = [] }: Props) {
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

  /*
   * Digitar a data.
   *
   * Numa barra que cobre 3.600 anos em 900 pixels, cada pixel vale quatro
   * anos: arrastar não alcança 2014, nem 1206, nem nenhum ano específico. A
   * barra serve para percorrer; o campo serve para chegar.
   */
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState(false);

  const irPara = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const data = interpretarData(texto);
      if (data === null) {
        setErro(true);
        return;
      }
      setErro(false);
      parar();
      const alvo = anoFracionarioDe(data);
      // Fora do domínio, encosta na ponta em vez de recusar em silêncio.
      onChange(normalizar(Math.min(Math.max(alvo, ini), fim)));
    },
    [texto, parar, onChange, normalizar, ini, fim]
  );

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
    <div
      className={largura ? "w-full" : "w-full max-w-3xl"}
      style={largura ? { maxWidth: largura } : undefined}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-lg text-amber-400">
          {rotuloDeAno(valor, amplitude)}
        </span>
        <div className="flex items-center gap-2 text-xs">
          <form onSubmit={irPara} className="flex items-center gap-1">
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setErro(false);
              }}
              placeholder="1206, 221 a.C., 1500-04-22"
              aria-label="Ir para a data"
              aria-invalid={erro}
              className={`w-44 rounded border bg-slate-900/60 px-2 py-1 font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none ${
                erro
                  ? "border-rose-500/70 text-rose-300"
                  : "border-slate-600 focus:border-amber-500/70"
              }`}
            />
            <button
              type="submit"
              className="rounded border border-slate-600 px-2 py-1 text-slate-300 transition-colors hover:bg-slate-800"
            >
              Ir
            </button>
          </form>
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

      {/*
        Trilho de 8 px e não de 4, e punho de 16 e não de 12: a barra é o
        controle mais usado da tela e cobre 3.600 anos, então ela é alvo de
        arrasto antes de ser enfeite.
      */}
      <div className="relative py-4">
        <div className="h-2 rounded bg-slate-700">
          <div
            className="h-2 rounded bg-amber-500"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>

        {/* Evento na mesma cor do marcador do globo, e mais alto, para virar alvo. */}
        {marcas.map((m) => (
          <span
            key={`${m.pos}-${m.rotulo}`}
            title={m.rotulo}
            className={
              m.tipo === "evento"
                ? "absolute top-0.5 h-8 w-px bg-rose-400/80"
                : "absolute top-2 h-5 w-px bg-sky-400/70"
            }
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
          className="pointer-events-none absolute top-1.5 h-4 w-4 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"
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
