'use client';

import { useState } from 'react';

import { BotaoFavorito } from './BotaoFavorito';
import { IconeCheck, IconeCompartilhar, IconeImpressora } from './Icones';

/**
 * Salvar, compartilhar e imprimir.
 *
 * O compartilhamento usa a folha nativa do sistema quando existe, que no
 * celular abre WhatsApp, Instagram e mensagens direto. Onde nao existe,
 * cai para copiar o link, e a confirmacao aparece no proprio botao para
 * a pessoa saber que funcionou.
 */
export function AcoesImovel({
  imovelId,
  titulo,
  codigo,
}: {
  imovelId: string;
  titulo: string;
  codigo: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const url = window.location.href;
    const texto = `${titulo} (cód. ${codigo})`;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: texto, url });
        return;
      } catch {
        // A pessoa fechou a folha de compartilhamento. Nao e erro.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2600);
    } catch {
      // Sem permissao de area de transferencia: nada a fazer aqui,
      // o visitante ainda pode copiar da barra de enderecos.
    }
  }

  return (
    <div className="imovel-acoes-topo">
      <BotaoFavorito imovelId={imovelId} titulo={titulo} variante="linha" />

      <button className="btn-acao" onClick={compartilhar}>
        {copiado ? <IconeCheck /> : <IconeCompartilhar />}
        {copiado ? 'Link copiado' : 'Compartilhar'}
      </button>

      <button className="btn-acao" onClick={() => window.print()}>
        <IconeImpressora />
        Imprimir ficha
      </button>
    </div>
  );
}
