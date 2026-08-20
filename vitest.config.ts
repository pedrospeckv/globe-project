import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Node por padrão: os testes de lógica não precisam de DOM e ficam mais
    // rápidos sem ele. Os testes de componente pedem jsdom arquivo a arquivo,
    // com `// @vitest-environment jsdom` no topo.
    environment: "node",
    /*
     * 15 s, e o número vem de medição, não de chute.
     *
     * Dois testes de página estouravam os 5 s padrão de forma intermitente — na
     * suíte cheia sim, sozinhos não. Medidos sem carga: **138 ms e 141 ms**. Não
     * são testes lentos; é contenção, um pico de ~36× quando 41 arquivos disputam
     * a máquina e vários montam jsdom (na suíte cheia o tempo de `environment`
     * passa de 100 s). Numa máquina de CI, com dois núcleos, é pior.
     *
     * 15 s dá cerca de 100× de folga sobre o custo real e ainda reprova teste
     * genuinamente travado, que é o que um timeout existe para pegar. Aumentar
     * aqui é preferível a espalhar timeout por arquivo: o problema não é de um
     * teste, é do banco todo dividir a mesma máquina.
     */
    testTimeout: 15000,
    include: [
      "lib/**/*.test.ts",
      "scripts/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
