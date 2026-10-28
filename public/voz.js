// Reconhecimento de voz offline com Vosk (biblioteca vosk-browser, WebAssembly).
// Só liga se a biblioteca e o modelo forem colocados manualmente (ver public/modelo-pt/README.md).
// Nada é baixado da internet: os arquivos são lidos deste mesmo servidor.
const BIBLIOTECA = new URL('./vendor/vosk.js', import.meta.url).href;
const MODELO = new URL('./modelo-pt/modelo.tar.gz', import.meta.url).href;

async function existe(url) {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

export async function verificarVoz() {
  if (typeof WebAssembly !== 'object') return { ok: false, motivo: 'Este navegador não consegue rodar o reconhecimento de voz.' };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, motivo: 'Este navegador não dá acesso ao microfone.' };
  const [temBiblioteca, temModelo] = await Promise.all([existe(BIBLIOTECA), existe(MODELO)]);
  if (!temBiblioteca || !temModelo) return { ok: false, motivo: 'A voz ainda não está instalada neste aparelho.' };
  return { ok: true };
}

let modelo = null;

async function carregarModelo() {
  if (!window.Vosk) {
    await new Promise((pronto, falha) => {
      const script = document.createElement('script');
      script.src = BIBLIOTECA;
      script.onload = pronto;
      script.onerror = () => falha(new Error('Não consegui carregar a biblioteca de voz.'));
      document.head.append(script);
    });
  }
  modelo ??= await window.Vosk.createModel(MODELO);
  return modelo;
}

// Começa a ouvir. Retorna a função `parar`, que entrega o texto final em `aoFinal`.
export async function ouvir({ aoParcial, aoFinal }) {
  const m = await carregarModelo();
  const microfone = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const contexto = new AudioContext();
  const reconhecedor = new m.KaldiRecognizer(contexto.sampleRate);
  let texto = '';
  reconhecedor.on('result', (msg) => {
    if (msg.result.text) texto = `${texto} ${msg.result.text}`.trim();
    aoParcial?.(texto);
  });
  reconhecedor.on('partialresult', (msg) => aoParcial?.(`${texto} ${msg.result.partial ?? ''}`.trim()));

  const fonte = contexto.createMediaStreamSource(microfone);
  const processador = contexto.createScriptProcessor(4096, 1, 1);
  processador.onaudioprocess = (evento) => {
    try {
      reconhecedor.acceptWaveform(evento.inputBuffer);
    } catch {
      // Um pedaço de áudio perdido não deve derrubar a gravação.
    }
  };
  fonte.connect(processador);
  processador.connect(contexto.destination);

  return function parar() {
    processador.disconnect();
    fonte.disconnect();
    microfone.getTracks().forEach((faixa) => faixa.stop());
    reconhecedor.retrieveFinalResult?.();
    setTimeout(() => {
      reconhecedor.remove?.();
      contexto.close();
      aoFinal?.(texto);
    }, 400);
  };
}
