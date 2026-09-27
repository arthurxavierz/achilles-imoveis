'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NomeMarca, SeloMarca } from '@/componentes/MarcaDemo';

import { iniciais, type Perfil } from '@imob/core';

import { supabaseNavegador } from '@/lib/supabase-navegador';
import {
  IconeAgenda,
  IconeAlvo,
  IconeChave,
  IconeEquipe,
  IconeFechar,
  IconeFinanceiro,
  IconeFunil,
  IconeImovel,
  IconeMenu,
  IconePainel,
  IconeRelatorio,
  IconeSair,
  IconeUsuario,
} from './Icones';

interface ItemMenu {
  href: string;
  rotulo: string;
  curto: string;
  Icone: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  area?: 'imoveis' | 'leads' | 'financeiro' | 'usuarios';
  somenteGestor?: boolean;
  /** Separa o dia a dia da leitura consolidada, na lateral. */
  grupo: 'Operação' | 'Gestão';
}

const MENU: ItemMenu[] = [
  { href: '/', rotulo: 'Visão geral', curto: 'Início', Icone: IconePainel, grupo: 'Operação' },
  { href: '/agenda', rotulo: 'Agenda', curto: 'Agenda', Icone: IconeAgenda, grupo: 'Operação' },
  {
    href: '/leads',
    rotulo: 'Leads',
    curto: 'Leads',
    Icone: IconeFunil,
    area: 'leads',
    grupo: 'Operação',
  },
  {
    href: '/prospeccao',
    rotulo: 'Prospecção',
    curto: 'Prospectar',
    Icone: IconeAlvo,
    area: 'leads',
    grupo: 'Operação',
  },
  {
    href: '/imoveis',
    rotulo: 'Imóveis',
    curto: 'Imóveis',
    Icone: IconeImovel,
    area: 'imoveis',
    grupo: 'Operação',
  },
  {
    href: '/proprietarios',
    rotulo: 'Proprietários',
    curto: 'Donos',
    Icone: IconeChave,
    area: 'imoveis',
    grupo: 'Operação',
  },
  {
    href: '/financeiro',
    rotulo: 'Financeiro',
    curto: 'Vendas',
    Icone: IconeFinanceiro,
    area: 'financeiro',
    grupo: 'Gestão',
  },
  {
    href: '/indicadores',
    rotulo: 'Indicadores',
    curto: 'Números',
    Icone: IconeRelatorio,
    somenteGestor: true,
    grupo: 'Gestão',
  },
  {
    href: '/equipe',
    rotulo: 'Equipe',
    curto: 'Equipe',
    Icone: IconeEquipe,
    somenteGestor: true,
    grupo: 'Gestão',
  },
];

const GRUPOS: ItemMenu['grupo'][] = ['Operação', 'Gestão'];

function liberado(item: ItemMenu, usuario: Perfil): boolean {
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
  if (item.somenteGestor && !gestor) return false;
  if (item.area && usuario.papel !== 'admin' && !usuario.permissoes?.[item.area]) return false;
  return true;
}

/** Ativo tambem nas subpaginas, para /agenda/123 manter a aba acesa. */
function estaAtivo(href: string, caminho: string): boolean {
  return href === '/' ? caminho === '/' : caminho.startsWith(href);
}

export function Navegacao({ usuario }: { usuario: Perfil }) {
  const caminho = usePathname();
  const router = useRouter();
  const [aberta, setAberta] = useState(false);

  const itens = MENU.filter((i) => liberado(i, usuario));
  // A barra do celular comporta cinco alvos sem apertar demais.
  const itensCelular = itens.slice(0, 5);

  /**
   * Rede de seguranca para a volta do navegador e para links de fora da
   * lateral. Fechar so por aqui nao bastava: usePathname() so muda quando
   * a navegacao termina de valer, e toda pagina do painel e force-dynamic
   * — entao entre o toque e a troca de rota cabia a consulta inteira ao
   * banco, com o fundo escuro por cima segurando os cliques. Tocar na aba
   * em que ja se esta era pior ainda: o caminho nao mudava nunca, e a
   * lateral ficava aberta ate alguem achar o X. Quem fecha de verdade e o
   * onClick de cada link, no toque.
   */
  useEffect(() => {
    setAberta(false);
  }, [caminho]);

  /**
   * O botao que abre a lateral vive no cabecalho de cada pagina, nao
   * aqui. Em vez de espalhar um contexto pelo app inteiro por causa de
   * um unico booleano, o botao dispara um evento e a lateral escuta.
   */
  useEffect(() => {
    const abrir = () => setAberta(true);
    window.addEventListener('achilles:abrir-menu', abrir);
    return () => window.removeEventListener('achilles:abrir-menu', abrir);
  }, []);

  useEffect(() => {
    document.body.style.overflow = aberta ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [aberta]);

  async function sair() {
    await supabaseNavegador().auth.signOut();
    router.replace('/entrar');
    router.refresh();
  }

  return (
    <>
      <aside className={`lateral${aberta ? ' aberta' : ''}`}>
        <div className="lateral-marca">
          <SeloMarca />
          <div style={{ minWidth: 0 }}>
            <strong><NomeMarca padrao="achilles" /></strong>
            <span>gestão</span>
          </div>
          <button
            className="btn-icone somente-celular empurra"
            style={{ color: 'rgba(255,255,255,.6)' }}
            onClick={() => setAberta(false)}
            aria-label="Fechar menu"
          >
            <IconeFechar />
          </button>
        </div>

        {GRUPOS.map((grupo) => {
          const doGrupo = itens.filter((i) => i.grupo === grupo);
          if (doGrupo.length === 0) return null;

          return (
            <nav key={grupo} className="lateral-grupo">
              <p className="lateral-grupo-titulo">{grupo}</p>
              {doGrupo.map(({ href, rotulo, Icone }) => (
                <Link
                  key={href}
                  href={href}
                  className="lateral-item"
                  onClick={() => setAberta(false)}
                  aria-current={estaAtivo(href, caminho) ? 'page' : undefined}
                >
                  <Icone />
                  {rotulo}
                </Link>
              ))}
            </nav>
          );
        })}

        <div className="lateral-rodape">
          <Link href="/perfil" className="cartao-usuario" onClick={() => setAberta(false)}>
            <span className="avatar">{iniciais(usuario.nome)}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>{usuario.nome}</strong>
              <span>{usuario.papel}</span>
            </span>
          </Link>

          <button
            className="lateral-item"
            onClick={sair}
            style={{ width: '100%', marginTop: 4 }}
          >
            <IconeSair />
            Sair do sistema
          </button>
        </div>
      </aside>

      {aberta && (
        <div
          className="fundo-escuro fundo-menu somente-celular"
          onClick={() => setAberta(false)}
          aria-hidden="true"
        />
      )}

      <div className="barra-inferior">
        <nav aria-label="Navegação principal">
          {itensCelular.map(({ href, curto, Icone }) => (
            <Link
              key={href}
              href={href}
              className="item-inferior"
              onClick={() => setAberta(false)}
              aria-current={estaAtivo(href, caminho) ? 'page' : undefined}
            >
              <Icone />
              {curto}
            </Link>
          ))}
          {itensCelular.length < 5 && (
            <Link
              href="/perfil"
              className="item-inferior"
              aria-current={caminho === '/perfil' ? 'page' : undefined}
            >
              <IconeUsuario />
              Perfil
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
