'use client';

import { useCallback, useRef } from 'react';

/**
 * Halo que segue o ponteiro sobre os cartoes.
 *
 * Um unico ouvinte no container, e nao um por cartao. Numa listagem de
 * doze imoveis a diferenca e doze ouvintes de movimento do mouse contra
 * um, e movimento do mouse dispara centenas de vezes por segundo.
 *
 * O efeito e proposital em telas com ponteiro. No celular ele nao existe:
 * nao ha para onde apontar, e um brilho fixo no canto do cartao so
 * confundiria. O CSS resolve isso com a consulta de hover.
 */
export function BrilhoPonteiro({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const quadro = useRef(0);

  const aoMover = useCallback((evento: React.MouseEvent<HTMLDivElement>) => {
    if (quadro.current) return;

    const { clientX, clientY } = evento;

    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0;

      const alvo = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-brilho]');
      if (!alvo) return;

      const caixa = alvo.getBoundingClientRect();
      alvo.style.setProperty('--px', `${clientX - caixa.left}px`);
      alvo.style.setProperty('--py', `${clientY - caixa.top}px`);
    });
  }, []);

  return (
    <div ref={area} className={`area-brilho ${className}`.trim()} onMouseMove={aoMover}>
      {children}
    </div>
  );
}
