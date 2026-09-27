import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { podeVerEquipe, type Perfil } from '@imob/core';

import { Equipe, type Carteira } from '@/componentes/equipe/Equipe';
import { carteiraDemo, equipeCompletaDemo } from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export const metadata: Metadata = { title: 'Equipe' };
export const dynamic = 'force-dynamic';

export default async function PaginaEquipe() {
  const usuario = await exigirUsuario();

  if (!podeVerEquipe(usuario)) redirect('/?erro=sem-permissao');

  if (modoDemo()) {
    const equipe = equipeCompletaDemo();
    const carteiras: Record<string, Carteira> = {};
    for (const p of equipe) carteiras[p.id] = carteiraDemo(p.id);

    return <Equipe usuario={usuario} equipe={equipe} carteiras={carteiras} />;
  }

  const supabase = await supabaseServidor();

  const { data, error } = await supabase.from('perfis').select('*').order('nome');
  if (error) console.error('[equipe] falha ao carregar:', error);

  const equipe = (data ?? []) as Perfil[];

  /**
   * Quatro consultas para a equipe inteira, e nao uma por pessoa.
   *
   * Aqui havia uma chamada de carteira_da_pessoa por integrante. A conta
   * fechava quando a equipe tinha cinco: hoje sao trinta e seis, e
   * medindo contra o banco real as trinta e seis chamadas em paralelo
   * custam 820ms so para preencher tres numeros por linha. Pior, o custo
   * cresce junto com a equipe, que e o contrario do que se espera de uma
   * tela de gestao.
   *
   * Agora cada tabela e lida uma vez, so na coluna de quem responde por
   * ela, e a contagem acontece em memoria. O numero de consultas para de
   * depender do tamanho da equipe.
   *
   * A conta espelha a funcao carteira_da_pessoa do banco, inclusive nos
   * filtros de arquivado e de situacao. Se a regra mudar la, precisa
   * mudar aqui: e o preco de trazer a agregacao para a aplicacao, e fica
   * anotado de proposito.
   */
  const [porLead, porImovel, porVenda] = await Promise.all([
    contarPorPessoa(supabase, 'leads', 'corretor_id', 'arquivado=eq.false'),
    contarPorPessoa(supabase, 'imoveis', 'corretor_id'),
    contarPorPessoa(supabase, 'vendas', 'consultor_id', 'nao-concluida-nem-cancelada'),
  ]);

  const carteiras: Record<string, Carteira> = {};

  for (const pessoa of equipe) {
    carteiras[pessoa.id] = {
      leads: porLead.get(pessoa.id) ?? 0,
      imoveis: porImovel.get(pessoa.id) ?? 0,
      negocios: porVenda.get(pessoa.id) ?? 0,
    };
  }

  return <Equipe usuario={usuario} equipe={equipe} carteiras={carteiras} />;
}

/**
 * Conta quantas linhas de uma tabela pertencem a cada pessoa.
 *
 * Le uma coluna so, em faixas de mil. A paginacao nao e zelo excessivo:
 * o PostgREST corta toda resposta em mil linhas sem avisar, e contagem
 * truncada nao aparece como erro na tela. Aparece como um numero menor
 * que a verdade, que e o defeito que ninguem percebe ate decidir algo
 * errado com ele.
 */
async function contarPorPessoa(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>,
  tabela: 'leads' | 'imoveis' | 'vendas',
  coluna: string,
  filtro?: string,
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const PAGINA = 1000;

  for (let de = 0; ; de += PAGINA) {
    let consulta = supabase
      .from(tabela)
      .select(coluna)
      .range(de, de + PAGINA - 1);

    if (filtro === 'arquivado=eq.false') consulta = consulta.eq('arquivado', false);
    if (filtro === 'nao-concluida-nem-cancelada') {
      consulta = consulta.not('status', 'in', '(concluida,cancelada)');
    }

    const { data, error } = await consulta;

    if (error) {
      console.error(`[equipe] falha ao contar ${tabela}:`, error);
      break;
    }

    const linhas = (data ?? []) as unknown as Record<string, unknown>[];

    for (const linha of linhas) {
      const dono = linha[coluna];
      if (typeof dono === 'string') mapa.set(dono, (mapa.get(dono) ?? 0) + 1);
    }

    if (linhas.length < PAGINA) break;
  }

  return mapa;
}
