# Diário do Rebanho

Protótipo para o **3º Hackathon AgroTech Tauá**. Diário de caprinos e ovinos em que o produtor
fala ou escreve o que aconteceu ("nasceram dois cabritos", "vendi três cabritos por setecentos
reais"). O app mostra o que entendeu, pede confirmação e calcula indicadores simples: saldo por
categoria, taxa de mortalidade e custo por cabeça.

Os dados ficam só no aparelho (localStorage). Nada é enviado pela internet.

## Como rodar

Precisa do Node.js 20 ou mais novo. Não há dependências para instalar.

```bash
npm start
```

Abra http://localhost:3000. Para usar outra porta: `PORT=8080 npm start` (no PowerShell:
`$env:PORT=8080; npm start`).

## Como usar no celular, sem computador

O app é instalável e funciona **sem internet** depois de aberto uma vez. Para isso ele precisa
estar num endereço com https. A forma gratuita é o GitHub Pages:

1. Publique o repositório no GitHub (no GitHub Desktop: *Publish repository*).
2. No GitHub, abra o repositório → **Settings → Pages** → em *Source*, escolha **GitHub Actions**.
3. A cada envio para a branch `main`, o workflow [.github/workflows/pages.yml](.github/workflows/pages.yml)
   roda os testes e publica o app em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. No celular, abra esse endereço uma vez com internet. No Chrome, toque em **⋮ → Instalar app**
   (ou *Adicionar à tela inicial*). Pronto: o ícone fica na tela e o app abre no curral, sem sinal.

O que torna isso possível:
- `public/manifest.webmanifest` e `public/icones/`: nome, ícone e cor do app instalado.
- `public/sw.js` e `public/arquivos-offline.js`: guardam o app no celular e o abrem sem rede. Quando
  houver sinal, a cópia é atualizada por trás.
- `npm run site` monta a pasta `site/` (é ela que vai para o Pages).

Os registros continuam só no celular. A publicação no Pages leva só o código do app, nunca os dados.

Abrir pelo Wi-Fi com `http://IP-DO-COMPUTADOR:3000` funciona para mostrar as telas, mas sem https o
celular não guarda o app para usar offline.

## Três versões para a apresentação

Com o servidor rodando, abra http://localhost:3000/versoes/ para ver as três versões lado a lado:

| Versão | Endereço | O que mostra |
| --- | --- | --- |
| v0, rascunho | `/versoes/v0/` | Só as telas, com dados de exemplo. Dá para navegar, nada salva. |
| v1, mínimo | `/versoes/v1/` | Anotar nascimento, morte, compra e venda por botões e ver a lista. |
| v2, completa | `/` | Frase falada ou escrita, botões coloridos, pesagem, gastos, indicadores e cópia de segurança. |

A v1 usa as mesmas regras testadas de `src/` e guarda os dados separados da v2, então uma não
mexe nos registros da outra.

## Como testar

```bash
npm test
```

Resultado nesta versão: **70 testes, 70 passando, 0 falhas** (Node 22.23.4).

| Arquivo | O que cobre |
| --- | --- |
| `test/interpretador.test.js` | 35 frases com a saída esperada (9 de confiança baixa), entrada vazia ou nula |
| `test/indicadores.test.js` | saldo por categoria, média que muda no período, mortalidade, custo com e sem custos, corte do período |
| `test/registros.test.js` | quantidade zero, valor negativo, data futura e inexistente, pesagem sem peso, custo |
| `test/formato.test.js` | R$ 1.234,56, leitura de valores digitados, datas dd/mm/aaaa |
| `test/servidor.test.js` | entrega das páginas e das versões, bloqueio de acesso fora das pastas |
| `test/offline.test.js` | nenhum arquivo fora da lista offline, manifesto válido, nenhum caminho absoluto |

## Estrutura

```
server.js            servidor estático (módulo http do Node)
src/                 regras de negócio, sem DOM (também servidas ao navegador)
  interpretador.js   texto → { tipo, categoria, quantidade, valor, pesoKg, confianca }
  registros.js       validação dos lançamentos
  indicadores.js     saldo, média de animais, mortalidade, custo por cabeça
  rotulos.js         nomes, explicações dos termos, frase de cada lançamento
  formato.js         reais, números e datas no padrão brasileiro
public/              interface (HTML, CSS, app.js, voz.js)
  sw.js              guarda o app no celular para abrir sem internet
  manifest.webmanifest, icones/   app instalável
  versoes/           v0 (rascunho) e v1 (mínimo) para a apresentação
  modelo-pt/         onde colocar o modelo de voz (ver README.md da pasta)
scripts/montar-site.js   monta site/ para publicar
test/                um arquivo de teste por módulo
```

## Como colocar a voz

O reconhecimento offline usa Vosk, que **não vem no projeto**. Siga
[public/modelo-pt/README.md](public/modelo-pt/README.md): colocar o modelo em
`public/modelo-pt/modelo.tar.gz` e a biblioteca em `public/vendor/vosk.js`. Confira a licença antes.
Sem esses arquivos, o botão "Falar" leva a uma tela onde o produtor escreve a frase, com o mesmo
interpretador, ou usa o registro rápido.

## O que foi simplificado e por quê

- **Voz não instalada**: exige autorização e confirmação de licença (ver DECISOES.md). O código de
  integração existe, mas não foi testado.
- **Uma frase = um lançamento**: frases com dois animais pedem para registrar separado. Mais simples
  de confirmar e de corrigir.
- **Datas faladas não são entendidas**: a data padrão é hoje e se corrige no registro rápido.
- **Sem contas ou nuvem**: tudo fica no aparelho. A cópia de segurança é um arquivo exportado.
- **Indicadores por rebanho inteiro**: mortalidade e custo não são separados por categoria.

## Expressões regionais ainda não cobertas

Para coletar com produtores e ensinar ao interpretador:

1. "perdi dois cabritos" (morte, furto ou extravio?)
2. "a cabra abortou"
3. "sumiu um bode" / "roubaram três cabras"
4. "apartei os cabritos" (separação, desmame)
5. "dei um bode" / "troquei uma cabra por um carneiro"
6. "uma barrigada de três" (parto com três filhotes)
7. "marrã", "chibato", "chiba" (nomes regionais por idade e sexo)
8. "mestiço", "pé-duro", "SRD" (raça, que hoje é ignorada)
9. "deu uma arroba" (peso em arroba em vez de quilo)
10. "vendi a dez conto o quilo vivo" (preço por quilo)

## Perguntas para entrevista com produtores

1. Nos últimos 12 meses, quantos animais você perdeu por furto, morte ou sumiço? Como ficou sabendo?
2. Hoje você anota nascimentos, mortes e vendas em algum lugar? Caderno, cabeça, celular?
3. Quando um animal some, como você prova quantos tinha (para polícia, seguro ou associação)?
4. Você usa o celular no curral ou só em casa? Tem sinal de internet lá?
5. Prefere falar ou tocar em botões? Quem da família mexe mais no celular?

## Ligação com o edital

**Eixo 2: Sucessão e modernização do campo.**

- **Desafio 6, Tecnologia acessível ao pequeno produtor (item 6.1.2): desafio principal.**
  - Realidade financeira: gratuito, sem mensalidade, feito para celular Android simples (ainda falta
    testar num aparelho de entrada de verdade).
  - Realidade estrutural: funciona sem internet depois de instalado; os dados ficam no celular.
  - Realidade operacional: botões de 56px, letra grande, uma cor e um ícone por ação, registro em
    até 4 toques ou por uma frase como "nasceram dois cabritos". Sem cadastro e sem senha.
- **Desafio 5, Automação e eficiência (item 6.1.1): desafio secundário.** Troca o caderno, ou a
  memória, por uma anotação rápida, e faz sozinho as contas de saldo do rebanho, mortalidade e custo
  por cabeça.
- **Desafio 8, Sucessão rural (item 6.1.4): ligação indireta.** Em muitas famílias é o jovem que
  mexe no celular; o app pode ser um jeito de ele participar da gestão do rebanho. Validar isso nas
  entrevistas (pergunta 5).
