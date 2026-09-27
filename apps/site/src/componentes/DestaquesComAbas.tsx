'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ImovelPublico } from '@imob/core';

import { CartaoImovel } from './CartaoImovel';
import { IconeSeta } from './Icones';

/**
 * Imoveis em destaque, com troca entre a curadoria e as novidades.
 *
 * As duas listas chegam prontas do servidor e a troca acontece sem
 * consulta nova. Sao dezesseis cartoes no total, o que cabe folgado no
 * HTML e evita um piscar de carregamento ao clicar numa aba que o
 * visitante espera ser instantanea.
 */
export function DestaquesComAbas({
  destaques,
  recentes,
}: {
  destaques: ImovelPublico[];
  recentes: ImovelPublico[];
}) {
  const [aba, setAba] = useState<'destaques' | 'recentes'>('destaques');

  const lista = aba === 'destaques' ? destaques : recentes;

  return (
    <>
      <div className="cabecalho-secao cabecalho-secao-centro">
        <div>
          <span className="rotulo">Seleção da casa</span>
          <h2 className="titulo-2">
            Imóveis em <span className="grifo">destaque</span>
          </h2>
        </div>

        <div className="abas" role="tablist" aria-label="Filtrar destaques">
          <button
            role="tab"
            aria-selected={aba === 'destaques'}
            onClick={() => setAba('destaques')}
          >
            Destaques
          </button>
          <button role="tab" aria-selected={aba === 'recentes'} onClick={() => setAba('recentes')}>
            Novidades
          </button>
        </div>
      </div>

      <div className="grade grade-4">
        {lista.map((imovel, i) => (
          <CartaoImovel key={imovel.id} imovel={imovel} prioridade={i < 4} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 44 }}>
        <Link className="btn btn-contorno" href="/imoveis">
          Ver todos os imóveis
          <IconeSeta />
        </Link>
      </div>
    </>
  );
}
