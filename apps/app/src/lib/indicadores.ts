import type { BaseIndicadores, Compromisso, Imovel, ImovelResumo, Interacao, Lead, Perfil, Venda } from '@imob/core';
import { periodoDoMes, periodoRecente, type Periodo } from '@imob/core';

import { baseIndicadoresDemo } from './dados-demo';
import { modoDemo } from './demonstracao';
import { supabaseServidor } from './supabase-servidor';
import { lerTudo } from './consultas';

/**
 * Carrega tudo que os indicadores precisam.
 *
 * Os numeros sao calculados em memoria, pelo pacote core, e nao por uma
 * consulta agregada por indicador. A escolha e deliberada: sao seis
 * recortes diferentes sobre os mesmos registros, e fazer seis consultas
 * agregadas obrigaria a repetir em SQL uma regra que ja existe em
 * TypeScript, com o risco classico de as duas discordarem no dia em que
 * alguem mudar so uma delas.
 *
 * O limite de linhas existe porque uma imobiliaria deste porte cabe
 * folgada nele. Quando nao couber, a conta muda para agregacao no banco,
 * e o lugar de trocar sera este arquivo, sem tocar nas telas.
 */
export async function carregarBaseIndicadores(): Promise<BaseIndicadores> {
  if (modoDemo()) return baseIndicadoresDemo();

  const supabase = await supabaseServidor();

  /**
   * Da carteira, so as colunas que as contas usam.
   *
   * Aqui havia um select('*') de ate 2000 imoveis. Com 964 na base sao
   * 2,2 MB buscados para somar bairro, tipo, situacao e data de
   * cadastro: descricao, observacao interna e o tsvector de busca
   * viajavam inteiros sem ninguem ler.
   */
  const COLUNAS_IMOVEL =
    'id, bairro, cidade, tipo, status, publicado, corretor_id, valor, criado_em, atualizado_em, ' +
    'titulo, codigo, finalidade, condominio_nome, matricula, valor_locacao, area_util, quartos, ' +
    'vagas, destaque, proprietario_id';

  const [perfis, imoveis, leads, interacoes, compromissos, vendas] = await Promise.all([
    supabase.from('perfis').select('*').order('nome'),
    lerTudo<ImovelResumo>((de, ate) =>
      supabase.from('imoveis').select(COLUNAS_IMOVEL).range(de, ate),
    ),
    lerTudo<Lead>((de, ate) =>
      supabase.from('leads').select('*').order('criado_em', { ascending: false }).range(de, ate),
    ),
    lerTudo<Interacao>((de, ate) =>
      supabase
        .from('lead_interacoes')
        .select('*')
        .order('criado_em', { ascending: false })
        .range(de, ate),
    ),
    lerTudo<Compromisso>((de, ate) =>
      supabase
        .from('compromissos')
        .select('*')
        .order('inicio', { ascending: false })
        .range(de, ate),
    ),
    lerTudo<Venda>((de, ate) =>
      supabase
        .from('vendas')
        .select('*')
        .order('data_proposta', { ascending: false })
        .range(de, ate),
    ),
  ]);

  // Só perfis ainda devolve o par data/error: o resto passa por lerTudo,
  // que registra a própria falha e entrega o que conseguiu ler.
  if (perfis.error) console.error('[indicadores] falha ao carregar perfis:', perfis.error);

  return {
    perfis: (perfis.data ?? []) as Perfil[],
    imoveis,
    leads,
    interacoes,
    compromissos,
    vendas,
  };
}

export interface OpcaoPeriodo {
  chave: string;
  rotulo: string;
  descricao: string;
}

export const PERIODOS: OpcaoPeriodo[] = [
  { chave: 'mes', rotulo: 'Este mês', descricao: 'Do dia 1 até hoje' },
  { chave: 'anterior', rotulo: 'Mês passado', descricao: 'Mês fechado' },
  { chave: 'trimestre', rotulo: '90 dias', descricao: 'Últimos noventa dias' },
  { chave: 'ano', rotulo: 'Ano', descricao: 'De janeiro até hoje' },
];

/** Converte a escolha da URL em um intervalo de datas. */
export function resolverPeriodo(chave: string | undefined): { periodo: Periodo; rotulo: string } {
  const agora = new Date();
  const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  if (chave === 'anterior') {
    const anterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const chaveAnterior = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    return { periodo: periodoDoMes(chaveAnterior), rotulo: 'Mês passado' };
  }

  if (chave === 'trimestre') {
    return { periodo: periodoRecente(90), rotulo: 'Últimos 90 dias' };
  }

  if (chave === 'ano') {
    const fim = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(
      agora.getDate(),
    ).padStart(2, '0')}`;
    return {
      periodo: { inicio: `${agora.getFullYear()}-01-01`, fim },
      rotulo: `Ano de ${agora.getFullYear()}`,
    };
  }

  return { periodo: periodoDoMes(competencia), rotulo: 'Este mês' };
}
