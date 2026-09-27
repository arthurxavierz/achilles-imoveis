'use client';

import { useEffect, useRef, useState } from 'react';

type Efeito = 'baixo' | 'esquerda' | 'direita' | 'zoom' | 'mascara' | 'cortina';

const CLASSES: Record<Efeito, string> = {
  baixo: 'revelar',
  esquerda: 'revelar revelar-lado',
  direita: 'revelar revelar-lado revelar-direita',
  zoom: 'revelar revelar-zoom',
  // A mascara descobre o bloco de baixo para cima, sem mover nada de
  // lugar. E o efeito certo para foto e grade: deslocar uma imagem
  // grande na entrada chama mais atencao para o movimento do que para
  // ela.
  mascara: 'revelar revelar-mascara',
  cortina: 'revelar revelar-mascara',
};

/**
 * Revela o conteudo quando ele entra na tela.
 *
 * Duas decisoes importantes:
 *
 * 1. O observador desconecta assim que o elemento aparece. Animar de
 *    volta quando o visitante rola para cima incomoda mais do que
 *    encanta, e mantem um observador vivo por elemento sem necessidade.
 *
 * 2. Se o navegador nao tiver IntersectionObserver, ou se a pessoa pediu
 *    menos animacao no sistema, o conteudo aparece direto. Animacao
 *    nunca pode ser a razao de alguem nao ver o texto.
 */
export function Revelar({
  children,
  efeito = 'baixo',
  atraso = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  efeito?: Efeito;
  /** Milissegundos de espera. Use para escalonar itens de uma lista. */
  atraso?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'header' | 'aside';
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  // A tag e escolhida por prop, entao o TypeScript nao consegue casar um
  // unico tipo de ref com todas as possibilidades. Tratar como
  // ElementType resolve sem espalhar casts pelo componente.
  const Componente = Tag as React.ElementType;

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
        if (entrada.isIntersecting) {
          setVisivel(true);
          observador.disconnect();
        }
      },
      // A margem negativa embaixo faz a animacao comecar quando o
      // elemento ja subiu um pouco, e nao no instante em que encosta na
      // borda da tela. O limiar baixo cobre o bloco alto, que nunca
      // chega a doze por cento visivel de uma vez.
      { threshold: 0.08, rootMargin: '0px 0px -80px 0px' },
    );

    observador.observe(elemento);

    /**
     * Rede de seguranca.
     *
     * Uma secao da home ficou invisivel em algumas maquinas e normal em
     * outras, e o mais provavel era problema de pintura na GPU. Mas
     * "mais provavel" nao e diagnostico, e enquanto a causa nao for
     * certa vale garantir o resultado: passado um tempo, se o elemento
     * estiver dentro da janela e ainda escondido, ele aparece na marra.
     *
     * A conferencia da posicao e o que impede a rede de virar um botao
     * de revelar a pagina inteira: sem ela, todo bloco la embaixo
     * apareceria junto e a revelacao por rolagem deixaria de existir.
     */
    const rede = setTimeout(() => {
      const caixa = elemento.getBoundingClientRect();
      const naTela = caixa.top < window.innerHeight && caixa.bottom > 0;
      if (naTela) setVisivel(true);
    }, 1500);

    return () => {
      clearTimeout(rede);
      observador.disconnect();
    };
  }, []);

  return (
    <Componente
      ref={alvo}
      className={`${CLASSES[efeito]}${visivel ? ' visivel' : ''}${className ? ` ${className}` : ''}`}
      style={atraso ? ({ '--atraso': `${atraso}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Componente>
  );
}
