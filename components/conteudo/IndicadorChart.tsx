import { formatarValor, type Indicador } from "@/lib/conteudo/indicador";
import type { Fonte } from "@/lib/conteudo/fonte";
import type { Periodo } from "@/lib/conteudo/pais";

const L = 560;
const A = 170;
const PAD = 30;
/** Sobra à esquerda para os rótulos do eixo vertical. */
const PAD_ESQ = 52;

/**
 * Série com faixas de mandato sombreadas.
 *
 * A §7 do spec: ninguém escreve "conquistas". A curva é da fonte, e o autor
 * apenas marca quem estava no poder. O leitor tira a própria conclusão — e
 * discordar de uma linha com fonte é bem mais difícil que discordar de um
 * bullet point.
 */
export function IndicadorChart({
  indicador,
  fonte,
  periodos = [],
}: {
  indicador: Indicador;
  fonte?: Fonte;
  periodos?: Periodo[];
}) {
  const anos = indicador.serie.map((p) => p.ano);
  const vals = indicador.serie.map((p) => p.valor);
  const a0 = Math.min(...anos);
  const a1 = Math.max(...anos);
  const v0 = Math.min(...vals);
  const v1 = Math.max(...vals);
  const spanA = a1 - a0 || 1;

  /*
   * No log a posição é proporcional ao expoente, não ao valor: é o que faz
   * uma série de três ordens de grandeza caber num gráfico onde ainda se
   * enxerga a diferença entre 4% e 10%.
   */
  const log = indicador.escala === "log";
  const t = (v: number) => (log ? Math.log10(v) : v);
  const t0 = t(v0);
  const t1 = t(v1);
  const spanV = t1 - t0 || 1;

  const x = (ano: number) => PAD_ESQ + ((ano - a0) / spanA) * (L - PAD_ESQ - PAD);
  const y = (v: number) => A - PAD - ((t(v) - t0) / spanV) * (A - PAD * 2);

  const d = indicador.serie
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ano).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join("");

  return (
    <figure className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-slate-100">{indicador.nome}</p>
        <p className="text-[11px] text-slate-500">{indicador.unidade}</p>
      </figcaption>

      <svg viewBox={`0 0 ${L} ${A}`} className="w-full">
        {periodos.map((p) => {
          const ini = Number(p.inicio.slice(0, 4));
          const fim = p.fim ? Number(p.fim.slice(0, 4)) : a1;
          if (fim < a0 || ini > a1) return null;
          const xi = x(Math.max(ini, a0));
          const xf = x(Math.min(fim, a1));
          return (
            <g key={p.id}>
              <rect
                x={xi}
                y={PAD - 12}
                width={Math.max(0, xf - xi)}
                height={A - PAD * 2 + 24}
                fill="rgba(56,189,248,0.07)"
                stroke="rgba(56,189,248,0.25)"
                strokeDasharray="3 3"
              />
              <text x={xi + 3} y={PAD - 3} fontSize="8" fill="#38bdf8">
                {p.rotulo}
              </text>
            </g>
          );
        })}

        <line x1={PAD_ESQ} y1={A - PAD} x2={L - PAD} y2={A - PAD} stroke="#334155" />
        <path d={d} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
        {indicador.serie.map((p) => (
          <circle key={p.ano} cx={x(p.ano)} cy={y(p.valor)} r={2} fill="#fbbf24" />
        ))}

        {/* Sem os extremos do eixo vertical, a curva não diz de quanto para quanto. */}
        <text x={PAD_ESQ - 5} y={y(v1) + 3} fontSize="8" fill="#64748b" textAnchor="end">
          {formatarValor(v1)}
        </text>
        <text x={PAD_ESQ - 5} y={y(v0) + 3} fontSize="8" fill="#64748b" textAnchor="end">
          {formatarValor(v0)}
        </text>

        <text x={PAD_ESQ} y={A - 10} fontSize="9" fill="#64748b">
          {a0}
        </text>
        <text x={L - PAD} y={A - 10} fontSize="9" fill="#64748b" textAnchor="end">
          {a1}
        </text>
      </svg>

      {log && (
        /*
         * Escala logarítmica precisa ser dita. Sem o aviso, o leitor lê a
         * queda de 1994 como suave quando ela foi de duas ordens de grandeza.
         */
        <p className="mt-1 text-[10px] text-amber-600/80">
          Eixo vertical em escala logarítmica — cada altura igual representa uma
          multiplicação, não uma soma.
        </p>
      )}

      {/* A atribuição não é opcional — a curva não é do autor. */}
      <p className="mt-2 text-[10px] text-slate-500">
        Fonte:{" "}
        {fonte
          ? `${fonte.titulo}${fonte.publicacao ? ` — ${fonte.publicacao}` : ""}`
          : indicador.fonte}
      </p>
    </figure>
  );
}
