"use client";

import { useEffect, useRef } from "react";
import { geoPath, geoGraticule10 } from "d3-geo";
import { criarProjecao } from "@/lib/geo/projecao";
import type { PaisFeature } from "@/lib/geo/mundo";
import { precisaoBaixa, type Fatia, type FatiaFeature } from "@/lib/geo/fatias";
import { NEUTRO, TRACO, corDoBalde, semCorPropria } from "@/lib/geo/cores";
import { colocarRotulos } from "@/lib/geo/rotulos";

interface Props {
  fundo: PaisFeature[];
  /**
   * A fatia histórica da data atual. Quando presente, substitui `fundo` —
   * é o mundo daquele momento no lugar do mundo de hoje.
   */
  fatia?: Fatia;
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  /** Ampliação e deslocamento da vista. Ver `OpcoesProjecao`. */
  zoom?: number;
  deslocamento?: [number, number];
}

/**
 * A partir de que achatamento os nomes aparecem.
 *
 * Praticamente "só no mapa": a colocação dos rótulos é o passo caro, e no meio da
 * animação de desenrolar ela seria refeita a cada quadro para um enquadramento
 * que ninguém vai ler. O gsap termina o tween exatamente em 1, então na prática
 * a conta é feita uma vez, quando o mapa para.
 */
const ACHATADO = 0.999;

/**
 * Corpo do rótulo, em pixels.
 *
 * Medido na fatia de 2018, num mapa de 1472 px (o que uma tela de 1080 rende):
 * fonte 9 nomeia 56 países, 10 nomeia 52 e 11 nomeia 46. O 9 pagaria a Alemanha
 * — que é o caso difícil, palavra longa em país compacto — ao preço de um texto
 * miúdo, e a Alemanha aparece de todo modo ao aproximar. Fica o 10.
 */
const FONTE_ROTULO = 10;

/** Anônimos num grupo só, fora da faixa de baldes. */
const ANONIMO = -1;

/**
 * Agrupa as feições por cor, para o desenho pagar uma pincelada por cor.
 *
 * Sem isto seriam até 1.946 pares de `fill`/`stroke` por quadro, um por
 * polígono de 1492, e o arrasto do globo redesenha a cada quadro. Agrupado,
 * são no máximo 25 — os 24 baldes mais o anônimo. O canvas aceita um caminho
 * com vários polígonos e o preenche de uma vez.
 */
function agruparPorCor(
  feicoes: readonly FatiaFeature[],
  cores: ReadonlyMap<string, number>,
  semCor: ReadonlySet<string>
): Map<number, FatiaFeature[]> {
  const grupos = new Map<number, FatiaFeature[]>();
  for (const f of feicoes) {
    const n = f.properties?.n;
    const balde =
      n && !semCor.has(n) ? (cores.get(n) ?? ANONIMO) : ANONIMO;
    const atual = grupos.get(balde);
    if (atual) atual.push(f);
    else grupos.set(balde, [f]);
  }
  return grupos;
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

    const projecao = criarProjecao({
      largura,
      altura,
      alpha,
      rotacao,
      zoom,
      deslocamento,
    });
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
       * Uma cor por entidade política, e é isso que faz a extensão de cada
       * país aparecer. Antes havia um preenchimento único para o mundo todo, e
       * a fronteira entre dois vizinhos era um traço de 0,5 px entre duas áreas
       * idênticas — ou seja, invisível: em 1500 a Europa era uma mancha só.
       *
       * As cores vêm resolvidas do carregador, por NOME, e a mesma entidade
       * guarda a mesma cor de uma fatia para a outra. Ver `lib/geo/cores.ts`.
       *
       * Duas passadas, separadas pela precisão que a própria fonte declara.
       * Fronteira conjectural sai tracejada; fronteira de registro sai
       * contínua. Desenhar as duas iguais afirmaria que sabemos onde passava a
       * linha da Núbia em 1500 a.C. com a mesma confiança com que sabemos a de
       * 1914 — e não sabemos. É o mesmo princípio do status de uma alegação: a
       * incerteza aparece, não é alisada.
       *
       * O PREENCHIMENTO é o mesmo nas duas, e só o traço muda. A primeira
       * versão escurecia o polígono conjectural além de tracejar a borda, e em
       * 323 a.C. o globo ficava praticamente vazio — dois sinais para a mesma
       * informação, ao custo de não se ver nada. Terra incerta é terra do mesmo
       * jeito; o que é incerto é onde ela acaba, e o tracejado já diz isso.
       */
      const firmes = fatia.feicoes.filter((f) => !precisaoBaixa(f));
      const conjecturais = fatia.feicoes.filter(precisaoBaixa);

      /*
       * Quem é pequeno demais para a cor dizer algo — ver `AREA_MINIMA_PARA_COR`.
       *
       * A área é a PROJETADA, medida no caminho, e não a esférica convertida: a
       * equirretangular estica com a latitude, e a conversão subestimaria a
       * Dinamarca pela metade, apagando a cor de país que na tela tem tamanho.
       *
       * Só no mapa. No globo esta conta dobraria o custo por quadro — é uma
       * varredura da geometria toda, o mesmo trabalho de desenhar —, e arrastar o
       * globo redesenha a cada quadro. A regra é de leitura do mapa de estudo, e
       * é onde ela roda.
       */
      const semCor = new Set<string>();
      if (alpha >= ACHATADO) {
        const caminho = geoPath(projecao);
        const areaPorNome = new Map<string, number>();
        for (const f of fatia.feicoes) {
          const n = f.properties?.n;
          if (!n) continue;
          areaPorNome.set(n, (areaPorNome.get(n) ?? 0) + Math.abs(caminho.area(f)));
        }
        for (const [n, area] of areaPorNome) {
          if (semCorPropria(area)) semCor.add(n);
        }
      }

      const desenhar = (
        feicoes: readonly FatiaFeature[],
        tracejado: boolean
      ) => {
        const grupos = agruparPorCor(feicoes, fatia.cores, semCor);
        // Ordem crescente de balde: o desenho não pode depender da ordem em
        // que os polígonos aparecem no arquivo.
        for (const balde of [...grupos.keys()].sort((a, b) => a - b)) {
          ctx.beginPath();
          for (const f of grupos.get(balde)!) path(f);
          ctx.fillStyle = balde === ANONIMO ? NEUTRO : corDoBalde(balde);
          ctx.fill();
          if (tracejado) ctx.setLineDash([2, 2]);
          ctx.strokeStyle = TRACO;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          if (tracejado) ctx.setLineDash([]);
        }
      };

      desenhar(firmes, false);
      desenhar(conjecturais, true);

      /*
       * Os nomes, por último, para ficarem por cima de qualquer preenchimento.
       *
       * O halo escuro é o que os torna legíveis sobre 24 cores diferentes: sem
       * ele, um nome claro sobre um país claro desaparece, e escolher a cor do
       * texto por país daria 24 casos para acertar em vez de um.
       */
      if (alpha >= ACHATADO) {
        ctx.font = `${FONTE_ROTULO}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const rotulos = colocarRotulos({
          feicoes: fatia.feicoes,
          projecao,
          medir: (t) => ctx.measureText(t).width,
          fonte: FONTE_ROTULO,
        });
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(2,6,23,0.9)";
        ctx.fillStyle = "#e2e8f0";
        for (const r of rotulos) {
          ctx.strokeText(r.nome, r.x, r.y);
          ctx.fillText(r.nome, r.x, r.y);
        }
      }
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
  }, [fundo, fatia, largura, altura, alpha, rotacao, zoom, deslocamento]);

  return <canvas ref={ref} className="absolute inset-0" />;
}
