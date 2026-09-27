'use client';

import { useFavoritos } from '@/lib/favoritos';
import { IconeCoracao } from './Icones';

/**
 * Salvar imovel.
 *
 * Dentro do cartao ele vive sobre um link que cobre o cartao inteiro,
 * entao precisa cancelar a propagacao e o comportamento padrao: sem
 * isso, salvar o imovel navegaria para a pagina dele.
 */
export function BotaoFavorito({
  imovelId,
  titulo,
  variante = 'flutuante',
}: {
  imovelId: string;
  titulo: string;
  variante?: 'flutuante' | 'linha';
}) {
  const { tem, alternar, pronto } = useFavoritos();
  const salvo = pronto && tem(imovelId);

  function aoClicar(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    alternar(imovelId);
  }

  const rotulo = salvo ? `Remover ${titulo} dos salvos` : `Salvar ${titulo}`;

  if (variante === 'linha') {
    return (
      <button className="btn-acao" onClick={aoClicar} data-ativo={salvo} aria-label={rotulo}>
        <IconeCoracao />
        {salvo ? 'Salvo' : 'Salvar imóvel'}
      </button>
    );
  }

  return (
    <button
      className="botao-favorito"
      onClick={aoClicar}
      data-ativo={salvo}
      aria-label={rotulo}
      title={rotulo}
    >
      <IconeCoracao />
    </button>
  );
}
