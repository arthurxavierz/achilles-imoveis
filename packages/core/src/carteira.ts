/**
 * A busca da carteira interna.
 *
 * Mora aqui, e nao dentro do componente da tela, por dois motivos. O
 * primeiro e que a mesma regra vai ser precisa em mais de um lugar
 * conforme o sistema crescer — a exportacao de XML e o relatorio de
 * carteira por consultor filtram exatamente igual. O segundo e que
 * regra de filtro e o tipo de codigo que se testa sozinho: entra uma
 * lista e um recorte, sai uma lista.
 *
 * A diferenca para o filtro da vitrine e o alcance. Ali o visitante
 * escolhe entre o que esta publicado; aqui a equipe precisa achar o
 * que esta fora do ar, o que nao tem dono e o que ficou sem
 * proprietario vinculado, que sao justamente os casos que ninguem quer
 * mostrar mas alguem precisa resolver.
 */

import type { FiltroCarteira, Imovel, Proprietario } from './tipos';

/** Sem acento e em minuscula: "Sao Jose" acha "São José". */
function simplificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Um imovel passa no recorte?
 *
 * `nomeProprietario` chega pronto porque quem chama ja tem o mapa de
 * proprietarios em maos. Refazer a busca por id aqui dentro seria
 * percorrer a lista de proprietarios uma vez por imovel.
 */
export function imovelNoFiltro(
  imovel: ImovelResumo,
  filtro: FiltroCarteira,
  nomeProprietario: string | null,
): boolean {
  if (filtro.tipo && imovel.tipo !== filtro.tipo) return false;
  if (filtro.status && imovel.status !== filtro.status) return false;
  if (filtro.finalidade && imovel.finalidade !== filtro.finalidade) return false;

  if (filtro.bairro && simplificar(imovel.bairro ?? '') !== simplificar(filtro.bairro)) {
    return false;
  }
  if (filtro.cidade && simplificar(imovel.cidade) !== simplificar(filtro.cidade)) return false;

  if (filtro.semProprietario && imovel.proprietario_id) return false;
  if (filtro.proprietario && imovel.proprietario_id !== filtro.proprietario) return false;

  if (filtro.consultor === 'sem-dono') {
    if (imovel.corretor_id !== null) return false;
  } else if (filtro.consultor && imovel.corretor_id !== filtro.consultor) {
    return false;
  }

  if (filtro.vitrine === 'publicados' && !imovel.publicado) return false;
  if (filtro.vitrine === 'fora' && imovel.publicado) return false;
  if (filtro.vitrine === 'destaque' && !imovel.destaque) return false;

  /**
   * O valor comparado e o da finalidade do imovel. Um imovel so de
   * locacao tem valor de venda zero, e compara-lo com "ate 1.500.000"
   * o traria em toda busca por preco de venda — o que faria a lista
   * de casas de dois milhoes vir cheia de aluguel de mil e duzentos.
   */
  const valor = imovel.finalidade === 'locacao' ? (imovel.valor_locacao ?? 0) : imovel.valor;
  if (filtro.valorMin !== null && valor < filtro.valorMin) return false;
  if (filtro.valorMax !== null && valor > filtro.valorMax) return false;

  if (filtro.quartosMin !== null && imovel.quartos < filtro.quartosMin) return false;
  if (filtro.vagasMin !== null && imovel.vagas < filtro.vagasMin) return false;
  if (filtro.areaMin !== null && imovel.area_util < filtro.areaMin) return false;

  if (!filtro.termo.trim()) return true;

  const termo = simplificar(filtro.termo);

  return (
    simplificar(imovel.titulo).includes(termo) ||
    simplificar(imovel.codigo).includes(termo) ||
    simplificar(imovel.bairro ?? '').includes(termo) ||
    simplificar(imovel.cidade).includes(termo) ||
    simplificar(imovel.tipo).includes(termo) ||
    simplificar(imovel.matricula ?? '').includes(termo) ||
    simplificar(imovel.condominio_nome ?? '').includes(termo) ||
    // Achar o imovel pelo nome de quem o entregou e o caminho que a
    // equipe usa ao telefone: a pessoa liga, se identifica, e ninguem
    // lembra o codigo do anuncio dela.
    simplificar(nomeProprietario ?? '').includes(termo)
  );
}

/**
 * As colunas do imovel que a tela da carteira precisa.
 *
 * O registro inteiro tem 58 colunas, e a lista le vinte. A diferenca
 * pesa: com 964 imoveis, mandar tudo sao 2,2 MB no HTML da pagina, e o
 * que sobra e descricao, observacao interna e metadados de SEO que a
 * tabela nunca desenha.
 *
 * O tipo existe para o corte ser honesto. Poderia ser um select mais
 * curto com um cast para Imovel, e a tela funcionaria igual hoje, mas o
 * dia em que alguem lesse imovel.descricao ali dentro o TypeScript
 * ficaria calado e o valor chegaria como undefined em producao.
 */
export type ImovelResumo = Pick<
  Imovel,
  | 'id'
  | 'titulo'
  | 'codigo'
  | 'tipo'
  | 'finalidade'
  | 'status'
  | 'bairro'
  | 'cidade'
  | 'condominio_nome'
  | 'matricula'
  | 'valor'
  | 'valor_locacao'
  | 'area_util'
  | 'quartos'
  | 'vagas'
  | 'publicado'
  | 'destaque'
  | 'corretor_id'
  | 'proprietario_id'
  | 'criado_em'
  | 'atualizado_em'
>;

export function filtrarCarteira<T extends ImovelResumo>(
  imoveis: T[],
  filtro: FiltroCarteira,
  proprietarios: Pick<Proprietario, 'id' | 'nome'>[],
): T[] {
  const nomes = new Map(proprietarios.map((p) => [p.id, p.nome]));

  return imoveis.filter((i) =>
    imovelNoFiltro(i, filtro, i.proprietario_id ? (nomes.get(i.proprietario_id) ?? null) : null),
  );
}

/** Quantos recortes estao ativos. Alimenta o "limpar filtros". */
export function contarFiltrosCarteira(filtro: FiltroCarteira): number {
  let total = 0;

  for (const [chave, valor] of Object.entries(filtro)) {
    if (chave === 'termo') continue;
    if (valor === '' || valor === null || valor === false) continue;
    total += 1;
  }

  return total + (filtro.termo.trim() ? 1 : 0);
}

/**
 * As faixas de preco oferecidas no filtro rapido.
 *
 * Sao os degraus que a equipe usa de fato ao qualificar um comprador,
 * e nao uma escala redonda: quem procura ate 500 mil e outro publico
 * de quem procura ate 1,5 milhao, e o salto entre eles importa mais
 * que a regularidade dos numeros.
 */
export const FAIXAS_CARTEIRA: { rotulo: string; min: number | null; max: number | null }[] = [
  { rotulo: 'Qualquer valor', min: null, max: null },
  { rotulo: 'Até R$ 500 mil', min: null, max: 500_000 },
  { rotulo: 'R$ 500 mil a R$ 1 mi', min: 500_000, max: 1_000_000 },
  { rotulo: 'R$ 1 mi a R$ 1,5 mi', min: 1_000_000, max: 1_500_000 },
  { rotulo: 'R$ 1,5 mi a R$ 3 mi', min: 1_500_000, max: 3_000_000 },
  { rotulo: 'Acima de R$ 3 mi', min: 3_000_000, max: null },
];

/** Resume a carteira de um proprietario a partir dos imoveis dele. */
export function resumirCarteira(imoveis: Pick<Imovel, 'publicado' | 'status' | 'valor'>[]): {
  total_imoveis: number;
  imoveis_publicados: number;
  valor_carteira: number;
} {
  return {
    total_imoveis: imoveis.length,
    imoveis_publicados: imoveis.filter((i) => i.publicado).length,
    valor_carteira: imoveis
      .filter((i) => i.status === 'disponivel' || i.status === 'reservado')
      .reduce((soma, i) => soma + Number(i.valor), 0),
  };
}
