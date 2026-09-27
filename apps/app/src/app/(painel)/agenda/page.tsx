import type { Metadata } from 'next';

import type { CompromissoDetalhado, Perfil } from '@imob/core';

import { Agenda } from '@/componentes/agenda/Agenda';
import { compromissosDemo } from '@/lib/dados-demo';
import { equipeDemo, modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export const metadata: Metadata = { title: 'Agenda' };

/** A agenda muda o tempo todo. Nada de cache entre requisicoes. */
export const dynamic = 'force-dynamic';

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; responsavel?: string; visao?: string }>;
}) {
  const params = await searchParams;
  const usuario = await exigirUsuario();
  const supabase = await supabaseServidor();

  const referencia = lerMes(params.mes);

  /**
   * Busca uma janela maior que o mes exibido: a grade do calendario
   * mostra os dias vizinhos que completam a primeira e a ultima semana,
   * e sem essa folga eles apareceriam sempre vazios.
   */
  const inicio = new Date(referencia.ano, referencia.mes - 1, 1);
  inicio.setDate(inicio.getDate() - 7);
  const fim = new Date(referencia.ano, referencia.mes, 0);
  fim.setDate(fim.getDate() + 8);

  const [compromissos, equipe] = modoDemo()
    ? [compromissosDemo(inicio, fim), equipeDemo()]
    : await Promise.all([carregarCompromissos(supabase, inicio, fim), carregarEquipe(supabase)]);

  return (
    <Agenda
      usuario={usuario}
      equipe={equipe}
      compromissos={compromissos}
      ano={referencia.ano}
      mes={referencia.mes}
      responsavelFiltro={params.responsavel ?? ''}
      visaoInicial={params.visao ?? 'mes'}
    />
  );
}

function lerMes(valor?: string): { ano: number; mes: number } {
  const agora = new Date();

  if (valor && /^\d{4}-\d{2}$/.test(valor)) {
    const [ano, mes] = valor.split('-').map(Number);
    if (ano >= 2020 && ano <= 2100 && mes >= 1 && mes <= 12) return { ano, mes };
  }

  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

type ClienteSupabase = Awaited<ReturnType<typeof supabaseServidor>>;

async function carregarCompromissos(
  supabase: ClienteSupabase,
  inicio: Date,
  fim: Date,
): Promise<CompromissoDetalhado[]> {
  /**
   * Uma consulta so, com os nomes vindo junto pelos relacionamentos.
   * Buscar compromissos e depois o nome de cada responsavel seria o
   * problema N+1 classico: trinta compromissos virariam trinta e uma
   * idas ao banco.
   */
  const { data, error } = await supabase
    .from('compromissos')
    .select(
      `*,
       responsavel:perfis!compromissos_responsavel_id_fkey (nome),
       autor:perfis!compromissos_criado_por_fkey (nome),
       imovel:imoveis (titulo),
       lead:leads (nome)`,
    )
    .gte('inicio', inicio.toISOString())
    .lte('inicio', fim.toISOString())
    .order('inicio');

  if (error) {
    console.error('[agenda] falha ao carregar:', error);
    return [];
  }

  return (data ?? []).map((linha) => {
    const bruto = linha as Record<string, unknown>;
    return {
      ...(bruto as unknown as CompromissoDetalhado),
      responsavel_nome: (bruto.responsavel as { nome?: string })?.nome ?? 'Sem responsável',
      criado_por_nome: (bruto.autor as { nome?: string })?.nome ?? null,
      imovel_titulo: (bruto.imovel as { titulo?: string })?.titulo ?? null,
      lead_nome: (bruto.lead as { nome?: string })?.nome ?? null,
    };
  });
}

async function carregarEquipe(supabase: ClienteSupabase): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) {
    console.error('[agenda] falha ao carregar equipe:', error);
    return [];
  }

  return (data ?? []) as Perfil[];
}
