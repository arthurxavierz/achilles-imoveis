/**
 * Indicadores da operacao.
 *
 * Funcoes puras: entram listas, saem numeros. Nenhuma consulta ao banco
 * acontece aqui, e essa e a razao de o modulo existir. O painel calcula
 * a partir do que ja carregou, a demonstracao calcula a partir do
 * arquivo local, e as duas telas mostram exatamente o mesmo resultado
 * porque atravessam este mesmo codigo.
 *
 * Cada indicador responde a uma pergunta que alguem faz em voz alta na
 * reuniao de segunda. Quando um numero nao responde a nenhuma, ele nao
 * entra aqui.
 */

import type { Compromisso } from './agenda';
import type { ImovelResumo } from './carteira';
import type { EtapaLead, Interacao, Lead, OrigemLead, Perfil } from './tipos';
import type { Venda } from './vendas';

export interface BaseIndicadores {
  perfis: Perfil[];
  /**
   * O resumo, e nao o registro inteiro.
   *
   * Os indicadores leem bairro, tipo, situacao, publicado, responsavel,
   * valor e data de cadastro. Carregar as 58 colunas para isso trazia
   * 2,2 MB de descricao e observacao interna que nenhuma conta usa.
   */
  imoveis: ImovelResumo[];
  leads: Lead[];
  interacoes: Interacao[];
  compromissos: Compromisso[];
  vendas: Venda[];
}

export interface Periodo {
  /** AAAA-MM-DD, inclusivo. */
  inicio: string;
  /** AAAA-MM-DD, inclusivo. */
  fim: string;
}

// ------------------------------------------------------------
// AJUDANTES
// ------------------------------------------------------------

const soData = (iso: string | null | undefined): string => String(iso ?? '').slice(0, 10);

const dentro = (iso: string | null | undefined, p: Periodo): boolean => {
  const d = soData(iso);
  return d >= p.inicio && d <= p.fim;
};

const somar = <T>(itens: T[], pegar: (i: T) => number): number =>
  itens.reduce((total, i) => total + (Number(pegar(i)) || 0), 0);

const media = <T>(itens: T[], pegar: (i: T) => number): number =>
  itens.length === 0 ? 0 : somar(itens, pegar) / itens.length;

const arredondar1 = (v: number): number => Math.round(v * 10) / 10;

/** Ultimos N meses no formato AAAA-MM, do mais antigo para o mais novo. */
export function ultimosMeses(quantidade: number, referencia = new Date()): string[] {
  const meses: string[] = [];

  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return meses;
}

export function periodoDoMes(competencia: string): Periodo {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return { inicio: `${competencia}-01`, fim: `${competencia}-${String(ultimo).padStart(2, '0')}` };
}

/** Periodo dos ultimos N dias, contando hoje. */
export function periodoRecente(dias: number, referencia = new Date()): Periodo {
  const inicio = new Date(referencia);
  inicio.setDate(inicio.getDate() - (dias - 1));

  const formatar = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;

  return { inicio: formatar(inicio), fim: formatar(referencia) };
}

// ------------------------------------------------------------
// VISAO GERAL DO PERIODO
// ------------------------------------------------------------

export interface ResumoOperacao {
  vgv: number;
  negocios: number;
  ticketMedio: number;
  comissaoBruta: number;
  margem: number;
  leadsRecebidos: number;
  leadsConvertidos: number;
  conversao: number;
  /** Dias entre a chegada do lead e o fechamento, media. */
  cicloMedioDias: number;
  atendimentos: number;
  visitasRealizadas: number;
}

export function resumirOperacao(base: BaseIndicadores, periodo: Periodo): ResumoOperacao {
  const concluidas = base.vendas.filter(
    (v) => v.status === 'concluida' && dentro(v.data_conclusao, periodo),
  );

  const leadsPeriodo = base.leads.filter((l) => dentro(l.criado_em, periodo));
  const convertidos = leadsPeriodo.filter((l) => l.etapa === 'fechado');

  const vgv = somar(concluidas, (v) => v.valor_venda);

  // Ciclo de venda: so entra o negocio que veio de um lead conhecido,
  // senao a media misturaria captacao antiga com atendimento novo.
  const porLead = new Map(base.leads.map((l) => [l.id, l]));
  const ciclos = concluidas
    .map((v) => {
      const lead = v.lead_id ? porLead.get(v.lead_id) : null;
      if (!lead || !v.data_conclusao) return null;
      const dias = Math.round(
        (new Date(v.data_conclusao).getTime() - new Date(lead.criado_em).getTime()) / 86_400_000,
      );
      return dias >= 0 ? dias : null;
    })
    .filter((d): d is number => d !== null);

  const interacoesPeriodo = base.interacoes.filter(
    (i) => i.tipo !== 'sistema' && dentro(i.criado_em, periodo),
  );

  const visitas = base.compromissos.filter(
    (c) => c.tipo === 'visita' && c.status === 'concluido' && dentro(c.inicio, periodo),
  );

  return {
    vgv,
    negocios: concluidas.length,
    ticketMedio: concluidas.length ? vgv / concluidas.length : 0,
    comissaoBruta: somar(concluidas, (v) => v.comissao_bruta),
    margem: somar(concluidas, (v) => v.margem),
    leadsRecebidos: leadsPeriodo.length,
    leadsConvertidos: convertidos.length,
    conversao: leadsPeriodo.length ? (convertidos.length / leadsPeriodo.length) * 100 : 0,
    cicloMedioDias: ciclos.length ? Math.round(media(ciclos, (d) => d)) : 0,
    atendimentos: interacoesPeriodo.length,
    visitasRealizadas: visitas.length,
  };
}

// ------------------------------------------------------------
// BAIRROS
// ------------------------------------------------------------

export interface DesempenhoBairro {
  bairro: string;
  imoveis: number;
  imoveisPublicados: number;
  leads: number;
  visitas: number;
  vendas: number;
  vgv: number;
  ticketMedio: number;
  /** Preco medio do metro quadrado dos imoveis vendidos no bairro. */
  precoMetro: number;
  /** Quantos leads foram precisos para cada venda. Menor e melhor. */
  leadsPorVenda: number;
  /** 0 a 100. Combina procura, conversao e valor. */
  indice: number;
}

/**
 * Ranking de bairros.
 *
 * O "bairro mais promissor" nao e o que mais vendeu nem o que tem o
 * imovel mais caro: e onde a procura vira negocio com menos esforco. Por
 * isso o indice pesa tres coisas em partes diferentes: procura (quantos
 * leads), eficiencia (quanto dessa procura fechou) e retorno (o VGV
 * gerado). Um bairro com muita procura e nenhuma conversao fica atras de
 * um com metade dos leads e o dobro de fechamentos, que e exatamente a
 * leitura que interessa para decidir onde captar o proximo imovel.
 */
export function desempenhoPorBairro(base: BaseIndicadores, periodo: Periodo): DesempenhoBairro[] {
  const porImovel = new Map(base.imoveis.map((i) => [i.id, i]));

  const bairroDoImovel = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return porImovel.get(id)?.bairro ?? null;
  };

  const agrupado = new Map<string, DesempenhoBairro>();

  const garantir = (bairro: string): DesempenhoBairro => {
    let atual = agrupado.get(bairro);
    if (!atual) {
      atual = {
        bairro,
        imoveis: 0,
        imoveisPublicados: 0,
        leads: 0,
        visitas: 0,
        vendas: 0,
        vgv: 0,
        ticketMedio: 0,
        precoMetro: 0,
        leadsPorVenda: 0,
        indice: 0,
      };
      agrupado.set(bairro, atual);
    }
    return atual;
  };

  for (const imovel of base.imoveis) {
    if (!imovel.bairro) continue;
    const linha = garantir(imovel.bairro);
    linha.imoveis += 1;
    if (imovel.publicado) linha.imoveisPublicados += 1;
  }

  for (const lead of base.leads) {
    if (!dentro(lead.criado_em, periodo)) continue;
    const bairro = bairroDoImovel(lead.imovel_id);
    if (!bairro) continue;
    garantir(bairro).leads += 1;
  }

  for (const c of base.compromissos) {
    if (c.tipo !== 'visita' || !dentro(c.inicio, periodo)) continue;
    const bairro = bairroDoImovel(c.imovel_id);
    if (!bairro) continue;
    garantir(bairro).visitas += 1;
  }

  const areaVendida = new Map<string, number>();

  for (const venda of base.vendas) {
    if (venda.status !== 'concluida' || !dentro(venda.data_conclusao, periodo)) continue;
    const bairro = bairroDoImovel(venda.imovel_id);
    if (!bairro) continue;

    const linha = garantir(bairro);
    linha.vendas += 1;
    linha.vgv += Number(venda.valor_venda) || 0;

    const area = venda.imovel_id ? Number(porImovel.get(venda.imovel_id)?.area_util ?? 0) : 0;
    if (area > 0) areaVendida.set(bairro, (areaVendida.get(bairro) ?? 0) + area);
  }

  const linhas = [...agrupado.values()];
  const maiorLeads = Math.max(1, ...linhas.map((l) => l.leads));
  const maiorVgv = Math.max(1, ...linhas.map((l) => l.vgv));

  for (const linha of linhas) {
    linha.ticketMedio = linha.vendas ? linha.vgv / linha.vendas : 0;
    linha.leadsPorVenda = linha.vendas ? arredondar1(linha.leads / linha.vendas) : 0;

    const area = areaVendida.get(linha.bairro) ?? 0;
    linha.precoMetro = area > 0 ? Math.round(linha.vgv / area) : 0;

    const procura = linha.leads / maiorLeads;
    const eficiencia = linha.leads > 0 ? Math.min(1, linha.vendas / linha.leads) : 0;
    const retorno = linha.vgv / maiorVgv;

    linha.indice = Math.round(procura * 40 + eficiencia * 35 + retorno * 25);
  }

  return linhas.sort((a, b) => b.indice - a.indice || b.vgv - a.vgv);
}

// ------------------------------------------------------------
// ORIGEM DOS LEADS
// ------------------------------------------------------------

export interface DesempenhoOrigem {
  origem: OrigemLead;
  leads: number;
  fechados: number;
  perdidos: number;
  emAndamento: number;
  conversao: number;
  vgv: number;
  ticketMedio: number;
  scoreMedio: number;
  /** Fatia dos leads do periodo, em porcentagem. */
  participacao: number;
}

export function desempenhoPorOrigem(base: BaseIndicadores, periodo: Periodo): DesempenhoOrigem[] {
  const leads = base.leads.filter((l) => dentro(l.criado_em, periodo));
  if (leads.length === 0) return [];

  const vendaPorLead = new Map<string, Venda>();
  for (const v of base.vendas) {
    if (v.status === 'concluida' && v.lead_id) vendaPorLead.set(v.lead_id, v);
  }

  const agrupado = new Map<OrigemLead, Lead[]>();
  for (const lead of leads) {
    const lista = agrupado.get(lead.origem) ?? [];
    lista.push(lead);
    agrupado.set(lead.origem, lista);
  }

  return [...agrupado.entries()]
    .map(([origem, doGrupo]) => {
      const fechados = doGrupo.filter((l) => l.etapa === 'fechado');
      const vgv = somar(fechados, (l) => Number(vendaPorLead.get(l.id)?.valor_venda ?? l.valor));

      return {
        origem,
        leads: doGrupo.length,
        fechados: fechados.length,
        perdidos: doGrupo.filter((l) => l.etapa === 'perdido').length,
        emAndamento: doGrupo.filter((l) => !['fechado', 'perdido'].includes(l.etapa)).length,
        conversao: (fechados.length / doGrupo.length) * 100,
        vgv,
        ticketMedio: fechados.length ? vgv / fechados.length : 0,
        scoreMedio: Math.round(media(doGrupo, (l) => l.score)),
        participacao: (doGrupo.length / leads.length) * 100,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

// ------------------------------------------------------------
// CONSULTORES
// ------------------------------------------------------------

export interface DesempenhoPessoa {
  id: string;
  nome: string;
  papel: string;
  metaMensal: number;
  vgv: number;
  negocios: number;
  comissao: number;
  ticketMedio: number;
  atingimento: number;
  leadsAtendidos: number;
  interacoes: number;
  visitasFeitas: number;
  compromissos: number;
  conversao: number;
  /** Interacoes registradas por lead sob responsabilidade. */
  toqueMedio: number;
  imoveisAtivos: number;
}

export function desempenhoPorPessoa(base: BaseIndicadores, periodo: Periodo): DesempenhoPessoa[] {
  return base.perfis
    .filter((p) => p.ativo)
    .map((p) => {
      const vendas = base.vendas.filter(
        (v) =>
          v.consultor_id === p.id && v.status === 'concluida' && dentro(v.data_conclusao, periodo),
      );

      const leads = base.leads.filter(
        (l) => l.corretor_id === p.id && dentro(l.criado_em, periodo),
      );

      const fechados = leads.filter((l) => l.etapa === 'fechado').length;

      const interacoes = base.interacoes.filter(
        (i) => i.autor_id === p.id && i.tipo !== 'sistema' && dentro(i.criado_em, periodo),
      );

      const compromissos = base.compromissos.filter(
        (c) => c.responsavel_id === p.id && c.status !== 'cancelado' && dentro(c.inicio, periodo),
      );

      const vgv = somar(vendas, (v) => v.valor_venda);

      return {
        id: p.id,
        nome: p.nome,
        papel: p.papel,
        metaMensal: p.meta_mensal,
        vgv,
        negocios: vendas.length,
        comissao: somar(vendas, (v) => v.comissao_consultor),
        ticketMedio: vendas.length ? vgv / vendas.length : 0,
        atingimento: p.meta_mensal > 0 ? arredondar1((vgv / p.meta_mensal) * 100) : 0,
        leadsAtendidos: leads.length,
        interacoes: interacoes.length,
        visitasFeitas: compromissos.filter((c) => c.tipo === 'visita').length,
        compromissos: compromissos.length,
        conversao: leads.length ? arredondar1((fechados / leads.length) * 100) : 0,
        toqueMedio: leads.length ? arredondar1(interacoes.length / leads.length) : 0,
        imoveisAtivos: base.imoveis.filter((i) => i.corretor_id === p.id && i.publicado).length,
      };
    })
    .sort((a, b) => b.vgv - a.vgv || b.interacoes - a.interacoes);
}

// ------------------------------------------------------------
// FUNIL
// ------------------------------------------------------------

export interface EtapaFunil {
  etapa: EtapaLead;
  leads: number;
  valor: number;
  /** Porcentagem que sobreviveu da etapa anterior. */
  passagem: number;
}

const ORDEM_FUNIL: EtapaLead[] = ['novo', 'contato', 'visita', 'proposta', 'fechado'];

/**
 * Funil acumulado.
 *
 * Cada etapa conta quem chegou ate ela, e nao quem parou nela. Um lead
 * parado em "proposta" ja passou por visita, e contar so o estagio atual
 * daria a impressao falsa de que a visita nao aconteceu. Assim a taxa de
 * passagem mostra onde a operacao realmente perde gente.
 */
export function funilAcumulado(base: BaseIndicadores, periodo: Periodo): EtapaFunil[] {
  const leads = base.leads.filter((l) => dentro(l.criado_em, periodo));

  const posicao = (etapa: EtapaLead): number => ORDEM_FUNIL.indexOf(etapa);

  const bruto = ORDEM_FUNIL.map((etapa, indice) => {
    // Perdidos ficam de fora do acumulado: eles saem do funil, e o que
    // interessa aqui e quanto do que continua vivo avancou.
    const chegaram = leads.filter((l) => l.etapa !== 'perdido' && posicao(l.etapa) >= indice);

    return {
      etapa,
      leads: chegaram.length,
      valor: somar(chegaram, (l) => l.valor),
      passagem: 0,
    };
  });

  return bruto.map((linha, indice) => ({
    ...linha,
    passagem:
      indice === 0
        ? 100
        : bruto[indice - 1].leads > 0
          ? arredondar1((linha.leads / bruto[indice - 1].leads) * 100)
          : 0,
  }));
}

// ------------------------------------------------------------
// EVOLUCAO MENSAL
// ------------------------------------------------------------

export interface MesConsolidado {
  competencia: string;
  vgv: number;
  negocios: number;
  comissao: number;
  leads: number;
  ticketMedio: number;
}

export function evolucaoMensal(base: BaseIndicadores, meses: string[]): MesConsolidado[] {
  return meses.map((competencia) => {
    const periodo = periodoDoMes(competencia);

    const vendas = base.vendas.filter(
      (v) => v.status === 'concluida' && dentro(v.data_conclusao, periodo),
    );

    const vgv = somar(vendas, (v) => v.valor_venda);

    return {
      competencia,
      vgv,
      negocios: vendas.length,
      comissao: somar(vendas, (v) => v.comissao_bruta),
      leads: base.leads.filter((l) => dentro(l.criado_em, periodo)).length,
      ticketMedio: vendas.length ? vgv / vendas.length : 0,
    };
  });
}

// ------------------------------------------------------------
// TIPOS DE IMOVEL
// ------------------------------------------------------------

export interface DesempenhoTipo {
  tipo: string;
  imoveis: number;
  leads: number;
  vendas: number;
  vgv: number;
  ticketMedio: number;
  /** Dias medios entre cadastrar o imovel e vende-lo. */
  diasAteVender: number;
}

export function desempenhoPorTipo(base: BaseIndicadores, periodo: Periodo): DesempenhoTipo[] {
  interface Acumulador extends DesempenhoTipo {
    somaDias: number;
    comDias: number;
  }

  const porImovel = new Map(base.imoveis.map((i) => [i.id, i]));
  const agrupado = new Map<string, Acumulador>();

  const garantir = (tipo: string): Acumulador => {
    let atual = agrupado.get(tipo);
    if (!atual) {
      atual = {
        tipo,
        imoveis: 0,
        leads: 0,
        vendas: 0,
        vgv: 0,
        ticketMedio: 0,
        diasAteVender: 0,
        somaDias: 0,
        comDias: 0,
      };
      agrupado.set(tipo, atual);
    }
    return atual;
  };

  for (const imovel of base.imoveis) garantir(imovel.tipo).imoveis += 1;

  for (const lead of base.leads) {
    if (!dentro(lead.criado_em, periodo) || !lead.imovel_id) continue;
    const imovel = porImovel.get(lead.imovel_id);
    if (imovel) garantir(imovel.tipo).leads += 1;
  }

  for (const venda of base.vendas) {
    if (venda.status !== 'concluida' || !dentro(venda.data_conclusao, periodo)) continue;
    const imovel = venda.imovel_id ? porImovel.get(venda.imovel_id) : null;
    if (!imovel) continue;

    const linha = garantir(imovel.tipo);
    linha.vendas += 1;
    linha.vgv += Number(venda.valor_venda) || 0;

    const dias = Math.round(
      (new Date(String(venda.data_conclusao)).getTime() - new Date(imovel.criado_em).getTime()) /
        86_400_000,
    );
    if (dias >= 0) {
      linha.somaDias += dias;
      linha.comDias += 1;
    }
  }

  return [...agrupado.values()]
    .map((linha) => ({
      tipo: linha.tipo,
      imoveis: linha.imoveis,
      leads: linha.leads,
      vendas: linha.vendas,
      vgv: linha.vgv,
      ticketMedio: linha.vendas ? linha.vgv / linha.vendas : 0,
      diasAteVender: linha.comDias ? Math.round(linha.somaDias / linha.comDias) : 0,
    }))
    .sort((a, b) => b.vgv - a.vgv || b.leads - a.leads);
}

// ------------------------------------------------------------
// PENDENCIAS
// ------------------------------------------------------------

export type GravidadePendencia = 'alta' | 'media' | 'baixa';

export interface Pendencia {
  chave: string;
  titulo: string;
  detalhe: string;
  quantidade: number;
  gravidade: GravidadePendencia;
  destino: string;
}

/**
 * O que esta esperando alguem agir.
 *
 * A lista e curta de proposito. Painel de pendencia que mostra vinte
 * itens vira papel de parede: ninguem le, e o item urgente se perde
 * entre os irrelevantes. Entram apenas as situacoes em que existe uma
 * acao clara e um custo real em nao fazer nada.
 */
export function levantarPendencias(
  base: BaseIndicadores,
  usuario: Perfil,
  parcelasVencidas = 0,
): Pendencia[] {
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
  const hoje = new Date().toISOString().slice(0, 10);
  const agora = Date.now();

  const meusLeads = (itens: Lead[]) =>
    gestor ? itens : itens.filter((l) => l.corretor_id === usuario.id);

  const ultima = new Map<string, string>();
  for (const i of base.interacoes) {
    const atual = ultima.get(i.lead_id);
    if (!atual || i.criado_em > atual) ultima.set(i.lead_id, i.criado_em);
  }

  const pendencias: Pendencia[] = [];

  const semDono = base.leads.filter((l) => !l.arquivado && l.corretor_id === null);
  if (semDono.length > 0) {
    pendencias.push({
      chave: 'leads-sem-dono',
      titulo: 'Leads sem responsável',
      detalhe: 'Chegaram pelo site ou pelo WhatsApp e ninguém assumiu o atendimento.',
      quantidade: semDono.length,
      gravidade: 'alta',
      destino: '/leads?visao=lista&consultor=sem-dono',
    });
  }

  const parados = meusLeads(base.leads.filter((l) => !l.arquivado)).filter((l) => {
    if (['fechado', 'perdido'].includes(l.etapa)) return false;
    const referencia = ultima.get(l.id) ?? l.criado_em;
    return (agora - new Date(referencia).getTime()) / 86_400_000 > 7;
  });

  if (parados.length > 0) {
    pendencias.push({
      chave: 'leads-parados',
      titulo: 'Atendimentos parados',
      detalhe: 'Mais de sete dias sem nenhum contato registrado.',
      quantidade: parados.length,
      gravidade: 'alta',
      destino: '/leads?visao=lista&situacao=parados',
    });
  }

  const atrasados = base.compromissos.filter(
    (c) =>
      (c.status === 'agendado' || c.status === 'confirmado') &&
      c.inicio.slice(0, 10) < hoje &&
      (gestor || c.responsavel_id === usuario.id),
  );

  if (atrasados.length > 0) {
    pendencias.push({
      chave: 'agenda-atrasada',
      titulo: 'Compromissos sem baixa',
      detalhe: 'Já passaram da data e continuam abertos na agenda.',
      quantidade: atrasados.length,
      gravidade: 'media',
      destino: '/agenda?visao=lista',
    });
  }

  const retornos = meusLeads(base.leads.filter((l) => !l.arquivado)).filter(
    (l) => l.proximo_contato && l.proximo_contato <= hoje && l.etapa !== 'fechado',
  );

  if (retornos.length > 0) {
    pendencias.push({
      chave: 'retorno-hoje',
      titulo: 'Retornos combinados',
      detalhe: 'A data de retorno prometida ao cliente chegou.',
      quantidade: retornos.length,
      gravidade: 'alta',
      destino: '/leads?visao=lista&situacao=retorno',
    });
  }

  if (gestor && parcelasVencidas > 0) {
    pendencias.push({
      chave: 'parcelas-vencidas',
      titulo: 'Comissões vencidas',
      detalhe: 'Parcelas com vencimento passado e ainda sem baixa.',
      quantidade: parcelasVencidas,
      gravidade: 'alta',
      destino: '/financeiro',
    });
  }

  const semPublicar = base.imoveis.filter(
    (i) => !i.publicado && i.status === 'disponivel' && (gestor || i.corretor_id === usuario.id),
  );

  if (semPublicar.length > 0) {
    pendencias.push({
      chave: 'imoveis-fora-do-ar',
      titulo: 'Imóveis fora da vitrine',
      detalhe: 'Estão disponíveis na carteira mas não aparecem no site.',
      quantidade: semPublicar.length,
      gravidade: 'baixa',
      destino: '/imoveis',
    });
  }

  const ordem: Record<GravidadePendencia, number> = { alta: 0, media: 1, baixa: 2 };
  return pendencias.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}
