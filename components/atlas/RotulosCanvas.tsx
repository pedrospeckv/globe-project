"use client";

import { useEffect, useRef } from "react";
import { criarProjecao } from "@/lib/geo/projecao";
import type { Fatia } from "@/lib/geo/fatias";
import { colocarRotulos } from "@/lib/geo/rotulos";

interface Props {
  fatia?: Fatia;
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  zoom?: number;
  deslocamento?: [number, number];
}

/**
 * A partir de que achatamento os nomes aparecem.
 *
 * Praticamente "só no mapa": a colocação é o passo caro, e no meio da animação de
 * desenrolar seria refeita a cada quadro para um enquadramento que ninguém vai
 * ler. O gsap termina o tween exatamente em 1, então na prática a conta é feita
 * uma vez, quando o mapa para.
 */
const ACHATADO = 0.999;

/**
 * Corpo do rótulo, em pixels.
 *
 * Medido na fatia de 2018, num mapa de 1472 px (o que uma tela de 1080 rende):
 * fonte 9 nomeia 56 países, 10 nomeia 52 e 11 nomeia 46. O 9 pagaria a Alemanha —
 * que é o caso difícil, palavra longa em país compacto — ao preço de um texto
 * miúdo, e a Alemanha aparece de todo modo ao aproximar. Fica o 10.
 */
const FONTE = 10;

/**
 * Os nomes dos países, numa camada própria ACIMA do overlay.
 *
 * ## Por que não junto do preenchimento
 *
 * Porque os países com dossiê são pintados no SVG com `#0ea5e9` a 55% de
 * opacidade, e o SVG fica por cima do canvas. Desenhado lá embaixo, o nome do
 * Brasil saía lavado de ciano: contraste de ~2,3:1 contra os ~6,5:1 de um país
 * sem dossiê. O defeito era ao contrário do que interessa — justamente os nove
 * países que o atlas cobre tinham os rótulos menos legíveis.
 *
 * ## Por que canvas e não `<text>` no SVG
 *
 * Porque a colocação precisa medir texto, e medir texto de verdade só o
 * `measureText` do canvas faz. A alternativa era estimar a largura por contagem
 * de caracteres, o que erra alguns por cento e deixa nomes se tocando. Aqui a
 * medida é a real, e o preço é uma camada a mais — que não recebe ponteiro, para
 * o hover continuar valendo no canvas de baixo.
 */
export function RotulosCanvas({
  fatia,
  largura,
  altura,
  alpha,
  rotacao,
  zoom = 1,
  deslocamento = [0, 0],
}: Props) {
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

    if (!fatia || alpha < ACHATADO) return;

    const projecao = criarProjecao({
      largura,
      altura,
      alpha,
      rotacao,
      zoom,
      deslocamento,
    });

    ctx.font = `${FONTE}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const rotulos = colocarRotulos({
      feicoes: fatia.feicoes,
      projecao,
      medir: (t) => ctx.measureText(t).width,
      fonte: FONTE,
    });

    /*
     * Halo escuro por baixo e texto claro por cima. É o que torna o nome legível
     * sobre 24 cores diferentes: escolher a cor do texto por país daria 24 casos
     * para acertar em vez de um.
     */
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(2,6,23,0.9)";
    ctx.fillStyle = "#f1f5f9";
    for (const r of rotulos) {
      ctx.strokeText(r.nome, r.x, r.y);
      ctx.fillText(r.nome, r.x, r.y);
    }
  }, [fatia, largura, altura, alpha, rotacao, zoom, deslocamento]);

  return (
    <canvas ref={ref} className="pointer-events-none absolute inset-0" />
  );
}
