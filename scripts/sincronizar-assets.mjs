/**
 * Copia assets/ para o public/ de cada app.
 *
 * Next.js so serve arquivo estatico que esteja dentro do public/ do
 * proprio app. Como a marca e uma so e os apps sao dois, o original
 * fica na raiz e esta copia acontece antes do dev e do build.
 *
 * A copia e destruida e refeita a cada execucao, de proposito: sem
 * isso, um arquivo removido da origem continuaria servido pelo destino,
 * e a logo antiga sobreviveria a propria substituicao.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origem = path.join(raiz, 'assets');

const destinos = [
  path.join(raiz, 'apps', 'site', 'public', 'assets'),
  path.join(raiz, 'apps', 'app', 'public', 'assets'),
];

if (!fs.existsSync(origem)) {
  console.error('[assets] pasta assets/ não encontrada na raiz. Nada a copiar.');
  process.exit(0);
}

let total = 0;

function copiar(de, para) {
  fs.mkdirSync(para, { recursive: true });

  for (const item of fs.readdirSync(de, { withFileTypes: true })) {
    const origemItem = path.join(de, item.name);
    const destinoItem = path.join(para, item.name);

    if (item.isDirectory()) {
      copiar(origemItem, destinoItem);
      continue;
    }

    // Markdown nesta árvore é documentação para quem programa: explica
    // o que a pasta guarda e como nomear o arquivo. Não tem por que
    // chegar ao navegador de quem visita o site.
    if (item.name.toLowerCase().endsWith('.md')) continue;

    fs.copyFileSync(origemItem, destinoItem);
    total += 1;
  }
}

for (const destino of destinos) {
  fs.rmSync(destino, { recursive: true, force: true });
  copiar(origem, destino);
}

console.log(`[assets] ${total / destinos.length} arquivo(s) em ${destinos.length} apps.`);
