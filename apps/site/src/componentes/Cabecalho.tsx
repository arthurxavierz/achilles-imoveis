'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useFavoritos } from '@/lib/favoritos';
import { ATALHOS_MENU, NAVEGACAO, SITE, linkWhatsApp, telefoneVisivel } from '@/lib/site';
import { IconeCoracao, IconeInstagram, IconeTelefone } from './Icones';
import { Marca } from './Marca';

/**
 * Cabecalho fixo.
 *
 * Sobre o hero da home ele e transparente, com um veu escuro por tras do
 * texto para a foto respirar sem engolir a leitura. Assim que o visitante
 * rola, ganha fundo quase opaco. Nas demais paginas nasce solido, porque
 * nao ha imagem embaixo dele.
 *
 * A navegacao inteira mora no painel de tela cheia, e nao numa fileira de
 * links. Foi a escolha da vitrine que estamos reconstruindo, e ela se
 * sustenta: com condominios, cidades e tipos de imovel, a lista de
 * destinos nao cabe numa linha, e espremer tudo la vira menu ilegivel no
 * notebook.
 *
 * A barra ficou com tres coisas: marca, imoveis salvos e menu. Telefone e
 * rede social saem daqui de proposito. Sobre uma foto de tela cheia, cada
 * texto a mais no topo disputa atencao com o titulo, e contato e algo que
 * a pessoa procura depois de ver imovel, nao antes.
 */
export function Cabecalho() {
  const caminho = usePathname();
  const [rolou, setRolou] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const favoritos = useFavoritos();

  const temHero = caminho === '/';
  const solido = rolou || !temHero || menuAberto;

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  // Trocar de pagina fecha o menu.
  useEffect(() => {
    setMenuAberto(false);
  }, [caminho]);

  // Com o menu aberto em tela cheia, o fundo nao deve rolar junto.
  useEffect(() => {
    document.body.style.overflow = menuAberto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuAberto]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAberto(false);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  return (
    <>
      <header className={`cabecalho ${solido ? 'cabecalho-solido' : 'cabecalho-transparente'}`}>
        <div className="container">
          <div className="cabecalho-interno">
            <Marca rotulo={`${SITE.nome}, ir para a página inicial`} />

            <div className="cabecalho-acoes">
              <Link
                href="/favoritos"
                className="btn-icone"
                aria-label={`Imóveis salvos${favoritos.pronto ? `: ${favoritos.total}` : ''}`}
                data-ativo={favoritos.total > 0 ? 'true' : 'false'}
              >
                <IconeCoracao />
                {favoritos.pronto && favoritos.total > 0 && <span>{favoritos.total}</span>}
              </Link>

              <button
                className="btn-menu"
                onClick={() => setMenuAberto((v) => !v)}
                aria-expanded={menuAberto}
                aria-controls="painel-menu"
                aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
              >
                <i aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav
        id="painel-menu"
        className={`painel-menu${menuAberto ? ' aberto' : ''}`}
        aria-label="Navegação principal"
        aria-hidden={!menuAberto}
      >
        <div className="painel-menu-grade">
          <div className="menu-coluna">
            <h3>Navegar</h3>
            {NAVEGACAO.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="menu-link"
                tabIndex={menuAberto ? 0 : -1}
              >
                {item.rotulo}
              </Link>
            ))}
          </div>

          <div className="menu-coluna">
            <h3>Buscas rápidas</h3>
            {ATALHOS_MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="menu-atalho"
                tabIndex={menuAberto ? 0 : -1}
              >
                <span>{item.rotulo}</span>
                <span>{item.apoio}</span>
              </Link>
            ))}

            <a
              className="btn btn-ouro"
              style={{ marginTop: 30 }}
              href={linkWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={menuAberto ? 0 : -1}
            >
              Falar com um consultor
            </a>

            {/* O telefone e o Instagram saíram da barra do topo, que
                ficou só com marca, salvos e menu. Eles não sumiram do
                site: vivem aqui e no rodapé, que é onde alguém procura
                contato depois de já ter olhado imóvel. */}
            <div className="menu-contatos">
              <a href={`tel:+55${SITE.whatsapp}`}>
                <IconeTelefone />
                {telefoneVisivel()}
              </a>
              <a href={SITE.redes.instagram} target="_blank" rel="noopener noreferrer">
                <IconeInstagram />
                Instagram
              </a>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
