'use server';

import { revalidatePath } from 'next/cache';

import {
  excluirProprietarioDemo,
  salvarProprietarioDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

function atualizar() {
  revalidatePath('/proprietarios');
  revalidatePath('/imoveis');
}

/**
 * Cadastra ou edita um proprietário.
 *
 * A exigência de telefone **ou** e-mail, e não dos dois, vem do que
 * acontece na captação de verdade: metade dos proprietários de imóvel
 * de alto padrão não passa e-mail, e uma parte dos que são pessoa
 * jurídica só dá o e-mail do comercial. Exigir os dois faria a equipe
 * inventar um dos campos, e campo inventado é pior que campo vazio —
 * ele parece um contato válido até alguém tentar usar.
 */
export async function salvarProprietario(
  _anterior: EstadoAcao,
  dados: FormData,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const id = texto(dados, 'id');
  const nome = texto(dados, 'nome');
  const telefone = texto(dados, 'telefone').replace(/\D/g, '');
  const email = texto(dados, 'email').toLowerCase();

  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do proprietário.' };
  if (!telefone && !email) {
    return { ok: false, erro: 'Informe ao menos um telefone ou um e-mail de contato.' };
  }

  const registro = {
    nome: nome.slice(0, 140),
    // O documento fica como veio digitado, com pontuação e tudo. Não
    // há validação de dígito aqui de propósito: proprietário
    // estrangeiro e espólio aparecem com documento fora do padrão de
    // CPF e CNPJ, e recusar o cadastro por isso travaria a captação.
    cpf_cnpj: texto(dados, 'cpf_cnpj') || null,
    email: email || null,
    telefone: telefone || null,
    endereco: texto(dados, 'endereco') || null,
    observacoes: texto(dados, 'observacoes').slice(0, 2000) || null,
  };

  if (modoDemo()) {
    const r = salvarProprietarioDemo(usuario, { ...registro, id: id || undefined });
    atualizar();
    return r.ok
      ? { ok: true, mensagem: id ? 'Proprietário atualizado.' : 'Proprietário cadastrado.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const resposta = id
    ? await supabase.from('proprietarios').update(registro).eq('id', id)
    : await supabase.from('proprietarios').insert({ ...registro, criado_por: usuario.id });

  if (resposta.error) {
    console.error('[proprietarios] falha ao salvar:', resposta.error);
    return { ok: false, erro: traduzirErro(resposta.error.message) };
  }

  atualizar();
  return { ok: true, mensagem: id ? 'Proprietário atualizado.' : 'Proprietário cadastrado.' };
}

/**
 * Exclusão, e só quando não sobrou imóvel vinculado.
 *
 * A checagem acontece antes do delete em vez de depender do erro do
 * banco. O `on delete set null` da migration 0001 apagaria o
 * proprietário e deixaria os imóveis apontando para lugar nenhum — em
 * silêncio, que é a pior forma de perder dado de captação. Aqui a
 * operação é recusada com o número de imóveis na mensagem, para a
 * pessoa saber o tamanho do que precisa transferir antes.
 */
export async function excluirProprietario(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, erro: 'Apenas a gestão exclui um proprietário.' };
  }

  if (modoDemo()) {
    const r = excluirProprietarioDemo(usuario, id);
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Proprietário excluído.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { count, error: erroContagem } = await supabase
    .from('imoveis')
    .select('id', { count: 'exact', head: true })
    .eq('proprietario_id', id);

  if (erroContagem) {
    console.error('[proprietarios] falha ao contar imóveis:', erroContagem);
    return { ok: false, erro: 'Não foi possível verificar a carteira agora. Tente novamente.' };
  }

  if (count && count > 0) {
    return {
      ok: false,
      erro: `Este proprietário tem ${count} ${
        count === 1 ? 'imóvel vinculado' : 'imóveis vinculados'
      }. Transfira ou exclua antes.`,
    };
  }

  const { error } = await supabase.from('proprietarios').delete().eq('id', id);

  if (error) {
    console.error('[proprietarios] falha ao excluir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizar();
  return { ok: true, mensagem: 'Proprietário excluído.' };
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('row-level security')) {
    return 'Você só alcança proprietários de imóveis da sua carteira. Fale com a gestão.';
  }
  return 'Não foi possível salvar agora. Tente novamente.';
}
