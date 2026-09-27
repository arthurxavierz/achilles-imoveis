import type { MetadataRoute } from 'next';

import { listarSlugsPublicados } from '@imob/db';

import { carregarCondominios } from '@/lib/dados';
import { semBanco, slugsPublicados } from '@/lib/demonstracao';
import { SITE } from '@/lib/site';
import { supabase } from '@/lib/supabase';

export const revalidate = 3600;

/**
 * Sitemap com todos os imoveis publicados.
 *
 * E o que faz o Google descobrir um imovel novo em horas em vez de
 * semanas. Cada URL leva a data da ultima alteracao, entao o buscador
 * sabe o que revisitar sem varrer o site inteiro.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE.url}/imoveis`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE.url}/condominios`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE.url}/anuncie`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE.url}/sobre`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE.url}/contato`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE.url}/politica-de-privacidade`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const [imoveis, condominios] = await Promise.all([
      semBanco()
        ? Promise.resolve(slugsPublicados())
        : listarSlugsPublicados(supabase()),
      carregarCondominios({ limite: 200 }),
    ]);

    return [
      ...fixas,
      ...condominios.map((c) => ({
        url: `${SITE.url}/condominio/${c.slug}`,
        lastModified: new Date(c.atualizado_em),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...imoveis.map((i) => ({
        url: `${SITE.url}/imovel/${i.slug}`,
        lastModified: new Date(i.atualizado_em),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch (erro) {
    console.error('[sitemap] falha ao listar imoveis:', erro);
    return fixas;
  }
}
