'use client';

import { brl } from '@imob/core';

import { IconeWhatsApp } from './Icones';

/**
 * Barra fixa no rodape do celular, na pagina do imovel.
 *
 * No desktop o preco e o botao de contato ficam sempre a vista, no
 * painel lateral fixo. No celular esse painel desce para o fim da
 * pagina, e quem esta lendo a descricao no meio do caminho perde de
 * vista tanto o preco quanto o botao. Esta barra devolve os dois.
 */
export function BarraMovel({
  valor,
  sufixo,
  titulo,
  linkWhats,
}: {
  valor: number;
  sufixo: string;
  titulo: string;
  linkWhats: string;
}) {
  return (
    <div className="barra-movel">
      <div className="barra-movel-valor">
        {valor > 0 ? (
          <strong>
            {brl(valor)}
            {sufixo}
          </strong>
        ) : (
          <strong>Sob consulta</strong>
        )}
        <span>{titulo}</span>
      </div>

      <a className="btn btn-zap" href={linkWhats} target="_blank" rel="noopener noreferrer">
        <IconeWhatsApp style={{ width: 16, height: 16 }} />
        Falar
      </a>
    </div>
  );
}
