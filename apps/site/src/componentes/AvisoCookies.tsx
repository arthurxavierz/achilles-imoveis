'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CHAVE = 'achilles:cookies';

/**
 * Aviso de cookies exigido pela LGPD.
 *
 * A escolha fica no localStorage do proprio visitante, e nao num cookie:
 * guardar o consentimento de cookie dentro de um cookie e o tipo de
 * contradicao que um auditor aponta na primeira leitura.
 *
 * Enquanto nao houver aceite, nenhum script de medicao (Analytics,
 * Pixel) deve ser carregado. Por isso o estado fica registrado com data:
 * serve de prova de quando o consentimento foi dado.
 */
export function AvisoCookies() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHAVE)) setVisivel(true);
    } catch {
      // Armazenamento bloqueado pelo navegador. Nao insiste.
    }
  }, []);

  function decidir(resposta: 'aceito' | 'essenciais') {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ resposta, em: new Date().toISOString() }));
    } catch {
      /* segue sem persistir */
    }
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div className="aviso-cookies" role="dialog" aria-label="Aviso de privacidade">
      <p>
        Usamos cookies para entender como você navega e melhorar sua experiência. Você pode aceitar
        todos ou manter apenas os essenciais. Detalhes na{' '}
        <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>

      <div className="cookies-acoes">
        <button className="btn" onClick={() => decidir('aceito')}>
          Aceitar
        </button>
        <button className="btn btn-contorno" onClick={() => decidir('essenciais')}>
          Só essenciais
        </button>
      </div>
    </div>
  );
}
