/**
 * Monta o acervo de fotos da demonstração a partir do Unsplash.
 *
 * Roda uma vez, à mão (`node scripts/baixar-fotos.mjs`), e o resultado
 * fica versionado em assets/fotos/. A demonstração não depende de rede
 * na hora de apresentar: tudo vem do próprio site.
 *
 * Só entram fotos gratuitas (licença Unsplash, uso comercial liberado) e
 * reais; renders 3D ficam de fora porque denunciam o banco de imagem na
 * primeira olhada. O crédito de cada foto vai para assets/fotos/creditos.json.
 */

import fs from 'node:fs';
import path from 'node:path';

const DESTINO = path.resolve('assets/fotos');

// categoria -> [busca, quantidade, largura]
const ACERVO = {
  casa: ['modern luxury house exterior', 14, 1600],
  predio: ['modern residential apartment building facade', 7, 1600],
  sala: ['modern living room interior', 12, 1600],
  cozinha: ['modern kitchen interior', 7, 1600],
  quarto: ['modern bedroom interior', 7, 1600],
  banheiro: ['luxury bathroom interior', 5, 1600],
  piscina: ['villa swimming pool', 6, 1600],
  cobertura: ['penthouse terrace city view', 5, 1600],
  studio: ['small studio apartment interior', 5, 1600],
  escritorio: ['modern office interior', 5, 1600],
  loja: ['retail store interior', 3, 1600],
  galpao: ['warehouse interior', 3, 1600],
  rural: ['farmhouse countryside', 6, 1600],
  campo: ['farmland aerial view', 4, 1600],
  terreno: ['empty land lot green field', 3, 1600],
  condominio: ['luxury residential complex pool', 6, 1600],
  hero: ['modern luxury house dusk', 3, 2400],
};

const PROIBIDO = /render|3d|illustration|model|drawing|sketch|miniature|toy/i;

async function buscar(consulta, pagina) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(consulta)}&per_page=30&page=${pagina}&orientation=landscape`;
  const resposta = await fetch(url, { headers: { 'user-agent': 'curl/8.9.1', accept: '*/*' } });
  if (!resposta.ok) throw new Error(`${resposta.status} em ${consulta}`);
  return (await resposta.json()).results;
}

fs.mkdirSync(DESTINO, { recursive: true });
const SO = process.argv[2];
const arquivoCreditos = path.join(DESTINO, 'creditos.json');
const creditos = SO && fs.existsSync(arquivoCreditos) ? JSON.parse(fs.readFileSync(arquivoCreditos, 'utf8')) : {};
const usados = new Set();

for (const [categoria, [consulta, quantidade, largura]] of Object.entries(ACERVO)) {
  if (SO && categoria !== SO) continue;
  const candidatos = [...(await buscar(consulta, 1)), ...(await buscar(consulta, 2))].filter(
    (f) => !f.premium && !f.plus && !usados.has(f.id) && !PROIBIDO.test(f.alt_description ?? '') && f.width > f.height,
  );

  let n = 0;
  for (const foto of candidatos) {
    if (n >= quantidade) break;
    const arquivo = `${categoria}-${String(n + 1).padStart(2, '0')}.jpg`;
    const url = `${foto.urls.raw}&w=${largura}&q=70&fm=jpg&fit=crop&ar=3:2`;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      fs.writeFileSync(path.join(DESTINO, arquivo), Buffer.from(await r.arrayBuffer()));
      usados.add(foto.id);
      creditos[arquivo] = {
        autor: foto.user.name,
        perfil: foto.user.links.html,
        origem: foto.links.html,
        descricao: foto.alt_description,
      };
      n++;
    } catch (erro) {
      console.error(arquivo, erro.message);
    }
  }
  console.log(`${categoria}: ${n}/${quantidade}`);
}

fs.writeFileSync(arquivoCreditos, JSON.stringify(creditos, null, 2));
