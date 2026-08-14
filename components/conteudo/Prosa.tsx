import ReactMarkdown from "react-markdown";

/**
 * Texto de contexto em markdown.
 *
 * A §6 do spec: a prosa vem POR CIMA das alegações estruturadas, nunca no
 * lugar delas. Aqui ela existe só para dar contexto ao que os campos já
 * afirmam com fonte.
 */
export function Prosa({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300 [&_a]:text-sky-400 [&_a:hover]:underline [&_em]:italic [&_strong]:font-semibold [&_strong]:text-slate-100">
      <ReactMarkdown>{texto}</ReactMarkdown>
    </div>
  );
}
