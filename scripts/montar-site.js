// Monta a pasta site/ com tudo que o celular precisa: public/ na raiz e src/ em site/src/.
// É essa pasta que vai para o GitHub Pages (ou qualquer hospedagem de arquivos com https).
import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = new URL('../site/', import.meta.url);

await rm(destino, { recursive: true, force: true });
await cp(new URL('../public/', import.meta.url), destino, { recursive: true });
await cp(new URL('../src/', import.meta.url), new URL('src/', destino), { recursive: true });
console.log(`Site montado em ${fileURLToPath(destino)} (a partir de ${raiz})`);
