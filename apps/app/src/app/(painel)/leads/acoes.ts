'use server';

import { revalidatePath } from 'next/cache';

import { calcularScore, temperaturaPorScore } from '@imob/core';

import {
  arquivarLeadDemo,
  assumirLeadDemo,
  excluirInteracaoDemo,
  excluirLeadDemo,
  moverLeadDemo,
  registrarInteracaoDemo,
  salvarLeadDemo,
  transferirLeadDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

const ETAPAS = ['novo', 'contato', 'visita', 'proposta', 'fechado', 'perdido'];

const TIPOS_INTERACAO = ['nota', 'ligacao', 'whatsapp', 'email', 'visita', 'proposta'];

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

function atualizar() {
  revalidatePath('/leads');
  revalidatePath('/');
  revalidatePath('/indicadores');
}

/** Mover o cartao no funil. E a acao mais usada do sistema. */
export async function moverLead(id: string, etapa: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (!ETAPAS.includes(etapa)) return { ok: false, erro: 'Etapa inválida.' };

  if (modoDemo()) {
    const r = moverLeadDemo(id, etapa);
    if (r.ok) {
      registrarInteracaoDemo(usuario, id, 'sistema', `Movido para a etapa "${etapa}".`);
    }
    atualizar();
    return r.ok ? { ok: true } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('leads').update({ etapa }).eq('id', id);

  if (error) {
    console.error('[leads] falha ao mover:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  // Registra no historico. Sem isso ninguem sabe quem moveu o que, e o
  // funil vira um quadro sem memoria.
  await supabase.from('lead_interacoes').insert({
    lead_id: id,
    tipo: 'sistema',
    conteudo: `Movido para a etapa "${etapa}".`,
    autor_id: usuario.id,
    autor_nome: usuario.nome,
  });

  atualizar();
  return { ok: true };
}

/** Assumir um lead que ainda nao tem dono. */
export async function assumirLead(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (modoDemo()) {
    const r = assumirLeadDemo(usuario, id);
    if (r.ok) {
      registrarInteracaoDemo(usuario, id, 'sistema', `${usuario.nome} assumiu o atendimento.`);
    }
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Lead atribuído a você.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase
    .from('leads')
    .update({ corretor_id: usuario.id })
    .eq('id', id)
    // Só assume o que está sem dono: evita duas pessoas disputarem o
    // mesmo lead e a última sobrescrever a primeira.
    .is('corretor_id', null);

  if (error) {
    console.error('[leads] falha ao assumir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  await supabase.from('lead_interacoes').insert({
    lead_id: id,
    tipo: 'sistema',
    conteudo: `${usuario.nome} assumiu o atendimento.`,
    autor_id: usuario.id,
    autor_nome: usuario.nome,
  });

  atualizar();
  return { ok: true, mensagem: 'Lead atribuído a você.' };
}

/**
 * Passar o atendimento para outra pessoa.
 *
 * Fica gravado na linha do tempo de propósito. Transferência de carteira
 * e a origem de metade das discussoes sobre comissao numa imobiliaria, e
 * o registro de quem passou para quem, e quando, encerra o assunto.
 */
export async function transferirLead(id: string, destinoId: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const destino = destinoId || null;

  if (modoDemo()) {
    const r = transferirLeadDemo(usuario, id, destino);
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Atendimento transferido.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const [{ data: antes }, { data: pessoa }] = await Promise.all([
    supabase.from('leads').select('corretor_id').eq('id', id).maybeSingle(),
    destino
      ? supabase.from('perfis').select('nome, ativo').eq('id', destino).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (destino && (!pessoa || pessoa.ativo === false)) {
    return { ok: false, erro: 'Quem recebe o atendimento precisa estar ativo na equipe.' };
  }

  const { error } = await supabase.from('leads').update({ corretor_id: destino }).eq('id', id);

  if (error) {
    console.error('[leads] falha ao transferir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  let nomeAnterior = 'ninguém';
  if (antes?.corretor_id) {
    const { data } = await supabase
      .from('perfis')
      .select('nome')
      .eq('id', antes.corretor_id)
      .maybeSingle();
    nomeAnterior = data?.nome ?? 'ninguém';
  }

  await supabase.from('lead_interacoes').insert({
    lead_id: id,
    tipo: 'sistema',
    conteudo: `Atendimento transferido de ${nomeAnterior} para ${pessoa?.nome ?? 'ninguém'}.`,
    autor_id: usuario.id,
    autor_nome: usuario.nome,
  });

  atualizar();
  return { ok: true, mensagem: 'Atendimento transferido.' };
}

/**
 * Arquivar tira o lead do funil sem apagar nada.
 *
 * E o caminho normal para quem nao vai fechar: o historico continua
 * disponivel para o relatorio de motivos de perda, que e o unico jeito
 * de descobrir se a operacao perde por preco, por credito ou por demora
 * no atendimento.
 */
export async function arquivarLead(id: string, motivo: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const escolhido = motivo.trim() || 'Outro motivo';
  if (escolhido.length > 200) return { ok: false, erro: 'Motivo longo demais.' };

  if (modoDemo()) {
    const r = arquivarLeadDemo(usuario, id, escolhido);
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Atendimento arquivado.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase
    .from('leads')
    .update({ arquivado: true, etapa: 'perdido', motivo_perda: escolhido })
    .eq('id', id);

  if (error) {
    console.error('[leads] falha ao arquivar:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  await supabase.from('lead_interacoes').insert({
    lead_id: id,
    tipo: 'sistema',
    conteudo: `Atendimento arquivado. Motivo: ${escolhido}.`,
    autor_id: usuario.id,
    autor_nome: usuario.nome,
  });

  atualizar();
  return { ok: true, mensagem: 'Atendimento arquivado.' };
}

/** Devolve um lead arquivado ao funil. */
export async function reabrirLead(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (modoDemo()) {
    const r = salvarLeadDemo(usuario, {
      id,
      arquivado: false,
      etapa: 'contato',
      motivo_perda: null,
    } as never);
    if (r.ok) registrarInteracaoDemo(usuario, id, 'sistema', 'Atendimento reaberto.');
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Atendimento reaberto.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase
    .from('leads')
    .update({ arquivado: false, etapa: 'contato', motivo_perda: null })
    .eq('id', id);

  if (error) {
    console.error('[leads] falha ao reabrir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  await supabase.from('lead_interacoes').insert({
    lead_id: id,
    tipo: 'sistema',
    conteudo: 'Atendimento reaberto.',
    autor_id: usuario.id,
    autor_nome: usuario.nome,
  });

  atualizar();
  return { ok: true, mensagem: 'Atendimento reaberto.' };
}

/**
 * Exclusao definitiva, so para a gestao.
 *
 * Existe por causa da LGPD: quando o titular pede a remocao dos dados,
 * arquivar nao basta. O historico de interacoes vai junto, e o negocio
 * eventualmente ligado ao lead perde o vinculo mas continua na
 * contabilidade.
 */
export async function excluirLead(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, erro: 'Apenas a gestão exclui um lead em definitivo.' };
  }

  if (modoDemo()) {
    const r = excluirLeadDemo(usuario, id);
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Lead excluído.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('leads').delete().eq('id', id);

  if (error) {
    console.error('[leads] falha ao excluir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizar();
  return { ok: true, mensagem: 'Lead excluído.' };
}

export async function registrarInteracao(
  _anterior: EstadoAcao,
  dados: FormData,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const leadId = texto(dados, 'lead_id');
  const conteudo = texto(dados, 'conteudo');
  const tipo = texto(dados, 'tipo') || 'nota';

  if (!leadId || conteudo.length < 2) {
    return { ok: false, erro: 'Escreva o que aconteceu no atendimento.' };
  }
  if (!TIPOS_INTERACAO.includes(tipo)) {
    return { ok: false, erro: 'Tipo de registro inválido.' };
  }

  if (modoDemo()) {
    const r = registrarInteracaoDemo(usuario, leadId, tipo, conteudo.slice(0, 2000));
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Anotação registrada.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('lead_interacoes').insert({
    lead_id: leadId,
    tipo,
    conteudo: conteudo.slice(0, 2000),
    autor_id: usuario.id,
    autor_nome: usuario.nome,
  });

  if (error) {
    console.error('[leads] falha na interação:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizar();
  return { ok: true, mensagem: 'Anotação registrada.' };
}

export async function excluirInteracao(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (modoDemo()) {
    const r = excluirInteracaoDemo(usuario, id);
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Anotação removida.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('lead_interacoes').delete().eq('id', id);

  if (error) {
    console.error('[leads] falha ao excluir interação:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizar();
  return { ok: true, mensagem: 'Anotação removida.' };
}

export async function salvarLead(_anterior: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const id = texto(dados, 'id');
  const nome = texto(dados, 'nome');
  const telefone = texto(dados, 'telefone').replace(/\D/g, '');

  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do cliente.' };
  if (!telefone && !texto(dados, 'email')) {
    return { ok: false, erro: 'Informe ao menos um telefone ou um e-mail de contato.' };
  }

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
  const responsavel = texto(dados, 'corretor_id');

  const registro = {
    nome: nome.slice(0, 120),
    telefone: telefone || null,
    email: texto(dados, 'email').toLowerCase() || null,
    mensagem: texto(dados, 'mensagem') || null,
    origem: texto(dados, 'origem') || 'manual',
    etapa: texto(dados, 'etapa') || 'novo',
    imovel_titulo: texto(dados, 'imovel_titulo') || null,
    valor: Number(texto(dados, 'valor').replace(/\D/g, '')) || 0,
    // Corretor so cadastra em nome proprio. Gestao escolhe, inclusive
    // deixar sem dono para alguem assumir na fila.
    corretor_id: gestor ? responsavel || null : usuario.id,
    proximo_contato: texto(dados, 'proximo_contato') || null,
  };

  const score = calcularScore({ ...registro, criado_em: new Date().toISOString() });
  const completo = { ...registro, score, temperatura: temperaturaPorScore(score) };

  if (modoDemo()) {
    const r = salvarLeadDemo(usuario, { ...completo, id: id || undefined } as never);
    atualizar();
    return r.ok
      ? { ok: true, mensagem: id ? 'Lead atualizado.' : 'Lead cadastrado.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const resposta = id
    ? await supabase.from('leads').update(completo).eq('id', id)
    : await supabase.from('leads').insert({ ...completo, consentimento_lgpd: true });

  if (resposta.error) {
    console.error('[leads] falha ao salvar:', resposta.error);
    return { ok: false, erro: traduzirErro(resposta.error.message) };
  }

  atualizar();
  return { ok: true, mensagem: id ? 'Lead atualizado.' : 'Lead cadastrado.' };
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('row-level security')) {
    return 'Você não tem permissão sobre este lead. Ele pertence a outro consultor.';
  }
  if (mensagem.includes('leads_origem_check')) {
    return 'Origem inválida para este lead.';
  }
  return 'Não foi possível salvar agora. Tente novamente.';
}
