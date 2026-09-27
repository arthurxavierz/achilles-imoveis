'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { ImovelPublico } from '@imob/core';
import { brl, precoVigente } from '@imob/core';

import { CartaoImovel } from './CartaoImovel';
import { IconeCoracao, IconeSeta, IconeWhatsApp } from './Icones';
import { useFavoritos } from '@/lib/favoritos';
import { linkWhatsApp } from '@/lib/site';

/**
 * Lista de imoveis salvos.
 *
 * A lista de ids vive no navegador, entao o servidor nao pode renderizar
 * esta pagina pronta: os dados chegam depois, por /api/imoveis. O
 * esqueleto de carregamento existe para a pagina nao dar um salto quando
 * os cartoes aparecem.
 */
export function ListaFavoritos() {
  const { ids, pronto, limpar } = useFavoritos();
  const [imoveis, setImoveis] = useState<ImovelPublico[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!pronto) return;

    if (ids.length === 0) {
      setImoveis([]);
      return;
    }

    let cancelado = false;

    fetch(`/api/imoveis?ids=${ids.join(',')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('falha'))))
      .then((dados) => {
        if (!cancelado) setImoveis(dados.imoveis ?? []);
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      });

    // Se a pessoa favoritar outro imovel enquanto esta requisicao ainda
    // esta no ar, a resposta antiga nao pode sobrescrever a nova.
    return () => {
      cancelado = true;
    };
  }, [ids, pronto]);

  if (!pronto || (imoveis === null && !erro)) {
    return (
      <div className="grade" style={{ marginTop: 40 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="esqueleto" style={{ height: 400 }} />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="estado-vazio" style={{ marginTop: 40 }}>
        <h2 className="titulo-3">Não conseguimos carregar sua lista</h2>
        <p>Atualize a página. Se continuar assim, fale com um consultor pelo WhatsApp.</p>
      </div>
    );
  }

  if (!imoveis || imoveis.length === 0) {
    return (
      <div className="estado-vazio" style={{ marginTop: 40 }}>
        <IconeCoracao />
        <h2 className="titulo-3">Você ainda não salvou nenhum imóvel</h2>
        <p>
          Enquanto navega pela carteira, toque no coração dos imóveis que chamarem sua atenção. Eles
          aparecem aqui para você comparar com calma.
        </p>
        <Link className="btn" href="/imoveis" style={{ marginTop: 26 }}>
          Ver imóveis disponíveis
          <IconeSeta />
        </Link>
      </div>
    );
  }

  const total = imoveis.reduce((soma, i) => soma + precoVigente(i).valor, 0);

  const mensagem = linkWhatsApp(
    `Olá! Separei ${imoveis.length} ${imoveis.length === 1 ? 'imóvel' : 'imóveis'} no site e gostaria de conversar sobre ${imoveis.length === 1 ? 'ele' : 'eles'}:\n\n` +
      imoveis.map((i) => `${i.codigo} - ${i.titulo} (${brl(precoVigente(i).valor)})`).join('\n'),
  );

  return (
    <>
      <div className="barra-listagem">
        <p className="contagem">
          <strong>{imoveis.length}</strong> {imoveis.length === 1 ? 'imóvel salvo' : 'imóveis salvos'}
          {total > 0 && <> · soma de {brl(total)}</>}
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-icone" onClick={limpar}>
            Limpar lista
          </button>
          <a className="btn btn-zap" href={mensagem} target="_blank" rel="noopener noreferrer">
            <IconeWhatsApp style={{ width: 16, height: 16 }} />
            Enviar para um consultor
          </a>
        </div>
      </div>

      <div className="grade">
        {imoveis.map((imovel, i) => (
          <CartaoImovel key={imovel.id} imovel={imovel} prioridade={i < 3} />
        ))}
      </div>
    </>
  );
}
