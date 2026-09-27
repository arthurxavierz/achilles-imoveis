'use client';

import { useEffect } from 'react';

import { IconeAlerta, IconeCheck } from './Icones';

/**
 * Confirmacao rapida que aparece no rodape e some sozinha.
 *
 * O papel dela e fechar o ciclo da acao: quem clicou em salvar precisa
 * de um sinal de que salvou. Fica 3,5 segundos, tempo de ler sem
 * atrapalhar a proxima tarefa. Erro fica visivel por mais tempo, porque
 * exige decisao de quem esta usando.
 */
export function Recado({
  texto,
  erro = false,
  aoFechar,
}: {
  texto: string;
  erro?: boolean;
  aoFechar: () => void;
}) {
  useEffect(() => {
    const relogio = setTimeout(aoFechar, erro ? 6000 : 3500);
    return () => clearTimeout(relogio);
  }, [aoFechar, erro, texto]);

  return (
    <div className={`recado${erro ? ' recado-erro' : ''}`} role="status" aria-live="polite">
      {erro ? <IconeAlerta /> : <IconeCheck />}
      <span>{texto}</span>
    </div>
  );
}
