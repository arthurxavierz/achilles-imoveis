'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  /** Cabeçalho do bloco a que a opção pertence. Opções seguidas com o
   *  mesmo grupo ficam sob um único cabeçalho. */
  grupo?: string;
}

/**
 * Lista de escolha.
 *
 * Existe porque `<select>` nativo não é estilizável. O menu que ele abre
 * é desenhado pelo sistema operacional, não pela página: no Windows sai
 * branco e quadrado no meio de um site preto, e `<optgroup>` vira uma
 * faixa clara com o rótulo ilegível. Não há CSS que resolva — a única
 * saída é desenhar a lista.
 *
 * O que se ganha além da aparência: grupos com cabeçalho legível,
 * o item marcado visível, e no celular uma folha que sobe de baixo,
 * com alvos de 48px, em vez do seletor em roleta que esconde o
 * contexto.
 *
 * O que não se pode perder ao trocar o nativo, e está tudo aqui:
 * abrir com Enter, Espaço ou seta; andar com as setas; Home e End;
 * escolher com Enter; fechar com Esc devolvendo o foco ao botão;
 * digitar as primeiras letras para pular até a opção; e os papéis
 * ARIA que fazem o leitor de tela anunciar isto como uma lista de
 * escolha, e não como um botão qualquer.
 */
export function Seletor({
  valor,
  aoMudar,
  opcoes,
  rotulo,
  id,
  className,
  placeholder,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  opcoes: OpcaoSeletor[];
  /** Lido por leitor de tela; não aparece na tela. */
  rotulo: string;
  id?: string;
  className?: string;
  /** Texto quando nada está escolhido e não há opção de valor vazio. */
  placeholder?: string;
}) {
  const gerado = useId();
  const idLista = `${id ?? gerado}-lista`;

  const [aberto, setAberto] = useState(false);
  const [destacado, setDestacado] = useState(0);
  const [paraCima, setParaCima] = useState(false);
  /** Onde o gatilho esta na tela. A lista e posicionada a partir daqui. */
  const [ancora, setAncora] = useState<DOMRect | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  const gatilho = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const digitado = useRef({ texto: '', quando: 0 });

  const indiceAtual = Math.max(
    0,
    opcoes.findIndex((o) => o.valor === valor),
  );
  const escolhida = opcoes.find((o) => o.valor === valor);

  function abrir() {
    setDestacado(indiceAtual);

    /**
     * Abre para cima quando nao ha espaco embaixo.
     *
     * Sem isto, um seletor perto do rodape da tela abre uma lista que
     * sai pela borda inferior — e no caso da barra de busca do hero,
     * fica atras do aviso de cookies. Trezentos e vinte pixels e a
     * altura maxima da lista; se nao couber abaixo e couber acima, ela
     * inverte.
     */
    const caixaGatilho = gatilho.current?.getBoundingClientRect();
    if (caixaGatilho) {
      const abaixo = window.innerHeight - caixaGatilho.bottom;
      const acima = caixaGatilho.top;
      setParaCima(abaixo < 340 && acima > abaixo);
      setAncora(caixaGatilho);
    }

    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }

  function escolher(indice: number) {
    const opcao = opcoes[indice];
    if (!opcao) return;
    aoMudar(opcao.valor);
    fechar();
  }

  /**
   * Fechar ao clicar fora é trabalho do fundo, não de um ouvinte no
   * documento.
   *
   * Havia aqui um `mousedown` que fechava quando o clique caía fora de
   * `caixa`. Depois que a lista passou a ser renderizada no <body>, ela
   * deixou de estar dentro de `caixa` — então escolher uma opção
   * disparava primeiro o mousedown, que fechava a lista, e o clique
   * chegava no vazio. O seletor parecia ignorar o mouse.
   *
   * O fundo cobre a tela inteira logo abaixo da lista e já tem o
   * próprio onClick. Clique na lista: pega na lista. Clique em
   * qualquer outro lugar: pega no fundo. Não sobra caso para um
   * ouvinte global resolver.
   */
  useEffect(() => {
    if (!aberto) return;

    // Rolar a página com a lista aberta deixaria o menu longe do campo
    // que o abriu, porque a posição é medida uma vez na abertura.
    function aoRolar() {
      setAberto(false);
    }

    window.addEventListener('scroll', aoRolar, true);
    return () => window.removeEventListener('scroll', aoRolar, true);
  }, [aberto]);

  // A âncora é medida de novo a cada redimensionamento: girar o
  // celular ou arrastar a janela moveria o campo e deixaria a lista
  // apontando para o lugar antigo.
  useLayoutEffect(() => {
    if (!aberto) return;

    function medir() {
      const r = gatilho.current?.getBoundingClientRect();
      if (r) setAncora(r);
    }

    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [aberto]);

  // Mantém o item destacado visível quando se anda com as setas por
  // uma lista maior que a caixa.
  useEffect(() => {
    if (!aberto) return;
    const alvo = lista.current?.children[destacado] as HTMLElement | undefined;
    alvo?.scrollIntoView({ block: 'nearest' });
  }, [aberto, destacado]);

  /** Pula para a opção que começa com o que foi digitado. */
  function porDigitacao(tecla: string) {
    const agora = Date.now();
    // Um segundo de pausa começa uma busca nova: "sa" procura "Sala",
    // mas "s" ... pausa ... "s" percorre os que começam com S.
    const texto = agora - digitado.current.quando > 1000 ? tecla : digitado.current.texto + tecla;
    digitado.current = { texto, quando: agora };

    const alvo = opcoes.findIndex((o) =>
      o.rotulo
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .startsWith(texto),
    );

    if (alvo >= 0) {
      setDestacado(alvo);
      if (!aberto) aoMudar(opcoes[alvo].valor);
    }
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      if (aberto) {
        e.preventDefault();
        fechar();
      }
      return;
    }

    if (!aberto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        abrir();
        return;
      }
    } else {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        escolher(destacado);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDestacado((i) => Math.min(opcoes.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDestacado((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setDestacado(0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setDestacado(opcoes.length - 1);
        return;
      }
      if (e.key === 'Tab') {
        fechar(false);
        return;
      }
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      porDigitacao(e.key.toLowerCase());
    }
  }

  return (
    <div className={`seletor${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        id={id}
        ref={gatilho}
        className="seletor-gatilho"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-label={rotulo}
        onClick={() => (aberto ? fechar(false) : abrir())}
        onKeyDown={aoTeclar}
      >
        <span className="seletor-valor">
          {escolhida?.rotulo ?? placeholder ?? opcoes[0]?.rotulo ?? ''}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="seletor-seta">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {aberto &&
        montado &&
        /**
         * A lista sai do fluxo e vai para o <body>.
         *
         * Não é preciosismo: a barra de busca do hero usa
         * `backdrop-filter`, e backdrop-filter cria bloco de contenção
         * para descendentes `position: fixed`. A folha do celular, que
         * deveria colar no rodapé da tela, colava no rodapé da barra —
         * ficava a 145px do fim e sem a largura toda. O mesmo valeria
         * para qualquer ancestral com transform, filter ou overflow
         * hidden, e este site tem os três em vários lugares.
         *
         * Fora do body, a lista é posicionada pela medida do gatilho,
         * que é o que `ancora` guarda.
         */
        createPortal(
          <>
            {/* Fundo: no celular separa a folha da página; no desktop
                fica transparente e serve só para captar o clique fora. */}
            <div className="seletor-fundo" onClick={() => fechar(false)} aria-hidden="true" />

            <ul
              className="seletor-lista"
              data-para-cima={paraCima ? 'true' : undefined}
              id={idLista}
              role="listbox"
              aria-label={rotulo}
              ref={lista}
              tabIndex={-1}
              onKeyDown={aoTeclar}
              style={
                ancora
                  ? ({
                      '--ancora-x': `${ancora.left}px`,
                      '--ancora-y': `${ancora.bottom + 10}px`,
                      '--ancora-y-cima': `${window.innerHeight - ancora.top + 10}px`,
                      '--ancora-largura': `${ancora.width}px`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {opcoes.map((o, i) => {
                const abreGrupo = o.grupo && o.grupo !== opcoes[i - 1]?.grupo;

                return (
                  <li
                    key={o.valor || `vazio-${i}`}
                    role="option"
                    aria-selected={o.valor === valor}
                    data-destacado={i === destacado ? 'true' : undefined}
                    data-grupo={abreGrupo ? o.grupo : undefined}
                    className="seletor-opcao"
                    onMouseEnter={() => setDestacado(i)}
                    onClick={() => escolher(i)}
                  >
                    <span>{o.rotulo}</span>
                    {o.valor === valor && (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="seletor-marca">
                        <path
                          d="M4 12.5l5 5L20 6.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>
          </>,
          document.body,
        )}
    </div>
  );
}
