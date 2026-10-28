# Decisões

Escolhas feitas durante a construção, sem consulta prévia. Cada uma pode ser revista.

## Processo
- **Sem PLANO.md de aprovação.** O dono do projeto pediu para executar direto. A ordem seguida foi:
  estrutura e servidor → lógica (interpretador, registros, indicadores) → testes → interface →
  teste no navegador → documentação.
- **Ferramentas portáteis.** A máquina não tinha Node nem Git. Com autorização, foram baixados o
  Node 22.23.4 (zip oficial de nodejs.org, SHA-256 conferido) e o MinGit 2.56.0.4 (GitHub
  oficial do Git for Windows), apenas em uma pasta temporária, sem instalar nada no sistema.

## Interpretador
- **Nunca salva sem confirmação.** Mesmo com confiança alta, o produtor toca em "Sim, salvar".
  Alta = um toque; média ou baixa = os campos que faltam aparecem antes do botão.
- **Campo extra `faltando` e `avisos`.** Além de `{ tipo, categoria, quantidade, valor, pesoKg,
  confianca }`, a saída diz quais campos pedir e explica em português o que não ficou claro.
- **"Conto" = R$ 1.000,00, só de 1 a 99 contos.** "Quinhentos conto" daria R$ 500.000,00, o que
  quase nunca é a intenção: a frase fica com confiança baixa e o app pede o valor em reais.
  "Um conto e meio" = R$ 1.500,00.
- **Valor sem "reais"** ("vendi dois cabritos por quinhentos") → confiança média, valor pré-preenchido
  para confirmar.
- **"cada"** multiplica pelo número de animais: "três cabritos a 300 reais cada" = R$ 900,00.
- **Singular sem número**: "morreu a cabra" (com artigo) vale 1 com confiança alta; "morreu cabrito"
  (sem artigo) vale 1 com confiança média.
- **Parto**: em "a cabra pariu dois cabritos" quem nasceu foram os cabritos. Em "a cabra pariu
  gêmeos" a categoria fica em aberto e o app pergunta se são cabritos, cabritas ou borregos.
- **Variações aceitas**: plurais, diminutivos (cabritinho), cordeiro → borrego, "bode novo" → bode,
  "matriz de cabra" → matriz, "deu cria", gêmeos (2), meia dúzia (6), dúzia (12).
- **Mais de um animal ou acontecimento na mesma frase** ("nasceu um cabrito e uma cabrita") →
  confiança baixa e pedido para registrar um de cada vez. Dividir em dois lançamentos fica para depois.
- **Idade e datas faladas são ignoradas** ("bode de 2 anos", "dia 12"): a data fica como hoje e
  pode ser corrigida no registro rápido.

## Registros
- **Tipo "custo"** (gasto com ração, vacina etc.) só entra pelo registro rápido. É necessário para o
  indicador de custo por cabeça.
- **Valores em reais com duas casas** (arredondados ao salvar). Pesagem aceita de 0 a 200 kg.
- **Matriz e reprodutor são categorias próprias.** Uma cabra contada como matriz não deve ser contada
  também como cabra. A tela de contagem explica cada categoria.

## Indicadores
- **Contagem base.** Na primeira vez o produtor informa quantos animais tem e em que data. O saldo
  de qualquer dia = contagem base + lançamentos desde aquela data. Lançamentos anteriores à data base
  são considerados já incluídos na contagem.
- **Período cortado** para começar na data da contagem e terminar hoje. A tela avisa quando isso acontece.
- **Média de animais**: com lançamentos que mudam o rebanho no período, média dos saldos de fim de
  cada dia; sem eles, (inicial + final) ÷ 2. A tela mostra qual método foi usado. A fórmula
  (inicial + final) ÷ 2 erra quando o rebanho muda no meio do período (ex.: 20 animais o mês todo e
  10 comprados no dia 29 dariam média 25, quando o real é perto de 20).
- **"sem dados"** em vez de zero quando não há custos lançados ou não há animais.

## Interface
- **Registro rápido em uma tela só**, com as etapas aparecendo conforme o produtor escolhe:
  tipo → animal → quantidade → Salvar = 4 toques (3 pelos atalhos Nasceu/Morreu/Vendeu).
- **Confirmação própria** (não o `confirm()` do navegador) para apagar e restaurar.
- **"Restaurar uma cópia"** foi adicionado ao lado de "Exportar dados": sem ele a cópia de segurança
  não teria como voltar para o aparelho.
- **O servidor também entrega `src/`**, para o navegador usar exatamente os mesmos módulos testados.

## Uso no celular (Eixo 2, Desafio 6)
- **App instalável e offline (PWA)** em vez de app de loja: não precisa de conta de desenvolvedor,
  não paga nada e atualiza sozinho quando houver sinal. Para o pequeno produtor, a barreira é menor.
- **Cache que responde na hora e atualiza por trás.** O app abre mesmo sem sinal; quando o celular
  conecta, a próxima abertura já vem com a versão nova. Não é preciso mudar `VERSAO_CACHE` a cada
  alteração; mude só se quiser forçar a limpeza da cópia antiga.
- **Lista de arquivos offline explícita** (`public/arquivos-offline.js`), com teste que acusa
  arquivo esquecido, em vez de um passo de build que gere a lista.
- **Caminhos relativos em tudo**, para o app funcionar numa subpasta do GitHub Pages
  (`usuario.github.io/repositorio/`). Um teste barra caminhos absolutos.
- **GitHub Pages pelo GitHub Actions**: o workflow roda `npm test` antes de publicar; se um teste
  falhar, nada é publicado. A ativação no GitHub (Settings → Pages) é do dono do repositório.
- **Testado** no Chrome do computador, numa subpasta que imita o Pages: o service worker guardou os
  17 arquivos e, com o servidor desligado, o app abriu e salvou um registro. O navegador embutido
  do Claude não aceita service worker, por isso o teste foi no Chrome.
- **Testado num celular de verdade** (28/10/2026): a v1, publicada no GitHub Pages, foi adicionada
  à tela inicial e funcionou offline no celular do autor. A v2 (completa) ainda não foi testada
  no celular.

## Voz (Vosk)
- **Não instalado.** O CLAUDE.md pede autorização antes de instalar pacotes, e a licença da
  biblioteca e do modelo ainda **não foi confirmada** na documentação oficial.
- O código de integração está em `public/voz.js`, seguindo a API do vosk-browser (`createModel`,
  `KaldiRecognizer`, `acceptWaveform`). **Não foi testado**, porque os arquivos não estão presentes.
  Sem eles o app avisa e oferece escrever a frase ou usar o registro rápido.
- A regra de privacidade continua valendo: o modelo é lido do próprio servidor local e nada vai
  para a internet. A API de voz do Chrome (Web Speech) foi descartada porque envia o
  áudio para servidores externos.
