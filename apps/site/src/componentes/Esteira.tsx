'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { IconeSeta, IconeSetaEsquerda } from './Icones';

/**
 * Trilho horizontal com setas.
 *
 * A rolagem nativa faz o trabalho pesado: no celular a pessoa arrasta com
 * o dedo, e o scroll-snap do CSS encaixa o cartao. As setas existem para
 * o desktop, onde nao ha gesto de arrastar e uma barra de rolagem
 * horizontal fina passa despercebida.
 *
 * Cada seta anda uma "pagina" visivel, e nao um cartao. Andar de um em um
 * exige muitos cliques quando cabem quatro na tela.
 */
export function Esteira({
  children,
  rotulo,
}: {
  children: React.ReactNode;
  /** Descreve a lista para quem usa leitor de tela. */
  rotulo: string;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const [noInicio, setNoInicio] = useState(true);
  const [noFim, setNoFim] = useState(false);

  const conferir = useCallback(() => {
    const el = trilho.current;
    if (!el) return;

    setNoInicio(el.scrollLeft <= 8);
    // A folga de dois pixels evita que o arredondamento do navegador
    // deixe a seta acesa quando ja chegou ao fim.
    setNoFim(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;

    conferir();
    el.addEventListener('scroll', conferir, { passive: true });

    const observador = new ResizeObserver(conferir);
    observador.observe(el);

    return () => {
      el.removeEventListener('scroll', conferir);
      observador.disconnect();
    };
  }, [conferir]);

  function andar(direcao: 1 | -1) {
    const el = trilho.current;
    if (!el) return;
    el.scrollBy({ left: direcao * el.clientWidth * 0.86, behavior: 'smooth' });
  }

  return (
    <div className="esteira-envelope">
      <button
        className="esteira-controle"
        data-lado="esquerda"
        onClick={() => andar(-1)}
        disabled={noInicio}
        aria-label="Voltar"
      >
        <IconeSetaEsquerda />
      </button>

      <div className="esteira-rolagem" ref={trilho} role="region" aria-label={rotulo} tabIndex={0}>
        {children}
      </div>

      <button
        className="esteira-controle"
        data-lado="direita"
        onClick={() => andar(1)}
        disabled={noFim}
        aria-label="Avançar"
      >
        <IconeSeta />
      </button>
    </div>
  );
}
