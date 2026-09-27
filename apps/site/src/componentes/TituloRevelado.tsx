'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Titulo que sobe palavra por palavra quando entra na tela.
 *
 * Cada palavra vive dentro de uma mascara e sobe de baixo com um atraso
 * pequeno em relacao a anterior. E o mesmo gesto do titulo da abertura,
 * repetido ao longo da pagina, e e o que da ritmo a rolagem: o texto
 * chega, nao aparece.
 *
 * A palavra continua sendo uma unica palavra no HTML, com espaco de
 * verdade entre elas. Isso importa mais do que parece: dividir em letras
 * quebraria a leitura por leitor de tela e a selecao com o mouse.
 */
export function TituloRevelado({
  texto,
  como: Tag = 'h2',
  className = 'titulo-2',
  /** Trecho final que recebe o grifo dourado. */
  grifo,
  /** Trecho final em itálico dourado, para quando o grifo seria demais. */
  italico,
}: {
  texto: string;
  como?: 'h1' | 'h2' | 'h3';
  className?: string;
  grifo?: string;
  italico?: string;
}) {
  const alvo = useRef<HTMLHeadingElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;

    const semAnimacao =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (semAnimacao || typeof IntersectionObserver === 'undefined') {
      setVisivel(true);
      return;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVisivel(true);
        observador.disconnect();
      },
      { threshold: 0.25, rootMargin: '0px 0px -40px 0px' },
    );

    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const destaque = grifo ?? italico ?? '';
  const inicio = destaque ? texto.replace(destaque, '').trimEnd() : texto;

  const palavras = inicio.split(' ').filter(Boolean);
  const palavrasDestaque = destaque.split(' ').filter(Boolean);

  const Componente = Tag as React.ElementType;

  return (
    <Componente ref={alvo} className={`${className} titulo-revelado${visivel ? ' visivel' : ''}`}>
      {palavras.map((palavra, i) => (
        <span className="palavra" key={`${palavra}-${i}`}>
          <span style={{ '--atraso': `${i * 55}ms` } as React.CSSProperties}>{palavra}</span>
        </span>
      ))}

      {palavrasDestaque.length > 0 && (
        <span className={grifo ? 'grifo' : 'destaque-italico'}>
          {palavrasDestaque.map((palavra, i) => (
            <span className="palavra" key={`d-${palavra}-${i}`}>
              <span style={{ '--atraso': `${(palavras.length + i) * 55}ms` } as React.CSSProperties}>
                {palavra}
              </span>
            </span>
          ))}
        </span>
      )}
    </Componente>
  );
}
