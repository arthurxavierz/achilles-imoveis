'use server';

import { revalidatePath } from 'next/cache';

import type { Foto, Imovel } from '@imob/core';

import {
  alterarImovelDemo,
  capasDemo,
  contatoProprietarioDemo,
  definirCapaDemo,
  excluirFotoDemo,
  fotosDoImovelDemo,
  registrarFotoDemo,
  reordenarFotosDemo,
  excluirImovelDemo,
  fichaImovelDemo,
  imoveisDemo,
  salvarImovelDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

/**
 * A foto de capa de um punhado de imóveis, para a miniatura da lista.
 *
 * Busca sob demanda, e não junto com a carteira, e a diferença é grande:
 * a carteira tem 964 linhas e a tela desenha 50 por vez. Trazer o
 * caminho da capa de todas colocaria por volta de cem kilobytes de texto
 * no HTML da página para desenhar cinquenta miniaturas, e as outras 914
 * viajariam à toa em toda visita. Aqui só entram os ids que estão na
 * página aberta.
 *
 * Aceita capa marcada ou a primeira da ordenação. As duas, porque a
 * importação da 0009 grava a foto de capa do feed e a carteira antiga
 * pode ter álbum sem nenhuma marcada; nesse caso a primeira serve, que é
 * o que a pessoa espera ver.
 */
export async function buscarCapas(ids: string[]): Promise<Record<string, string>> {
  await exigirUsuario();

  const alvos = normalizarIds(ids);
  if (alvos.length === 0) return {};

  if (modoDemo()) return capasDemo(alvos);

  const supabase = await supabaseServidor();

  const { data, error } = await supabase
    .from('imovel_fotos')
    .select('imovel_id, path, capa, ordem')
    .in('imovel_id', alvos)
    .or('capa.eq.true,ordem.eq.0')
    .order('capa', { ascending: false })
    .order('ordem', { ascending: true });

  if (error) {
    // Miniatura é conforto, não conteúdo: falhar aqui deixa a lista sem
    // imagem, e não sem lista.
    console.error('[imoveis] falha ao buscar as capas:', error);
    return {};
  }

  const capas: Record<string, string> = {};
  for (const linha of data ?? []) {
    const foto = linha as { imovel_id: string; path: string };
    // A ordenação já colocou a capa marcada na frente, então o primeiro
    // que chegar de cada imóvel é o certo.
    if (!capas[foto.imovel_id]) capas[foto.imovel_id] = foto.path;
  }

  return capas;
}

/**
 * Resultado de uma ação em lote.
 *
 * Em lote, "deu certo" e "deu errado" deixam de ser sim ou não: parte
 * dos imóveis passa e parte esbarra na RLS, na situação ou numa
 * negociação aberta. Por isso a tela precisa dos números, não só de um
 * booleano — é a diferença entre "12 publicados" e "12 publicados, 3
 * na carteira de outro consultor".
 */
export interface EstadoLote {
  ok: boolean;
  sucesso: number;
  falha: number;
  erro?: string;
  mensagem?: string;
}

/** Limite de segurança: a seleção "todos" não deve virar uma query gigante. */
const LIMITE_LOTE = 500;

function normalizarIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))].slice(0, LIMITE_LOTE);
}

const FINALIDADES = ['venda', 'locacao', 'venda_locacao'];
const STATUS = ['disponivel', 'reservado', 'vendido', 'locado', 'inativo'];

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? '').trim();
}

/**
 * Numero a partir do que a pessoa digitou.
 *
 * Quem cadastra imovel digita preco do jeito que le em contrato, com
 * ponto de milhar e virgula decimal. Recusar isso obrigaria a apagar a
 * pontuacao na mao em cada campo de dinheiro da ficha, e o campo de
 * dinheiro aparece cinco vezes.
 *
 * A ordem das regras resolve a unica ambiguidade real, que e "6.500":
 * pode ser seis mil e quinhentos ou seis e meio. No Brasil, e a
 * primeira leitura — e num cadastro de imovel, mais ainda. Por isso
 * grupos de exatamente tres digitos separados por ponto sao tratados
 * como milhar, e o ponto so vira decimal quando o que vem depois dele
 * nao tem tres digitos ("1250000.50", que e como sai do teclado
 * numerico).
 */
function numero(dados: FormData, campo: string): number {
  const bruto = texto(dados, campo).replace(/[^\d.,-]/g, '');
  if (!bruto) return 0;

  let normalizado: string;

  if (bruto.includes(',')) {
    // Virgula presente: ela e o decimal, e todo ponto e milhar.
    normalizado = bruto.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(bruto)) {
    // 1.250.000 e 6.500: so grupos de tres, entao e milhar.
    normalizado = bruto.replace(/\./g, '');
  } else {
    // 1250000.50: ponto decimal, deixa como esta.
    normalizado = bruto;
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor >= 0 ? valor : 0;
}

function inteiro(dados: FormData, campo: string): number {
  const valor = Number(texto(dados, campo).replace(/\D/g, ''));
  return Number.isFinite(valor) ? valor : 0;
}

/**
 * A vitrine tambem precisa saber.
 *
 * O site le a mesma base, e sem invalidar as rotas publicas um imovel
 * editado continuaria aparecendo com o texto antigo ate o cache de
 * cinco minutos virar.
 */
function atualizarImoveis() {
  revalidatePath('/imoveis');
  revalidatePath('/proprietarios');
  revalidatePath('/');
}

/**
 * Publicar ou tirar do ar.
 *
 * O efeito e imediato no site: a vitrine le a view vitrine_imoveis, que
 * so mostra o que esta publicado, e o revalidate de cinco minutos do
 * site republica a listagem. Vale avisar quem usa: nao e instantaneo.
 */
export async function alternarPublicacao(id: string, publicado: boolean): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (modoDemo()) {
    const r = alterarImovelDemo(usuario, id, { publicado });
    revalidatePath('/imoveis');
    return r.ok
      ? {
          ok: true,
          mensagem: publicado
            ? 'Imóvel publicado. Recarregue o site para vê-lo na vitrine.'
            : 'Imóvel retirado da vitrine.',
        }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('imoveis').update({ publicado }).eq('id', id);

  if (error) {
    console.error('[imoveis] falha ao publicar:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  revalidatePath('/imoveis');
  return {
    ok: true,
    mensagem: publicado
      ? 'Imóvel publicado. Aparece no site em até 5 minutos.'
      : 'Imóvel retirado da vitrine.',
  };
}

export async function alternarDestaque(id: string, destaque: boolean): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (modoDemo()) {
    const r = alterarImovelDemo(usuario, id, { destaque });
    revalidatePath('/imoveis');
    return r.ok
      ? { ok: true, mensagem: destaque ? 'Marcado como destaque.' : 'Destaque removido.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('imoveis').update({ destaque }).eq('id', id);

  if (error) return { ok: false, erro: traduzirErro(error.message) };

  revalidatePath('/imoveis');
  return { ok: true, mensagem: destaque ? 'Marcado como destaque.' : 'Destaque removido.' };
}

export async function mudarStatusImovel(id: string, status: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const permitidos = ['disponivel', 'reservado', 'vendido', 'locado', 'inativo'];
  if (!permitidos.includes(status)) return { ok: false, erro: 'Situação inválida.' };

  // Imovel vendido, locado ou inativo sai da vitrine junto. Deixar um
  // vendido publicado gera visita perdida e cliente irritado.
  const alteracao: Record<string, unknown> = { status };
  if (['vendido', 'locado', 'inativo'].includes(status)) {
    alteracao.publicado = false;
    alteracao.destaque = false;
  }

  if (modoDemo()) {
    const r = alterarImovelDemo(usuario, id, alteracao);
    revalidatePath('/imoveis');
    return r.ok ? { ok: true, mensagem: 'Situação atualizada.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase.from('imoveis').update(alteracao).eq('id', id);

  if (error) return { ok: false, erro: traduzirErro(error.message) };

  revalidatePath('/imoveis');
  return { ok: true, mensagem: 'Situação atualizada.' };
}

/** Transferir a carteira. Somente a gestao reatribui imovel de alguem. */
export async function atribuirCorretor(id: string, corretorId: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, erro: 'Apenas a gestão pode transferir imóveis entre consultores.' };
  }

  if (modoDemo()) {
    const r = alterarImovelDemo(usuario, id, { corretor_id: corretorId || null });
    revalidatePath('/imoveis');
    return r.ok ? { ok: true, mensagem: 'Imóvel transferido.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();
  const { error } = await supabase
    .from('imoveis')
    .update({ corretor_id: corretorId || null })
    .eq('id', id);

  if (error) return { ok: false, erro: traduzirErro(error.message) };

  revalidatePath('/imoveis');
  return { ok: true, mensagem: 'Imóvel transferido.' };
}

/**
 * Publicar ou tirar do ar em lote.
 *
 * O caso de uso que pediu esta função: a carteira chega importada, com
 * dezenas de imóveis fora do ar, e alguém precisa colocar tudo no ar de
 * uma vez — não clicar "No ar" cinquenta vezes.
 *
 * Publicar só vale para imóvel disponível. Um vendido ou inativo que
 * fosse ao ar junto colocaria na vitrine algo que não está à venda, e é
 * a mesma regra que `mudarStatusImovel` já aplica ao tirar da vitrine o
 * que muda de situação. Por isso o filtro `.eq('status', 'disponivel')`
 * mora aqui, no servidor, e não na tela: vale para qualquer chamador.
 *
 * A RLS do banco decide o resto. O update com `.in(...)` só toca as
 * linhas que este usuário pode gerenciar, e o `.select('id')` devolve
 * exatamente quais passaram — é assim que a tela sabe dizer quantos
 * ficaram de fora por serem de outro consultor.
 */
/**
 * A ficha completa de um imóvel, para a gaveta.
 *
 * A lista da carteira carrega só as vinte colunas que a tabela desenha.
 * Quando alguém abre a gaveta para editar, aí sim vale buscar as 58: é
 * um registro, num clique deliberado, contra 964 registros em toda
 * abertura da tela.
 *
 * O RLS decide o que volta. Um corretor que force o id de um imóvel de
 * outro recebe null, e a gaveta mostra o aviso em vez do formulário.
 */
export async function buscarFichaImovel(id: string): Promise<Imovel | null> {
  await exigirUsuario();

  if (!id) return null;

  if (modoDemo()) return fichaImovelDemo(id);

  const supabase = await supabaseServidor();

  const { data, error } = await supabase.from('imoveis').select('*').eq('id', id).maybeSingle();

  if (error) {
    console.error('[imoveis] falha ao abrir a ficha:', error);
    return null;
  }

  return (data ?? null) as Imovel | null;
}

/**
 * Nome e contato de quem entregou o imóvel, dentro da ficha dele.
 *
 * Antes, para ligar para o dono de um imóvel, a pessoa saía da ficha,
 * abria a aba de proprietários, procurava pelo nome e voltava. O dado
 * sempre esteve a um clique de distância; o que faltava era ele estar no
 * lugar onde a pergunta aparece.
 *
 * Quem decide se o contato vai ou não é o RLS, e não este código. A
 * consulta ao proprietário roda com a sessão de quem pediu, então a
 * política da migration 0012 responde exatamente o que responderia na
 * aba de proprietários: gestão vê, o consultor com o imóvel na carteira
 * agora vê, e mais ninguém. Repetir a regra aqui em JavaScript criaria
 * uma segunda versão dela para divergir com o tempo.
 *
 * Os três estados são distintos de propósito. "Sem proprietário" é um
 * cadastro a resolver e a tela precisa cobrar; "sem acesso" é a regra
 * funcionando, e a tela precisa explicar em vez de parecer defeito.
 */
export type ContatoProprietario =
  | { estado: 'sem-proprietario' }
  | { estado: 'sem-acesso' }
  | { estado: 'ok'; nome: string; telefone: string | null; email: string | null };

export async function buscarContatoProprietario(imovelId: string): Promise<ContatoProprietario> {
  const usuario = await exigirUsuario();

  if (!imovelId) return { estado: 'sem-proprietario' };

  if (modoDemo()) return contatoProprietarioDemo(usuario, imovelId);

  const supabase = await supabaseServidor();

  const { data: imovel } = await supabase
    .from('imoveis')
    .select('proprietario_id')
    .eq('id', imovelId)
    .maybeSingle();

  const proprietarioId = (imovel as { proprietario_id: string | null } | null)?.proprietario_id;
  if (!proprietarioId) return { estado: 'sem-proprietario' };

  const { data, error } = await supabase
    .from('proprietarios')
    .select('nome, telefone, email')
    .eq('id', proprietarioId)
    .maybeSingle();

  if (error) {
    console.error('[imoveis] falha ao buscar o contato do proprietário:', error);
    return { estado: 'sem-acesso' };
  }

  // Linha existe e o vínculo existe, mas a consulta voltou vazia: foi a
  // política de leitura filtrando, que é o caso que a tela explica.
  if (!data) return { estado: 'sem-acesso' };

  const dono = data as { nome: string; telefone: string | null; email: string | null };

  return {
    estado: 'ok',
    nome: dono.nome,
    telefone: dono.telefone,
    email: dono.email,
  };
}

/**
 * Vincula o mesmo proprietário a vários imóveis.
 *
 * A importação trouxe a carteira sem dono, e regularizar um por um pela
 * gaveta é o tipo de tarefa que ninguém termina. O caminho é filtrar por
 * "sem proprietário", marcar o que é daquela pessoa e resolver de uma
 * vez.
 *
 * A RLS decide quais linhas passam, e o .select() devolve exatamente as
 * que passaram: é assim que a tela sabe dizer quantas ficaram de fora.
 */
export async function vincularProprietarioEmLote(
  ids: string[],
  proprietarioId: string,
): Promise<EstadoLote> {
  const usuario = await exigirUsuario();

  if (!proprietarioId) {
    return { ok: false, sucesso: 0, falha: 0, erro: 'Escolha um proprietário.' };
  }

  const alvos = normalizarIds(ids);
  if (alvos.length === 0) {
    return { ok: false, sucesso: 0, falha: 0, erro: 'Nenhum imóvel selecionado.' };
  }

  if (modoDemo()) {
    let sucesso = 0;
    for (const id of alvos) {
      const r = alterarImovelDemo(usuario, id, { proprietario_id: proprietarioId });
      if (r.ok) sucesso += 1;
    }
    atualizarImoveis();
    return montarResultadoLote('vincular', sucesso, alvos.length - sucesso);
  }

  const supabase = await supabaseServidor();

  const { data, error } = await supabase
    .from('imoveis')
    .update({ proprietario_id: proprietarioId })
    .in('id', alvos)
    .select('id');

  if (error) {
    console.error('[imoveis] falha ao vincular proprietário em lote:', error);
    return { ok: false, sucesso: 0, falha: alvos.length, erro: traduzirErro(error.message) };
  }

  const sucesso = data?.length ?? 0;
  atualizarImoveis();
  return montarResultadoLote('vincular', sucesso, alvos.length - sucesso);
}

// ------------------------------------------------------------
// FOTOS
// ------------------------------------------------------------
//
// O bucket, os tipos aceitos e as politicas de escrita ja existiam desde
// a migration 0005, e o site publica as fotos ha meses. O que nao existia
// era caminho para a equipe mexer nelas: imovel cadastrado pelo painel
// nascia sem foto e sem como ganhar uma, e so tinha album quem veio da
// importacao.
//
// O arquivo em si nao passa por aqui. Ele sobe do navegador direto para
// o storage, com a sessao da pessoa, e estas acoes so cuidam da linha na
// tabela. A escolha e de peso: mandar a foto pela acao do servidor faria
// cada envio ocupar memoria e banda da funcao, e sao dez megabytes por
// arquivo no limite do bucket.

/** As fotos de um imovel, na ordem em que a vitrine mostra. */
export async function listarFotos(imovelId: string): Promise<Foto[]> {
  await exigirUsuario();
  if (!imovelId) return [];

  if (modoDemo()) return fotosDoImovelDemo(imovelId);

  const supabase = await supabaseServidor();

  const { data, error } = await supabase
    .from('imovel_fotos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('capa', { ascending: false })
    .order('ordem', { ascending: true });

  if (error) {
    console.error('[imoveis] falha ao listar fotos:', error);
    return [];
  }

  return (data ?? []) as Foto[];
}

/**
 * Registra no banco uma foto que o navegador acabou de subir.
 *
 * A primeira foto de um imovel vira capa sozinha. Sem isso o imovel
 * ficaria com album e sem capa, que na vitrine e o mesmo que ficar sem
 * foto nenhuma: o cartao usa urlCapa().
 */
export async function registrarFoto(
  imovelId: string,
  path: string,
  legenda?: string,
): Promise<EstadoAcao> {
  await exigirUsuario();

  if (!imovelId || !path) return { ok: false, erro: 'Foto sem imóvel ou sem caminho.' };

  if (modoDemo()) {
    const r = registrarFotoDemo(imovelId, path, legenda ?? null);
    atualizarImoveis();
    return r.ok ? { ok: true, mensagem: 'Foto adicionada.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { count } = await supabase
    .from('imovel_fotos')
    .select('id', { count: 'exact', head: true })
    .eq('imovel_id', imovelId);

  const existentes = count ?? 0;

  const { error } = await supabase.from('imovel_fotos').insert({
    imovel_id: imovelId,
    path,
    legenda: legenda?.trim() || null,
    ordem: existentes,
    capa: existentes === 0,
  });

  if (error) {
    console.error('[imoveis] falha ao registrar foto:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizarImoveis();
  return { ok: true, mensagem: 'Foto adicionada.' };
}

/**
 * Apaga a foto do banco e do storage.
 *
 * Nesta ordem, e nao ao contrario: se o arquivo sumisse primeiro e a
 * linha ficasse, a vitrine mostraria um quadro quebrado. Falhando o
 * arquivo, sobra um orfao invisivel no bucket, que custa alguns
 * kilobytes e nao quebra tela nenhuma.
 *
 * Se a capa for removida, a proxima foto assume. Album sem capa aparece
 * na vitrine como imovel sem foto.
 */
export async function excluirFoto(id: string): Promise<EstadoAcao> {
  await exigirUsuario();

  if (modoDemo()) {
    const r = excluirFotoDemo(id);
    atualizarImoveis();
    return r.ok ? { ok: true, mensagem: 'Foto removida.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { data: foto } = await supabase
    .from('imovel_fotos')
    .select('imovel_id, path, capa')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('imovel_fotos').delete().eq('id', id);

  if (error) {
    console.error('[imoveis] falha ao excluir foto:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  if (foto?.path) {
    const { error: erroArquivo } = await supabase.storage.from('imoveis').remove([foto.path]);
    if (erroArquivo) console.error('[imoveis] arquivo órfão no bucket:', foto.path, erroArquivo);
  }

  if (foto?.capa) {
    const { data: proxima } = await supabase
      .from('imovel_fotos')
      .select('id')
      .eq('imovel_id', foto.imovel_id)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (proxima?.id) {
      await supabase.from('imovel_fotos').update({ capa: true }).eq('id', proxima.id);
    }
  }

  atualizarImoveis();
  return { ok: true, mensagem: 'Foto removida.' };
}

/** Define a capa. Uma so por imovel, entao as outras caem juntas. */
export async function definirCapa(imovelId: string, fotoId: string): Promise<EstadoAcao> {
  await exigirUsuario();

  if (modoDemo()) {
    const r = definirCapaDemo(imovelId, fotoId);
    atualizarImoveis();
    return r.ok ? { ok: true, mensagem: 'Capa definida.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error: erroLimpar } = await supabase
    .from('imovel_fotos')
    .update({ capa: false })
    .eq('imovel_id', imovelId);

  if (erroLimpar) {
    console.error('[imoveis] falha ao limpar a capa:', erroLimpar);
    return { ok: false, erro: traduzirErro(erroLimpar.message) };
  }

  const { error } = await supabase.from('imovel_fotos').update({ capa: true }).eq('id', fotoId);

  if (error) {
    console.error('[imoveis] falha ao definir a capa:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizarImoveis();
  return { ok: true, mensagem: 'Capa definida.' };
}

/**
 * Grava a ordem inteira de uma vez.
 *
 * A tela move uma foto por vez, mas mandar so o par que trocou obrigaria
 * o servidor a recalcular o resto e a discordar da tela no primeiro
 * clique rapido. Enviar a lista fechada e mais simples e nao empata: sao
 * dezesseis fotos no caso tipico.
 */
export async function reordenarFotos(imovelId: string, ids: string[]): Promise<EstadoAcao> {
  await exigirUsuario();

  const ordenados = normalizarIds(ids);
  if (ordenados.length === 0) return { ok: false, erro: 'Nada para reordenar.' };

  if (modoDemo()) {
    const r = reordenarFotosDemo(imovelId, ordenados);
    atualizarImoveis();
    return r.ok ? { ok: true, mensagem: 'Ordem salva.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const resultados = await Promise.all(
    ordenados.map((id, ordem) =>
      supabase.from('imovel_fotos').update({ ordem }).eq('id', id).eq('imovel_id', imovelId),
    ),
  );

  const falha = resultados.find((r) => r.error);
  if (falha?.error) {
    console.error('[imoveis] falha ao reordenar fotos:', falha.error);
    return { ok: false, erro: traduzirErro(falha.error.message) };
  }

  atualizarImoveis();
  return { ok: true, mensagem: 'Ordem salva.' };
}

export async function publicarEmLote(ids: string[], publicado: boolean): Promise<EstadoLote> {
  const usuario = await exigirUsuario();

  const alvos = normalizarIds(ids);
  if (alvos.length === 0) return { ok: false, sucesso: 0, falha: 0, erro: 'Nenhum imóvel selecionado.' };

  if (modoDemo()) {
    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
    const porId = new Map(imoveisDemo().map((i) => [i.id, i]));
    let sucesso = 0;
    let falha = 0;

    for (const id of alvos) {
      const imovel = porId.get(id);
      if (!imovel) {
        falha += 1;
        continue;
      }
      // Publicar só o que está disponível, e só o que é meu (ou sou gestão).
      if (publicado && imovel.status !== 'disponivel') {
        falha += 1;
        continue;
      }
      if (!gestor && imovel.corretor_id !== usuario.id) {
        falha += 1;
        continue;
      }
      const r = alterarImovelDemo(usuario, id, { publicado });
      if (r.ok) sucesso += 1;
      else falha += 1;
    }

    atualizarImoveis();
    return montarResultadoLote(publicado ? 'publicar' : 'retirar', sucesso, falha);
  }

  const supabase = await supabaseServidor();

  let consulta = supabase.from('imoveis').update({ publicado }).in('id', alvos);
  if (publicado) consulta = consulta.eq('status', 'disponivel');

  const { data, error } = await consulta.select('id');

  if (error) {
    console.error('[imoveis] falha ao publicar em lote:', error);
    return { ok: false, sucesso: 0, falha: alvos.length, erro: traduzirErro(error.message) };
  }

  const sucesso = data?.length ?? 0;
  atualizarImoveis();
  return montarResultadoLote(publicado ? 'publicar' : 'retirar', sucesso, alvos.length - sucesso);
}

/**
 * Exclusão em lote.
 *
 * Só a gestão, mesma regra da exclusão avulsa. E a mesma trava: imóvel
 * com negociação aberta não sai — a comissão pendurada nele precisa de
 * origem no fim do mês. Em vez de recusar o lote inteiro por causa de um,
 * separamos os bloqueados, excluímos o resto e devolvemos a contagem,
 * para a pessoa saber que dois dos quinze ficaram e por quê.
 */
export async function excluirEmLote(ids: string[]): Promise<EstadoLote> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, sucesso: 0, falha: 0, erro: 'Apenas a gestão exclui imóveis em definitivo.' };
  }

  const alvos = normalizarIds(ids);
  if (alvos.length === 0) return { ok: false, sucesso: 0, falha: 0, erro: 'Nenhum imóvel selecionado.' };

  if (modoDemo()) {
    let sucesso = 0;
    let falha = 0;
    for (const id of alvos) {
      const r = excluirImovelDemo(usuario, id);
      if (r.ok) sucesso += 1;
      else falha += 1;
    }
    atualizarImoveis();
    return montarResultadoLote('excluir', sucesso, falha);
  }

  const supabase = await supabaseServidor();

  const { data: negociando, error: erroVenda } = await supabase
    .from('vendas')
    .select('imovel_id')
    .in('imovel_id', alvos)
    .not('status', 'in', '(cancelada,concluida)');

  if (erroVenda) {
    console.error('[imoveis] falha ao verificar negociações do lote:', erroVenda);
    return { ok: false, sucesso: 0, falha: alvos.length, erro: 'Não foi possível verificar as negociações agora.' };
  }

  const bloqueados = new Set((negociando ?? []).map((v) => v.imovel_id as string));
  const excluir = alvos.filter((id) => !bloqueados.has(id));

  let sucesso = 0;
  if (excluir.length > 0) {
    const { data, error } = await supabase.from('imoveis').delete().in('id', excluir).select('id');
    if (error) {
      console.error('[imoveis] falha ao excluir em lote:', error);
      return { ok: false, sucesso: 0, falha: alvos.length, erro: traduzirErro(error.message) };
    }
    sucesso = data?.length ?? 0;
  }

  atualizarImoveis();
  return montarResultadoLote('excluir', sucesso, alvos.length - sucesso);
}

/** Monta a mensagem de um lote a partir das contagens, sem repetir texto em cada ação. */
function montarResultadoLote(
  acao: 'publicar' | 'retirar' | 'excluir' | 'vincular',
  sucesso: number,
  falha: number,
): EstadoLote {
  const rotulo = {
    publicar: 'publicado',
    retirar: 'retirado do ar',
    excluir: 'excluído',
    vincular: 'vinculado ao proprietário',
  }[acao];
  const rotuloPlural = {
    publicar: 'publicados',
    retirar: 'retirados do ar',
    excluir: 'excluídos',
    vincular: 'vinculados ao proprietário',
  }[acao];

  if (sucesso === 0) {
    const motivo =
      acao === 'publicar'
        ? 'Verifique se estão disponíveis e na sua carteira.'
        : acao === 'excluir'
          ? 'Podem ter negociação em andamento.'
          : 'Podem estar na carteira de outro consultor.';
    return { ok: false, sucesso, falha, erro: `Nenhum imóvel ${rotulo}. ${motivo}` };
  }

  const base = sucesso === 1 ? `1 imóvel ${rotulo}` : `${sucesso} imóveis ${rotuloPlural}`;
  const publicado = acao === 'publicar' ? ' Aparece no site em até 5 minutos.' : '';
  const restante =
    falha > 0
      ? ` ${falha} ${falha === 1 ? 'ficou de fora' : 'ficaram de fora'}${
          acao === 'excluir' ? ' por ter negociação aberta' : ''
        }.`
      : '';

  return { ok: true, sucesso, falha, mensagem: `${base}.${publicado}${restante}` };
}


/**
 * Cadastra ou edita um imóvel.
 *
 * A regra que este projeto ganhou agora: **não existe imóvel sem
 * proprietário**. A recusa acontece aqui, no servidor, e não só no
 * `required` do formulário — o campo do navegador é conveniência para
 * quem digita, não garantia. Qualquer coisa que chegue por outro
 * caminho (uma importação, um script, um formulário adulterado) esbarra
 * nesta linha.
 *
 * O motivo é operacional, não burocrático. Imóvel sem proprietário é
 * imóvel que ninguém sabe de quem é quando aparece uma proposta: não há
 * quem autorize a visita, não há quem assine, e a comissão fica sem
 * origem. A carteira importada por XML tem exatamente esse buraco, e é
 * o que o filtro "sem proprietário" da lista serve para caçar.
 */
export async function salvarImovel(_anterior: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const id = texto(dados, 'id');
  const titulo = texto(dados, 'titulo');
  const proprietarioId = texto(dados, 'proprietario_id');

  if (titulo.length < 4) return { ok: false, erro: 'Dê um título ao imóvel.' };
  if (!proprietarioId) {
    return {
      ok: false,
      erro: 'Vincule um proprietário. Todo imóvel precisa de alguém que responda por ele.',
    };
  }

  const finalidade = texto(dados, 'finalidade') || 'venda';
  if (!FINALIDADES.includes(finalidade)) return { ok: false, erro: 'Finalidade inválida.' };

  const status = texto(dados, 'status') || 'disponivel';
  if (!STATUS.includes(status)) return { ok: false, erro: 'Situação inválida.' };

  const valor = numero(dados, 'valor');
  const valorLocacao = numero(dados, 'valor_locacao');

  if (finalidade !== 'locacao' && valor <= 0) {
    return { ok: false, erro: 'Informe o valor de venda.' };
  }
  if (finalidade !== 'venda' && valorLocacao <= 0) {
    return { ok: false, erro: 'Informe o valor do aluguel.' };
  }

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const registro = {
    titulo: titulo.slice(0, 160),
    descricao: texto(dados, 'descricao').slice(0, 6000) || null,
    tipo: texto(dados, 'tipo') || 'Apartamento',
    finalidade,
    status,

    cep: texto(dados, 'cep').replace(/\D/g, '') || null,
    logradouro: texto(dados, 'logradouro') || null,
    numero: texto(dados, 'numero') || null,
    complemento: texto(dados, 'complemento') || null,
    bairro: texto(dados, 'bairro') || null,
    cidade: texto(dados, 'cidade') || 'Uberlândia',
    uf: (texto(dados, 'uf') || 'MG').toUpperCase().slice(0, 2),
    exibir_endereco: dados.get('exibir_endereco') === 'on',

    valor,
    valor_locacao: valorLocacao || null,
    valor_condominio: numero(dados, 'valor_condominio') || null,
    valor_iptu: numero(dados, 'valor_iptu') || null,
    aceita_permuta: dados.get('aceita_permuta') === 'on',
    aceita_financiamento: dados.get('aceita_financiamento') === 'on',

    area_util: numero(dados, 'area_util'),
    area_total: numero(dados, 'area_total'),
    hectares: numero(dados, 'hectares') || null,
    quartos: inteiro(dados, 'quartos'),
    suites: inteiro(dados, 'suites'),
    banheiros: inteiro(dados, 'banheiros'),
    vagas: inteiro(dados, 'vagas'),
    ano_construcao: inteiro(dados, 'ano_construcao') || null,
    andar: inteiro(dados, 'andar') || null,
    mobiliado: dados.get('mobiliado') === 'on',

    // Uma característica por linha no textarea. É mais rápido de
    // digitar que um campo de etiquetas e não exige mouse, o que
    // importa para quem cadastra vinte imóveis numa tarde.
    caracteristicas: texto(dados, 'caracteristicas')
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 40),

    proprietario_id: proprietarioId,
    corretor_id: gestor ? texto(dados, 'corretor_id') || null : usuario.id,
    exclusividade: dados.get('exclusividade') === 'on',
    autorizacao_ate: texto(dados, 'autorizacao_ate') || null,
    matricula: texto(dados, 'matricula') || null,
    observacoes_internas: texto(dados, 'observacoes_internas').slice(0, 3000) || null,
  };

  if (modoDemo()) {
    const r = salvarImovelDemo(usuario, { ...registro, id: id || undefined } as never);
    atualizarImoveis();
    return r.ok
      ? { ok: true, mensagem: id ? 'Imóvel atualizado.' : 'Imóvel cadastrado, ainda fora do ar.' }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const resposta = id
    ? await supabase.from('imoveis').update(registro).eq('id', id)
    : await supabase.from('imoveis').insert({
        ...registro,
        // Nasce fora do ar. Publicar é um segundo gesto, deliberado:
        // imóvel recém-cadastrado ainda não tem foto nem revisão de
        // texto, e ir direto para a vitrine é deixar a vitrine aberta
        // durante a arrumação.
        publicado: false,
        destaque: false,
        fonte: 'manual',
      });

  if (resposta.error) {
    console.error('[imoveis] falha ao salvar:', resposta.error);
    return { ok: false, erro: traduzirErro(resposta.error.message) };
  }

  atualizarImoveis();
  return {
    ok: true,
    mensagem: id ? 'Imóvel atualizado.' : 'Imóvel cadastrado, ainda fora do ar.',
  };
}

/**
 * Exclusão definitiva.
 *
 * Só a gestão, e só quando não há negociação em andamento. Um imóvel
 * com proposta aberta que desaparece leva junto o rastro de uma
 * comissão que alguém vai cobrar no fim do mês — e aí não há como
 * reconstruir de quem era.
 *
 * Para tirar da vitrine sem perder o registro existe o caminho normal,
 * que é mudar a situação para inativo. É o que a mensagem de confirmação
 * da tela oferece antes.
 */
export async function excluirImovel(id: string): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
    return { ok: false, erro: 'Apenas a gestão exclui um imóvel em definitivo.' };
  }

  if (modoDemo()) {
    const r = excluirImovelDemo(usuario, id);
    atualizarImoveis();
    return r.ok ? { ok: true, mensagem: 'Imóvel excluído.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { data: emAberto, error: erroVenda } = await supabase
    .from('vendas')
    .select('codigo')
    .eq('imovel_id', id)
    .not('status', 'in', '(cancelada,concluida)')
    .limit(1);

  if (erroVenda) {
    console.error('[imoveis] falha ao verificar negociações:', erroVenda);
    return { ok: false, erro: 'Não foi possível verificar as negociações agora.' };
  }

  if (emAberto && emAberto.length > 0) {
    return {
      ok: false,
      erro: `Existe uma negociação em andamento (${emAberto[0].codigo}) neste imóvel. Conclua ou cancele antes de excluir.`,
    };
  }

  const { error } = await supabase.from('imoveis').delete().eq('id', id);

  if (error) {
    console.error('[imoveis] falha ao excluir:', error);
    return { ok: false, erro: traduzirErro(error.message) };
  }

  atualizarImoveis();
  return { ok: true, mensagem: 'Imóvel excluído.' };
}

/** Vincula um proprietário a um imóvel que ficou sem, vindo da importação. */
export async function vincularProprietario(
  id: string,
  proprietarioId: string,
): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  if (!proprietarioId) return { ok: false, erro: 'Escolha um proprietário.' };

  if (modoDemo()) {
    const r = alterarImovelDemo(usuario, id, { proprietario_id: proprietarioId });
    atualizarImoveis();
    return r.ok ? { ok: true, mensagem: 'Proprietário vinculado.' } : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  const { error } = await supabase
    .from('imoveis')
    .update({ proprietario_id: proprietarioId })
    .eq('id', id);

  if (error) return { ok: false, erro: traduzirErro(error.message) };

  atualizarImoveis();
  return { ok: true, mensagem: 'Proprietário vinculado.' };
}
function traduzirErro(mensagem: string): string {
  if (mensagem.includes('row-level security')) {
    return 'Este imóvel está na carteira de outro consultor. Só ele ou a gestão pode alterá-lo.';
  }

  /**
   * Recusa do gatilho da migration 0012, e não do RLS.
   *
   * A diferença importa na tela: cair na mensagem de RLS acima diria
   * que o imóvel é de outro consultor, o que aqui é falso e manda a
   * pessoa procurar o problema no lugar errado. O imóvel é dela; quem
   * não é dela é o proprietário que ela tentou vincular.
   *
   * O texto vem do banco sem acento, como todo o SQL do projeto, então
   * é reescrito aqui em vez de repassado.
   */
  if (mensagem.includes('nao esta na sua carteira')) {
    return 'Este proprietário não está na sua carteira. Vincule apenas quem você cadastrou ou quem já é dono de outro imóvel seu. A gestão pode vincular qualquer um.';
  }

  return 'Não foi possível salvar agora. Tente novamente.';
}
