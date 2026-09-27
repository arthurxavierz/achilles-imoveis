/**
 * Papeis e permissoes da equipe.
 *
 * O papel responde "quanto essa pessoa manda"; as permissoes respondem
 * "em quais areas ela entra". Sao dois eixos separados de proposito: uma
 * imobiliaria pode ter um corretor de confianca que enxerga o financeiro
 * das proprias comissoes sem por isso poder mexer na agenda dos colegas.
 *
 * A trava real esta no banco, na funcao definir_acesso() da migration
 * 0003, que so aceita chamada de administrador e recusa que alguem
 * rebaixe ou desative a propria conta. O que existe aqui e a mesma regra
 * escrita para a tela, para o botao nem aparecer quando a acao seria
 * negada.
 */

import type { AreaPermissao, Papel, Perfil, Permissoes } from './tipos';

export interface DescricaoPapel {
  chave: Papel;
  rotulo: string;
  resumo: string;
  /** O que a pessoa passa a enxergar, em linguagem de quem usa. */
  alcance: string[];
}

export const PAPEIS: DescricaoPapel[] = [
  {
    chave: 'admin',
    rotulo: 'Administrador',
    resumo: 'Comanda o sistema inteiro, inclusive quem entra e quem sai.',
    alcance: [
      'Enxerga todas as áreas, sem depender das permissões',
      'Cadastra, edita e desativa integrantes da equipe',
      'Fixa compromissos na agenda de qualquer pessoa',
      'Altera negócios já concluídos',
    ],
  },
  {
    chave: 'gestor',
    rotulo: 'Gestor',
    resumo: 'Conduz a operação da equipe, sem administrar acessos.',
    alcance: [
      'Vê a carteira, o funil e a agenda de toda a equipe',
      'Marca e fixa compromissos para os consultores',
      'Aprova, conclui e cancela negócios',
      'Não altera papel, permissão ou acesso de ninguém',
    ],
  },
  {
    chave: 'corretor',
    rotulo: 'Consultor',
    resumo: 'Cuida da própria carteira de clientes e imóveis.',
    alcance: [
      'Vê os próprios leads e os que ainda não têm dono',
      'Gerencia os imóveis em que é o captador',
      'Marca a própria agenda e enxerga a dos colegas sem editar',
      'Só entra nas áreas liberadas nas permissões',
    ],
  },
];

export const rotuloPapel = (papel: Papel | string): string =>
  PAPEIS.find((p) => p.chave === papel)?.rotulo ?? 'Consultor';

export const AREAS_PERMISSAO: {
  chave: AreaPermissao;
  rotulo: string;
  explicacao: string;
}[] = [
  {
    chave: 'imoveis',
    rotulo: 'Imóveis',
    explicacao: 'Cadastrar, publicar e editar imóveis da própria carteira.',
  },
  {
    chave: 'leads',
    rotulo: 'Leads',
    explicacao: 'Atender o funil, registrar contatos e mover etapas.',
  },
  {
    chave: 'financeiro',
    rotulo: 'Financeiro',
    explicacao: 'Ver negócios, comissões e recebíveis. Consultor vê só os próprios.',
  },
  {
    chave: 'usuarios',
    rotulo: 'Usuários',
    explicacao: 'Abrir a tela de equipe. Alterar acesso continua sendo só do administrador.',
  },
];

/** Ponto de partida sensato ao cadastrar alguem novo. */
export function permissoesPadrao(papel: Papel): Permissoes {
  if (papel === 'admin') {
    return { imoveis: true, leads: true, financeiro: true, usuarios: true };
  }
  if (papel === 'gestor') {
    return { imoveis: true, leads: true, financeiro: true, usuarios: false };
  }
  return { imoveis: true, leads: true, financeiro: false, usuarios: false };
}

/** Normaliza o que vem de formulario para o formato gravado no banco. */
export function normalizarPermissoes(bruto: Partial<Permissoes> | null | undefined): Permissoes {
  return {
    imoveis: Boolean(bruto?.imoveis),
    leads: Boolean(bruto?.leads),
    financeiro: Boolean(bruto?.financeiro),
    usuarios: Boolean(bruto?.usuarios),
  };
}

export interface ResultadoValidacao {
  ok: boolean;
  erro?: string;
}

/**
 * Confere se a alteracao de acesso pode acontecer.
 *
 * Espelha as duas excecoes que a funcao definir_acesso() do banco
 * levanta. A segunda existe para o sistema nunca ficar sem dono: se o
 * unico administrador se rebaixa, ninguem mais consegue promover
 * ninguem, e a saida seria mexer no banco na mao.
 */
export function validarAlteracaoAcesso(
  autor: Perfil,
  alvoId: string,
  mudancas: { papel?: Papel; ativo?: boolean },
  equipe: Perfil[],
): ResultadoValidacao {
  if (autor.papel !== 'admin') {
    return { ok: false, erro: 'Apenas administradores alteram papel, permissão e acesso.' };
  }

  const mudaPapel = mudancas.papel !== undefined;
  const desativa = mudancas.ativo === false;

  if (alvoId === autor.id && ((mudaPapel && mudancas.papel !== 'admin') || desativa)) {
    return {
      ok: false,
      erro: 'Você não pode rebaixar nem desativar o próprio acesso de administrador.',
    };
  }

  const admins = equipe.filter((p) => p.papel === 'admin' && p.ativo);
  const alvoEraAdminAtivo = admins.some((p) => p.id === alvoId);
  const perdeAdmin = alvoEraAdminAtivo && ((mudaPapel && mudancas.papel !== 'admin') || desativa);

  if (perdeAdmin && admins.length <= 1) {
    return {
      ok: false,
      erro: 'A imobiliária ficaria sem nenhum administrador ativo. Promova outra pessoa antes.',
    };
  }

  return { ok: true };
}

/** Quem pode abrir a tela de equipe. Ver e uma coisa; alterar e outra. */
export function podeVerEquipe(u: Perfil | null | undefined): boolean {
  if (!u || !u.ativo) return false;
  return u.papel === 'admin' || u.papel === 'gestor' || Boolean(u.permissoes?.usuarios);
}

export function podeAdministrarEquipe(u: Perfil | null | undefined): boolean {
  return Boolean(u && u.ativo && u.papel === 'admin');
}
