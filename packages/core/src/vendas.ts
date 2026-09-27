/**
 * Vendas e comissao.
 *
 * As contas aqui espelham as colunas geradas da migration 0007. O banco
 * continua sendo a verdade: estas funcoes existem para o formulario
 * mostrar o resultado enquanto a pessoa digita, antes de salvar. Se
 * divergirem algum dia, quem esta errado e este arquivo.
 */

export type TipoVenda = 'venda' | 'locacao';

export type StatusVenda = 'proposta' | 'aprovada' | 'contrato' | 'concluida' | 'cancelada';

export type FormaPagamento = 'a_vista' | 'financiado' | 'permuta' | 'misto' | 'consorcio';

export interface Venda {
  id: string;
  codigo: string;
  tipo: TipoVenda;

  imovel_id: string | null;
  imovel_titulo: string;
  lead_id: string | null;

  comprador_nome: string;
  comprador_telefone: string | null;
  comprador_email: string | null;
  proprietario_nome: string | null;

  valor_tabela: number;
  valor_venda: number;
  desconto: number;

  forma_pagamento: FormaPagamento;
  entrada: number;
  valor_financiado: number;
  banco: string | null;

  percentual_comissao: number;
  percentual_casa: number;
  percentual_captador: number;

  comissao_bruta: number;
  comissao_casa: number;
  comissao_captador: number;
  comissao_consultor: number;

  custos: number;
  margem: number;

  consultor_id: string | null;
  captador_id: string | null;

  status: StatusVenda;
  data_proposta: string;
  data_assinatura: string | null;
  data_conclusao: string | null;

  motivo_cancelamento: string | null;
  observacoes: string | null;

  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Venda com os nomes das pessoas resolvidos, para as listagens. */
export interface VendaDetalhada extends Venda {
  consultor_nome: string | null;
  captador_nome: string | null;
}

export type DestinoParcela = 'casa' | 'consultor' | 'captador' | 'terceiro';

export interface VendaParcela {
  id: string;
  venda_id: string;
  descricao: string;
  beneficiario_id: string | null;
  destino: DestinoParcela;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  status: 'pendente' | 'pago' | 'cancelado';
  observacoes: string | null;
  criado_em: string;
}

export const STATUS_VENDA: Record<StatusVenda, { rotulo: string; cor: string; descricao: string }> = {
  proposta: {
    rotulo: 'Proposta',
    cor: 'cinza',
    descricao: 'Proposta apresentada, aguardando resposta do proprietário.',
  },
  aprovada: {
    rotulo: 'Aprovada',
    cor: 'marinho',
    descricao: 'Proprietário aceitou. Reunindo documentação.',
  },
  contrato: {
    rotulo: 'Em contrato',
    cor: 'ambar',
    descricao: 'Contrato assinado, aguardando liberação do recurso.',
  },
  concluida: {
    rotulo: 'Concluída',
    cor: 'verde',
    descricao: 'Negócio fechado. Comissão lançada no caixa.',
  },
  cancelada: {
    rotulo: 'Cancelada',
    cor: 'rubro',
    descricao: 'Negócio não avançou.',
  },
};

export const FORMAS_PAGAMENTO: { chave: FormaPagamento; rotulo: string }[] = [
  { chave: 'financiado', rotulo: 'Financiamento bancário' },
  { chave: 'a_vista', rotulo: 'À vista' },
  { chave: 'permuta', rotulo: 'Permuta' },
  { chave: 'consorcio', rotulo: 'Consórcio' },
  { chave: 'misto', rotulo: 'Misto' },
];

/** As etapas em ordem, para a barra de andamento do negócio. */
export const ETAPAS_VENDA: StatusVenda[] = ['proposta', 'aprovada', 'contrato', 'concluida'];

// ------------------------------------------------------------
// CALCULO
// ------------------------------------------------------------

export interface EntradaCalculo {
  valorTabela?: number;
  valorVenda: number;
  percentualComissao: number;
  percentualCasa: number;
  percentualCaptador?: number;
  custos?: number;
}

export interface ResultadoCalculo {
  desconto: number;
  descontoPercentual: number;
  comissaoBruta: number;
  comissaoCasa: number;
  comissaoCaptador: number;
  comissaoConsultor: number;
  margem: number;
  margemPercentual: number;
}

const arredondar = (v: number): number => Math.round(v * 100) / 100;

/**
 * Mesma sequencia de arredondamento das colunas geradas no banco:
 * arredonda cada parte antes de subtrair, nunca depois.
 *
 * Parece preciosismo, mas nao e. Arredondar so no fim faz as tres
 * partes somarem um centavo a mais ou a menos que a comissao bruta, e
 * esse centavo aparece na conferencia do contador todo mes.
 */
export function calcularVenda(e: EntradaCalculo): ResultadoCalculo {
  const valorVenda = Math.max(0, Number(e.valorVenda) || 0);
  const valorTabela = Math.max(0, Number(e.valorTabela) || 0);
  const custos = Math.max(0, Number(e.custos) || 0);

  const pctComissao = limitar(e.percentualComissao);
  const pctCasa = limitar(e.percentualCasa);
  const pctCaptador = limitar(e.percentualCaptador ?? 0);

  const comissaoBruta = arredondar((valorVenda * pctComissao) / 100);
  const comissaoCasa = arredondar(((valorVenda * pctComissao) / 100) * (pctCasa / 100));
  const comissaoCaptador = arredondar(((valorVenda * pctComissao) / 100) * (pctCaptador / 100));
  const comissaoConsultor = arredondar(comissaoBruta - comissaoCasa - comissaoCaptador);

  const desconto = Math.max(0, arredondar(valorTabela - valorVenda));
  const margem = arredondar(comissaoCasa - custos);

  return {
    desconto,
    descontoPercentual: valorTabela > 0 ? arredondar((desconto / valorTabela) * 100) : 0,
    comissaoBruta,
    comissaoCasa,
    comissaoCaptador,
    comissaoConsultor,
    margem,
    margemPercentual: comissaoBruta > 0 ? arredondar((margem / comissaoBruta) * 100) : 0,
  };
}

function limitar(valor: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Problemas que impedem salvar. Devolve lista vazia quando esta tudo
 * certo, para a tela poder mostrar tudo de uma vez em vez de revelar um
 * erro por tentativa.
 */
/**
 * O imovel como ele aparece no seletor da gaveta de negocio.
 *
 * E uma lista de escolha, nao uma ficha: bastam codigo, titulo e onde
 * fica para a pessoa reconhecer qual imovel esta vendendo. Mandar o
 * registro inteiro de cada um seria repetir na tela do financeiro o
 * peso que ja custou caro na tela da carteira.
 */
export interface ImovelDaVenda {
  id: string;
  codigo: string;
  titulo: string;
  bairro: string | null;
  cidade: string;
  valor: number;
  valor_locacao: number | null;
  status: string;
  publicado: boolean;
}

/**
 * O que a operacao faz com o imovel ligado a ela.
 *
 * Existe porque nem toda linha do financeiro significa a mesma coisa
 * para a carteira: uma proposta nao deveria mexer no anuncio, um
 * distrato devolve o imovel para a vitrine, e um negocio fechado fora do
 * sistema as vezes so precisa que aquele imovel suma da lista.
 */
export const EFEITOS_NO_IMOVEL = {
  manter: {
    rotulo: 'Manter como está',
    ajuda: 'A operação não mexe no anúncio.',
  },
  tirar_do_ar: {
    rotulo: 'Tirar do ar',
    ajuda: 'Sai da vitrine agora, sem esperar a conclusão. Continua na carteira.',
  },
  excluir: {
    rotulo: 'Excluir da carteira',
    ajuda: 'Apaga o imóvel em definitivo. O histórico do negócio guarda o título.',
  },
} as const;

export type EfeitoNoImovel = keyof typeof EFEITOS_NO_IMOVEL;

export function validarVenda(v: Partial<Venda>): string[] {
  const erros: string[] = [];

  if (!v.imovel_titulo?.trim()) erros.push('Informe o imóvel do negócio.');
  if (!v.comprador_nome?.trim()) erros.push('Informe o nome do comprador.');
  if (!v.valor_venda || v.valor_venda <= 0) erros.push('Informe o valor fechado.');

  const casa = Number(v.percentual_casa ?? 0);
  const captador = Number(v.percentual_captador ?? 0);
  if (casa + captador > 100) {
    erros.push('A soma da parte da casa com a do captador não pode passar de 100%.');
  }

  if (v.status === 'cancelada' && !v.motivo_cancelamento?.trim()) {
    erros.push('Informe o motivo do cancelamento.');
  }

  if (v.valor_tabela && v.valor_venda && v.valor_venda > v.valor_tabela * 1.5) {
    erros.push('O valor fechado está muito acima do valor de tabela. Confira os números.');
  }

  return erros;
}

/**
 * Divisao sugerida da comissao em parcelas.
 *
 * O padrao do mercado e sinal na assinatura e o restante na liberacao
 * do recurso pelo banco, que costuma levar de 30 a 60 dias. Quando a
 * venda e a vista, entra tudo de uma vez.
 */
export function sugerirParcelas(
  venda: Pick<Venda, 'comissao_bruta' | 'forma_pagamento' | 'data_assinatura' | 'data_proposta'>,
): { descricao: string; valor: number; vencimento: string }[] {
  const total = Number(venda.comissao_bruta) || 0;
  if (total <= 0) return [];

  const base = venda.data_assinatura ?? venda.data_proposta ?? new Date().toISOString().slice(0, 10);

  if (venda.forma_pagamento === 'a_vista') {
    return [{ descricao: 'Comissão integral', valor: total, vencimento: somarDias(base, 7) }];
  }

  const sinal = arredondar(total * 0.3);
  return [
    { descricao: 'Sinal na assinatura', valor: sinal, vencimento: somarDias(base, 5) },
    {
      descricao: 'Saldo na liberação do recurso',
      valor: arredondar(total - sinal),
      vencimento: somarDias(base, 45),
    },
  ];
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export interface ResumoFinanceiroPeriodo {
  vgv: number;
  negocios: number;
  comissao_bruta: number;
  comissao_casa: number;
  comissao_equipe: number;
  custos: number;
  margem: number;
  ticket_medio: number;
  desconto_medio_pct: number;
  em_negociacao: number;
  a_receber: number;
}

export interface DesempenhoConsultor {
  consultor_id: string;
  consultor_nome: string;
  meta_mensal: number;
  vgv: number;
  negocios: number;
  comissao: number;
  atingimento: number;
}
