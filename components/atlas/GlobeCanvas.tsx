"use client";

import { useEffect, useRef } from "react";
import { geoPath, geoGraticule10 } from "d3-geo";
import { criarProjecao } from "@/lib/geo/projecao";
import type { PaisFeature } from "@/lib/geo/mundo";
import { precisaoBaixa, type FatiaFeature } from "@/lib/geo/fatias";

interface Props {
  fundo: PaisFeature[];
  /**
   * A fatia histórica da data atual. Quando presente, substitui `fundo` —
   * é o mundo daquele momento no lugar do mundo de hoje.
   */
  fatia?: FatiaFeature[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
}

/**
 * Camada decorativa: o mundo que o atlas não cobre com dossiê, mais a malha
 * de meridianos e o contorno da esfera. Redesenhada a cada frame.
 *
 * Vai em canvas justamente por ser a camada pesada e não-interativa — o que
 * é clicável mora no SVG por cima. É por não ser clicável que ela pode usar
 * geometria histórica sem id do atlas: nada aponta para estes polígonos.
 */
export function GlobeCanvas({
  fundo,
  fatia,
  largura,
  altura,
  alpha,
  rotacao,
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

    if (fatia) {
      /*
       * Duas passadas, separadas pela precisão que a própria fonte declara.
       *
       * Fronteira conjectural sai tracejada e mais apagada; fronteira de
       * registro sai contínua. Desenhar as duas iguais afirmaria que sabemos
       * onde passava a linha da Núbia em 1500 a.C. com a mesma confiança com
       * que sabemos a de 1914 — e não sabemos. É o mesmo princípio do status
       * de uma alegação: a incerteza aparece, não é alisada.
       *
       * A separação é feita aqui e não no carregador porque só a tela precisa
       * dela, e porque `ctx.setLineDash` obriga a fechar um caminho antes de
       * mudar o traço.
       */
      const firmes = fatia.filter((f) => !precisaoBaixa(f));
      const conjecturais = fatia.filter(precisaoBaixa);

      ctx.beginPath();
      for (const f of firmes) path(f);
      ctx.fillStyle = "#16203a";
      ctx.fill();
      ctx.strokeStyle = "#243049";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      /*
       * O preenchimento é o MESMO das firmes, e só o traço muda.
       *
       * A primeira versão escurecia o polígono e tracejava a borda, e em 323
       * a.C. o globo ficava praticamente vazio — dois sinais para a mesma
       * informação, ao custo de não se ver nada. Terra incerta é terra do
       * mesmo jeito; o que é incerto é onde ela acaba, e isso o tracejado já
       * diz sozinho.
       */
      ctx.beginPath();
      for (const f of conjecturais) path(f);
      ctx.fillStyle = "#16203a";
      ctx.fill();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = "#2c3a54";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Sem fatia carregada ainda: os países de hoje seguram o lugar.
      ctx.beginPath();
      for (const f of fundo) path(f);
      ctx.fillStyle = "#16203a";
      ctx.fill();
      ctx.strokeStyle = "#243049";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }, [fundo, fatia, largura, altura, alpha, rotacao]);

  return <canvas ref={ref} className="absolute inset-0" />;
}
