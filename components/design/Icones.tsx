/**
 * Os ícones do sistema de design.
 *
 * Escritos à mão em SVG pela mesma razão que os de `IconesAla`: o projeto não
 * tem biblioteca de ícones, e puxar mil para gastar dois custa mais do que
 * resolve. Traço de 1.5 e `currentColor`, para herdarem a cor de quem os usa.
 *
 * `aria-hidden` em todos: ícone aqui nunca carrega informação que o texto ao
 * lado já não dê. Quem usa leitor de tela ouve o rótulo do campo, não "lupa".
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

export function IconeLupa({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconeLimpar({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
