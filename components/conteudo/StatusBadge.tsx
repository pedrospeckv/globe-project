import type { StatusAlegacao } from "@/lib/conteudo/alegacao";

/**
 * A cor não indica "grave" ou "leve" — indica em que estágio a apuração está.
 * Anulado e prescrito compartilham o azul porque ambos significam "não houve
 * pronunciamento definitivo de mérito", que é a distinção que os dois campos
 * políticos mais confundem.
 */
const ROTULOS: Record<StatusAlegacao, { texto: string; classe: string }> = {
  "transito-julgado": {
    texto: "Trânsito em julgado",
    classe: "border-red-500/40 bg-red-500/10 text-red-400",
  },
  "em-julgamento": {
    texto: "Em julgamento",
    classe: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  },
  investigacao: {
    texto: "Investigação",
    classe: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500",
  },
  anulado: {
    texto: "Anulado",
    classe: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  },
  prescrito: {
    texto: "Prescrito",
    classe: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  },
  "alegacao-sem-processo": {
    texto: "Alegação sem processo",
    classe: "border-slate-600 bg-slate-700/40 text-slate-300",
  },
  desmentido: {
    texto: "Desmentido",
    classe: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
};

export function StatusBadge({ status }: { status: StatusAlegacao }) {
  const { texto, classe } = ROTULOS[status];
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}
    >
      {texto}
    </span>
  );
}
