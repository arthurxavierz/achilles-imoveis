'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { ORDENS, type OrdemBusca } from '@imob/core';

import { Seletor } from './Seletor';

/**
 * Ordenacao da listagem.
 *
 * Escreve na URL em vez de guardar no estado. Assim o link "casas no
 * Karaiba, do maior valor para o menor" pode ser mandado por WhatsApp e
 * abrir exatamente o mesmo resultado do outro lado, que e como corretor
 * e cliente conversam na pratica.
 */
export function Ordenacao({ atual }: { atual: OrdemBusca }) {
  const router = useRouter();
  const params = useSearchParams();

  function trocar(ordem: string) {
    const atuais = new URLSearchParams(params.toString());

    if (ordem === 'relevancia') atuais.delete('ordem');
    else atuais.set('ordem', ordem);

    // Trocar a ordem embaralha o resultado inteiro, entao continuar na
    // pagina 4 nao teria sentido.
    atuais.delete('pagina');

    router.push(`/imoveis?${atuais.toString()}`);
  }

  return (
    <div className="campo-select">
      <label htmlFor="ordem" className="armadilha">
        Ordenar por
      </label>
      <Seletor
        id="ordem"
        rotulo="Ordenar por"
        valor={atual}
        aoMudar={trocar}
        opcoes={ORDENS.map((o) => ({ valor: o.chave, rotulo: o.rotulo }))}
      />
    </div>
  );
}
