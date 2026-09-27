import { cookies } from 'next/headers';

import type { Perfil } from '@imob/core';
import { lerBase, modoDemo } from '@imob/demo';

export { modoDemo };

const COOKIE_PAPEL = 'achilles-demo-usuario';

/**
 * Quem está usando o painel na demonstração.
 *
 * A escolha fica num cookie, e não em memória, para que a troca de
 * pessoa sobreviva à navegação e ao recarregamento. Isso permite ver na
 * prática a diferença entre os papéis: o admin marca compromisso para
 * os outros e enxerga o financeiro inteiro; o corretor só mexe na
 * própria agenda e não vê a aba de equipe.
 *
 * Sem cookie, entra como administrador, que é o papel com mais tela
 * para mostrar.
 */
export async function usuarioDemo(): Promise<Perfil> {
  const base = lerBase();
  const armazem = await cookies();
  const escolhido = armazem.get(COOKIE_PAPEL)?.value;

  return base.perfis.find((p) => p.id === escolhido) ?? base.perfis[0];
}

export function equipeDemo(): Perfil[] {
  return lerBase().perfis;
}

export const NOME_COOKIE_PAPEL = COOKIE_PAPEL;
