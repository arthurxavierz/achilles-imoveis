'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { modoDemo } from '@imob/demo';
import { reiniciarBase } from '@imob/demo';

import { NOME_COOKIE_PAPEL } from '@/lib/demonstracao';

/**
 * Ações que só existem enquanto o sistema roda sem banco.
 *
 * Cada uma checa modoDemo() antes de fazer qualquer coisa. Não é
 * paranoia: estas funções ficam expostas como endpoints de servidor, e
 * um "reiniciar tudo" acessível em produção seria um desastre.
 */

/** Troca quem está usando o painel, para comparar os papéis. */
export async function trocarUsuarioDemo(id: string): Promise<void> {
  if (!modoDemo()) return;

  const armazem = await cookies();
  armazem.set(NOME_COOKIE_PAPEL, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/', 'layout');
}

/** Devolve os dados simulados ao estado original. */
export async function reiniciarDemo(): Promise<void> {
  if (!modoDemo()) return;

  reiniciarBase();
  revalidatePath('/', 'layout');
}
