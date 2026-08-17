/**
 * Os três ícones das alas da central do país.
 *
 * Escritos à mão em SVG porque o projeto não tem `lucide-react` e a central
 * usa exatamente três. Puxar uma biblioteca de mil ícones para gastar três,
 * num projeto cujas dependências cabem em nove linhas, custa mais do que
 * resolve. Traço de 1.5 e `currentColor` para herdarem a cor de quem os usa,
 * que é como os originais se comportam.
 */

const comum = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function IconePeriodos({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconeFiguras({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconeLivros({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
