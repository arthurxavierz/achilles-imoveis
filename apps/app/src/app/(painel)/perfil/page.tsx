import type { Metadata } from 'next';

import { brl, iniciais, telefone as fmtTelefone } from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { FormularioPerfil } from '@/componentes/FormularioPerfil';
import { exigirUsuario } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Meu perfil' };
export const dynamic = 'force-dynamic';

export default async function PaginaPerfil() {
  const usuario = await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Meu perfil" />

      <div className="corpo">
        <div className="grade-cartoes grade-2">
          <section className="cartao">
            <div className="cartao-corpo">
              <div className="linha-flex" style={{ gap: 16 }}>
                <span className="avatar avatar-g">{iniciais(usuario.nome)}</span>
                <div className="pilha">
                  <strong style={{ fontSize: '1.15rem' }}>{usuario.nome}</strong>
                  <span className="texto-mudo" style={{ textTransform: 'capitalize' }}>
                    {usuario.papel}
                    {usuario.creci && ` · ${usuario.creci}`}
                  </span>
                </div>
              </div>

              <dl style={{ display: 'grid', gap: 14, marginTop: 24 }}>
                <Linha rotulo="E-mail" valor={usuario.email ?? 'não informado'} />
                <Linha
                  rotulo="Telefone"
                  valor={usuario.telefone ? fmtTelefone(usuario.telefone) : 'não informado'}
                />
                <Linha
                  rotulo="Meta mensal"
                  valor={usuario.meta_mensal > 0 ? brl(usuario.meta_mensal) : 'sem meta definida'}
                />
              </dl>

              <p className="ajuda" style={{ marginTop: 20 }}>
                Papel, permissões e meta são definidos pela administração. Nome, telefone e CRECI
                você mesmo mantém atualizados aqui ao lado.
              </p>
            </div>
          </section>

          <section className="cartao">
            <div className="cartao-cabecalho">
              <h2>Seus dados</h2>
            </div>
            <div className="cartao-corpo">
              <FormularioPerfil perfil={usuario} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="linha-flex entre" style={{ borderBottom: '1px solid var(--linha)', paddingBottom: 12 }}>
      <dt className="texto-mudo">{rotulo}</dt>
      <dd style={{ fontWeight: 500 }}>{valor}</dd>
    </div>
  );
}
