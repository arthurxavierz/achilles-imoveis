'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ImovelPublico } from '@imob/core';
import { urlFoto } from '@imob/db';

import { IconeFechar, IconeImagem, IconeSeta, IconeSetaEsquerda } from './Icones';

/**
 * Galeria do imovel.
 *
 * Mosaico de quatro fotos que abre um visor de tela cheia ao clique. O
 * visor e a parte que importa: numa vitrine de alto padrao a foto e o
 * argumento de venda, e ver uma miniatura de trezentos pixels nao decide
 * ninguem.
 *
 * Navegacao por seta do teclado e por gesto de arrastar, porque metade
 * das visitas vem do celular e ali ninguem procura botao.
 *
 * O visor vai para o <body> por portal, e nao fica onde o componente
 * mora. Motivo concreto: a pagina do imovel envolve a galeria num
 * <Revelar>, e essa div tem "will-change: transform" para a animacao de
 * entrada. Qualquer will-change de transform cria um bloco de contencao
 * novo, e um filho "position: fixed" passa a se prender a essa div em
 * vez da janela — o visor abria do tamanho da galeria, com o cabecalho
 * do site e o botao do WhatsApp por cima. No <body> nao ha ancestral
 * transformado, e "tela cheia" volta a ser a tela inteira.
 */
export function GaleriaImovel({ imovel }: { imovel: ImovelPublico }) {
  const fotos = (imovel.fotos ?? [])
    .map((f) => ({ url: urlFoto(f.path), legenda: f.legenda }))
    .filter((f): f is { url: string; legenda: string | null } => Boolean(f.url));

  const [visor, setVisor] = useState(false);
  const [atual, setAtual] = useState(0);
  const [toqueX, setToqueX] = useState<number | null>(null);
  // createPortal so roda no navegador. Sem esta trava a geracao estatica
  // quebra ao procurar document no servidor.
  const [montado, setMontado] = useState(false);
  /**
   * Largura natural da foto aberta, medida quando ela carrega.
   *
   * As fotos desta carteira vieram do portal antigo em 550px de largura,
   * algumas em 1280px. Deixar o CSS esticar uma delas para os 1400px do
   * palco e o que fazia a imagem parecer quebrada: nao ha pixel para
   * inventar. Com a medida em maos da para limitar o crescimento.
   */
  const [larguraNatural, setLarguraNatural] = useState<number | null>(null);
  const tiras = useRef<HTMLDivElement>(null);

  const total = fotos.length;

  useEffect(() => setMontado(true), []);

  const andar = useCallback(
    (passo: number) => {
      if (total === 0) return;
      setAtual((i) => (i + passo + total) % total);
      setLarguraNatural(null);
    },
    [total],
  );

  useEffect(() => {
    if (!visor) return;

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setVisor(false);
      if (e.key === 'ArrowRight') andar(1);
      if (e.key === 'ArrowLeft') andar(-1);
    }

    document.addEventListener('keydown', aoTeclar);

    // Trava a rolagem sem deslocar a pagina: so esconder o overflow
    // devolve ao body a largura da barra de rolagem, e o conteudo inteiro
    // pula alguns pixels para o lado ao abrir e ao fechar o visor.
    const larguraBarra = window.innerWidth - document.documentElement.clientWidth;
    const overflowAntes = document.body.style.overflow;
    const paddingAntes = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (larguraBarra > 0) document.body.style.paddingRight = `${larguraBarra}px`;

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAntes;
      document.body.style.paddingRight = paddingAntes;
    };
  }, [visor, andar]);

  // A miniatura da foto aberta se centraliza sozinha. Com vinte e cinco
  // fotos a tira ativa saia da area visivel e a pessoa perdia a
  // referencia de onde estava na sequencia.
  useEffect(() => {
    if (!visor) return;
    const ativa = tiras.current?.querySelector<HTMLElement>('[aria-current="true"]');
    ativa?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [visor, atual]);

  function abrir(indice: number) {
    if (total === 0) return;
    setAtual(indice);
    setLarguraNatural(null);
    setVisor(true);
  }

  function irPara(indice: number) {
    setAtual(indice);
    setLarguraNatural(null);
  }

  const principal = fotos[0];
  const secundarias = fotos.slice(1, 4);

  return (
    <>
      <div className="galeria">
        <div
          className="galeria-item galeria-principal"
          onClick={() => abrir(0)}
          role={total > 0 ? 'button' : undefined}
          tabIndex={total > 0 ? 0 : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              abrir(0);
            }
          }}
          aria-label={total > 0 ? `Ver as ${total} fotos de ${imovel.titulo}` : undefined}
        >
          {principal ? (
            <Image
              src={principal.url}
              alt={principal.legenda ?? imovel.titulo}
              fill
              sizes="(max-width: 900px) 100vw, 66vw"
              style={{ objectFit: 'cover' }}
              priority
            />
          ) : (
            <div className="galeria-vazia" aria-hidden="true">
              B
            </div>
          )}
        </div>

        {[0, 1, 2].map((i) => {
          const foto = secundarias[i];
          const ehUltima = i === 2 && total > 4;

          return (
            <div
              key={i}
              className={`galeria-item${i === 0 ? ' galeria-secundaria-movel' : ''}`}
              onClick={() => abrir(Math.min(i + 1, total - 1))}
              role={foto ? 'button' : undefined}
              tabIndex={foto ? 0 : undefined}
              aria-label={foto ? `Abrir foto ${i + 2}` : undefined}
            >
              {foto ? (
                <>
                  <Image
                    src={foto.url}
                    alt={foto.legenda ?? `${imovel.titulo}, foto ${i + 2}`}
                    fill
                    sizes="33vw"
                    style={{ objectFit: 'cover' }}
                  />
                  {ehUltima && <span className="galeria-mais">mais {total - 4} fotos</span>}
                </>
              ) : (
                <div className="galeria-vazia" style={{ fontSize: '2rem' }} aria-hidden="true">
                  <IconeImagem style={{ width: 30, height: 30 }} />
                </div>
              )}
            </div>
          );
        })}

        {/* Botao explicito de abrir. O mosaico ja e clicavel, mas num
            imovel com vinte e cinco fotos convem dizer quantas existem
            antes da pessoa descobrir por acidente. */}
        {total > 0 && (
          <button className="galeria-abrir" onClick={() => abrir(0)}>
            <IconeImagem />
            Ver {total} {total === 1 ? 'foto' : 'fotos'}
          </button>
        )}
      </div>

      {montado &&
        visor &&
        total > 0 &&
        createPortal(
          <div
            className="visor"
            role="dialog"
            aria-modal="true"
            aria-label="Fotos do imóvel"
            // Clicar no vazio fecha, que e o gesto que todo mundo tenta
            // primeiro. O palco e as tiras tratam o proprio clique.
            onClick={(e) => {
              if (e.target === e.currentTarget) setVisor(false);
            }}
          >
            <header className="visor-topo">
              <span className="visor-contador">
                {atual + 1} <i aria-hidden="true">/</i> {total}
              </span>
              <span className="visor-legenda">{fotos[atual].legenda ?? imovel.titulo}</span>
              <button
                className="btn-icone"
                onClick={() => setVisor(false)}
                aria-label="Fechar fotos"
              >
                <IconeFechar />
              </button>
            </header>

            <div
              className="visor-palco"
              onClick={(e) => {
                if (e.target === e.currentTarget) setVisor(false);
              }}
              onTouchStart={(e) => setToqueX(e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (toqueX === null) return;
                const distancia = e.changedTouches[0].clientX - toqueX;
                // Quarenta pixels separa um arrastar de um toque trêmulo.
                if (Math.abs(distancia) > 40) andar(distancia > 0 ? -1 : 1);
                setToqueX(null);
              }}
            >
              {total > 1 && (
                <button
                  className="visor-nav"
                  data-lado="esquerda"
                  onClick={() => andar(-1)}
                  aria-label="Foto anterior"
                >
                  <IconeSetaEsquerda />
                </button>
              )}

              {/* A chave por URL forca um <img> novo a cada troca. Sem
                  ela o navegador mantem a foto anterior desenhada
                  enquanto a proxima carrega, e a transicao fica com um
                  quadro errado no meio. */}
              <Image
                key={fotos[atual].url}
                src={fotos[atual].url}
                alt={fotos[atual].legenda ?? `${imovel.titulo}, foto ${atual + 1}`}
                width={1600}
                height={1200}
                quality={90}
                className="visor-foto"
                priority
                onLoad={(e) => setLarguraNatural(e.currentTarget.naturalWidth || null)}
                /**
                 * O teto de crescimento vira variavel de CSS, e o estilo
                 * cruza com o limite do palco por min(). Uma foto de
                 * 550px para de esticar em 880 e continua nitida; uma de
                 * 1280 vai ate onde o palco deixar.
                 *
                 * 1.6x e o ponto em que o borrado ainda nao aparece numa
                 * tela comum. Sem teto nenhum, o palco de 1400px pegava
                 * a foto de 550 e esticava duas vezes e meia.
                 */
                style={
                  {
                    '--teto': larguraNatural ? `${Math.round(larguraNatural * 1.6)}px` : '100%',
                  } as React.CSSProperties
                }
              />

              {total > 1 && (
                <button
                  className="visor-nav"
                  data-lado="direita"
                  onClick={() => andar(1)}
                  aria-label="Próxima foto"
                >
                  <IconeSeta />
                </button>
              )}
            </div>

            {total > 1 && (
              <div className="visor-tiras" ref={tiras}>
                {fotos.map((f, i) => (
                  <button
                    key={`${f.url}-${i}`}
                    className="visor-tira"
                    aria-current={i === atual}
                    onClick={() => irPara(i)}
                    aria-label={`Ir para a foto ${i + 1}`}
                  >
                    <Image
                      src={f.url}
                      alt=""
                      width={192}
                      height={132}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
