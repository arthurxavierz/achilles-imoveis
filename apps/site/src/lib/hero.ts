import fs from 'node:fs';
import path from 'node:path';

import { SITE } from './site';

/**
 * Descobre a foto de abertura da home.
 *
 * A ordem de preferencia e deliberada:
 *
 * 1. NEXT_PUBLIC_HERO_IMAGEM, se estiver definida. E o escape para
 *    apontar a uma CDN ou trocar a foto sem novo deploy do repositorio.
 * 2. Um arquivo em assets/site/, com qualquer uma das extensoes abaixo.
 * 3. Nada. A home cai no skyline desenhado em CSS.
 *
 * O terceiro caso e o que importa: sem esta checagem, apontar o <Image>
 * para um arquivo inexistente daria 404 e uma faixa preta vazia no lugar
 * mais visivel do site. Aqui a ausencia do arquivo e uma condicao
 * prevista, nao um acidente — a home nasce funcionando e melhora quando
 * a foto chega.
 *
 * Roda so no servidor: e chamada da page.tsx, que e componente de
 * servidor. Importar isto de um componente com 'use client' quebra o
 * build, e e para quebrar mesmo: fs nao existe no navegador.
 */

const NOME = 'hero';
const EXTENSOES = ['jpg', 'jpeg', 'webp', 'avif', 'png'] as const;

export function imagemDoHero(): string | null {
  if (SITE.heroImagem) return SITE.heroImagem;

  for (const extensao of EXTENSOES) {
    const relativo = `/assets/site/${NOME}.${extensao}`;
    if (fs.existsSync(path.join(process.cwd(), 'public', relativo))) return relativo;
  }

  return null;
}
