'use client';

import { useEffect, useState } from 'react';

import type { ImovelPublico } from '@imob/core';

import { CartaoImovel } from './CartaoImovel';
import { Esteira } from './Esteira';

/** Quantos cartões o trilho mostra por visita. */
const QUANTOS = 7;

/**
 * Vitrine de destaque, sorteada a cada carregamento.
 *
 * O sorteio acontece depois que a página monta, e não no servidor, por
 * causa do cache. A home é regenerada a cada cinco minutos e servida
 * pronta do CDN: sorteando no servidor, a mesma seleção ficaria de pé
 * por cinco minutos e quem recarregasse veria sempre os mesmos sete.
 *
 * A primeira pintura usa os primeiros do lote, na ordem em que o banco
 * mandou. Isso não é detalhe de estilo: o HTML do servidor e a primeira
 * renderização do navegador precisam bater, e sortear já na montagem
 * faria o React reclamar de conteúdo divergente. Sorteado no efeito, a
 * troca acontece um quadro depois, com o conteúdo já visível.
 */
export function VitrineDestaque({ lote }: { lote: ImovelPublico[] }) {
  const [escolhidos, setEscolhidos] = useState(() => lote.slice(0, QUANTOS));

  useEffect(() => {
    setEscolhidos(sortear(lote, QUANTOS));
  }, [lote]);

  return (
    <Esteira rotulo="Imóveis em destaque">
      {escolhidos.map((imovel) => (
        <CartaoImovel key={imovel.id} imovel={imovel} />
      ))}
    </Esteira>
  );
}

/**
 * Sorteia sem repetir.
 *
 * Embaralhamento de Fisher-Yates interrompido na quantidade pedida: para
 * tirar sete de trinta e seis não há motivo de embaralhar os trinta e
 * seis. Sortear por índice aleatório e torcer para não repetir seria o
 * caminho fácil, e é o que costuma entregar o mesmo imóvel duas vezes no
 * mesmo trilho.
 */
function sortear<T>(itens: T[], quantos: number): T[] {
  const copia = [...itens];
  const fim = Math.min(quantos, copia.length);

  for (let i = 0; i < fim; i++) {
    const j = i + Math.floor(Math.random() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia.slice(0, fim);
}
