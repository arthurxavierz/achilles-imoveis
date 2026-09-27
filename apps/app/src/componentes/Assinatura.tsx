import { AUTORIA } from '@imob/core';

/**
 * Credito de quem desenvolveu, no rodape do sistema.
 *
 * Fica em componente, e nao solto no layout, porque aparece em dois
 * lugares com cascas diferentes: dentro do painel, depois do conteudo da
 * pagina, e na tela de entrada, que nao passa pelo layout do painel.
 */
export function Assinatura() {
  return (
    <footer className="assinatura">
      Desenvolvido por {AUTORIA.nome}.{' '}
      <a href={AUTORIA.url} target="_blank" rel="noopener noreferrer">
        ({AUTORIA.arroba})
      </a>
    </footer>
  );
}
