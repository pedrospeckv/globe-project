import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * Árvore de trabalho paralela do agente: é uma CÓPIA do repositório, com o
     * `.next` dela dentro. Sem ignorar, `eslint .` entra lá e quebra tentando ler
     * um chunk de build que já não existe — erro que não é do código nem do lint.
     */
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
