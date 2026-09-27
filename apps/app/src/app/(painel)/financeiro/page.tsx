import type { Metadata } from 'next';

import type {
  DesempenhoConsultor,
  ImovelDaVenda,
  Perfil,
  ResumoFinanceiroPeriodo,
  VendaDetalhada,
  VendaParcela,
} from '@imob/core';

import { Financeiro } from '@/componentes/financeiro/Financeiro';
import { desempenhoEquipe, resumoFinanceiro } from '@imob/demo';

import { carteiraParaVendaDemo, parcelasDemo, vendasDemo } from '@/lib/dados-demo';
import { equipeDemo, modoDemo } from '@/lib/demonstracao';
import { exigirPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export const metadata: Metadata = { title: 'Financeiro' };
export const dynamic = 'force-dynamic';

export default async function PaginaFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{
    competencia?: string;
    status?: string;
    de?: string;
    ate?: string;
  }>;
}) {
  const params = await searchParams;

  // A pagina inteira exige a area financeira. Consultor sem essa
  // permissao ainda ve as proprias vendas, mas por outra tela.
  const usuario = await exigirPermissao('financeiro');
  const supabase = await supabaseServidor();

  const competencia = lerCompetencia(params.competencia);
  const { inicio, fim } = limitesDoMes(competencia);

  /**
   * Período da lista de negócios.
   *
   * O mês escolhido é o padrão, e não um enfeite do cabeçalho: a lista
   * mostrava os últimos 120 negócios de qualquer data enquanto o título
   * acima dela anunciava um mês específico. Quem lia os dois via uma
   * contradição e não tinha como saber qual valia.
   *
   * As datas soltas, quando informadas, mandam mais que o mês. É o que
   * permite olhar um trimestre ou o ano inteiro sem obrigar a andar de
   * mês em mês.
   */
  const de = lerData(params.de) ?? inicio;
  const ate = lerData(params.ate) ?? fim;

  const [resumo, vendas, parcelas, desempenho, equipe] = modoDemo()
    ? [
        resumoFinanceiro(inicio, fim),
        vendasDemo(params.status, de, ate),
        parcelasDemo(),
        desempenhoEquipe(inicio, fim),
        equipeDemo(),
      ]
    : await Promise.all([
        carregarResumo(supabase, inicio, fim),
        carregarVendas(supabase, params.status, de, ate),
        carregarParcelas(supabase),
        carregarDesempenho(supabase, inicio, fim),
        carregarEquipe(supabase),
      ]);

  // A carteira alimenta o seletor de imóvel da gaveta. Só as colunas que
  // o seletor mostra: é uma lista de escolha, não uma ficha.
  const imoveis = modoDemo() ? carteiraParaVendaDemo() : await carregarCarteira(supabase);

  return (
    <Financeiro
      usuario={usuario}
      resumo={resumo}
      vendas={vendas}
      parcelas={parcelas}
      desempenho={desempenho}
      equipe={equipe}
      competencia={competencia}
      statusFiltro={params.status ?? ''}
      imoveis={imoveis}
      de={de}
      ate={ate}
      periodoLivre={Boolean(params.de || params.ate)}
    />
  );
}

/** Aceita só AAAA-MM-DD. Texto de URL é escrito por desconhecido. */
function lerData(valor?: string): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

/**
 * A carteira que o seletor de imóvel da gaveta oferece.
 *
 * Traz o que ainda pode ser negociado, e não os 964: imóvel vendido ou
 * inativo numa lista de escolha só atrapalha quem procura. Em faixas de
 * mil porque é o teto que o PostgREST aplica sem avisar.
 */
async function carregarCarteira(supabase: ClienteSupabase): Promise<ImovelDaVenda[]> {
  const linhas: ImovelDaVenda[] = [];
  const PAGINA = 1000;

  for (;;) {
    const { data, error } = await supabase
      .from('imoveis')
      .select('id, codigo, titulo, bairro, cidade, valor, valor_locacao, status, publicado')
      .in('status', ['disponivel', 'reservado'])
      .order('codigo', { ascending: true })
      .range(linhas.length, linhas.length + PAGINA - 1);

    if (error) {
      console.error('[financeiro] falha ao carregar a carteira:', error);
      break;
    }

    const faixa = (data ?? []) as unknown as ImovelDaVenda[];
    linhas.push(...faixa);
    if (faixa.length < PAGINA) break;
  }

  return linhas;
}

function lerCompetencia(valor?: string): string {
  if (valor && /^\d{4}-\d{2}$/.test(valor)) return valor;
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function limitesDoMes(competencia: string): { inicio: string; fim: string } {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${competencia}-01`,
    fim: `${competencia}-${String(ultimo).padStart(2, '0')}`,
  };
}

type ClienteSupabase = Awaited<ReturnType<typeof supabaseServidor>>;

/**
 * O resumo vem de uma funcao do banco, e nao de uma soma no JavaScript.
 * Assim o total do painel, o total do relatorio e o total exportado
 * saem sempre do mesmo lugar e nao divergem.
 */
async function carregarResumo(
  supabase: ClienteSupabase,
  inicio: string,
  fim: string,
): Promise<ResumoFinanceiroPeriodo> {
  const vazio: ResumoFinanceiroPeriodo = {
    vgv: 0,
    negocios: 0,
    comissao_bruta: 0,
    comissao_casa: 0,
    comissao_equipe: 0,
    custos: 0,
    margem: 0,
    ticket_medio: 0,
    desconto_medio_pct: 0,
    em_negociacao: 0,
    a_receber: 0,
  };

  const { data, error } = await supabase.rpc('resumo_financeiro', {
    p_inicio: inicio,
    p_fim: fim,
  });

  if (error) {
    console.error('[financeiro] falha no resumo:', error);
    return vazio;
  }

  const linha = Array.isArray(data) ? data[0] : data;
  return { ...vazio, ...(linha ?? {}) };
}

async function carregarVendas(
  supabase: ClienteSupabase,
  status: string | undefined,
  de: string,
  ate: string,
): Promise<VendaDetalhada[]> {
  let consulta = supabase
    .from('vendas')
    .select(
      `*,
       consultor:perfis!vendas_consultor_id_fkey (nome),
       captador:perfis!vendas_captador_id_fkey (nome)`,
    )
    .gte('data_proposta', de)
    .lte('data_proposta', ate)
    .order('data_proposta', { ascending: false })
    .limit(500);

  const permitidos = ['proposta', 'aprovada', 'contrato', 'concluida', 'cancelada'];
  if (status && permitidos.includes(status)) consulta = consulta.eq('status', status);

  const { data, error } = await consulta;

  if (error) {
    console.error('[financeiro] falha ao carregar vendas:', error);
    return [];
  }

  return (data ?? []).map((linha) => {
    const bruto = linha as Record<string, unknown>;
    return {
      ...(bruto as unknown as VendaDetalhada),
      consultor_nome: (bruto.consultor as { nome?: string })?.nome ?? null,
      captador_nome: (bruto.captador as { nome?: string })?.nome ?? null,
    };
  });
}

async function carregarParcelas(supabase: ClienteSupabase): Promise<VendaParcela[]> {
  const { data, error } = await supabase
    .from('venda_parcelas')
    .select('*')
    .order('vencimento');

  if (error) {
    console.error('[financeiro] falha ao carregar parcelas:', error);
    return [];
  }

  return (data ?? []) as VendaParcela[];
}

async function carregarDesempenho(
  supabase: ClienteSupabase,
  inicio: string,
  fim: string,
): Promise<DesempenhoConsultor[]> {
  const { data, error } = await supabase.rpc('desempenho_equipe', {
    p_inicio: inicio,
    p_fim: fim,
  });

  if (error) {
    console.error('[financeiro] falha no desempenho:', error);
    return [];
  }

  return (data ?? []) as DesempenhoConsultor[];
}

async function carregarEquipe(supabase: ClienteSupabase): Promise<Perfil[]> {
  const { data } = await supabase.from('perfis').select('*').eq('ativo', true).order('nome');
  return (data ?? []) as Perfil[];
}
