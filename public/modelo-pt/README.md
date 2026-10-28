# Modelo de voz em português (Vosk)

O app reconhece a fala sem internet usando o **Vosk** no navegador. Os arquivos não vêm no
repositório: você coloca manualmente, depois de conferir a licença.

## O que colocar

1. **Modelo em português** (pequeno, cerca de 30 a 50 MB):
   - Página oficial de modelos: https://alphacephei.com/vosk/models
   - Escolha o modelo pequeno de português (`vosk-model-small-pt-...`).
   - O vosk-browser lê o modelo compactado em `.tar.gz`. Se o download vier em `.zip`,
     descompacte e compacte de novo a pasta em `.tar.gz`.
   - Salve como: `public/modelo-pt/modelo.tar.gz`

2. **Biblioteca vosk-browser** (um arquivo JavaScript):
   - Projeto: https://github.com/ccoreilly/vosk-browser
   - Copie o arquivo `vosk.js` da versão publicada para `public/vendor/vosk.js`.

Ao abrir a tela "Registrar falando", o app procura esses dois arquivos. Se faltar algum, ele avisa
e oferece escrever a frase ou usar o registro rápido.

## Licenças (conferir antes de usar)

Confirme na página oficial de cada projeto antes de distribuir o app:

- Biblioteca vosk-browser: veja o arquivo LICENSE no repositório.
- Modelo de português: a licença aparece na tabela da página de modelos, ao lado de cada modelo.

Registre o que encontrar no `DECISOES.md`.
