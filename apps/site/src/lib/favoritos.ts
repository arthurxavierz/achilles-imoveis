'use client';

import { useCallback, useEffect, useState } from 'react';

const CHAVE = 'achilles:favoritos';
const EVENTO = 'achilles:favoritos-alterados';

/**
 * Lista de imoveis salvos pelo visitante.
 *
 * Fica no localStorage do navegador, sem cadastro e sem servidor. Isso e
 * proposital: pedir login para salvar um imovel afasta o visitante logo
 * no momento de maior interesse. Quando ele decidir falar com a gente, o
 * formulario ja leva junto a lista do que ele salvou.
 *
 * O evento customizado sincroniza todas as instancias do hook na mesma
 * aba. Sem ele, favoritar pelo cartao nao atualizaria o contador do
 * cabecalho, porque o "storage" do navegador so avisa outras abas.
 */

function ler(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((i) => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

function gravar(lista: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Navegacao anonima com armazenamento cheio ou bloqueado.
    // O favorito nao persiste, mas nada quebra.
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function useFavoritos() {
  // Comeca vazio nos dois lados. Se lesse o localStorage direto no
  // estado inicial, o HTML do servidor e o do navegador ficariam
  // diferentes e o React acusaria erro de hidratacao.
  const [ids, setIds] = useState<string[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setIds(ler());
    setPronto(true);

    const atualizar = () => setIds(ler());
    window.addEventListener(EVENTO, atualizar);
    window.addEventListener('storage', atualizar);

    return () => {
      window.removeEventListener(EVENTO, atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, []);

  const alternar = useCallback((id: string) => {
    const atual = ler();
    const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
    gravar(nova);
  }, []);

  const remover = useCallback((id: string) => {
    gravar(ler().filter((x) => x !== id));
  }, []);

  const limpar = useCallback(() => gravar([]), []);

  return {
    ids,
    total: ids.length,
    /** Falso durante a primeira renderizacao, antes de ler o navegador. */
    pronto,
    tem: (id: string) => ids.includes(id),
    alternar,
    remover,
    limpar,
  };
}
