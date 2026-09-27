/**
 * Consultas sobre a base de demonstração.
 *
 * Reproduzem o que o banco faria: a vitrine só enxerga o que está
 * publicado e sem os campos de captação, o resumo financeiro soma o
 * período, e assim por diante. Reproduzir esse recorte importa, porque
 * é ele que você está testando quando publica um imóvel no painel e
 * confere se ele apareceu no site.
 */

import type {
  CondominioComResumo,
  DesempenhoConsultor,
  ImovelPublico,
  Lead,
  ResumoFinanceiroPeriodo,
} from '@imob/core';

/** Mesma forma das facetas do pacote de banco, sem depender dele. */
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

import type { Foto } from '@imob/core';

import { alterarBase, lerBase, novoId } from './armazem';

/**
 * Álbum de cada imóvel, indexado uma vez por leitura da base.
 *
 * A vitrine monta dezenas de cartões por página; procurar as fotos de
 * cada um varrendo a lista inteira seria quadrático à toa. O índice fica
 * preso ao array de fotos: quando a base é regravada, o array é outro e
 * o índice é refeito sozinho.
 */
const INDICES_FOTOS = new WeakMap<Foto[], Map<string, Foto[]>>();

function fotosDoImovel(imovelId: string): Foto[] {
  const fotos = lerBase().fotos ?? [];
  let indice = INDICES_FOTOS.get(fotos);

  if (!indice) {
    indice = new Map();
    for (const foto of fotos) {
      const lista = indice.get(foto.imovel_id) ?? [];
      lista.push(foto);
      indice.set(foto.imovel_id, lista);
    }
    for (const lista of indice.values()) {
      lista.sort((a, b) => Number(b.capa) - Number(a.capa) || a.ordem - b.ordem);
    }
    INDICES_FOTOS.set(fotos, indice);
  }

  return indice.get(imovelId) ?? [];
}

// ------------------------------------------------------------
// VITRINE PÚBLICA
// ------------------------------------------------------------

/**
 * Converte o registro interno no que o visitante pode ver.
 *
 * Espelha a view vitrine_imoveis: matrícula, proprietário, observações
 * internas e dados de captação simplesmente não existem no resultado.
 * O endereço só aparece quando o proprietário autorizou.
 */
function paraVitrine(imovel: Record<string, unknown>): ImovelPublico {
  const exibirEndereco = Boolean(imovel.exibir_endereco);

  return {
    id: imovel.id as string,
    codigo: imovel.codigo as string,
    slug: imovel.slug as string,
    titulo: imovel.titulo as string,
    descricao: (imovel.descricao as string) ?? null,
    tipo: imovel.tipo as string,
    finalidade: imovel.finalidade as ImovelPublico['finalidade'],
    status: imovel.status as ImovelPublico['status'],

    bairro: (imovel.bairro as string) ?? null,
    cidade: imovel.cidade as string,
    uf: imovel.uf as string,
    logradouro: exibirEndereco ? ((imovel.logradouro as string) ?? null) : null,
    numero: exibirEndereco ? ((imovel.numero as string) ?? null) : null,
    cep: exibirEndereco ? ((imovel.cep as string) ?? null) : null,
    latitude: exibirEndereco ? ((imovel.latitude as number) ?? null) : null,
    longitude: exibirEndereco ? ((imovel.longitude as number) ?? null) : null,

    valor: Number(imovel.valor ?? 0),
    valor_locacao: (imovel.valor_locacao as number) ?? null,
    valor_condominio: (imovel.valor_condominio as number) ?? null,
    valor_iptu: (imovel.valor_iptu as number) ?? null,
    aceita_permuta: Boolean(imovel.aceita_permuta),
    aceita_financiamento: Boolean(imovel.aceita_financiamento),

    area_util: Number(imovel.area_util ?? 0),
    area_total: Number(imovel.area_total ?? 0),
    hectares: (imovel.hectares as number) ?? null,
    quartos: Number(imovel.quartos ?? 0),
    suites: Number(imovel.suites ?? 0),
    banheiros: Number(imovel.banheiros ?? 0),
    vagas: Number(imovel.vagas ?? 0),
    ano_construcao: (imovel.ano_construcao as number) ?? null,
    andar: (imovel.andar as number) ?? null,
    mobiliado: Boolean(imovel.mobiliado),
    caracteristicas: (imovel.caracteristicas as string[]) ?? [],

    condominio_id: (imovel.condominio_id as string) ?? null,
    condominio_nome: (imovel.condominio_nome as string) ?? null,
    referencia_externa: (imovel.referencia_externa as string) ?? null,

    destaque: Boolean(imovel.destaque),
    cover: (imovel.cover as string) ?? 'cv1',
    meta_titulo: (imovel.meta_titulo as string) ?? null,
    meta_descricao: (imovel.meta_descricao as string) ?? null,

    criado_em: imovel.criado_em as string,
    atualizado_em: imovel.atualizado_em as string,

    fotos: fotosDoImovel(imovel.id as string),
  };
}

/** Todos os imóveis publicados, no formato da vitrine. */
export function imoveisPublicos(): ImovelPublico[] {
  return lerBase()
    .imoveis.filter((i) => i.publicado)
    .map((i) => paraVitrine(i as unknown as Record<string, unknown>));
}

export interface FiltroDemo {
  termo?: string;
  tipo?: string;
  bairro?: string;
  cidade?: string;
  condominio?: string;
  finalidade?: string;
  quartos?: number;
  suites?: number;
  banheiros?: number;
  vagas?: number;
  valorMin?: number;
  valorMax?: number;
  areaMin?: number;
  areaMax?: number;
  caracteristicas?: string[];
  somenteDestaque?: boolean;
  ordem?: string;
  pagina?: number;
  porPagina?: number;
}

/** Sem acento e em minúsculas, para a busca aceitar "karaiba". */
function achatar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function buscarVitrine(filtro: FiltroDemo = {}) {
  const termo = filtro.termo ? achatar(filtro.termo) : '';

  let lista = imoveisPublicos().filter((i) => {
    if (filtro.tipo && i.tipo !== filtro.tipo) return false;
    if (filtro.bairro && i.bairro !== filtro.bairro) return false;
    if (filtro.cidade && i.cidade !== filtro.cidade) return false;
    if (filtro.condominio && i.condominio_nome !== filtro.condominio) return false;

    // Locação inclui quem aceita as duas finalidades: o imóvel marcado
    // como venda_locacao serve aos dois públicos.
    if (filtro.finalidade === 'locacao' && !['locacao', 'venda_locacao'].includes(i.finalidade)) {
      return false;
    }
    if (filtro.finalidade === 'venda' && !['venda', 'venda_locacao'].includes(i.finalidade)) {
      return false;
    }

    if (filtro.quartos && i.quartos < filtro.quartos) return false;
    if (filtro.suites && i.suites < filtro.suites) return false;
    if (filtro.banheiros && i.banheiros < filtro.banheiros) return false;
    if (filtro.vagas && i.vagas < filtro.vagas) return false;
    if (filtro.valorMin && i.valor < filtro.valorMin) return false;
    if (filtro.valorMax && i.valor > filtro.valorMax) return false;
    if (filtro.areaMin && i.area_util < filtro.areaMin) return false;
    if (filtro.areaMax && i.area_util > filtro.areaMax) return false;
    if (filtro.somenteDestaque && !i.destaque) return false;

    if (filtro.caracteristicas?.length) {
      if (!filtro.caracteristicas.every((c) => i.caracteristicas.includes(c))) return false;
    }

    if (termo) {
      const alvo = achatar(
        `${i.titulo} ${i.bairro ?? ''} ${i.cidade} ${i.codigo} ${i.condominio_nome ?? ''} ` +
          `${i.referencia_externa ?? ''} ${i.descricao ?? ''}`,
      );
      if (!alvo.includes(termo)) return false;
    }

    return true;
  });

  const ordenacoes: Record<string, (a: ImovelPublico, b: ImovelPublico) => number> = {
    menor_preco: (a, b) => a.valor - b.valor,
    maior_preco: (a, b) => b.valor - a.valor,
    maior_area: (a, b) => b.area_util - a.area_util,
    menor_area: (a, b) => a.area_util - b.area_util,
    recentes: (a, b) => b.criado_em.localeCompare(a.criado_em),
    relevancia: (a, b) => Number(b.destaque) - Number(a.destaque) || b.valor - a.valor,
  };

  const escolhida = ordenacoes[filtro.ordem ?? 'relevancia'] ?? ordenacoes.relevancia;

  // Desempate por id, igual ao da consulta real: sem ele dois imóveis de
  // mesmo valor trocam de lugar entre páginas e aparecem duplicados.
  lista = [...lista].sort((a, b) => escolhida(a, b) || a.id.localeCompare(b.id));

  const porPagina = filtro.porPagina ?? 12;
  const pagina = Math.max(1, filtro.pagina ?? 1);
  const de = (pagina - 1) * porPagina;

  return {
    imoveis: lista.slice(de, de + porPagina),
    total: lista.length,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(lista.length / porPagina)),
  };
}

export function imovelPorSlug(slug: string): ImovelPublico | null {
  return imoveisPublicos().find((i) => i.slug === slug) ?? null;
}

export function destaquesVitrine(limite = 8): ImovelPublico[] {
  return imoveisPublicos()
    .filter((i) => i.destaque && i.status === 'disponivel')
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limite);
}

export function recentesVitrine(limite = 8): ImovelPublico[] {
  return imoveisPublicos()
    .filter((i) => i.status === 'disponivel')
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .slice(0, limite);
}

/**
 * Espelha buscarLoteDestaque: marcados primeiro, o resto da carteira
 * publicada em seguida, do mais caro para o mais barato.
 */
export function loteDestaqueVitrine(limite = 36): ImovelPublico[] {
  const disponiveis = imoveisPublicos().filter((i) => i.status === 'disponivel');
  const porValor = (a: ImovelPublico, b: ImovelPublico) => Number(b.valor) - Number(a.valor);

  const marcados = disponiveis.filter((i) => i.destaque).sort(porValor);
  const resto = disponiveis.filter((i) => !i.destaque).sort(porValor);

  return [...marcados, ...resto].slice(0, limite);
}

/**
 * Os últimos imóveis que mudaram. Espelha buscarAtualizados do banco:
 * ordena por atualizado_em, que é o que muda quando o preço cai ou entra
 * foto nova, e não por criado_em, que congela na data do cadastro.
 */
export function atualizadosVitrine(limite = 10): ImovelPublico[] {
  return imoveisPublicos()
    .filter((i) => i.status === 'disponivel')
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))
    .slice(0, limite);
}

// ------------------------------------------------------------
// CONDOMÍNIOS
// ------------------------------------------------------------

/**
 * Reproduz a view vitrine_condominios: cada empreendimento vem com a
 * contagem de unidades disponíveis e a faixa de preço delas, que é o que
 * o cartão mostra sem precisar de uma consulta por linha.
 */
export function condominiosVitrine(
  opcoes: { destaque?: boolean; luxo?: boolean; cidade?: string; limite?: number } = {},
): CondominioComResumo[] {
  const base = lerBase();
  const publicos = imoveisPublicos();

  return base.condominios
    .filter((c) => c.publicado)
    .filter((c) => !opcoes.destaque || c.destaque)
    .filter((c) => !opcoes.luxo || c.luxo)
    .filter((c) => !opcoes.cidade || c.cidade === opcoes.cidade)
    .map((c) => {
      const unidades = publicos.filter(
        (i) => i.condominio_id === c.id && !['vendido', 'locado'].includes(i.status),
      );
      const valores = unidades.map((i) => i.valor).filter((v) => v > 0);

      return {
        ...c,
        total_imoveis: unidades.length,
        menor_valor: valores.length ? Math.min(...valores) : 0,
        maior_valor: valores.length ? Math.max(...valores) : 0,
      };
    })
    .sort(
      (a, b) =>
        Number(b.destaque) - Number(a.destaque) ||
        b.total_imoveis - a.total_imoveis ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
    .slice(0, opcoes.limite ?? 60);
}

export function condominioPorSlug(slug: string): CondominioComResumo | null {
  return condominiosVitrine({ limite: 999 }).find((c) => c.slug === slug) ?? null;
}

export function semelhantesVitrine(imovel: ImovelPublico, limite = 4): ImovelPublico[] {
  const publicos = imoveisPublicos().filter(
    (i) => i.id !== imovel.id && i.status === 'disponivel',
  );

  // Unidade no mesmo empreendimento é sempre a melhor sugestão: quem
  // gostou da planta costuma aceitar outro andar do mesmo prédio.
  const doCondominio = imovel.condominio_id
    ? publicos.filter((i) => i.condominio_id === imovel.condominio_id)
    : [];

  if (doCondominio.length >= limite) return doCondominio.slice(0, limite);

  const proximos = publicos.filter(
    (i) =>
      !doCondominio.includes(i) &&
      (i.bairro === imovel.bairro || i.tipo === imovel.tipo) &&
      i.valor >= imovel.valor * 0.6 &&
      i.valor <= imovel.valor * 1.6,
  );

  return [...doCondominio, ...proximos].slice(0, limite);
}

/** Mesma forma da função facetas_vitrine() do banco: valor com contagem. */
export function facetasVitrine(): Facetas {
  const publicados = imoveisPublicos().filter((i) => i.status === 'disponivel');
  const valores = publicados.map((i) => i.valor).filter((v) => v > 0);

  const contar = (pegar: (i: ImovelPublico) => string | null | undefined): Faceta[] => {
    const mapa = new Map<string, number>();
    for (const imovel of publicados) {
      const valor = pegar(imovel);
      if (!valor) continue;
      mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .map(([valor, total]) => ({ valor, total }))
      .sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor, 'pt-BR'));
  };

  return {
    bairros: contar((i) => i.bairro),
    cidades: contar((i) => i.cidade),
    tipos: contar((i) => i.tipo),
    condominios: contar((i) => i.condominio_nome),
    faixaValor: (valores.length ? [Math.min(...valores), Math.max(...valores)] : [0, 0]) as [
      number,
      number,
    ],
  };
}

export function slugsPublicados() {
  return imoveisPublicos().map((i) => ({ slug: i.slug, atualizado_em: i.atualizado_em }));
}

export function imoveisPorIds(ids: string[]): ImovelPublico[] {
  const publicos = imoveisPublicos();
  const porId = new Map(publicos.map((i) => [i.id, i]));
  return ids.map((id) => porId.get(id)).filter((i): i is ImovelPublico => Boolean(i));
}

// ------------------------------------------------------------
// FINANCEIRO
// ------------------------------------------------------------

export function resumoFinanceiro(inicio: string, fim: string): ResumoFinanceiroPeriodo {
  const base = lerBase();

  const concluidas = base.vendas.filter(
    (v) =>
      v.status === 'concluida' &&
      v.data_conclusao &&
      v.data_conclusao >= inicio &&
      v.data_conclusao <= fim,
  );

  const soma = (pegar: (v: (typeof concluidas)[number]) => number) =>
    concluidas.reduce((total, v) => total + Number(pegar(v) || 0), 0);

  const vgv = soma((v) => v.valor_venda);

  const comDesconto = concluidas.filter((v) => v.valor_tabela > 0);
  const descontoMedio =
    comDesconto.length > 0
      ? comDesconto.reduce((t, v) => t + (v.desconto / v.valor_tabela) * 100, 0) /
        comDesconto.length
      : 0;

  return {
    vgv,
    negocios: concluidas.length,
    comissao_bruta: soma((v) => v.comissao_bruta),
    comissao_casa: soma((v) => v.comissao_casa),
    comissao_equipe: soma((v) => v.comissao_consultor + v.comissao_captador),
    custos: soma((v) => v.custos),
    margem: soma((v) => v.margem),
    ticket_medio: concluidas.length ? vgv / concluidas.length : 0,
    desconto_medio_pct: descontoMedio,
    em_negociacao: base.vendas
      .filter((v) => ['proposta', 'aprovada', 'contrato'].includes(v.status))
      .reduce((t, v) => t + Number(v.valor_venda), 0),
    a_receber: base.parcelas
      .filter((p) => p.status === 'pendente')
      .reduce((t, p) => t + Number(p.valor), 0),
  };
}

export function desempenhoEquipe(inicio: string, fim: string): DesempenhoConsultor[] {
  const base = lerBase();

  return base.perfis
    .filter((p) => p.ativo)
    .map((p) => {
      const minhas = base.vendas.filter(
        (v) =>
          v.consultor_id === p.id &&
          v.status === 'concluida' &&
          v.data_conclusao &&
          v.data_conclusao >= inicio &&
          v.data_conclusao <= fim,
      );

      const vgv = minhas.reduce((t, v) => t + Number(v.valor_venda), 0);

      return {
        consultor_id: p.id,
        consultor_nome: p.nome,
        meta_mensal: p.meta_mensal,
        vgv,
        negocios: minhas.length,
        comissao: minhas.reduce((t, v) => t + Number(v.comissao_consultor), 0),
        atingimento: p.meta_mensal > 0 ? Math.round((vgv / p.meta_mensal) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.vgv - a.vgv || a.consultor_nome.localeCompare(b.consultor_nome));
}

// ------------------------------------------------------------
// LEADS VINDOS DO SITE
// ------------------------------------------------------------

export interface NovoLeadDemo {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  mensagem?: string | null;
  origem?: string;
  imovel_id?: string | null;
  imovel_titulo?: string | null;
  valor?: number | null;
  pagina_origem?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

/**
 * Grava um lead recebido pelo formulário público.
 *
 * Reproduz o comportamento de registrarLeadPublico(), inclusive a
 * deduplicação: o mesmo telefone dentro de trinta dias vira uma
 * interação no atendimento existente, e não um cartão novo no funil. Sem
 * isso, testar o formulário três vezes encheria a coluna Novo de
 * duplicatas da mesma pessoa e daria uma impressão errada do sistema.
 */
export function registrarLeadDemo(entrada: NovoLeadDemo): { duplicado: boolean } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();
    const telefone = String(entrada.telefone ?? '').replace(/\D/g, '') || null;
    const email = entrada.email?.trim().toLowerCase() || null;

    const trintaDias = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const existente = base.leads.find(
      (l) =>
        l.criado_em >= trintaDias &&
        ((telefone && l.telefone === telefone) || (!telefone && email && l.email === email)),
    );

    if (existente) {
      existente.arquivado = false;
      existente.score = Math.min(100, existente.score + 10);
      existente.temperatura =
        existente.score >= 70 ? 'quente' : existente.score >= 40 ? 'morno' : 'frio';
      existente.atualizado_em = agora;

      base.interacoes.push({
        id: novoId(),
        lead_id: existente.id,
        tipo: 'sistema',
        conteudo: `Novo contato pelo site.${entrada.mensagem ? ` Mensagem: "${entrada.mensagem}"` : ''}`,
        autor_id: null,
        autor_nome: 'Site',
        criado_em: agora,
      });

      return { duplicado: true };
    }

    let score = 25;
    if (telefone) score += 10;
    if (email) score += 10;
    if ((entrada.mensagem ?? '').length > 40) score += 15;
    if (entrada.imovel_id) score += 20;
    if ((entrada.valor ?? 0) >= 2_000_000) score += 15;
    else if ((entrada.valor ?? 0) >= 800_000) score += 10;
    score = Math.max(0, Math.min(100, score + 10));

    const lead: Lead = {
      id: novoId(),
      nome: entrada.nome.trim().slice(0, 120),
      telefone,
      email,
      mensagem: entrada.mensagem?.slice(0, 2000) ?? null,
      origem: (entrada.origem ?? 'site') as Lead['origem'],
      etapa: 'novo',
      temperatura: score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio',
      score,
      imovel_id: entrada.imovel_id ?? null,
      imovel_titulo: entrada.imovel_titulo ?? null,
      valor: entrada.valor ?? 0,
      // Chega sem dono, na fila. É a mesma regra do banco: quem assume
      // o atendimento é decisão da equipe, não do formulário.
      corretor_id: null,
      consentimento_lgpd: true,
      consentimento_em: agora,
      utm_source: entrada.utm_source ?? null,
      utm_medium: entrada.utm_medium ?? null,
      utm_campaign: entrada.utm_campaign ?? null,
      utm_term: null,
      utm_content: null,
      pagina_origem: entrada.pagina_origem ?? null,
      arquivado: false,
      motivo_perda: null,
      proximo_contato: null,
      criado_em: agora,
      atualizado_em: agora,
    };

    base.leads.push(lead);

    base.interacoes.push({
      id: novoId(),
      lead_id: lead.id,
      tipo: 'sistema',
      conteudo: `Contato recebido pelo site.${entrada.imovel_titulo ? ` Imóvel de interesse: ${entrada.imovel_titulo}.` : ''}`,
      autor_id: null,
      autor_nome: 'Site',
      criado_em: agora,
    });

    return { duplicado: false };
  });
}
