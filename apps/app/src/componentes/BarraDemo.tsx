'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { Perfil } from '@imob/core';

import { reiniciarDemo, trocarUsuarioDemo } from '@/app/(painel)/demo-acoes';
import { IconeAlerta, IconeUsuario } from './Icones';

/**
 * Faixa que aparece só quando o sistema roda sem banco.
 *
 * Além de avisar que os dados são simulados, ela troca quem está usando
 * o painel. Isso importa mais do que parece: as regras de quem pode o
 * quê são o coração deste sistema, e a única forma honesta de conferir
 * se elas funcionam é entrar como corretor e tentar mexer no que é da
 * gestão.
 */
export function BarraDemo({ usuario, equipe }: { usuario: Perfil; equipe: Perfil[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function trocar(id: string) {
    iniciar(async () => {
      await trocarUsuarioDemo(id);
      router.refresh();
    });
  }

  function reiniciar() {
    iniciar(async () => {
      await reiniciarDemo();
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <div className="faixa-demo">
      <span className="faixa-demo-selo">
        <IconeAlerta />
        Demonstração
      </span>

      <span className="faixa-demo-texto">
        Dados simulados, sem banco configurado. O que você alterar aqui vale também no site.
      </span>

      <label className="faixa-demo-troca">
        <IconeUsuario />
        <span className="somente-desktop">Entrar como</span>
        <select
          value={usuario.id}
          onChange={(e) => trocar(e.target.value)}
          disabled={pendente}
          aria-label="Trocar de usuário na demonstração"
        >
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.papel})
            </option>
          ))}
        </select>
      </label>

      {confirmando ? (
        <span className="linha-flex" style={{ gap: 6 }}>
          <button className="faixa-demo-botao" onClick={reiniciar} disabled={pendente}>
            Confirmar
          </button>
          <button className="faixa-demo-botao" onClick={() => setConfirmando(false)}>
            Voltar
          </button>
        </span>
      ) : (
        <button
          className="faixa-demo-botao"
          onClick={() => setConfirmando(true)}
          disabled={pendente}
          title="Devolve os dados simulados ao estado original"
        >
          Reiniciar dados
        </button>
      )}
    </div>
  );
}
