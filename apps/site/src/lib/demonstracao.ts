/**
 * Ponte do site para a base de demonstração.
 *
 * Os dados moram em @imob/demo, num arquivo compartilhado com o painel
 * de gestão. É isso que permite publicar um imóvel no painel e vê-lo
 * aparecer aqui, sem banco nenhum configurado.
 *
 * Tudo está atrás de semBanco(): assim que NEXT_PUBLIC_SUPABASE_URL
 * existir, nada daqui é usado. Não é um plano B para banco fora do ar,
 * é um modo de trabalho antes do banco existir.
 */

export {
  modoDemo as semBanco,
  atualizadosVitrine,
  buscarVitrine as buscarDemo,
  condominioPorSlug,
  condominiosVitrine,
  destaquesVitrine,
  facetasVitrine,
  imovelPorSlug,
  imoveisPorIds,
  loteDestaqueVitrine,
  recentesVitrine,
  registrarLeadDemo,
  semelhantesVitrine,
  slugsPublicados,
} from '@imob/demo';
