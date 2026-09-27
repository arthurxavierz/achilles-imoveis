'use server';

import { revalidatePath } from 'next/cache';

import { sugerirParcelas, validarVenda, type Venda } from '@imob/core';

import {
  baixarParcelaDemo,
  excluirParcelaDemo,
  efeitoNoImovelDemo,
  excluirVendaDemo,
  salvarParcelaDemo,
  salvarVendaDemo,
  statusVendaDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

/**
 * Acoes do financeiro.
 *
 * Como na agenda, rodam com a sessao do usuario, entao o RLS da
 * migration 0007 continua sendo a trava real: um consultor so alcanca as
 * proprias vendas, e so enquanto elas nao foram concluidas.
 *
 * Nenhum valor de comissao e enviado ao banco. Os campos comissao_bruta,
 * comissao_casa, comissao_consultor e margem sao colunas geradas: quem
 * calcula e o Postgres. Mandar esses numeros daqui seria abrir espaco
 * para a tela e o banco discordarem.
 */

const DESTINOS_PARCELA = ['casa', 'consultor', 'captador', 'terceiro'] as const;
const STATUS_PARCELA = ['pendente', 'pago', 'cancelado'] as const;

type DestinoParcela = (typeof DESTINOS_PARCELA)[number];
type StatusParcela = (typeof STATUS_PARCELA)[number];

/* Conferem e estreitam o tipo no mesmo passo: o cliente do Supabase nao
   e tipado e aceita qualquer string, mas a base de demonstracao cobra a
   uniao de verdade. */
function ehDestino(v: string): v is DestinoParcela {
  return (DESTINOS_PARCELA as readonly string[]).includes(v);
}

function ehStatusParcela(v: string): v is StatusParcela {
  return (STATUS_PARCELA as readonly string[]).includes(v);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

/** "1.250.000" e "1250000" viram 1250000. Campo com mascara chega assim. */
function numero(dados: FormData, campo: string): number {
  const bruto = texto(dados, campo).replace(/\./g, '').replace(',', '.');
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function salvarVenda(_anterior: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();
  const supabase = await supabaseServidor();

  const id = texto(dados, 'id');
  const status = texto(dados, 'status') || 'proposta';

  const registro = {
    tipo: texto(dados, 'tipo') || 'venda',
    imovel_id: texto(dados, 'imovel_id') || null,
    imovel_titulo: texto(dados, 'imovel_titulo'),
    lead_id: texto(dados, 'lead_id') || null,

    comprador_nome: texto(dados, 'comprador_nome'),
    comprador_telefone: texto(dados, 'comprador_telefone') || null,
    comprador_email: texto(dados, 'comprador_email') || null,
    proprietario_nome: texto(dados, 'proprietario_nome') || null,

    valor_tabela: numero(dados, 'valor_tabela'),
    valor_venda: numero(dados, 'valor_venda'),

    forma_pagamento: texto(dados, 'forma_pagamento') || 'financiado',
    entrada: numero(dados, 'entrada'),
    valor_financiado: numero(dados, 'valor_financiado'),
    banco: texto(dados, 'banco') || null,

    percentual_comissao: numero(dados, 'percentual_comissao') || 6,
    percentual_casa: numero(dados, 'percentual_casa'),
    percentual_captador: numero(dados, 'percentual_captador'),
    custos: numero(dados, 'custos'),

    consultor_id: texto(dados, 'consultor_id') || null,
    captador_id: texto(dados, 'captador_id') || null,

    status,
    data_proposta: texto(dados, 'data_proposta') || new Date().toISOString().slice(0, 10),
    data_assinatura: texto(dados, 'data_assinatura') || null,
    data_conclusao: texto(dados, 'data_conclusao') || null,

    motivo_cancelamento: texto(dados, 'motivo_cancelamento') || null,
    observacoes: texto(dados, 'observacoes') || null,
  };

  const problemas = validarVenda(registro as Partial<Venda>);
  if (problemas.length > 0) return { ok: false, erro: problemas[0] };

  if (modoDemo()) {
    const r = salvarVendaDemo(usuario, { ...registro, id: id || undefined } as Partial<Venda>);
    if (!r.ok) return { ok: false, erro: r.erro };
    revalidatePath('/financeiro');
    revalidatePath('/');
    revalidatePath('/imoveis');
    return {
      ok: true,
      mensagem: id ? 'Negócio atualizado.' : 'Negócio ' + r.codigo + ' registrado.',
    };
  }

  const resposta = id
    ? await supabase.from('vendas').update(registro).eq('id', id).select('*').single()
    : await supabase
        .from('vendas')
        .insert({ ...registro, criado_por: usuario.id })
        .select('*')
        .single();

  if (resposta.error) {
    console.error('[financeiro] falha ao salvar venda:', resposta.error);
    return { ok: false, erro: traduzirErro(resposta.error.message) };
  }

  const venda = resposta.data as Venda;

  await aplicarEfeitoNoImovel(supabase, registro.imovel_id, texto(dados, 'efeito_imovel'), usuario);

  /**
   * Cria as parcelas da comissao no primeiro salvamento, quando ainda
   * nao existe nenhuma. Depois disso o financeiro ajusta a mao, e o
   * sistema nao mexe mais: reescrever parcela que alguem ja conferiu
   * seria pior do que nao sugerir nada.
   */
  if (!id && venda.comissao_bruta > 0) {
    const { count } = await supabase
      .from('venda_parcelas')
      .select('id', { count: 'exact', head: true })
      .eq('venda_id', venda.id);

    if (!count) {
      const parcelas = sugerirParcelas(venda).map((p) => ({
        venda_id: venda.id,
        descricao: p.descricao,
        destino: 'casa' as const,
        valor: p.valor,
        vencimento: p.vencimento,
        status: 'pendente' as const,
      }));

      if (parcelas.length > 0) {
        const { error } = await supabase.from('venda_parcelas').insert(parcelas);
        // Falhar aqui nao invalida a venda, que ja esta gravada.
        if (error) console.error('[financeiro] parcelas sugeridas:', error);
      }
    }
  }

  revalidatePath('/financeiro');
  revalidatePath('/');

  return {
    ok: true,
    mensagem: id
      ? 'Negócio atualizado.'
      : `Negócio ${venda.codigo} registrado.`,
  };
}

export async function mudarStatusVenda(
  id: string,
  status: string,
  motivo?: string,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const permitidos = ['proposta', 'aprovada', 'contrato', 'concluida', 'cancelada'];
  if (!permitidos.includes(status)) return { ok: false, erro: 'Situação inválida.' };

  if (status === 'cancelada' && !motivo?.trim()) {
    return { ok: false, erro: 'Informe o motivo do cancelamento.' };
  }

  if (modoDemo()) {
    const r = statusVendaDemo(usuario, id, status, motivo);
    revalidatePath('/financeiro');
    revalidatePath('/');
    revalidatePath('/imoveis');
    if (!r.ok) return { ok: false, erro: r.erro };
    return {
      ok: true,
      mensagem:
        status === 'concluida'
          ? 'Negócio concluído. O imóvel saiu da vitrine e a comissão foi lançada no caixa.'
          : 'Situação atualizada.',
    };
  }

  const supabase = await supabaseServidor();

  const alteracao: Record<string, unknown> = { status };
  if (status === 'cancelada') alteracao.motivo_cancelamento = motivo?.trim();
  // A data de conclusao e preenchida pelo gatilho do banco quando fica
  // nula, entao nao precisa ser enviada daqui.

  const { error } = await supabase.from('vendas').update(alteracao).eq('id', id);

  if (error) {
    console.error('[financeiro] falha ao mudar status:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/financeiro');
  revalidatePath('/');
  revalidatePath('/imoveis');

  return {
    ok: true,
    mensagem:
      status === 'concluida'
        ? 'Negócio concluído. O imóvel saiu da vitrine e a comissão foi lançada no caixa.'
        : 'Situação atualizada.',
  };
}

/**
 * Cria ou altera uma parcela de comissao.
 *
 * O sistema sugere as parcelas no primeiro salvamento do negocio e
 * depois nao mexe mais, para nao reescrever o que o financeiro ja
 * conferiu. O comentario daquela funcao dizia que "o financeiro ajusta a
 * mao" — so que nao havia como ajustar: a unica acao existente era dar
 * baixa. Comissao renegociada obrigava a apagar o negocio e refazer.
 *
 * Quase tudo e opcional. Descricao, valor e vencimento sao o minimo que
 * torna a linha util para a previsao de caixa; beneficiario e
 * observacao ficam em branco sem problema.
 */
export async function salvarParcela(
  _anterior: EstadoAcao,
  dados: FormData,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const id = texto(dados, 'id');
  const vendaId = texto(dados, 'venda_id');
  const descricao = texto(dados, 'descricao');
  const valor = numero(dados, 'valor');
  const vencimento = texto(dados, 'vencimento');
  const destino = texto(dados, 'destino') || 'casa';
  const status = texto(dados, 'status') || 'pendente';

  if (!id && !vendaId) return { ok: false, erro: 'Escolha o negócio da parcela.' };
  if (!descricao) return { ok: false, erro: 'Descreva a parcela.' };
  if (valor <= 0) return { ok: false, erro: 'Informe o valor da parcela.' };
  if (!vencimento) return { ok: false, erro: 'Informe o vencimento.' };

  if (!ehDestino(destino)) return { ok: false, erro: 'Destino inválido.' };
  if (!ehStatusParcela(status)) return { ok: false, erro: 'Situação inválida.' };

  // O banco recusa parcela paga sem data, e com razao: e o que separa
  // "o cliente disse que pagou" de "entrou na conta".
  const pagoEm = status === 'pago' ? texto(dados, 'pago_em') || hojeISO() : null;

  const registro = {
    descricao,
    valor,
    vencimento,
    destino,
    status,
    pago_em: pagoEm,
    beneficiario_id: texto(dados, 'beneficiario_id') || null,
    observacoes: texto(dados, 'observacoes') || null,
  };

  if (modoDemo()) {
    const r = salvarParcelaDemo(usuario, { ...registro, id: id || undefined, venda_id: vendaId });
    revalidatePath('/financeiro');
    return r.ok
      ? { ok: true, mensagem: id ? 'Parcela atualizada.' : 'Parcela criada.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = id
    ? await supabase.from('venda_parcelas').update(registro).eq('id', id)
    : await supabase.from('venda_parcelas').insert({ ...registro, venda_id: vendaId });

  if (error) {
    console.error('[financeiro] falha ao salvar parcela:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/financeiro');
  revalidatePath('/');
  return { ok: true, mensagem: id ? 'Parcela atualizada.' : 'Parcela criada.' };
}

/**
 * Apaga uma parcela.
 *
 * So a gestao. Parcela e previsao de caixa e base de comissao de alguem:
 * apagar por engano tira dinheiro do relatorio de uma pessoa sem deixar
 * rastro. Para tirar da previsao sem perder o registro existe o caminho
 * normal, que e marcar como cancelada.
 */
export async function excluirParcela(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, erro: 'Apenas a gestão exclui uma parcela.' };
  }

  if (modoDemo()) {
    const r = excluirParcelaDemo(usuario, id);
    revalidatePath('/financeiro');
    return r.ok ? { ok: true, mensagem: 'Parcela excluída.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();
  const { error } = await supabase.from('venda_parcelas').delete().eq('id', id);

  if (error) {
    console.error('[financeiro] falha ao excluir parcela:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/financeiro');
  revalidatePath('/');
  return { ok: true, mensagem: 'Parcela excluída.' };
}

/** Baixa de parcela: o dinheiro entrou de fato. */
export async function baixarParcela(id: string, pago: boolean): Promise<EstadoAcao> {
  await exigirUsuario();

  if (modoDemo()) {
    const r = baixarParcelaDemo(id, pago);
    revalidatePath('/financeiro');
    return r.ok
      ? { ok: true, mensagem: pago ? 'Parcela baixada.' : 'Baixa desfeita.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase
    .from('venda_parcelas')
    .update(
      pago
        ? { status: 'pago', pago_em: new Date().toISOString().slice(0, 10) }
        : { status: 'pendente', pago_em: null },
    )
    .eq('id', id);

  if (error) {
    console.error('[financeiro] falha na baixa:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/financeiro');
  return { ok: true, mensagem: pago ? 'Parcela baixada.' : 'Baixa desfeita.' };
}

/**
 * Apaga o negócio em definitivo.
 *
 * Só a gestão, mesma régua da exclusão de imóvel. E o imóvel ligado a
 * ele não vai junto: quem apaga um lançamento errado do financeiro não
 * está dizendo que o imóvel deixou de existir.
 */
export async function excluirVenda(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, erro: 'Apenas a gestão exclui um negócio em definitivo.' };
  }

  if (modoDemo()) {
    const r = excluirVendaDemo(usuario, id);
    revalidatePath('/financeiro');
    revalidatePath('/');
    return r.ok ? { ok: true, mensagem: 'Negócio excluído.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('vendas').delete().eq('id', id);

  if (error) {
    console.error('[financeiro] falha ao excluir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/financeiro');
  return { ok: true, mensagem: 'Negócio excluído.' };
}

/**
 * O que a operação faz com o imóvel ligado a ela.
 *
 * Nem toda linha do financeiro significa a mesma coisa para a carteira.
 * Registrar uma proposta não deveria mexer no anúncio; um negócio
 * fechado por fora às vezes só precisa que aquele imóvel suma da lista.
 * Por isso a escolha é de quem registra, e não uma regra fixa.
 *
 * Isto convive com o gatilho ao_concluir_venda do banco, que marca o
 * imóvel como vendido e tira do ar quando o negócio passa a concluído.
 * São camadas diferentes: o gatilho garante a coerência do fecho, esta
 * função atende o que a pessoa pediu no momento do registro. "Manter"
 * não desfaz o gatilho, e a tela avisa isso.
 */
async function aplicarEfeitoNoImovel(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>,
  imovelId: string | null,
  efeito: string,
  usuario: { papel: string },
): Promise<void> {
  if (!imovelId) return;
  if (efeito !== 'tirar_do_ar' && efeito !== 'excluir') return;

  if (modoDemo()) {
    efeitoNoImovelDemo(imovelId, efeito);
    revalidatePath('/imoveis');
    return;
  }

  if (efeito === 'tirar_do_ar') {
    const { error } = await supabase
      .from('imoveis')
      .update({ publicado: false, destaque: false })
      .eq('id', imovelId);

    if (error) console.error('[financeiro] falha ao tirar o imóvel do ar:', error);
    revalidatePath('/imoveis');
    return;
  }

  // Excluir carteira é decisão de gestão, mesma régua da tela de
  // imóveis. Um consultor que forçasse o campo no formulário apagaria
  // um registro que ele nem pode editar.
  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    console.warn('[financeiro] exclusão de imóvel pedida por quem não é gestão. Ignorada.');
    return;
  }

  const { error } = await supabase.from('imoveis').delete().eq('id', imovelId);

  if (error) console.error('[financeiro] falha ao excluir o imóvel:', error);
  revalidatePath('/imoveis');
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('row-level security') || mensagem.includes('violates row-level')) {
    return 'Você não tem permissão para alterar este negócio. Negócio concluído só é alterado pela gestão.';
  }
  if (mensagem.includes('venda_divisao_coerente')) {
    return 'A soma da parte da casa com a do captador não pode passar de 100%.';
  }
  if (mensagem.includes('venda_cancelamento_justificado')) {
    return 'Informe o motivo do cancelamento.';
  }
  return 'Não foi possível salvar agora. Tente novamente.';
}
