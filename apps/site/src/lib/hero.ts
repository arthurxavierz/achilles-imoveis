import { SITE } from './site';

/**
 * Descobre a foto de abertura da home.
 *
 * A ordem de preferencia e deliberada:
 *
 * 1. NEXT_PUBLIC_HERO_IMAGEM, se estiver definida. E o escape para
 *    apontar a uma CDN ou trocar a foto sem novo deploy do repositorio.
 * 2. Um arquivo em assets/site/hero.*, procurado no build pelo
 *    next.config.mjs e embutido na mesma variavel. A procura era feita
 *    aqui, a cada requisicao, mas no Cloudflare Workers nao ha disco.
 * 3. Nada. A home cai no skyline desenhado em CSS.
 *
 * O terceiro caso e o que importa: sem ele, apontar o <Image> para um
 * arquivo inexistente daria 404 e uma faixa preta vazia no lugar mais
 * visivel do site. A home nasce funcionando e melhora quando a foto
 * chega. Trocar ou incluir a foto em assets/site/ pede novo build.
 */
export function imagemDoHero(): string | null {
  return SITE.heroImagem || null;
}
