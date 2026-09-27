import type { Metadata } from 'next';

import type { ImovelResumo, Perfil, Proprietario } from '@imob/core';

import { ListaImoveis } from '@/componentes/imoveis/ListaImoveis';
import { imoveisDemo, nomesProprietariosDemo } from '@/lib/dados-demo';
import { equipeDemo, modoDemo } from '@/lib/demonstracao';
import { exigirPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export const metadata: Metadata = { title: 'Imóveis' };
export const dynamic = 'force-dynamic';

/**
 * Teto de linhas da carteira.
 *
 * Existia um teto de 500 aqui, e ele escondeu 464 imóveis de uma
 * carteira de 964 — de um jeito que ninguém tinha como perceber pela
 * tela. O mecanismo vale registrar, porque a armadilha se fecha sozinha:
 *
 * a consulta ordenava por atualizado_em desc e cortava em 500. Uma ação
 * em lote publicou os 500 que estavam visíveis, e publicar escreve
 * atualizado_em. Com isso os mesmos 500 subiram para o topo da ordenação
 * e passaram a ocupar a janela inteira para sempre. Os outros 464 nunca
 * mais apareceram — e como eram justamente os não publicados, o painel
 * dizia "461 imóveis fora da vitrine" apontando para uma tela onde
 * nenhum deles existia.
 *
 * Só subir o número não resolveria, e por pouco: o PostgREST corta
 * toda resposta em mil linhas (db-max-rows), então um .limit(2000)
 * devolve mil e cala. Com 964 imóveis isso passaria despercebido hoje e
 * voltaria a esconder carteira no dia em que a importação trouxesse a
 * milésima primeira. Por isso a leitura vai paginada, em faixas de mil.
 *
 * Duas defesas contra o corte silencioso. O teto é o mesmo de
 * lib/indicadores.ts, folgado para esta imobiliária; e quando ele for
 * atingido a tela avisa, em vez de esconder o resto sem dizer nada.
 * Quando 2000 não bastar, o caminho é levar filtro e paginação para o
 * banco — mas aí os filtros desta tela, que hoje trabalham sobre a
 * carteira inteira em memória, precisam ir junto.
 */
const LIMITE_CARTEIRA = 2000;

/** Teto de linhas por resposta do PostgREST. Não adianta pedir mais. */
const LINHAS_POR_PAGINA = 1000;

/**
 * As colunas que a tela desenha, e só elas.
 *
 * Com select('*') a página carregava 2,2 MB para 964 imóveis, buscava
 * tudo do banco, serializava tudo no HTML e ainda fazia o navegador
 * interpretar tudo, para desenhar uma tabela de vinte colunas. Medido,
 * o corte leva o mesmo conteúdo a menos de 500 KB.
 *
 * A ficha completa não some: ela é buscada quando a gaveta abre, que é
 * o único momento em que alguém lê descrição e observação interna. De
 * quebra, esses dois campos deixam de viajar no HTML de uma tela que só
 * lista.
 */
const COLUNAS_DA_LISTA = [
  'id',
  'titulo',
  'codigo',
  'tipo',
  'finalidade',
  'status',
  'bairro',
  'cidade',
  'condominio_nome',
  'matricula',
  'valor',
  'valor_locacao',
  'area_util',
  'quartos',
  'vagas',
  'publicado',
  'destaque',
  'corretor_id',
  'proprietario_id',
  'atualizado_em',
].join(', ');

export default async function PaginaImoveis({
  searchParams,
}: {
  searchParams: Promise<{
    imovel?: string;
    proprietario?: string;
    'sem-proprietario'?: string;
  }>;
}) {
  const params = await searchParams;
  const usuario = await exigirPermissao('imoveis');

  if (modoDemo()) {
    return (
      <ListaImoveis
        usuario={usuario}
        imoveis={imoveisDemo()}
        proprietarios={nomesProprietariosDemo(usuario)}
        equipe={equipeDemo()}
        parametros={params}
        truncada={false}
      />
    );
  }

  const supabase = await supabaseServidor();

  /**
   * Os proprietários vêm só com id e nome. A tela usa os dois para o
   * seletor de filtro e para a coluna da tabela, e não precisa de CPF
   * nem de telefone aqui — trazer o registro inteiro colocaria dado
   * sensível de dezenas de pessoas no HTML de uma tela que só queria
   * mostrar um nome.
   */
  const [carteira, proprietarios, equipe] = await Promise.all([
    carregarCarteira(supabase),
    supabase.from('proprietarios').select('id, nome').order('nome'),
    supabase.from('perfis').select('*').eq('ativo', true).order('nome'),
  ]);

  if (proprietarios.error) {
    console.error('[imoveis] falha ao carregar proprietários:', proprietarios.error);
  }

  return (
    <ListaImoveis
      usuario={usuario}
      imoveis={carteira}
      proprietarios={(proprietarios.data ?? []) as Pick<Proprietario, 'id' | 'nome'>[]}
      equipe={(equipe.data ?? []) as Perfil[]}
      parametros={params}
      truncada={carteira.length >= LIMITE_CARTEIRA}
    />
  );
}

/**
 * Lê a carteira inteira, em faixas de mil linhas.
 *
 * A paginação existe por causa do teto do PostgREST, não por causa do
 * volume: pedir 2000 de uma vez devolve 1000 sem erro nenhum, e um
 * corte que não avisa é exatamente o que causou o problema que esta
 * tela acabou de ter.
 *
 * O `.order` repetido em toda faixa não é redundância. Paginar por
 * intervalo só é coerente sobre uma ordenação estável, e atualizado_em
 * sozinho não é: uma ação em lote grava o mesmo instante em centenas de
 * linhas, e empate no Postgres não tem ordem definida — sem o desempate
 * por código, a mesma linha poderia vir duas vezes numa faixa e sumir
 * na outra.
 */
async function carregarCarteira(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>,
): Promise<ImovelResumo[]> {
  const carteira: ImovelResumo[] = [];

  while (carteira.length < LIMITE_CARTEIRA) {
    const de = carteira.length;
    const ate = Math.min(de + LINHAS_POR_PAGINA, LIMITE_CARTEIRA) - 1;

    const { data, error } = await supabase
      .from('imoveis')
      .select(COLUNAS_DA_LISTA)
      .order('atualizado_em', { ascending: false })
      .order('codigo', { ascending: true })
      .range(de, ate);

    if (error) {
      console.error('[imoveis] falha ao carregar a partir de', de, error);
      break;
    }

    const faixa = (data ?? []) as unknown as ImovelResumo[];
    carteira.push(...faixa);

    // Faixa incompleta significa fim da carteira, e não erro.
    if (faixa.length < ate - de + 1) break;
  }

  return carteira;
}

