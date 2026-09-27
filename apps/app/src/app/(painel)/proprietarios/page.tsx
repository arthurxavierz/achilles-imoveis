import type { Metadata } from 'next';

import { resumirCarteira, type Imovel, type Perfil, type ProprietarioComCarteira } from '@imob/core';

import { Proprietarios } from '@/componentes/proprietarios/Proprietarios';
import { imoveisDemo, proprietariosDemo } from '@/lib/dados-demo';
import { equipeDemo, modoDemo } from '@/lib/demonstracao';
import { exigirPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export const metadata: Metadata = { title: 'Proprietários' };
export const dynamic = 'force-dynamic';

/**
 * Cadastro de quem entrega imóvel para a Achilles.
 *
 * Fica atrás da permissão de imóveis, e não de uma permissão própria:
 * quem cadastra imóvel precisa cadastrar proprietário no mesmo gesto,
 * porque um não existe sem o outro. Uma permissão separada criaria a
 * situação de alguém poder abrir a ficha do imóvel e não conseguir
 * preencher o campo obrigatório dela.
 *
 * A carteira de cada proprietário é contada aqui, no servidor, junto
 * com a lista de imóveis que a tela já precisa para a gaveta. É uma
 * consulta a mais, não uma por proprietário — com cem proprietários,
 * a diferença entre as duas abordagens é cem idas ao banco a cada
 * abertura da tela.
 */
export default async function PaginaProprietarios({
  searchParams,
}: {
  searchParams: Promise<{ proprietario?: string }>;
}) {
  const params = await searchParams;
  const usuario = await exigirPermissao('imoveis');

  if (modoDemo()) {
    return (
      <Proprietarios
        usuario={usuario}
        proprietarios={proprietariosDemo(usuario)}
        imoveis={imoveisDemo()}
        equipe={equipeDemo()}
        abertoInicial={params.proprietario ?? null}
      />
    );
  }

  const supabase = await supabaseServidor();

  /**
   * O RLS já recorta o que cada pessoa alcança: a gestão vê todos os
   * proprietários, e o corretor só os de imóveis da própria carteira.
   * Não há filtro por papel aqui de propósito, para não repetir em
   * JavaScript uma regra que o Postgres já aplica — e que, se as duas
   * discordarem um dia, quem estará certo é o banco.
   */
  /**
   * Da carteira, só as colunas que esta tela lê.
   *
   * Aqui havia um select('*') de até mil imóveis. Com 964 na base isso
   * são 2,2 MB medidos, que o servidor busca, serializa no HTML e o
   * navegador ainda precisa interpretar, tudo para desenhar três
   * números por proprietário e uma lista curta dentro da gaveta.
   *
   * As colunas abaixo são exatamente as usadas: resumirCarteira soma
   * por publicado, status e valor; a gaveta mostra título, código,
   * tipo, bairro e responsável; e proprietario_id é o que amarra cada
   * imóvel ao dono. O resto, com descrição e observação interna à
   * frente, nunca chegava a ser lido.
   */
  const COLUNAS_DA_CARTEIRA =
    'id, titulo, codigo, tipo, bairro, status, publicado, valor, corretor_id, proprietario_id';

  const [proprietarios, imoveis, equipe] = await Promise.all([
    supabase.from('proprietarios').select('*').order('nome'),
    carregarCarteiraResumida(supabase, COLUNAS_DA_CARTEIRA),
    supabase.from('perfis').select('*').eq('ativo', true).order('nome'),
  ]);

  if (proprietarios.error) {
    console.error('[proprietarios] falha ao carregar:', proprietarios.error);
  }

  const lista = imoveis as Imovel[];

  const comCarteira: ProprietarioComCarteira[] = (proprietarios.data ?? []).map((p) => ({
    ...p,
    ...resumirCarteira(lista.filter((i) => i.proprietario_id === p.id)),
  }));

  return (
    <Proprietarios
      usuario={usuario}
      proprietarios={comCarteira}
      imoveis={lista}
      equipe={(equipe.data ?? []) as Perfil[]}
      abertoInicial={params.proprietario ?? null}
    />
  );
}

/**
 * A carteira inteira, em faixas de mil.
 *
 * O limite de mil que havia aqui não era escolha, era o teto do
 * PostgREST escrito à mão: pedir mais que isso devolve mil e cala. Com
 * 964 imóveis a conta ainda fecha, mas o imóvel de número mil e um
 * deixaria proprietários com a carteira contada a menos, sem nenhum
 * sinal na tela.
 */
async function carregarCarteiraResumida(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>,
  colunas: string,
): Promise<unknown[]> {
  const linhas: unknown[] = [];
  const PAGINA = 1000;

  for (;;) {
    const de = linhas.length;

    const { data, error } = await supabase
      .from('imoveis')
      .select(colunas)
      .order('atualizado_em', { ascending: false })
      .order('codigo', { ascending: true })
      .range(de, de + PAGINA - 1);

    if (error) {
      console.error('[proprietarios] falha ao carregar a carteira:', error);
      break;
    }

    const faixa = data ?? [];
    linhas.push(...faixa);

    if (faixa.length < PAGINA) break;
  }

  return linhas;
}
