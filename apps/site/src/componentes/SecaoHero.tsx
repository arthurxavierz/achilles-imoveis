'use client';

import { useEffect, useRef } from 'react';

/**
 * Abertura da home, com movimento ligado a rolagem.
 *
 * Publica uma unica variavel no elemento, `--rolagem`, que vai de 0 no
 * topo a 1 quando a abertura saiu inteira da tela. Todo o movimento
 * acontece no CSS a partir dela: o fundo sobe mais devagar que o texto,
 * o veu escurece e o conteudo se afasta.
 *
 * A conta roda dentro de requestAnimationFrame e nunca mais de uma vez
 * por quadro. Escrever transform direto no ouvinte de scroll e o erro
 * classico de parallax: o navegador recalcula layout no meio da rolagem
 * e o efeito trava justamente no celular, onde ele mais aparece.
 *
 * Quem pediu menos animacao no sistema recebe a abertura parada. O
 * conteudo e o mesmo; so o movimento nao acontece.
 */
export function SecaoHero({ children }: { children: React.ReactNode }) {
  const alvo = useRef<HTMLElement>(null);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;

    const semAnimacao =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (semAnimacao) return;

    let quadro = 0;
    let ultimo = -1;

    const medir = () => {
      quadro = 0;

      const altura = elemento.offsetHeight || window.innerHeight;
      const bruto = Math.min(1, Math.max(0, window.scrollY / altura));

      // Duas casas bastam para o olho. Sem o arredondamento, o valor muda
      // a cada pixel e o navegador repinta sem necessidade.
      const valor = Math.round(bruto * 100) / 100;
      if (valor === ultimo) return;

      ultimo = valor;
      elemento.style.setProperty('--rolagem', String(valor));
    };

    const agendar = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar, { passive: true });

    return () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <section className="hero" ref={alvo}>
      {children}
    </section>
  );
}
