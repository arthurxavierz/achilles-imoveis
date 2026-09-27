import { cache } from 'react';
import { redirect } from 'next/navigation';

import type { Perfil } from '@imob/core';

import { modoDemo, usuarioDemo } from './demonstracao';
import { supabaseServidor } from './supabase-servidor';

/**
 * Quem esta usando o sistema agora.
 *
 * Usa getUser() e nao getSession(). A diferenca importa: getSession le o
 * cookie e acredita nele, enquanto getUser valida o token com o servidor
 * do Supabase. Num sistema onde a pessoa logada ve dado de cliente e
 * comissao, confiar num cookie que o proprio navegador pode ter forjado
 * nao e aceitavel.
 *
 * Embrulhada em cache() do React, que memoriza por requisicao. Sem isso
 * a conta era esta: o layout do painel chama exigirUsuario, e cada
 * pagina chama exigirPermissao, que chama exigirUsuario de novo. Duas
 * chamadas, cada uma custando um getUser mais um select em perfis, dao
 * quatro idas ao Supabase antes de a tela buscar o primeiro dado
 * proprio. Medido daqui, sao cerca de 600ms jogados fora em toda
 * navegacao do painel.
 *
 * O cache vale so para a requisicao em curso: nao ha risco de uma
 * pessoa herdar a sessao de outra, que seria a pior falha possivel num
 * sistema com carteira separada por consultor.
 */
export const usuarioAtual = cache(async function usuarioAtual(): Promise<Perfil | null> {
  // Sem banco configurado, o painel roda em demonstração e entra com um
  // perfil simulado. Some sozinho quando o Supabase for configurado.
  if (modoDemo()) return usuarioDemo();

  const supabase = await supabaseServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as Perfil;
});

/**
 * Exige alguem logado e ativo. Use no layout do painel: qualquer pagina
 * abaixo dele ja pode contar com um perfil valido.
 *
 * Perfil desativado e derrubado aqui mesmo. Quando o admin desliga um
 * corretor, a sessao dele pode continuar valida por horas; sem esta
 * checagem, um ex-funcionario continuaria entrando ate o token expirar.
 */
export async function exigirUsuario(): Promise<Perfil> {
  const perfil = await usuarioAtual();

  if (!perfil) redirect('/entrar');
  if (!perfil.ativo) redirect('/entrar?motivo=inativo');

  return perfil;
}

/** Exige uma area especifica. Espelha a funcao pode() do banco. */
export async function exigirPermissao(area: 'imoveis' | 'leads' | 'financeiro' | 'usuarios') {
  const perfil = await exigirUsuario();

  const liberado = perfil.papel === 'admin' || Boolean(perfil.permissoes?.[area]);
  if (!liberado) redirect('/?erro=sem-permissao');

  return perfil;
}

/** Exige gestao. Usada nas telas de equipe e de resultado consolidado. */
export async function exigirGestor(): Promise<Perfil> {
  const perfil = await exigirUsuario();

  if (perfil.papel !== 'admin' && perfil.papel !== 'gestor') {
    redirect('/?erro=sem-permissao');
  }

  return perfil;
}
