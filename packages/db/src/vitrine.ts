/**
 * Consultas da vitrine publica.
 *
 * Todas leem as views vitrine_imoveis e vitrine_condominios, nunca as
 * tabelas. A view ja exclui o que nao e publico (matricula,
 * proprietario, observacoes internas) e ja filtra publicado = true.
 * Assim um select distraido no frontend nao tem como vazar dado de
 * captacao.
 *
 * O tamanho da carteira mudou o desenho daqui. Com quase mil imoveis, a
 * paginacao passa a ser obrigatoria em toda consulta, as facetas saem de
 * uma funcao agregada no banco em vez de uma varredura em JavaScript, e
 * a ordenacao sempre carrega um desempate por id, senao dois imoveis com
 * o mesmo valor trocam de lugar entre paginas e aparecem duplicados.
 */

import type { Cliente } from './clientes';
import type {
  CondominioComResumo,
  FiltroBusca,
  Foto,
  ImovelPublico,
  OrdemBusca,
} from '@imob/core';

const VIEW = 'vitrine_imoveis';
const VIEW_CONDOMINIOS = 'vitrine_condominios';

const ORDENACAO: Record<OrdemBusca, { coluna: string; crescente: boolean }> = {
  relevancia: { coluna: 'destaque', crescente: false },
  recentes: { coluna: 'criado_em', crescente: false },
  menor_preco: { coluna: 'valor', crescente: true },
  maior_preco: { coluna: 'valor', crescente: false },
  maior_area: { coluna: 'area_util', crescente: false },
  menor_area: { coluna: 'area_util', crescente: true },
};

/**
 * Limpa o texto que o visitante digitou antes de entrar num filtro or()
 * do PostgREST.
 *
 * Isto NAO e paranoia: no PostgREST a expressao or() e uma string, e
 * virgula, ponto e parenteses sao a sintaxe dela. Um termo de busca com
 * "a,b.eq.c" reescreveria o filtro em vez de ser tratado como texto. O
 * RLS ainda impediria vazamento de linha nao publicada, mas a consulta
 * viraria outra. Aqui so sobra o que e seguro dentro de um ilike.
 */
function limparTermo(texto: string): string {
  return texto
    .replace(/[,().*\\"'%:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export interface ResultadoBusca {
  imoveis: ImovelPublico[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

const VAZIO: ResultadoBusca = {
  imoveis: [],
  total: 0,
  pagina: 1,
  porPagina: 12,
  totalPaginas: 1,
};

/**
 * Busca com filtros da vitrine. Retorna a pagina pedida e o total, para
 * a paginacao saber quantas paginas existem sem uma segunda consulta.
 */
export async function buscarImoveis(
  cliente: Cliente,
  filtro: FiltroBusca = {},
): Promise<ResultadoBusca> {
  const pagina = Math.max(1, Number(filtro.pagina ?? 1));
  const porPagina = Math.min(48, Math.max(1, Number(filtro.porPagina ?? 12)));
  const de = (pagina - 1) * porPagina;
  const ate = de + porPagina - 1;

  let q = cliente.from(VIEW).select('*', { count: 'exact' });

  if (filtro.termo?.trim()) {
    const t = limparTermo(filtro.termo);
    if (t) {
      q = q.or(
        `titulo.ilike.%${t}%,bairro.ilike.%${t}%,cidade.ilike.%${t}%,` +
          `codigo.ilike.%${t}%,condominio_nome.ilike.%${t}%,referencia_externa.ilike.%${t}%`,
      );
    }
  }

  if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
  if (filtro.bairro) q = q.eq('bairro', filtro.bairro);
  if (filtro.cidade) q = q.eq('cidade', filtro.cidade);
  if (filtro.condominio) q = q.eq('condominio_nome', filtro.condominio);
  if (filtro.quartos) q = q.gte('quartos', filtro.quartos);
  if (filtro.suites) q = q.gte('suites', filtro.suites);
  if (filtro.banheiros) q = q.gte('banheiros', filtro.banheiros);
  if (filtro.vagas) q = q.gte('vagas', filtro.vagas);
  if (filtro.valorMin) q = q.gte('valor', filtro.valorMin);
  if (filtro.valorMax) q = q.lte('valor', filtro.valorMax);
  if (filtro.areaMin) q = q.gte('area_util', filtro.areaMin);
  if (filtro.areaMax) q = q.lte('area_util', filtro.areaMax);
  if (filtro.somenteDestaque) q = q.eq('destaque', true);
  if (filtro.caracteristicas?.length) q = q.contains('caracteristicas', filtro.caracteristicas);

  // Locacao filtra pelas duas finalidades que aceitam alugar, porque o
  // imovel marcado como venda_locacao serve aos dois publicos.
  if (filtro.finalidade === 'locacao') q = q.in('finalidade', ['locacao', 'venda_locacao']);
  else if (filtro.finalidade === 'venda') q = q.in('finalidade', ['venda', 'venda_locacao']);

  const ordem = ORDENACAO[filtro.ordem ?? 'relevancia'];
  q = q.order(ordem.coluna, { ascending: ordem.crescente });
  // Desempate estavel: sem isso, dois imoveis com o mesmo valor podem
  // trocar de lugar entre paginas e aparecer duplicados para o visitante.
  q = q.order('id', { ascending: true });

  const { data, error, count } = await q.range(de, ate);
  if (error) throw error;

  const imoveis = (data ?? []) as ImovelPublico[];
  await anexarFotos(cliente, imoveis);

  const total = count ?? imoveis.length;
  return {
    imoveis,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Um imovel pela URL publica. Retorna null quando nao existe ou saiu do ar. */
export async function buscarImovelPorSlug(
  cliente: Cliente,
  slug: string,
): Promise<ImovelPublico | null> {
  const { data, error } = await cliente.from(VIEW).select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const imovel = data as ImovelPublico;
  await anexarFotos(cliente, [imovel]);
  return imovel;
}

/** Destaques da home. */
export async function buscarDestaques(cliente: Cliente, limite = 8): Promise<ImovelPublico[]> {
  const { data, error } = await cliente
    .from(VIEW)
    .select('*')
    .eq('destaque', true)
    .eq('status', 'disponivel')
    .order('valor', { ascending: false })
    .limit(limite);
  if (error) throw error;

  const imoveis = (data ?? []) as ImovelPublico[];
  await anexarFotos(cliente, imoveis);
  return imoveis;
}

/** Os mais recentes, para o bloco de novidades da home. */
export async function buscarRecentes(cliente: Cliente, limite = 8): Promise<ImovelPublico[]> {
  const { data, error } = await cliente
    .from(VIEW)
    .select('*')
    .eq('status', 'disponivel')
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw error;

  const imoveis = (data ?? []) as ImovelPublico[];
  await anexarFotos(cliente, imoveis);
  return imoveis;
}

/**
 * Lote de onde a home sorteia a vitrine de destaque.
 *
 * Traz primeiro quem esta marcado como destaque e completa com o resto
 * da carteira publicada, dos mais caros para os mais baratos. Os dois
 * comportamentos importam: hoje ninguem marcou nada, e uma secao que
 * dependesse so da marcacao apareceria vazia; e quando a equipe comecar
 * a marcar, o que ela escolheu entra na frente sem precisar mexer aqui.
 *
 * O lote e grande de proposito. Quem sorteia sete e a tela, a cada
 * carregamento, e sortear de um conjunto de sete nao sortearia nada.
 *
 * So a foto de capa vem junto. O album inteiro seriam dezesseis fotos
 * por imovel, e num lote de trinta e seis isso passa de quinhentas
 * linhas para alimentar trinta e seis miniaturas — sem contar que o
 * PostgREST corta a resposta em mil linhas, entao um lote maior comecaria
 * a perder foto no fim da lista, em silencio.
 */
export async function buscarLoteDestaque(
  cliente: Cliente,
  limite = 36,
): Promise<ImovelPublico[]> {
  const { data: marcados, error: erroMarcados } = await cliente
    .from(VIEW)
    .select('*')
    .eq('destaque', true)
    .eq('status', 'disponivel')
    .order('valor', { ascending: false })
    .limit(limite);
  if (erroMarcados) throw erroMarcados;

  const lote = (marcados ?? []) as ImovelPublico[];

  if (lote.length < limite) {
    let completar = cliente
      .from(VIEW)
      .select('*')
      .eq('status', 'disponivel')
      .order('valor', { ascending: false })
      .limit(limite - lote.length);

    // Sem isto os marcados voltariam duplicados no complemento.
    if (lote.length > 0) {
      completar = completar.not('id', 'in', `(${lote.map((i) => i.id).join(',')})`);
    }

    const { data: resto, error: erroResto } = await completar;
    if (erroResto) throw erroResto;

    lote.push(...((resto ?? []) as ImovelPublico[]));
  }

  await anexarCapas(cliente, lote);
  return lote;
}

/**
 * Os ultimos imoveis que mudaram, para o carrossel de novidades da home.
 *
 * Ordena por atualizado_em, e nao por criado_em como buscarRecentes.
 * Sao coisas diferentes: "recem-cadastrado" e sobre quando o imovel
 * entrou na carteira, e nunca muda depois; "atualizado" pega tambem o
 * imovel antigo que baixou de preco, ganhou foto nova ou voltou a ficar
 * disponivel. Numa carteira madura, onde quase nada entra por semana, e
 * a segunda lista que tem novidade de verdade para mostrar.
 */
export async function buscarAtualizados(cliente: Cliente, limite = 10): Promise<ImovelPublico[]> {
  const { data, error } = await cliente
    .from(VIEW)
    .select('*')
    .eq('status', 'disponivel')
    .order('atualizado_em', { ascending: false })
    .limit(limite);
  if (error) throw error;

  const imoveis = (data ?? []) as ImovelPublico[];
  await anexarFotos(cliente, imoveis);
  return imoveis;
}

/**
 * Semelhantes ao imovel aberto: mesmo condominio primeiro, senao mesmo
 * bairro ou mesmo tipo, em faixa de preco proxima.
 */
export async function buscarSemelhantes(
  cliente: Cliente,
  imovel: ImovelPublico,
  limite = 4,
): Promise<ImovelPublico[]> {
  // Unidade no mesmo empreendimento e sempre a melhor sugestao: quem
  // gostou da planta costuma aceitar outro andar do mesmo predio.
  if (imovel.condominio_id) {
    const { data } = await cliente
      .from(VIEW)
      .select('*')
      .neq('id', imovel.id)
      .eq('condominio_id', imovel.condominio_id)
      .eq('status', 'disponivel')
      .limit(limite);

    const doCondominio = (data ?? []) as ImovelPublico[];
    if (doCondominio.length >= limite) {
      await anexarFotos(cliente, doCondominio);
      return doCondominio;
    }
  }

  const { data, error } = await cliente
    .from(VIEW)
    .select('*')
    .neq('id', imovel.id)
    .eq('status', 'disponivel')
    .or(`bairro.eq.${limparTermo(imovel.bairro ?? '')},tipo.eq.${limparTermo(imovel.tipo)}`)
    .gte('valor', Math.round(Number(imovel.valor) * 0.6))
    .lte('valor', Math.round(Number(imovel.valor) * 1.6))
    .limit(limite);
  if (error) throw error;

  const imoveis = (data ?? []) as ImovelPublico[];
  await anexarFotos(cliente, imoveis);
  return imoveis;
}

/**
 * Imoveis por id, na ordem em que os ids foram pedidos.
 *
 * Alimenta a pagina de imoveis salvos. O Postgres devolve as linhas na
 * ordem que quiser, entao a reordenacao acontece aqui: o visitante ve a
 * lista na ordem em que salvou, e nao numa ordem que muda a cada visita.
 */
export async function buscarImoveisPorIds(
  cliente: Cliente,
  ids: string[],
): Promise<ImovelPublico[]> {
  if (ids.length === 0) return [];

  const { data, error } = await cliente.from(VIEW).select('*').in('id', ids);
  if (error) throw error;

  const imoveis = (data ?? []) as ImovelPublico[];
  await anexarFotos(cliente, imoveis);

  const porId = new Map(imoveis.map((i) => [i.id, i]));
  return ids.map((id) => porId.get(id)).filter((i): i is ImovelPublico => Boolean(i));
}

/** Todos os slugs publicados. Alimenta o sitemap.xml e o build estatico. */
export async function listarSlugsPublicados(
  cliente: Cliente,
): Promise<{ slug: string; atualizado_em: string }[]> {
  const { data, error } = await cliente
    .from(VIEW)
    .select('slug, atualizado_em')
    .order('atualizado_em', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as { slug: string; atualizado_em: string }[];
}

// ------------------------------------------------------------
// CONDOMINIOS
// ------------------------------------------------------------

export async function listarCondominios(
  cliente: Cliente,
  opcoes: { destaque?: boolean; luxo?: boolean; cidade?: string; limite?: number } = {},
): Promise<CondominioComResumo[]> {
  let q = cliente.from(VIEW_CONDOMINIOS).select('*');

  if (opcoes.destaque) q = q.eq('destaque', true);
  if (opcoes.luxo) q = q.eq('luxo', true);
  if (opcoes.cidade) q = q.eq('cidade', opcoes.cidade);

  const { data, error } = await q
    .order('destaque', { ascending: false })
    .order('total_imoveis', { ascending: false })
    .limit(opcoes.limite ?? 60);

  if (error) throw error;
  return (data ?? []) as CondominioComResumo[];
}

export async function buscarCondominioPorSlug(
  cliente: Cliente,
  slug: string,
): Promise<CondominioComResumo | null> {
  const { data, error } = await cliente
    .from(VIEW_CONDOMINIOS)
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CondominioComResumo | null;
}

// ------------------------------------------------------------
// FACETAS
// ------------------------------------------------------------

export interface Faceta {
  valor: string;
  total: number;
}

export interface Facetas {
  bairros: Faceta[];
  cidades: Faceta[];
  tipos: Faceta[];
  condominios: Faceta[];
  faixaValor: [number, number];
}

const FACETAS_VAZIAS: Facetas = {
  bairros: [],
  cidades: [],
  tipos: [],
  condominios: [],
  faixaValor: [0, 0],
};

/**
 * Bairros, cidades, tipos e condominios existentes, com contagem.
 *
 * Sai de uma funcao agregada no banco, e nao de um select de todas as
 * linhas: com mil imoveis, contar no JavaScript seria a parte mais cara
 * de montar a pagina, e a resposta ficaria em megabytes para gerar
 * algumas dezenas de opcoes de filtro.
 */
export async function listarFacetas(cliente: Cliente): Promise<Facetas> {
  const [agrupado, extremos] = await Promise.all([
    cliente.rpc('facetas_vitrine'),
    cliente
      .from(VIEW)
      .select('valor')
      .eq('status', 'disponivel')
      .gt('valor', 0)
      .order('valor', { ascending: true })
      .limit(1),
  ]);

  if (agrupado.error) throw agrupado.error;

  const linhas = (agrupado.data ?? []) as { dimensao: string; valor: string; total: number }[];

  const porDimensao = (dimensao: string): Faceta[] =>
    linhas
      .filter((l) => l.dimensao === dimensao && l.valor)
      .map((l) => ({ valor: l.valor, total: Number(l.total) }))
      .sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor, 'pt-BR'));

  const { data: maior } = await cliente
    .from(VIEW)
    .select('valor')
    .eq('status', 'disponivel')
    .order('valor', { ascending: false })
    .limit(1);

  const minimo = Number((extremos.data ?? [])[0]?.valor ?? 0);
  const maximo = Number((maior ?? [])[0]?.valor ?? 0);

  return {
    bairros: porDimensao('bairro'),
    cidades: porDimensao('cidade'),
    tipos: porDimensao('tipo'),
    condominios: porDimensao('condominio'),
    faixaValor: [minimo, maximo],
  };
}

export { VAZIO as RESULTADO_VAZIO, FACETAS_VAZIAS };

/**
 * Uma consulta so para as fotos de varios imoveis, em vez de uma por
 * imovel. Evita o problema N+1 numa listagem de 12 cartoes.
 */
async function anexarFotos(cliente: Cliente, imoveis: ImovelPublico[]): Promise<void> {
  if (imoveis.length === 0) return;

  const { data, error } = await cliente
    .from('imovel_fotos')
    .select('*')
    .in(
      'imovel_id',
      imoveis.map((i) => i.id),
    )
    .order('capa', { ascending: false })
    .order('ordem', { ascending: true });

  if (error) throw error;

  const porImovel = new Map<string, Foto[]>();
  for (const foto of (data ?? []) as Foto[]) {
    const lista = porImovel.get(foto.imovel_id) ?? [];
    lista.push(foto);
    porImovel.set(foto.imovel_id, lista);
  }

  for (const imovel of imoveis) {
    imovel.fotos = porImovel.get(imovel.id) ?? [];
  }
}

/**
 * Anexa apenas a foto de capa de cada imovel.
 *
 * O cartao da vitrine chama urlCapa(), que se contenta com uma foto so.
 * Buscar o album inteiro para desenhar uma miniatura multiplica por
 * dezesseis o numero de linhas lidas, e encosta no teto de mil da
 * resposta assim que o lote cresce.
 *
 * Imovel sem capa marcada fica com a lista vazia e cai no fundo neutro
 * do cartao, que e o mesmo caminho de quem nao tem foto nenhuma.
 */
async function anexarCapas(cliente: Cliente, imoveis: ImovelPublico[]): Promise<void> {
  if (imoveis.length === 0) return;

  const { data, error } = await cliente
    .from('imovel_fotos')
    .select('*')
    .eq('capa', true)
    .in(
      'imovel_id',
      imoveis.map((i) => i.id),
    );

  if (error) throw error;

  const porImovel = new Map<string, Foto[]>();
  for (const foto of (data ?? []) as Foto[]) {
    porImovel.set(foto.imovel_id, [foto]);
  }

  for (const imovel of imoveis) {
    imovel.fotos = porImovel.get(imovel.id) ?? [];
  }
}

/** Contador de visualizacoes. Falha em silencio: nao e critico. */
export async function registrarVisualizacao(cliente: Cliente, imovelId: string): Promise<void> {
  try {
    await cliente.rpc('contar_visualizacao', { p_imovel_id: imovelId });
  } catch {
    // Metrica de vaidade nao pode derrubar a pagina do imovel.
  }
}
