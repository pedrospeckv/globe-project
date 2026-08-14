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
  /** Países cujo território abrigava mais de um Estado nesta data. */
  divididos?: readonly Alpha3[];
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
  divididos = [],
}: Props) {
  const path = useMemo(
    () => geoPath(criarProjecao({ largura, altura, alpha, rotacao })),
    [largura, altura, alpha, rotacao]
  );

  const dividido = useMemo(() => new Set<string>(divididos), [divididos]);

  return (
    <svg width={largura} height={altura} className="pointer-events-none absolute inset-0">
      <defs>
        {/*
          Hachura para território que abrigava mais de um Estado. Ela admite a
          limitação em vez de escondê-la: o atlas não tem a geometria da
          fronteira interna e não vai inventar uma.
        */}
        <pattern
          id="hachura-dividido"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" fill="#0ea5e9" fillOpacity="0.28" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#7dd3fc" strokeWidth="2.2" />
        </pattern>
      </defs>

      <g>
        {curados.map(({ alpha3, feature }) => {
          const d = path(feature);
          if (!d) return null;
          const ativo = selecionado === alpha3;
          const partido = dividido.has(alpha3);
          return (
            <path
              key={alpha3}
              d={d}
              fill={partido ? "url(#hachura-dividido)" : ativo ? "#38bdf8" : "#0ea5e9"}
              fillOpacity={partido ? 1 : ativo ? 0.9 : 0.55}
              stroke="#7dd3fc"
              strokeWidth={ativo ? 1.5 : 0.75}
              strokeDasharray={partido ? "4 2" : undefined}
              className="pointer-events-auto cursor-pointer transition-[fill-opacity] duration-200"
              onClick={() => onSelecionar(alpha3)}
            >
              <title>
                {partido ? `${alpha3} — território dividido` : alpha3}
              </title>
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
