'use server';

import { revalidatePath } from 'next/cache';

import { normalizarPermissoes, type Papel, type Permissoes } from '@imob/core';
import { criarClienteAdmin } from '@imob/db';

import {
  definirAcessoDemo,
  removerPessoaDemo,
  salvarPessoaDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

/**
 * Administracao da equipe.
 *
 * Duas travas independentes protegem estas acoes:
 *
 * 1. A verificacao de papel aqui, que evita a ida ao banco quando a
 *    resposta ja e nao.
 *
 * 2. A funcao definir_acesso() da migration 0003, que confere de novo
 *    do lado do Postgres. Ela e quem realmente decide: papel e
 *    permissao nem constam do grant de UPDATE, entao nao existe caminho
 *    que passe por fora dela.
 *
 * Criar acesso e a unica operacao que precisa da chave de servico, e o
 * motivo e o desenho do Supabase: convidar alguem escreve em auth.users,
 * que nenhuma sessao de usuario alcanca. A chave nunca sai do servidor.
 */

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

const PAPEIS_VALIDOS: Papel[] = ['admin', 'gestor', 'corretor'];

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

function lerPermissoes(dados: FormData): Permissoes {
  return normalizarPermissoes({
    imoveis: dados.get('perm_imoveis') === 'on',
    leads: dados.get('perm_leads') === 'on',
    financeiro: dados.get('perm_financeiro') === 'on',
    usuarios: dados.get('perm_usuarios') === 'on',
  });
}

function atualizar() {
  revalidatePath('/equipe');
  revalidatePath('/');
}

/**
 * Cadastra ou edita alguem da equipe.
 *
 * O administrador define a senha na hora, e a pessoa entra direto. Nao
 * ha convite por e-mail.
 *
 * A escolha tem um custo que vale registrar: o admin conhece a senha
 * inicial de quem ele cadastra. O caminho do convite evitaria isso,
 * mas depende de servidor de e-mail configurado, de o link nao cair no
 * spam e de a pessoa clicar dentro do prazo — e numa equipe pequena,
 * onde quem cadastra esta na mesma sala de quem vai usar, isso troca
 * um risco pequeno por tres pontos de falha reais.
 *
 * O que reduz o custo: a senha e sorteada com crypto.getRandomValues no
 * navegador, nunca fica gravada em lugar nenhum do sistema, e a pessoa
 * pode troca-la em Perfil no primeiro acesso.
 */
export async function salvarPessoa(
  _anterior: EstadoAcao,
  dados: FormData,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const id = texto(dados, 'id');
  const nome = texto(dados, 'nome');
  const email = texto(dados, 'email').toLowerCase();
  const telefone = texto(dados, 'telefone').replace(/\D/g, '');
  const creci = texto(dados, 'creci');

  const senha = String(dados.get('senha') ?? '');

  const papelBruto = texto(dados, 'papel') as Papel;
  const papel = PAPEIS_VALIDOS.includes(papelBruto) ? papelBruto : 'corretor';
  const meta = Number(texto(dados, 'meta_mensal').replace(/\D/g, '')) || 0;
  const permissoes = lerPermissoes(dados);

  if (nome.length < 2) return { ok: false, erro: 'Informe o nome completo.' };
  if (!id && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, erro: 'Informe um e-mail válido. É por ele que a pessoa entra.' };
  }

  // Oito e o minimo do proprio Supabase. Nao inventamos regra de
  // maiuscula e simbolo: elas empurram a pessoa para "Senha@123", que e
  // pior que uma frase longa. O botao de sortear resolve melhor.
  if (!id && senha.length < 8) {
    return { ok: false, erro: 'A senha precisa de ao menos 8 caracteres.' };
  }

  const eAdmin = usuario.papel === 'admin';
  const proprioCadastro = id === usuario.id;

  if (!eAdmin && !proprioCadastro) {
    return { ok: false, erro: 'Apenas o administrador altera o cadastro de outra pessoa.' };
  }

  if (modoDemo()) {
    const salvo = salvarPessoaDemo(usuario, {
      id: id || undefined,
      nome,
      email: email || null,
      telefone: telefone || null,
      creci: creci || null,
      papel,
      permissoes,
      meta_mensal: meta,
    });

    if (!salvo.ok) return { ok: false, erro: salvo.erro };

    // Papel, permissao e meta passam pela mesma porta do banco real, para
    // a demonstracao recusar exatamente o que o Postgres recusaria.
    if (id && eAdmin) {
      const acesso = definirAcessoDemo(usuario, id, { papel, permissoes, meta_mensal: meta });
      if (!acesso.ok) return { ok: false, erro: acesso.erro };
    }

    atualizar();
    return { ok: true, mensagem: id ? 'Cadastro atualizado.' : 'Integrante cadastrado.' };
  }

  const supabase = await supabaseServidor();

  if (id) {
    const { error } = await supabase.rpc('atualizar_perfil', {
      p_usuario_id: id,
      p_nome: nome,
      p_email: email || null,
      p_telefone: telefone || null,
      p_creci: creci || null,
    });

    if (error) {
      console.error('[equipe] falha ao atualizar perfil:', error);
      return { ok: false, erro: traduzirErro(error.message) };
    }

    if (eAdmin) {
      const { error: erroAcesso } = await supabase.rpc('definir_acesso', {
        p_usuario_id: id,
        p_papel: papel,
        p_permissoes: permissoes,
        p_meta: meta,
      });

      if (erroAcesso) {
        console.error('[equipe] falha ao definir acesso:', erroAcesso);
        return { ok: false, erro: traduzirErro(erroAcesso.message) };
      }
    }

    atualizar();
    return { ok: true, mensagem: 'Cadastro atualizado.' };
  }

  if (!eAdmin) return { ok: false, erro: 'Apenas o administrador cadastra novos integrantes.' };

  let admin;
  try {
    admin = criarClienteAdmin();
  } catch (erro) {
    console.error('[equipe] chave de serviço ausente:', erro);
    return {
      ok: false,
      erro: 'Falta a chave SUPABASE_SERVICE_ROLE_KEY no servidor para criar o acesso.',
    };
  }

  // email_confirm: true marca o endereco como verificado sem mandar
  // nada. Sem isso o Supabase segura o login esperando a confirmacao
  // que, neste fluxo, nunca vai chegar.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, telefone },
  });

  if (error) {
    console.error('[equipe] falha ao criar acesso:', error);
    if (
      error.message.includes('already been registered') ||
      error.message.includes('already exists')
    ) {
      return { ok: false, erro: 'Este e-mail já tem acesso ao sistema.' };
    }
    if (error.message.toLowerCase().includes('password')) {
      return { ok: false, erro: 'O Supabase recusou esta senha. Tente uma mais longa.' };
    }
    return { ok: false, erro: 'Não foi possível criar o acesso agora.' };
  }

  const novoId = data.user?.id;

  if (novoId) {
    // O gatilho ao_criar_usuario ja criou o perfil como corretor. Aqui o
    // admin ajusta papel, permissoes e meta em uma unica ida ao banco.
    const { error: erroAcesso } = await supabase.rpc('definir_acesso', {
      p_usuario_id: novoId,
      p_papel: papel,
      p_permissoes: permissoes,
      p_meta: meta,
    });

    if (erroAcesso) console.error('[equipe] usuário criado, acesso pendente:', erroAcesso);

    if (creci) {
      await supabase.rpc('atualizar_perfil', { p_usuario_id: novoId, p_creci: creci });
    }
  }

  atualizar();
  return {
    ok: true,
    mensagem: `Acesso criado para ${email}. Entregue a senha à pessoa por um canal seguro — ela não aparece de novo.`,
  };
}

/**
 * Troca a senha de alguem da equipe.
 *
 * Existe por causa da escolha acima. Sem convite por e-mail, tambem nao
 * ha "esqueci minha senha" — e sem esta funcao, quem esquecesse ficaria
 * de fora do sistema para sempre, sem caminho de volta.
 *
 * Só o administrador chama, e ele nao pode trocar a propria senha por
 * aqui: para isso existe a tela de Perfil, que exige a senha atual. A
 * diferenca importa — esta funcao troca sem conferir nada, e usada em
 * si mesma seria um jeito de contornar aquela conferencia.
 */
export async function redefinirSenha(id: string, senha: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin') {
    return { ok: false, erro: 'Apenas o administrador redefine a senha de outra pessoa.' };
  }
  if (id === usuario.id) {
    return {
      ok: false,
      erro: 'Para trocar a sua própria senha, use a tela de Perfil.',
    };
  }
  if (senha.length < 8) {
    return { ok: false, erro: 'A senha precisa de ao menos 8 caracteres.' };
  }

  if (modoDemo()) {
    return { ok: true, mensagem: 'Senha redefinida. (demonstração: nada foi gravado)' };
  }

  let admin;
  try {
    admin = criarClienteAdmin();
  } catch (erro) {
    console.error('[equipe] chave de serviço ausente:', erro);
    return { ok: false, erro: 'Falta a chave SUPABASE_SERVICE_ROLE_KEY no servidor.' };
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password: senha });

  if (error) {
    console.error('[equipe] falha ao redefinir senha:', error);
    return { ok: false, erro: 'Não foi possível redefinir a senha agora.' };
  }

  atualizar();
  return {
    ok: true,
    mensagem: 'Senha redefinida. Entregue à pessoa por um canal seguro.',
  };
}

/** Liga e desliga o acesso sem apagar histórico. */
export async function alternarAcesso(id: string, ativo: boolean): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin') {
    return { ok: false, erro: 'Apenas o administrador altera o acesso da equipe.' };
  }

  if (modoDemo()) {
    const r = definirAcessoDemo(usuario, id, { ativo });
    atualizar();
    return r.ok
      ? { ok: true, mensagem: ativo ? 'Acesso reativado.' : 'Acesso desativado.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.rpc('definir_acesso', { p_usuario_id: id, p_ativo: ativo });

  if (error) {
    console.error('[equipe] falha ao alternar acesso:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizar();
  return { ok: true, mensagem: ativo ? 'Acesso reativado.' : 'Acesso desativado.' };
}

/**
 * Remove alguem da equipe em definitivo.
 *
 * Exige quem assume a carteira quando ainda ha algo no nome da pessoa.
 * Negocio ja concluido nao troca de dono: a comissao daquele mes
 * pertence a quem vendeu, mesmo depois do desligamento.
 */
export async function removerPessoa(id: string, substitutoId: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin') {
    return { ok: false, erro: 'Apenas o administrador remove integrantes.' };
  }
  if (id === usuario.id) {
    return { ok: false, erro: 'Você não pode remover o próprio acesso.' };
  }

  if (modoDemo()) {
    const r = removerPessoaDemo(usuario, id, substitutoId || null);
    atualizar();
    return r.ok ? { ok: true, mensagem: 'Integrante removido.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  if (substitutoId) {
    const { error } = await supabase.rpc('transferir_carteira', {
      p_de: id,
      p_para: substitutoId,
    });

    if (error) {
      console.error('[equipe] falha ao transferir carteira:', error);
      return { ok: false, erro: traduzirErro(error.message) };
    }
  }

  let admin;
  try {
    admin = criarClienteAdmin();
  } catch (erro) {
    console.error('[equipe] chave de serviço ausente:', erro);
    return {
      ok: false,
      erro: 'Falta a chave SUPABASE_SERVICE_ROLE_KEY no servidor para excluir o acesso.',
    };
  }

  // Apagar o usuario no auth derruba o perfil junto, pela chave
  // estrangeira com on delete cascade da migration 0001.
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    console.error('[equipe] falha ao remover usuário:', error);
    return { ok: false, erro: 'Não foi possível remover o acesso agora.' };
  }

  atualizar();
  return { ok: true, mensagem: 'Integrante removido.' };
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('Apenas administradores') || mensagem.includes('42501')) {
    return 'Apenas administradores alteram papel, permissão e acesso.';
  }
  if (mensagem.includes('proprio acesso de administrador')) {
    return 'Você não pode rebaixar nem desativar o próprio acesso de administrador.';
  }
  if (mensagem.includes('precisa estar ativo')) {
    return 'Quem recebe a carteira precisa estar ativo na equipe.';
  }
  if (mensagem.includes('Usuario nao encontrado')) {
    return 'Pessoa não encontrada.';
  }
  return 'Não foi possível concluir a operação agora. Tente novamente.';
}
