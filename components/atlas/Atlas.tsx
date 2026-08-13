"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { GlobeCanvas } from "./GlobeCanvas";
import { GeoOverlay } from "./GeoOverlay";
import { separarPaises, type PaisFeature } from "@/lib/geo/mundo";
import { ISO_NUMERICO, type Alpha3 } from "@/lib/geo/iso";
import { rotaCompleta } from "@/lib/geo/rota";
import type { Viagem } from "@/lib/conteudo/viagem";

const LARGURA = 900;
const ALTURA = 560;

interface Props {
  mundo: PaisFeature[];
  viagens: Viagem[];
  /**
   * ISO alpha-3 dos países que têm conteúdo escrito. Aceso significa "tem
   * dossiê" — um país aceso que abre página vazia ensina o visitante a parar
   * de clicar.
   */
  paisesComConteudo: string[];
}

/**
 * Único dono do estado. Tudo abaixo recebe props e não guarda estado próprio,
 * o que torna impossível globo, rotas e seleção dessincronizarem.
 */
export function Atlas({ mundo, viagens, paisesComConteudo }: Props) {
  const [alpha, setAlpha] = useState(0);
  const [rotacao, setRotacao] = useState<[number, number]>([-40, -10]);
  const [selecionado, setSelecionado] = useState<Alpha3 | null>(null);

  const arrastando = useRef(false);
  const ultimo = useRef<[number, number]>([0, 0]);

  /**
   * GSAP anima um objeto JavaScript comum, não o DOM — e é isso que serve
   * aqui, porque quem desenha é o D3. O onUpdate empurra o valor para o React
   * a cada frame e as duas camadas se redesenham juntas.
   */
  const tween = useRef({ v: 0 });
  const animacao = useRef<gsap.core.Tween | null>(null);

  useEffect(() => () => void animacao.current?.kill(), []);

  const alternarModo = useCallback(() => {
    animacao.current?.kill();
    const destino = tween.current.v < 0.5 ? 1 : 0;
    animacao.current = gsap.to(tween.current, {
      v: destino,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => setAlpha(tween.current.v),
    });
  }, []);

  const acesos = useMemo(
    () => paisesComConteudo.filter((iso): iso is Alpha3 => iso in ISO_NUMERICO),
    [paisesComConteudo]
  );

  const { curados, fundo } = useMemo(
    () => separarPaises(mundo, acesos),
    [mundo, acesos]
  );
  const rotas = useMemo(() => viagens.map(rotaCompleta), [viagens]);

  const aoPressionar = useCallback((e: React.PointerEvent) => {
    arrastando.current = true;
    ultimo.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
        className="relative touch-none cursor-grab active:cursor-grabbing"
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

      <div className="flex items-center gap-6 text-sm text-slate-300">
        <span className="min-w-40 font-mono text-xs">
          {selecionado ? `País: ${selecionado}` : "Clique num país aceso"}
        </span>
        <button
          onClick={alternarModo}
          className="rounded border border-slate-600 px-3 py-1 transition-colors hover:bg-slate-800"
        >
          {alpha < 0.5 ? "Desenrolar" : "Enrolar"}
        </button>
      </div>
    </div>
  );
}
