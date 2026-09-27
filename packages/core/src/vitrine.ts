/**
 * Vocabulario da vitrine publica.
 *
 * Rotulos, faixas de valor e ordenacoes ficam aqui porque aparecem em
 * quatro lugares ao mesmo tempo: busca do hero, filtros da listagem,
 * titulo da pagina e texto do link que o Google indexa. Escrever
 * "Acima de 3,5 milhoes" em cada um deles e como o texto acaba
 * divergindo entre a tela e o resultado.
 */

import type { Finalidade, FiltroBusca, OrdemBusca } from './tipos';
import { brl, brlCurto } from './formato';
import { pluralTipo } from './regras';

// ------------------------------------------------------------
// PRETENSAO
// ------------------------------------------------------------

export const PRETENSOES: { chave: Finalidade; rotulo: string; verbo: string }[] = [
  { chave: 'venda', rotulo: 'Comprar', verbo: 'à venda' },
  { chave: 'locacao', rotulo: 'Alugar', verbo: 'para alugar' },
];

export const rotuloPretensao = (f: Finalidade | undefined): string =>
  PRETENSOES.find((p) => p.chave === f)?.rotulo ?? 'Comprar';

export const verboPretensao = (f: Finalidade | undefined): string =>
  PRETENSOES.find((p) => p.chave === f)?.verbo ?? 'à venda';

// ------------------------------------------------------------
// FAIXAS DE VALOR
// ------------------------------------------------------------

export interface FaixaValor {
  chave: string;
  rotulo: string;
  min?: number;
  max?: number;
}

/**
 * As faixas sao largas na base e ficam mais largas ainda no topo. Numa
 * carteira que vai de 300 mil a 27 milhoes, dividir tudo em degraus
 * iguais deixaria a ultima faixa com um imovel e a primeira com
 * trezentos.
 */
export const FAIXAS_VALOR: FaixaValor[] = [
  { chave: 'ate-500', rotulo: 'Até 500 mil', max: 500_000 },
  { chave: '500-1m', rotulo: '500 mil a 1 milhão', min: 500_000, max: 1_000_000 },
  { chave: '1m-2m', rotulo: '1 a 2 milhões', min: 1_000_000, max: 2_000_000 },
  { chave: '2m-5m', rotulo: '2 a 5 milhões', min: 2_000_000, max: 5_000_000 },
  { chave: '5m-10m', rotulo: '5 a 10 milhões', min: 5_000_000, max: 10_000_000 },
  { chave: 'acima-10m', rotulo: 'Acima de 10 milhões', min: 10_000_000 },
];

export const faixaPorChave = (chave: string | undefined): FaixaValor | undefined =>
  FAIXAS_VALOR.find((f) => f.chave === chave);

/** Descobre em qual faixa um par min/max cai, para o select nascer marcado. */
export function chaveDaFaixa(min?: number, max?: number): string {
  const encontrada = FAIXAS_VALOR.find((f) => (f.min ?? 0) === (min ?? 0) && f.max === max);
  return encontrada?.chave ?? '';
}

// ------------------------------------------------------------
// ORDENACAO
// ------------------------------------------------------------

export const ORDENS: { chave: OrdemBusca; rotulo: string }[] = [
  { chave: 'relevancia', rotulo: 'Mais relevantes' },
  { chave: 'recentes', rotulo: 'Mais recentes' },
  { chave: 'maior_preco', rotulo: 'Maior valor' },
  { chave: 'menor_preco', rotulo: 'Menor valor' },
  { chave: 'maior_area', rotulo: 'Maior área' },
  { chave: 'menor_area', rotulo: 'Menor área' },
];

export const CHAVES_ORDEM = ORDENS.map((o) => o.chave);

export const rotuloOrdem = (o: OrdemBusca | undefined): string =>
  ORDENS.find((x) => x.chave === o)?.rotulo ?? 'Mais relevantes';

// ------------------------------------------------------------
// QUANTIDADES
// ------------------------------------------------------------

/** Os degraus de quarto, suite e vaga que aparecem como botao no filtro. */
export const DEGRAUS = [1, 2, 3, 4] as const;

// ------------------------------------------------------------
// TITULO E RESUMO DA BUSCA
// ------------------------------------------------------------

/**
 * Titulo que descreve a busca em portugues corrente.
 *
 * Vale para o visitante e para o Google na mesma medida: "Casas à venda
 * no Jardim Karaíba" e o que a pessoa digita na busca, e e o que precisa
 * estar no h1 da pagina de resultado.
 */
export function tituloDaBusca(filtro: FiltroBusca): string {
  const partes: string[] = [];

  partes.push(filtro.tipo ? pluralTipo(filtro.tipo) : 'Imóveis');
  partes.push(verboPretensao(filtro.finalidade));

  if (filtro.condominio) partes.push(`no ${filtro.condominio}`);
  else if (filtro.bairro) partes.push(`no ${filtro.bairro}`);

  if (filtro.cidade) partes.push(`em ${filtro.cidade}`);
  else if (!filtro.bairro && !filtro.condominio) partes.push('em Uberlândia e região');

  return partes.join(' ');
}

/** Quantos filtros estao ativos. Alimenta o contador do botao. */
export function contarFiltros(filtro: FiltroBusca): number {
  let total = 0;

  if (filtro.termo) total++;
  if (filtro.tipo) total++;
  if (filtro.bairro) total++;
  if (filtro.cidade) total++;
  if (filtro.condominio) total++;
  if (filtro.quartos) total++;
  if (filtro.suites) total++;
  if (filtro.banheiros) total++;
  if (filtro.vagas) total++;
  if (filtro.valorMin || filtro.valorMax) total++;
  if (filtro.areaMin || filtro.areaMax) total++;
  if (filtro.somenteDestaque) total++;
  total += filtro.caracteristicas?.length ?? 0;

  return total;
}

/** Lista legivel do que esta filtrado, para as fichas removiveis. */
export interface FiltroAplicado {
  chave: string;
  rotulo: string;
  /** Parametros a limpar quando a pessoa remove esta ficha. */
  limpa: string[];
}

export function descreverFiltros(filtro: FiltroBusca): FiltroAplicado[] {
  const fichas: FiltroAplicado[] = [];

  if (filtro.termo) {
    fichas.push({ chave: 'termo', rotulo: `"${filtro.termo}"`, limpa: ['termo'] });
  }
  if (filtro.tipo) fichas.push({ chave: 'tipo', rotulo: filtro.tipo, limpa: ['tipo'] });
  if (filtro.condominio) {
    fichas.push({ chave: 'condominio', rotulo: filtro.condominio, limpa: ['condominio'] });
  }
  if (filtro.bairro) fichas.push({ chave: 'bairro', rotulo: filtro.bairro, limpa: ['bairro'] });
  if (filtro.cidade) fichas.push({ chave: 'cidade', rotulo: filtro.cidade, limpa: ['cidade'] });

  if (filtro.quartos) {
    fichas.push({
      chave: 'quartos',
      rotulo: `${filtro.quartos}+ ${filtro.quartos === 1 ? 'quarto' : 'quartos'}`,
      limpa: ['quartos'],
    });
  }
  if (filtro.suites) {
    fichas.push({
      chave: 'suites',
      rotulo: `${filtro.suites}+ ${filtro.suites === 1 ? 'suíte' : 'suítes'}`,
      limpa: ['suites'],
    });
  }
  if (filtro.vagas) {
    fichas.push({
      chave: 'vagas',
      rotulo: `${filtro.vagas}+ ${filtro.vagas === 1 ? 'vaga' : 'vagas'}`,
      limpa: ['vagas'],
    });
  }
  if (filtro.banheiros) {
    fichas.push({
      chave: 'banheiros',
      rotulo: `${filtro.banheiros}+ ${filtro.banheiros === 1 ? 'banheiro' : 'banheiros'}`,
      limpa: ['banheiros'],
    });
  }

  if (filtro.valorMin || filtro.valorMax) {
    const rotulo =
      filtro.valorMin && filtro.valorMax
        ? `${brlCurto(filtro.valorMin)} a ${brlCurto(filtro.valorMax)}`
        : filtro.valorMax
          ? `Até ${brlCurto(filtro.valorMax)}`
          : `Acima de ${brlCurto(filtro.valorMin ?? 0)}`;
    fichas.push({ chave: 'valor', rotulo, limpa: ['valorMin', 'valorMax'] });
  }

  if (filtro.areaMin || filtro.areaMax) {
    const rotulo =
      filtro.areaMin && filtro.areaMax
        ? `${filtro.areaMin} a ${filtro.areaMax} m²`
        : filtro.areaMax
          ? `Até ${filtro.areaMax} m²`
          : `A partir de ${filtro.areaMin} m²`;
    fichas.push({ chave: 'area', rotulo, limpa: ['areaMin', 'areaMax'] });
  }

  if (filtro.somenteDestaque) {
    fichas.push({ chave: 'destaque', rotulo: 'Super destaque', limpa: ['destaque'] });
  }

  for (const c of filtro.caracteristicas ?? []) {
    fichas.push({ chave: `caracteristica-${c}`, rotulo: c, limpa: [] });
  }

  return fichas;
}

/**
 * Preco escrito por extenso curto, usado no cartao.
 * Mantido aqui, e nao no formato, porque a regra e da vitrine: acima de
 * um milhao o centavo nao informa nada e atrapalha a leitura da grade.
 */
export function precoCartao(valor: number): string {
  if (valor <= 0) return 'Sob consulta';
  return brl(valor);
}
