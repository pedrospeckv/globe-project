"use client";

import { useMemo } from "react";
import { geoPath } from "d3-geo";
import { criarProjecao } from "@/lib/geo/projecao";
import type { PaisCurado } from "@/lib/geo/mundo";
import type { RotaFeature } from "@/lib/geo/rota";
import type { Alpha3 } from "@/lib/geo/iso";

interface Props {
  curados: PaisCurado[];
  rotas: RotaFeature[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  selecionado: Alpha3 | null;
  onSelecionar: (a: Alpha3) => void;
}

/**
 * Camada interativa. Poucos elementos, então SVG compensa: clique e hover
 * saem de graça pelo DOM, e as rotas viram <path> reais — que é o que o
 * DrawSVG do GSAP precisa para desenhá-las progressivamente no plano 3.
 *
 * Usa a MESMA projeção do canvas, então as camadas não podem dessincronizar.
 */
export function GeoOverlay({
  curados,
  rotas,
  largura,
  altura,
  alpha,
  rotacao,
  selecionado,
  onSelecionar,
}: Props) {
  const path = useMemo(
    () => geoPath(criarProjecao({ largura, altura, alpha, rotacao })),
    [largura, altura, alpha, rotacao]
  );

  return (
    <svg width={largura} height={altura} className="pointer-events-none absolute inset-0">
      <g>
        {curados.map(({ alpha3, feature }) => {
          const d = path(feature);
          if (!d) return null;
          const ativo = selecionado === alpha3;
          return (
            <path
              key={alpha3}
              d={d}
              fill={ativo ? "#38bdf8" : "#0ea5e9"}
              fillOpacity={ativo ? 0.9 : 0.55}
              stroke="#7dd3fc"
              strokeWidth={ativo ? 1.5 : 0.75}
              className="pointer-events-auto cursor-pointer transition-[fill-opacity] duration-200 hover:[fill-opacity:0.85]"
              onClick={() => onSelecionar(alpha3)}
            >
              <title>{alpha3}</title>
            </path>
          );
        })}
      </g>

      <g>
        {rotas.map((rota) => {
          const d = path(rota);
          if (!d) return null;
          return (
            <path
              key={rota.properties.viagemId}
              d={d}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="5 4"
            >
              <title>{rota.properties.titulo}</title>
            </path>
          );
        })}
      </g>
    </svg>
  );
}
