import fs from "node:fs";
import path from "node:path";
import type { PaisIdentificado } from "../iso";

/**
 * Os países do acervo real, lidos do disco, para os testes de geometria.
 *
 * Substitui o `PAISES_DO_ATLAS` que `lib/geo/iso.ts` exportava. Aquela constante
 * saiu junto com a tabela à mão: o código numérico passou a morar no arquivo de
 * cada país, para que adicionar um não exija tocar em arquivo compartilhado.
 *
 * Lê o acervo em vez de listar os nove aqui, e é de propósito — uma lista escrita
 * neste arquivo teria o mesmo defeito que a tabela tinha, só mudado para a pasta
 * de testes: PR de país novo passaria a mexer num fixture. Assim, país novo é
 * coberto sozinho.
 *
 * Síncrono porque teste não deve esperar E/S para montar fixture, e são nove
 * arquivos pequenos. Sem zod: se um deles estiver inválido, o problema aparece no
 * `pnpm validar` e nos testes de `lib/conteudo`, que é onde ele deve aparecer.
 */
export function paisesDoAcervo(): PaisIdentificado[] {
  const pasta = path.join(process.cwd(), "conteudo", "paises");
  return fs
    .readdirSync(pasta)
    .filter((a) => a.endsWith(".json"))
    .map((a) => {
      const d = JSON.parse(fs.readFileSync(path.join(pasta, a), "utf8")) as {
        iso: string;
        isoNumerico: string;
      };
      return { iso: d.iso, isoNumerico: d.isoNumerico };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

export const PAISES_DO_ACERVO = paisesDoAcervo();

/** Só os alpha-3, que é o que `separarPaises` recebe. */
export const ISOS_DO_ACERVO = PAISES_DO_ACERVO.map((p) => p.iso);
