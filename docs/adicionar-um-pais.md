# Adicionar um país

Guia completo, do zero ao PR. Não precisa saber TypeScript — precisa saber ler
fonte e escrever com cuidado.

O exemplo é a **Rússia**, que já está no repositório: pode abrir
`conteudo/paises/russia.json` ao lado e comparar.

## 1. Escolher, e avisar

Pegue um de [`cobertura.md`](cobertura.md) e **abra uma issue dizendo qual**. Duas
pessoas escrevendo o mesmo país é a única forma de desperdício que este projeto
consegue produzir sozinho.

Sugestão para o primeiro: um país cuja história você já conhece razoavelmente. O
trabalho difícil não é o formato, é decidir onde um período termina e outro começa.

## 2. Criar o arquivo

`conteudo/paises/<nome-em-portugues>.json`, com hífen no lugar de espaço:
`russia.json`, `estados-unidos.json`, `coreia-do-sul.json`.

A casca:

```json
{
  "iso": "RUS",
  "nome": "Rússia",
  "periodos": []
}
```

- **`iso`** — o código ISO 3166-1 **alpha-3**, três letras maiúsculas. É o que liga
  o dossiê ao polígono no mapa.
- **`nome`** — em português, como você quer que apareça na tela.

## 3. Dividir em períodos

Esta é a parte que exige julgamento, e é o coração do atlas.

**Período é um recorte com nome próprio**, não uma fatia de calendário. "Grão-Principado de
Moscou" é um período; "século XV" não é. O teste é: existe um rótulo que uma
pessoa da época reconheceria como o nome da coisa em que ela vivia?

Um período real, do arquivo da Rússia:

```json
{
  "id": "ru-moscovia",
  "inicio": "1283",
  "fim": "1547",
  "rotulo": "Grão-Principado de Moscou",
  "regime": "principado sob suserania da Horda de Ouro até 1480, depois soberano",
  "textoMdx": "Moscou começa como um principado secundário entre vários...",
  "fontes": ["figes-tragedia-russa"]
}
```

Campo por campo:

| campo | regra |
|---|---|
| `id` | minúsculo, sem espaço, com hífen. O costume é prefixar com duas letras do país: `ru-moscovia`, `br-imperio` |
| `inicio` | `AAAA`, `AAAA-MM` ou `AAAA-MM-DD`. Para a.C., negativo: `-221`. **Não existe ano zero** |
| `fim` | mesma forma. **Omitir** significa período em curso — é o que faz o período atual ser o último da linha do tempo, e não um módulo separado |
| `rotulo` | o nome da entidade política na época |
| `regime` | como se governava. Frase, não enum: "principado sob suserania da Horda de Ouro até 1480, depois soberano" |
| `textoMdx` | a prosa. Opcional, mas é o que o leitor vem ler |
| `fontes` | ids de `conteudo/fontes/fontes.json`. **Obrigatório se houver `textoMdx`** |

Duas armadilhas do calendário:

- **Início inclusivo, fim exclusivo.** É o que faz 1822 pertencer ao Império do
  Brasil e não à Colônia. Se você fizer um período terminar e o próximo começar no
  mesmo ano, a data cai no segundo.
- Períodos **não podem se sobrepor**, e o validador reclama.

### Quando o território teve mais de um Estado

Alemanha 1949–1990, Vietnã 1954–1976, Iêmen até 1990. O par país × período sozinho
não diz isso, então o período recebe `entidades`:

```json
{
  "id": "de-divisao",
  "inicio": "1949",
  "fim": "1990",
  "rotulo": "Alemanha dividida",
  "regime": "dois Estados",
  "entidades": [
    { "nome": "República Federal da Alemanha", "regime": "democracia parlamentar", "fontes": [] },
    { "nome": "República Democrática Alemã", "regime": "Estado socialista de partido único", "fontes": [] }
  ]
}
```

**Duas ou mais, nunca uma** — uma entidade só é o próprio período, e o validador
recusa. O mapa hachura o país nesses períodos em vez de fingir uma fronteira
interna que o atlas não tem.

## 4. As fontes

Toda fonte é uma entidade com id próprio em `conteudo/fontes/fontes.json`, para que
a mesma obra citada em cinco lugares exista uma vez só.

Um livro — note a **ausência de `url`**, que é o certo quando não se sabe onde ele
está publicado:

```json
{
  "id": "ambedkar-aniquilacao-casta",
  "tipo": "livro",
  "titulo": "Annihilation of Caste",
  "autor": "B. R. Ambedkar",
  "data": "1936",
  "citacao": "Discurso escrito para uma conferência que o cancelou ao ler o texto..."
}
```

Um documento oficial:

```json
{
  "id": "acordo-belovezha-1991",
  "tipo": "documento-oficial",
  "titulo": "Acordo de Belovezha",
  "publicacao": "Rússia, Ucrânia e Bielorrússia",
  "data": "1991-12-08",
  "citacao": "Declarou que a União Soviética deixava de existir como sujeito de direito internacional..."
}
```

`tipo` é um destes seis, e só destes:

`decisao-judicial` · `documento-oficial` · `livro` · `artigo-academico` ·
`reportagem` · `dataset`

Obrigatórios são `id`, `tipo` e `titulo`. Opcionais: `autor`, `publicacao`, `data`,
`url`, `citacao`.

**Sobre `citacao`:** é o resumo, escrito por você, do que aquela fonte sustenta.
Serve para quem revisa saber se a fonte cobre a frase que a cita, sem ter de ler o
livro. Vale o esforço de escrever bem.

**Sobre `url`:** só entra se você abriu. Este é o ponto em que contribuição escrita
com ajuda de IA mais falha — modelos produzem links verossímeis que nunca
existiram. Sem URL o conteúdo é aceito; com URL inventada, não.

## 5. A linha em `lib/geo/iso.ts`

Para o dossiê acender no mapa, o código numérico precisa estar na tabela:

```ts
export const ISO_NUMERICO = {
  BRA: "076",
  // ...
  RUS: "643",
} as const;
```

O número é o **ISO 3166-1 numérico**, e você não deve adivinhá-lo: ele está no
próprio mapa. Para descobrir o do seu país:

```bash
pnpm tsx -e "const t=require('world-atlas/countries-110m.json');console.log(t.objects.countries.geometries.filter(g=>/Peru/i.test(g.properties.name)).map(g=>g.properties.name+' = '+g.id).join('\n'))"
```

Trocando `Peru` pelo nome **em inglês**, que é como a base o traz. Se não aparecer
nada, o mapa não desenha aquele país nesta resolução — vale abrir uma issue em vez
de forçar.

Este é o passo que vai desaparecer; ver o gargalo no
[CONTRIBUTING](../CONTRIBUTING.md#gargalo-conhecido-libgeoisots).

## 6. Conferir

```bash
pnpm validar
```

Ele diz o arquivo, o campo e o que falta. É o comando que você vai rodar mais
vezes, e a mensagem de erro é escrita para quem escreve conteúdo, não para quem
programa. Quando passar:

```bash
pnpm test
```

E para ver na tela:

```bash
pnpm dev
```

Em <http://localhost:3000/atlas>, arraste a barra do tempo até uma data dentro de
um dos seus períodos: o país deve **acender** com contorno azul e virar clicável.
Se não acender, quase sempre é o passo 5.

## 7. Regerar a cobertura e abrir o PR

```bash
pnpm tsx scripts/cobertura.ts
```

Comite `docs/cobertura.md` junto — é ele que mostra o mundo diminuindo.

No PR, diga de onde vem o que você escreveu. Não precisa ser longo; precisa deixar
claro em que se apoiou.

## Quanto trabalho é, de verdade

Os nove países existentes têm **6 a 16 períodos** e cerca de **3.200 caracteres por
período**. Um país inteiro é, na prática, um fim de semana de leitura e escrita.

Não precisa ser tudo de uma vez: **um PR com três períodos bem feitos é melhor que
um com doze apressados**, e o país pode crescer depois. O atlas prefere pouco com
fonte a muito sem.
