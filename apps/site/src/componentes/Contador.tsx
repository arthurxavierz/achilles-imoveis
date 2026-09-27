'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Numero que sobe de zero ate o valor final quando entra na tela.
 *
 * Usa requestAnimationFrame em vez de setInterval: o navegador sincroniza
 * com a taxa de atualizacao da tela, entao a contagem fica suave em 120 Hz
 * e nao gasta quadro em aba de fundo.
 */
export function Contador({
  ate,
  duracao = 1600,
  prefixo = '',
  sufixo = '',
  decimais = 0,
}: {
  ate: number;
  duracao?: number;
  prefixo?: string;
  sufixo?: string;
  decimais?: number;
}) {
  const alvo = useRef<HTMLSpanElement>(null);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;

    const semAnimacao =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (semAnimacao || typeof IntersectionObserver === 'undefined') {
      setValor(ate);
      return;
    }

    let quadro = 0;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        observador.disconnect();

        const inicio = performance.now();

        const passo = (agora: number) => {
          const progresso = Math.min(1, (agora - inicio) / duracao);
          // Desaceleracao no fim: o numero chega ao valor final sem
          // parada seca, como um velocimetro assentando.
          const suave = 1 - Math.pow(1 - progresso, 3);
          setValor(ate * suave);
          if (progresso < 1) quadro = requestAnimationFrame(passo);
        };

        quadro = requestAnimationFrame(passo);
      },
      { threshold: 0.5 },
    );

    observador.observe(elemento);

    return () => {
      observador.disconnect();
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ate, duracao]);

  const formatado = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });

  return (
    <span ref={alvo}>
      {prefixo}
      {formatado}
      {sufixo}
    </span>
  );
}
