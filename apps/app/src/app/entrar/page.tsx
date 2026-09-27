import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NomeMarca, SeloMarca } from '@/componentes/MarcaDemo';

import { Assinatura } from '@/componentes/Assinatura';
import { FormularioEntrada } from '@/componentes/FormularioEntrada';

export const metadata: Metadata = { title: 'Entrar' };

export default function PaginaEntrar() {
  return (
    <div className="entrada">
      <aside className="entrada-arte">
        {/* Mesmo logotipo da lateral, e por isso reusa .lateral-marca:
            o estilo mora num lugar so e nao ha duas versoes da marca
            para manter em dia. */}
        <div className="lateral-marca" style={{ padding: 0, border: 'none' }}>
          <SeloMarca />
          <div>
            <strong><NomeMarca padrao="achilles" /></strong>
            <span>negócios imobiliários</span>
          </div>
        </div>

        <p className="entrada-frase">
          Sua carteira, seu funil e sua <em>comissão</em>, no mesmo lugar.
        </p>

        <p className="entrada-nota">
          Cada consultor enxerga a própria carteira. A gestão enxerga o conjunto. Nenhum dado de
          cliente sai daqui sem passar pelas regras de permissão do sistema.
        </p>
      </aside>

      <main className="entrada-painel">
        <Suspense fallback={<div className="esqueleto" style={{ height: 380, width: 384 }} />}>
          <FormularioEntrada />
        </Suspense>

        <Assinatura />
      </main>
    </div>
  );
}
