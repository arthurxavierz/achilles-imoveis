'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { Perfil } from '@imob/core';

import { supabaseNavegador } from '@/lib/supabase-navegador';
import { IconeAlerta, IconeCheck } from './Icones';

/**
 * Dados que a propria pessoa mantem.
 *
 * Grava direto pelo navegador, e nao por acao de servidor, porque a
 * policy "perfis - edita o proprio" da migration 0003 ja limita coluna a
 * coluna: papel, permissoes e ativo nem sequer tem privilegio de update
 * para o usuario. Uma tentativa de mudar o proprio papel morre no banco.
 */
export function FormularioPerfil({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(perfil.telefone ?? '');
  const [creci, setCreci] = useState(perfil.creci ?? '');
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  function salvar(evento: React.FormEvent) {
    evento.preventDefault();

    if (nome.trim().length < 2) {
      setResultado({ ok: false, texto: 'Informe seu nome completo.' });
      return;
    }

    iniciar(async () => {
      // Sem banco configurado, o perfil e apenas leitura: nao ha
      // onde gravar, e fingir que salvou seria pior que avisar.
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setResultado({
          ok: false,
          texto: 'Em modo demonstração o perfil não pode ser alterado. Use a barra do topo para trocar de usuário.',
        });
        return;
      }

      const { error } = await supabaseNavegador()
        .from('perfis')
        .update({
          nome: nome.trim(),
          telefone: telefone.replace(/\D/g, '') || null,
          creci: creci.trim() || null,
        })
        .eq('id', perfil.id);

      if (error) {
        console.error('[perfil] falha ao salvar:', error);
        setResultado({ ok: false, texto: 'Não foi possível salvar. Tente novamente.' });
        return;
      }

      setResultado({ ok: true, texto: 'Dados atualizados.' });
      router.refresh();
    });
  }

  return (
    <form className="formulario" onSubmit={salvar}>
      <div className="campo">
        <label htmlFor="p-nome">Nome completo</label>
        <input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>

      <div className="linha-campos">
        <div className="campo">
          <label htmlFor="p-telefone">Telefone</label>
          <input
            id="p-telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
            placeholder="(34) 90000-0000"
          />
        </div>

        <div className="campo">
          <label htmlFor="p-creci">CRECI</label>
          <input
            id="p-creci"
            value={creci}
            onChange={(e) => setCreci(e.target.value)}
            placeholder="CRECI-MG 00000"
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="p-email">E-mail de acesso</label>
        <input id="p-email" value={perfil.email ?? ''} disabled />
        <span className="ajuda">
          Trocar o e-mail de acesso é feito pela administração, por segurança.
        </span>
      </div>

      {resultado && (
        <div className={`aviso ${resultado.ok ? 'aviso-ok' : 'aviso-erro'}`}>
          {resultado.ok ? <IconeCheck /> : <IconeAlerta />}
          <span>{resultado.texto}</span>
        </div>
      )}

      <button className="btn" type="submit" disabled={pendente}>
        {pendente ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  );
}
