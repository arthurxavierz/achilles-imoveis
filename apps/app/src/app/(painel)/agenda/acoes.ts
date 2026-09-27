'use server';

import { revalidatePath } from 'next/cache';

import { montarInstante } from '@imob/core';

import {
  excluirCompromissoDemo,
  salvarCompromissoDemo,
  statusCompromissoDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

/**
 * Acoes da agenda.
 *
 * Rodam no servidor, com a sessao do usuario. Duas consequencias que
 * importam:
 *
 * 1. O RLS da migration 0006 continua valendo. Se um corretor tentar
 *    alterar o compromisso de outro, o banco recusa, mesmo que alguem
 *    burle a interface e chame esta funcao direto.
 *
 * 2. Nada de chave de servico aqui. Estas funcoes tem exatamente o
 *    mesmo poder que a pessoa logada tem, nem mais.
 */

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

export async function salvarCompromisso(
  _anterior: EstadoAcao,
  dados: FormData,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const supabase = await supabaseServidor();

  const id = texto(dados, 'id');
  const titulo = texto(dados, 'titulo');
  const data = texto(dados, 'data');
  const horaInicio = texto(dados, 'hora_inicio');
  const horaFim = texto(dados, 'hora_fim');
  const diaInteiro = dados.get('dia_inteiro') === 'on';

  if (titulo.length < 2) return { ok: false, erro: 'Dê um título ao compromisso.' };
  if (!data) return { ok: false, erro: 'Escolha a data.' };
  if (!diaInteiro && (!horaInicio || !horaFim)) {
    return { ok: false, erro: 'Informe o horário de início e de término.' };
  }

  // Dia inteiro ocupa das 8h as 18h: o expediente comercial. Guardar
  // 00:00 as 23:59 encheria a grade do dia e escondia o resto.
  const inicio = montarInstante(data, diaInteiro ? '08:00' : horaInicio);
  const fim = montarInstante(data, diaInteiro ? '18:00' : horaFim);

  if (new Date(fim) < new Date(inicio)) {
    return { ok: false, erro: 'O término não pode ser antes do início.' };
  }

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  // Corretor sempre marca para si, independentemente do que o formulario
  // enviar. A trava real esta no RLS; esta linha evita a ida ao banco.
  const responsavelId = gestor ? texto(dados, 'responsavel_id') || usuario.id : usuario.id;

  const registro = {
    titulo,
    observacao: texto(dados, 'observacao') || null,
    tipo: texto(dados, 'tipo') || 'visita',
    inicio,
    fim,
    dia_inteiro: diaInteiro,
    local: texto(dados, 'local') || null,
    responsavel_id: responsavelId,
    imovel_id: texto(dados, 'imovel_id') || null,
    lead_id: texto(dados, 'lead_id') || null,
    status: texto(dados, 'status') || 'agendado',
    // Somente a gestao trava um compromisso na agenda de alguem.
    travado: gestor ? dados.get('travado') === 'on' : false,
    lembrete_minutos: Number(texto(dados, 'lembrete_minutos') || 60),
  };

  if (modoDemo()) {
    const r = salvarCompromissoDemo(usuario, {
      ...registro,
      id: id || undefined,
    } as Parameters<typeof salvarCompromissoDemo>[1]);
    if (!r.ok) return { ok: false, erro: r.erro };
    revalidatePath('/agenda');
    revalidatePath('/');
    return { ok: true, mensagem: id ? 'Compromisso atualizado.' : 'Compromisso marcado na agenda.' };
  }

  const resposta = id
    ? await supabase.from('compromissos').update(registro).eq('id', id)
    : await supabase.from('compromissos').insert({ ...registro, criado_por: usuario.id });

  if (resposta.error) {
    console.error('[agenda] falha ao salvar:', resposta.error);
    return { ok: false, erro: traduzirErro(resposta.error.message) };
  }

  revalidatePath('/agenda');
  revalidatePath('/');

  return {
    ok: true,
    mensagem: id ? 'Compromisso atualizado.' : 'Compromisso marcado na agenda.',
  };
}

export async function excluirCompromisso(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (modoDemo()) {
    const r = excluirCompromissoDemo(usuario, id);
    revalidatePath('/agenda');
    revalidatePath('/');
    return r.ok ? { ok: true, mensagem: 'Compromisso excluído.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('compromissos').delete().eq('id', id);

  if (error) {
    console.error('[agenda] falha ao excluir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/agenda');
  revalidatePath('/');
  return { ok: true, mensagem: 'Compromisso excluído.' };
}

/** Marcar como concluído ou confirmado sem abrir o formulário inteiro. */
export async function mudarStatusCompromisso(id: string, status: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const permitidos = ['agendado', 'confirmado', 'concluido', 'cancelado', 'remarcado'];
  if (!permitidos.includes(status)) return { ok: false, erro: 'Situação inválida.' };

  if (modoDemo()) {
    const r = statusCompromissoDemo(usuario, id, status);
    revalidatePath('/agenda');
    revalidatePath('/');
    return r.ok ? { ok: true } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('compromissos').update({ status }).eq('id', id);

  if (error) {
    console.error('[agenda] falha ao mudar status:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/agenda');
  revalidatePath('/');
  return { ok: true };
}

/**
 * O Postgres devolve mensagem em ingles, com nome de constraint. Isso
 * nao pode chegar cru na tela de um corretor.
 */
function traduzirErro(mensagem: string): string {
  if (mensagem.includes('row-level security') || mensagem.includes('violates row-level')) {
    return 'Você não tem permissão para alterar este compromisso. Fale com a administração.';
  }
  if (mensagem.includes('compromisso_intervalo_valido')) {
    return 'O término não pode ser antes do início.';
  }
  if (mensagem.includes('compromisso_duracao_sensata')) {
    return 'Um compromisso não pode durar mais de 30 dias.';
  }
  return 'Não foi possível salvar agora. Tente novamente.';
}
