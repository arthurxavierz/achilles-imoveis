'use client';

import { IconeMenu } from './Icones';

/**
 * Barra do topo de cada pagina do painel.
 *
 * Fica em cada pagina, e nao no layout, porque titulo e acoes mudam a
 * cada tela e o layout do Next e renderizado no servidor uma vez so.
 */
export function CabecalhoPagina({
  titulo,
  children,
}: {
  titulo: string;
  /** Botoes de acao, alinhados a direita. */
  children?: React.ReactNode;
}) {
  return (
    <header className="topo">
      <button
        className="btn-icone somente-celular"
        onClick={() => window.dispatchEvent(new CustomEvent('achilles:abrir-menu'))}
        aria-label="Abrir menu"
      >
        <IconeMenu />
      </button>

      <h1>{titulo}</h1>

      {children && <div className="topo-acoes">{children}</div>}
    </header>
  );
}
