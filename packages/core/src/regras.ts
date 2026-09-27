/**
 * Regras de negocio da Achilles.
 *
 * Ficam aqui, fora do React e fora do SQL, por um motivo pratico: sao as
 * unicas regras que precisam valer nos tres lugares ao mesmo tempo (site,
 * app e funcoes de servidor). O RLS do banco continua sendo a trava real
 * de seguranca; isto aqui e a mesma regra escrita para a interface, para
 * o botao nem aparecer quando a acao seria negada.
 */

import type {
  AreaPermissao,
  EtapaLead,
  Imovel,
  ImovelPublico,
  Perfil,
  StatusImovel,
  Transacao,
} from './tipos';

// ------------------------------------------------------------
// PERMISSOES
// ------------------------------------------------------------

export const ehAdmin = (u: Perfil | null | undefined): boolean =>
  !!u && u.ativo && u.papel === 'admin';

export const ehGestor = (u: Perfil | null | undefined): boolean =>
  !!u && u.ativo && (u.papel === 'admin' || u.papel === 'gestor');

/** Espelha a funcao pode(area) do banco. */
export function pode(u: Perfil | null | undefined, area: AreaPermissao): boolean {
  if (!u || !u.ativo) return false;
  if (u.papel === 'admin') return true;
  return Boolean(u.permissoes?.[area]);
}

/** A regra de ouro da carteira: so o dono do imovel ou a gestao mexe. */
export function podeGerenciarImovel(
  u: Perfil | null | undefined,
  imovel: Pick<Imovel, 'corretor_id'> | null | undefined,
): boolean {
  if (!u || !imovel || !pode(u, 'imoveis')) return false;
  return ehGestor(u) || imovel.corretor_id === u.id;
}

/** Corretor enxerga os proprios leads e os ainda nao atribuidos. */
export function podeVerLead(
  u: Perfil | null | undefined,
  lead: { corretor_id: string | null } | null | undefined,
): boolean {
  if (!u || !lead || !pode(u, 'leads')) return false;
  return ehGestor(u) || lead.corretor_id === u.id || lead.corretor_id === null;
}

// ------------------------------------------------------------
// FUNIL
// ------------------------------------------------------------

export const ETAPAS: { chave: EtapaLead; nome: string; cor: string }[] = [
  { chave: 'novo', nome: 'Novo', cor: 'slate' },
  { chave: 'contato', nome: 'Contato', cor: 'slate' },
  { chave: 'visita', nome: 'Visita', cor: 'amber' },
  { chave: 'proposta', nome: 'Proposta', cor: 'amber' },
  { chave: 'fechado', nome: 'Fechado', cor: 'green' },
];

/** 'perdido' fica fora do quadro: sai do funil sem sumir do historico. */
export const ETAPAS_ATIVAS = ETAPAS.map((e) => e.chave);

export const rotuloEtapa = (e: EtapaLead): string =>
  ETAPAS.find((x) => x.chave === e)?.nome ?? 'Perdido';

/** Taxa de conversao do funil, em %. Fechados sobre o total considerado. */
export function taxaConversao(leads: { etapa: EtapaLead }[]): number {
  const total = leads.filter((l) => l.etapa !== 'perdido').length;
  if (total === 0) return 0;
  const fechados = leads.filter((l) => l.etapa === 'fechado').length;
  return Math.round((fechados / total) * 100);
}

// ------------------------------------------------------------
// IMOVEIS
// ------------------------------------------------------------

export const STATUS_IMOVEL: Record<StatusImovel, { rotulo: string; cor: string; publico: boolean }> = {
  disponivel: { rotulo: 'Disponível', cor: 'green', publico: true },
  reservado: { rotulo: 'Reservado', cor: 'amber', publico: true },
  vendido: { rotulo: 'Vendido', cor: 'ash', publico: false },
  locado: { rotulo: 'Locado', cor: 'slate', publico: false },
  inativo: { rotulo: 'Inativo', cor: 'ash', publico: false },
};

/**
 * Tipos aceitos no cadastro e na importacao.
 *
 * A lista e larga de proposito. O XML do portal traz de studio a
 * fazenda, e um tipo fora da lista viraria "Outro" na vitrine, perdendo
 * o filtro justamente onde o imovel e mais caro: area rural e galpao
 * logistico sao os dois maiores tickets da carteira.
 */
export const TIPOS_IMOVEL = [
  'Apartamento',
  'Apartamento Garden',
  'Casa',
  'Casa em condomínio',
  'Cobertura',
  'Flat',
  'Studio',
  'Sobrado',
  'Sala comercial',
  'Loja',
  'Prédio',
  'Galpão',
  'Terreno',
  'Área',
  'Chácara',
  'Sítio',
  'Rancho',
  'Fazenda',
  'Hotel',
] as const;

/** Agrupamento usado nos atalhos da home e no menu de tipos. */
export const GRUPOS_TIPO: { rotulo: string; tipos: string[] }[] = [
  { rotulo: 'Apartamentos', tipos: ['Apartamento', 'Apartamento Garden', 'Cobertura', 'Flat', 'Studio'] },
  { rotulo: 'Casas', tipos: ['Casa', 'Casa em condomínio', 'Sobrado'] },
  { rotulo: 'Terrenos', tipos: ['Terreno', 'Área'] },
  { rotulo: 'Rural', tipos: ['Chácara', 'Sítio', 'Rancho', 'Fazenda'] },
  { rotulo: 'Comercial', tipos: ['Sala comercial', 'Loja', 'Prédio', 'Galpão', 'Hotel'] },
];

/** Tipos que se medem em hectares, e nao em metro quadrado util. */
export const TIPOS_RURAIS = ['Fazenda', 'Sítio', 'Chácara', 'Rancho', 'Área'] as const;

export const ehRural = (tipo: string): boolean =>
  (TIPOS_RURAIS as readonly string[]).includes(tipo);

/** "Apartamento" -> "Apartamentos". Serve para titulo de listagem. */
export function pluralTipo(tipo: string): string {
  if (tipo.endsWith('ção')) return `${tipo.slice(0, -3)}ções`;
  if (tipo.endsWith('l')) return `${tipo.slice(0, -1)}is`;
  if (tipo.endsWith('m')) return `${tipo.slice(0, -1)}ns`;
  if (tipo.endsWith('r') || tipo.endsWith('z')) return `${tipo}es`;
  if (tipo.endsWith('s')) return tipo;
  return `${tipo}s`;
}

export const CARACTERISTICAS_COMUNS = [
  'Piscina',
  'Piscina aquecida',
  'Churrasqueira',
  'Espaço gourmet',
  'Varanda gourmet',
  'Academia',
  'Sauna',
  'Home theater',
  'Adega climatizada',
  'Automação',
  'Elevador privativo',
  'Condomínio fechado',
  'Portaria 24h',
  'Mobiliado',
  'Jardim privativo',
  'Rooftop',
  'Vista panorâmica',
  'Aceita pet',
] as const;

/** O preco que o anuncio mostra depende da finalidade. */
export function precoVigente(i: Pick<ImovelPublico, 'finalidade' | 'valor' | 'valor_locacao'>): {
  valor: number;
  sufixo: string;
} {
  if (i.finalidade === 'locacao') {
    return { valor: Number(i.valor_locacao ?? 0), sufixo: '/mês' };
  }
  return { valor: Number(i.valor ?? 0), sufixo: '' };
}

/** Custo mensal fixo do imovel: condominio + IPTU rateado. */
export function custoMensal(
  i: Pick<ImovelPublico, 'valor_condominio' | 'valor_iptu'>,
): number {
  return Number(i.valor_condominio ?? 0) + Number(i.valor_iptu ?? 0) / 12;
}

/** "4 quartos · 5 banheiros · 4 vagas · 412 m²" para o cartao. */
export function resumoImovel(
  i: Pick<ImovelPublico, 'quartos' | 'banheiros' | 'vagas' | 'area_util' | 'hectares'>,
): string {
  const partes: string[] = [];
  if (i.quartos > 0) partes.push(`${i.quartos} ${i.quartos === 1 ? 'quarto' : 'quartos'}`);
  if (i.banheiros > 0) partes.push(`${i.banheiros} ${i.banheiros === 1 ? 'banheiro' : 'banheiros'}`);
  if (i.vagas > 0) partes.push(`${i.vagas} ${i.vagas === 1 ? 'vaga' : 'vagas'}`);

  // Numa fazenda o metro quadrado util nao diz nada. O hectare diz tudo.
  const ha = Number(i.hectares ?? 0);
  if (ha > 0) partes.push(`${ha} ${ha === 1 ? 'hectare' : 'hectares'}`);
  else if (i.area_util > 0) partes.push(`${i.area_util} m²`);

  return partes.join(' · ');
}

/** Endereco na medida do que o proprietario autorizou exibir. */
export function enderecoPublico(
  i: Pick<ImovelPublico, 'logradouro' | 'numero' | 'bairro' | 'cidade' | 'uf'>,
): string {
  const rua = [i.logradouro, i.numero].filter(Boolean).join(', ');
  const local = [i.bairro, `${i.cidade} - ${i.uf}`].filter(Boolean).join(', ');
  return [rua, local].filter(Boolean).join(' - ');
}

// ------------------------------------------------------------
// FINANCEIRO
// ------------------------------------------------------------

/** Comissao padrao do mercado de Uberlandia para venda: 6%. */
export const COMISSAO_PADRAO = 6;

export function calcularComissao(valorVenda: number, percentual = COMISSAO_PADRAO): number {
  return Math.round(Number(valorVenda) * (Number(percentual) / 100) * 100) / 100;
}

export interface ResumoFinanceiro {
  receitaRealizada: number;
  receitaPrevista: number;
  despesas: number;
  resultado: number;
  vgv: number;
}

export function resumirFinanceiro(transacoes: Transacao[]): ResumoFinanceiro {
  let receitaRealizada = 0;
  let receitaPrevista = 0;
  let despesas = 0;
  let vgv = 0;

  for (const t of transacoes) {
    if (t.status === 'cancelado') continue;
    if (t.tipo === 'despesa') {
      despesas += Number(t.valor);
      continue;
    }
    if (t.status === 'pago') receitaRealizada += Number(t.valor);
    else receitaPrevista += Number(t.valor);
    if (t.tipo === 'comissao') vgv += Number(t.valor_venda);
  }

  return {
    receitaRealizada,
    receitaPrevista,
    despesas,
    resultado: receitaRealizada - despesas,
    vgv,
  };
}

// ------------------------------------------------------------
// LEADS
// ------------------------------------------------------------

/**
 * Score de 0 a 100. Ordena a fila de atendimento do corretor: quem tem
 * telefone, veio de um imovel especifico e chegou agora vale mais que um
 * formulario generico de tres semanas atras.
 */
export function calcularScore(lead: {
  telefone?: string | null;
  email?: string | null;
  mensagem?: string | null;
  imovel_id?: string | null;
  valor?: number | null;
  origem?: string | null;
  criado_em?: string | null;
}): number {
  let score = 0;

  if (lead.telefone) score += 25;
  if (lead.email) score += 10;
  if (lead.mensagem && lead.mensagem.trim().length > 40) score += 15;
  if (lead.imovel_id) score += 20;

  const valor = Number(lead.valor ?? 0);
  if (valor >= 2_000_000) score += 15;
  else if (valor >= 800_000) score += 10;
  else if (valor > 0) score += 5;

  if (lead.origem === 'indicacao') score += 15;
  else if (lead.origem === 'site' || lead.origem === 'vitrine') score += 8;

  if (lead.criado_em) {
    const dias = (Date.now() - new Date(lead.criado_em).getTime()) / 86_400_000;
    if (dias <= 1) score += 10;
    else if (dias <= 7) score += 5;
    else if (dias > 30) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

export function temperaturaPorScore(score: number): 'frio' | 'morno' | 'quente' {
  if (score >= 70) return 'quente';
  if (score >= 40) return 'morno';
  return 'frio';
}
