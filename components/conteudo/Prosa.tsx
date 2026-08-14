import ReactMarkdown from "react-markdown";
import { resolverLigacoes, type Alvos } from "@/lib/conteudo/ligacoes";

/**
 * Texto de contexto em markdown.
 *
 * A §6 do spec: a prosa vem POR CIMA das alegações estruturadas, nunca no
 * lugar delas. Aqui ela existe só para dar contexto ao que os campos já
 * afirmam com fonte.
 *
 * Com `alvos`, as ligações `[[id]]` viram links. Sem `alvos`, o texto sai
 * como está — o que só acontece onde não há acervo à mão, e nunca deixa
 * link quebrado na tela porque a integridade já quebrou o build antes.
 */
export function Prosa({ texto, alvos }: { texto?: string; alvos?: Alvos }) {
  if (!texto) return null;
  const pronto = alvos ? resolverLigacoes(texto, alvos) : texto;
  return (
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300 [&_a]:text-sky-400 [&_a:hover]:underline [&_em]:italic [&_strong]:font-semibold [&_strong]:text-slate-100">
      <ReactMarkdown>{pronto}</ReactMarkdown>
    </div>
  );
}
