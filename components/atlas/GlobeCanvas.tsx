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
 *
 * Vai em canvas justamente por ser a camada pesada e não-interativa — o que
 * é clicável mora no SVG por cima.
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
