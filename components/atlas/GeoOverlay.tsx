"use client";

import { useMemo } from "react";
import { geoPath } from "d3-geo";
import { criarProjecao, pontoVisivel } from "@/lib/geo/projecao";
import type { PaisCurado } from "@/lib/geo/mundo";
import type { RotaFeature } from "@/lib/geo/rota";
import type { Alpha3 } from "@/lib/geo/iso";
import type { DisputaSemRecorte, TerritorioDisputado } from "@/lib/geo/disputas";
import type { Evento } from "@/lib/conteudo/evento";
import { rotuloDeData } from "@/lib/conteudo/tempo";

/**
 * Ilha pequena com a soberania já resolvida para a data em tela.
 *
 * Resolvida FORA daqui, no `Atlas`, porque esta camada é só desenho: se ela
 * recebesse a lista de trechos e o ano, passaria a ter regra de conteúdo
 * dentro de um componente de apresentação.
 */
export interface IlhaMarcada {
  id: string;
  nome: string;
  ponto: [number, number];
  /** Quem exercia. `null` onde a fonte não atribui posse a ninguém. */
  poder: string | null;
  disputada: boolean;
}

interface Props {
  curados: PaisCurado[];
  rotas: RotaFeature[];
  /** Eventos próximos ao instante atual. */
  eventos?: Evento[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  selecionado: Alpha3 | null;
  onSelecionar: (a: Alpha3) => void;
  /** Países cujo território abrigava mais de um Estado nesta data. */
  divididos?: readonly Alpha3[];
  /** Territórios de soberania disputada, marcados por polígono e não por país. */
  disputados?: readonly TerritorioDisputado[];
  /**
   * Disputas que a base cartográfica não separa em polígono. Viram alfinete,
   * não área — ver a nota em lib/geo/disputas.ts sobre a Caxemira.
   */
  disputasMarcadas?: readonly DisputaSemRecorte[];
  /**
   * Ilhas que a base cartográfica não desenha — ver `lib/conteudo/ilha.ts`.
   * Entram como marcador e não como polígono: Fernando de Noronha tem 18 km²,
   * e nesta escala um polígono fiel seria invisível e um visível seria falso.
   */
  ilhas?: readonly IlhaMarcada[];
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
  eventos = [],
  largura,
  altura,
  alpha,
  rotacao,
  selecionado,
  onSelecionar,
  divididos = [],
  disputados = [],
  disputasMarcadas = [],
  ilhas = [],
}: Props) {
  const projecao = useMemo(
    () => criarProjecao({ largura, altura, alpha, rotacao }),
    [largura, altura, alpha, rotacao]
  );
  const path = useMemo(() => geoPath(projecao), [projecao]);

  const dividido = useMemo(() => new Set<string>(divididos), [divididos]);

  /*
   * Os contornos são caros e mudam por dois motivos só: a projeção girou ou
   * a lista de países mudou. Gerá-los dentro do JSX refazia os nove a cada
   * render, inclusive quando só o ano tinha avançado sem acender ou apagar
   * ninguém.
   */
  const caminhosDePais = useMemo(
    () =>
      curados
        .map(({ alpha3, feature }) => ({ alpha3, d: path(feature) }))
        .filter((c): c is { alpha3: Alpha3; d: string } => c.d !== null),
    [curados, path]
  );

  const caminhosDisputados = useMemo(
    () =>
      disputados
        .map(({ alpha3, feature, disputa }) => ({ alpha3, disputa, d: path(feature) }))
        .filter((c): c is typeof c & { d: string } => c.d !== null),
    [disputados, path]
  );

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

        {/*
          Disputa de soberania usa hachura própria, em âmbar. Compartilhar a
          hachura azul com o território dividido faria o mapa dizer que são a
          mesma coisa, e não são: uma é país partido em dois Estados, a outra
          é um pedaço cuja soberania está em contestação aberta.
        */}
        <pattern
          id="hachura-disputado"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="7" height="7" fill="#f59e0b" fillOpacity="0.18" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#fbbf24" strokeWidth="2" />
        </pattern>
      </defs>

      {/*
        Cada camada se identifica pelo nome. Antes elas eram alcançadas pela
        posição, e inserir uma no meio quebrava tudo que dependia da ordem.
      */}
      <g data-camada="paises">
        {caminhosDePais.map(({ alpha3, d }) => {
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

      {/*
        Território disputado. Fica entre os países e as rotas: por cima do
        país a que a base o atribui, e clicável pelo mesmo país — a disputa
        é sobre a soberania, não sobre a existência do dossiê.
      */}
      <g data-camada="disputados">
        {caminhosDisputados.map(({ alpha3, disputa, d }) => {
          return (
            <path
              key={disputa.id}
              d={d}
              fill="url(#hachura-disputado)"
              stroke="#fbbf24"
              strokeWidth={1}
              strokeDasharray="3 2"
              className="pointer-events-auto cursor-pointer"
              onClick={() => onSelecionar(alpha3)}
            >
              <title>{`${disputa.nome} — soberania disputada`}</title>
            </path>
          );
        })}
      </g>

      {/*
        Disputa que a base não recorta. Vira alfinete em vez de área porque
        o polígono não existe na base e desenhá-lo à mão seria traçar a
        fronteira que está em litígio. Usa o âmbar da disputa, e não o rosa
        do evento: é estado permanente, não acontecimento datado.
      */}
      <g data-camada="disputas-marcadas">
        {disputasMarcadas.map((d) => {
          if (!pontoVisivel(d.centro, { alpha, rotacao })) return null;
          const p = projecao(d.centro);
          if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
          // Mesmo arredondamento dos eventos, pelo mesmo motivo de hidratação.
          const x = p[0].toFixed(3);
          const y = p[1].toFixed(3);
          return (
            <g key={d.id} transform={`translate(${x},${y})`}>
              <circle r={9} fill="#f59e0b" fillOpacity={0.15} />
              <path
                d="M 0 -6 L 6 0 L 0 6 L -6 0 Z"
                fill="none"
                stroke="#fbbf24"
                strokeWidth={1.4}
                strokeDasharray="3 2"
              >
                <title>{`${d.nome} — soberania disputada, sem geometria na base`}</title>
              </path>
            </g>
          );
        })}
      </g>

      <g data-camada="ilhas">
        {ilhas.map((i) => {
          if (!pontoVisivel(i.ponto, { alpha, rotacao })) return null;
          const p = projecao(i.ponto);
          if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
          const x = p[0].toFixed(3);
          const y = p[1].toFixed(3);

          /*
           * Ilha disputada herda o losango tracejado das disputas sem
           * polígono, porque é a mesma afirmação: existe soberania contestada
           * aqui. Usar marca diferente para a mesma coisa faria o leitor
           * procurar uma distinção que não existe.
           */
          /*
           * Na disputada, quem administra continua na etiqueta. Dizer só
           * "disputada" esconderia que o Reino Unido administra as Malvinas
           * desde 1833, e omitir o fato para parecer neutro é escolher um
           * lado por outro caminho. Quem exerce e quem reivindica são coisas
           * diferentes, e as duas cabem numa linha.
           */
          const rotulo = i.disputada
            ? `${i.nome} — soberania disputada${
                i.poder ? `, administrada por ${i.poder}` : ""
              }`
            : `${i.nome} — ${i.poder ?? "sem soberania exercida"}`;

          return (
            <g key={i.id} transform={`translate(${x},${y})`}>
              {i.disputada ? (
                <>
                  <circle r={7} fill="#f59e0b" fillOpacity={0.15} />
                  <path
                    d="M 0 -5 L 5 0 L 0 5 L -5 0 Z"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.3}
                    strokeDasharray="3 2"
                  >
                    <title>{rotulo}</title>
                  </path>
                </>
              ) : (
                <>
                  {/* Alvo de mouse maior que a marca: 3 px de raio é difícil
                      de acertar, e a ilha existe para ser consultada. */}
                  <circle r={7} fill="transparent" />
                  <circle
                    r={3}
                    fill="#0b1220"
                    stroke={i.poder ? "#93c5fd" : "#64748b"}
                    strokeWidth={1.2}
                    strokeDasharray={i.poder ? undefined : "2 2"}
                  >
                    <title>{rotulo}</title>
                  </circle>
                </>
              )}
            </g>
          );
        })}
      </g>

      <g data-camada="rotas">
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

      {/*
        Marcadores de evento. Projetados pela MESMA projeção das outras
        camadas — mas um ponto avulso não passa pelo corte que o `geoPath`
        aplica, então o lado oculto precisa ser perguntado antes: sem isso o
        marcador de um evento na China aparece sobre a América do Sul.
      */}
      <g data-camada="eventos">
        {eventos.map((ev) => {
          if (!pontoVisivel(ev.ponto, { alpha, rotacao })) return null;
          const p = projecao(ev.ponto);
          if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
          /*
             Arredondar não é cosmético: sem isso o servidor escrevia
             `388.6494362206221` e o navegador `388.649436220622`, e o React
             acusava divergência de hidratação. Trigonometria em ponto
             flutuante pode diferir no último dígito entre o V8 do Node e o do
             navegador. O `d` dos países não sofre disso porque o geoPath do
             d3 já arredonda em 3 casas por conta própria — aqui a string é
             montada à mão, então o arredondamento também precisa ser.
          */
          const x = p[0].toFixed(3);
          const y = p[1].toFixed(3);
          return (
            <g key={ev.id} transform={`translate(${x},${y})`}>
              <circle r={7} fill="#f43f5e" fillOpacity={0.18} />
              <circle r={3} fill="#f43f5e" stroke="#fecdd3" strokeWidth={0.8}>
                <title>{`${ev.titulo} · ${rotuloDeData(ev.data)}`}</title>
              </circle>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
