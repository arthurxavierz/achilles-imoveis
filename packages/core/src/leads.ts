/**
 * Vocabulario dos leads.
 *
 * Origem e tipo de interacao sao listas que aparecem em tres lugares: no
 * formulario do site, no painel e no relatorio. Centralizar aqui evita a
 * situacao classica de o site gravar "whatsapp" e o painel mostrar
 * "WhatsApp Business" porque alguem digitou o rotulo de novo.
 */

import type { EtapaLead, Interacao, Lead, OrigemLead, TipoInteracao } from './tipos';

// ------------------------------------------------------------
// ORIGEM
// ------------------------------------------------------------

export interface DescricaoOrigem {
  chave: OrigemLead;
  rotulo: string;
  /** Como esse lead chegou, em uma frase, para quem nunca viu o sistema. */
  explicacao: string;
  cor: string;
  /** Origens que o sistema grava sozinho nao aparecem no formulario manual. */
  automatica: boolean;
}

export const ORIGENS_LEAD: DescricaoOrigem[] = [
  {
    chave: 'site',
    rotulo: 'Formulário do site',
    explicacao: 'Preencheu o formulário de contato em achillesimoveis.com.br.',
    cor: 'marinho',
    automatica: true,
  },
  {
    chave: 'vitrine',
    rotulo: 'Página do imóvel',
    explicacao: 'Pediu informação direto na página de um imóvel da vitrine.',
    cor: 'marinho',
    automatica: true,
  },
  {
    chave: 'whatsapp',
    rotulo: 'WhatsApp',
    explicacao: 'Chamou no número da imobiliária.',
    cor: 'verde',
    automatica: false,
  },
  {
    chave: 'telefone',
    rotulo: 'Telefone',
    explicacao: 'Ligou para a imobiliária.',
    cor: 'cinza',
    automatica: false,
  },
  {
    chave: 'presencial',
    rotulo: 'Atendimento presencial',
    explicacao: 'Entrou na loja ou foi atendido em plantão de vendas.',
    cor: 'ouro',
    automatica: false,
  },
  {
    chave: 'indicacao',
    rotulo: 'Indicação',
    explicacao: 'Chegou por indicação de cliente ou parceiro.',
    cor: 'ouro',
    automatica: false,
  },
  {
    chave: 'instagram',
    rotulo: 'Instagram',
    explicacao: 'Veio de publicação ou anúncio nas redes.',
    cor: 'roxo',
    automatica: false,
  },
  {
    chave: 'portal',
    rotulo: 'Portal imobiliário',
    explicacao: 'Repassado por portal parceiro.',
    cor: 'ambar',
    automatica: true,
  },
  {
    chave: 'prospeccao',
    rotulo: 'Prospecção ativa',
    explicacao:
      'A casa foi atrás. Saiu de uma busca por segmento e cidade na tela de Prospecção, e não de alguém que procurou a Achilles.',
    cor: 'roxo',
    automatica: false,
  },
  {
    chave: 'manual',
    rotulo: 'Inclusão manual',
    explicacao: 'Cadastrado pela equipe, sem canal de entrada definido.',
    cor: 'cinza',
    automatica: false,
  },
];

export const rotuloOrigem = (origem: OrigemLead | string): string =>
  ORIGENS_LEAD.find((o) => o.chave === origem)?.rotulo ?? 'Outra origem';

export const corOrigem = (origem: OrigemLead | string): string =>
  ORIGENS_LEAD.find((o) => o.chave === origem)?.cor ?? 'cinza';

/** Origens que a equipe pode escolher ao cadastrar alguem na mao. */
export const ORIGENS_MANUAIS = ORIGENS_LEAD.filter((o) => !o.automatica);

// ------------------------------------------------------------
// INTERACOES
// ------------------------------------------------------------

export const TIPOS_INTERACAO: {
  chave: TipoInteracao;
  rotulo: string;
  cor: string;
  /** 'sistema' e escrito pelo proprio painel, nao pela pessoa. */
  manual: boolean;
}[] = [
  { chave: 'nota', rotulo: 'Observação', cor: 'cinza', manual: true },
  { chave: 'ligacao', rotulo: 'Ligação', cor: 'marinho', manual: true },
  { chave: 'whatsapp', rotulo: 'WhatsApp', cor: 'verde', manual: true },
  { chave: 'email', rotulo: 'E-mail', cor: 'roxo', manual: true },
  { chave: 'visita', rotulo: 'Visita', cor: 'ouro', manual: true },
  { chave: 'proposta', rotulo: 'Proposta', cor: 'ambar', manual: true },
  { chave: 'sistema', rotulo: 'Registro do sistema', cor: 'cinza', manual: false },
];

export const TIPOS_INTERACAO_MANUAIS = TIPOS_INTERACAO.filter((t) => t.manual);

export const rotuloInteracao = (tipo: TipoInteracao | string): string =>
  TIPOS_INTERACAO.find((t) => t.chave === tipo)?.rotulo ?? 'Registro';

export const corInteracao = (tipo: TipoInteracao | string): string =>
  TIPOS_INTERACAO.find((t) => t.chave === tipo)?.cor ?? 'cinza';

// ------------------------------------------------------------
// SITUACAO DO ATENDIMENTO
// ------------------------------------------------------------

export const CORES_ETAPA: Record<EtapaLead, string> = {
  novo: 'marinho',
  contato: 'roxo',
  visita: 'ouro',
  proposta: 'ambar',
  fechado: 'verde',
  perdido: 'rubro',
};

/**
 * Dias desde o ultimo sinal de vida do atendimento.
 *
 * Usa a interacao mais recente quando existe, e a data de criacao
 * quando o lead ainda nao teve nenhuma. E o numero que responde a
 * pergunta que mais custa dinheiro numa imobiliaria: ha quanto tempo
 * ninguem fala com essa pessoa.
 */
export function diasSemContato(
  lead: Pick<Lead, 'criado_em'>,
  ultimaInteracao?: string | null,
): number {
  const referencia = new Date(ultimaInteracao ?? lead.criado_em).getTime();
  if (Number.isNaN(referencia)) return 0;
  return Math.floor((Date.now() - referencia) / 86_400_000);
}

/**
 * Um atendimento esfriou quando passou do prazo aceitavel sem contato.
 * O prazo muda por etapa de proposito: lead novo que espera dois dias ja
 * e um problema, enquanto um em negociacao pode passar uma semana no
 * aguardo do banco sem que isso signifique abandono.
 */
export const PRAZO_SEM_CONTATO: Record<EtapaLead, number> = {
  novo: 1,
  contato: 3,
  visita: 5,
  proposta: 7,
  fechado: 30,
  perdido: 365,
};

export function estaEsfriando(
  lead: Pick<Lead, 'criado_em' | 'etapa'>,
  ultimaInteracao?: string | null,
): boolean {
  if (lead.etapa === 'fechado' || lead.etapa === 'perdido') return false;
  return diasSemContato(lead, ultimaInteracao) > PRAZO_SEM_CONTATO[lead.etapa];
}

/** Ultima interacao de cada lead, para a lista nao fazer uma consulta por linha. */
export function ultimaInteracaoPorLead(interacoes: Interacao[]): Map<string, Interacao> {
  const mapa = new Map<string, Interacao>();

  for (const i of interacoes) {
    const atual = mapa.get(i.lead_id);
    if (!atual || i.criado_em > atual.criado_em) mapa.set(i.lead_id, i);
  }

  return mapa;
}

export const MOTIVOS_PERDA = [
  'Comprou com outra imobiliária',
  'Desistiu da compra',
  'Não tinha crédito aprovado',
  'Valor acima do orçamento',
  'Não respondeu aos contatos',
  'Procurava outra região',
  'Contato inválido',
  'Outro motivo',
] as const;
