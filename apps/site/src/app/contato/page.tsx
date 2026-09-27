import type { Metadata } from 'next';

import { telefone as fmtTelefone } from '@imob/core';

import { FormularioInteresse } from '@/componentes/FormularioInteresse';
import { SITE, linkWhatsApp, telefoneVisivel } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contato',
  description: `Fale com a ${SITE.nome}. Atendimento consultivo para compra, venda e investimento em imóveis em Uberlândia.`,
  alternates: { canonical: '/contato' },
};

export default function PaginaContato() {
  return (
    <div className="container pagina">
      <span className="rotulo">Fale com a Achilles</span>
      <h1 className="titulo-2">
        Vamos conversar sobre o <em>seu</em> próximo imóvel.
      </h1>

      <div className="duas-colunas" style={{ marginTop: 56 }}>
        <div className="prosa">
          <h2>Onde estamos</h2>
          <p>
            {SITE.endereco.logradouro}, {SITE.endereco.complemento}
            <br />
            {SITE.endereco.bairro} · {SITE.endereco.cidade} - {SITE.endereco.uf}
            <br />
            CEP {SITE.endereco.cep}
          </p>

          <h3>Atendimento</h3>
          <p>{SITE.horario}</p>

          <h3>Canais diretos</h3>
          <p>
            WhatsApp:{' '}
            <a
              href={linkWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--marinho-700)' }}
            >
              {telefoneVisivel()}
            </a>
            <br />
            E-mail:{' '}
            <a href={`mailto:${SITE.email}`} style={{ color: 'var(--marinho-700)' }}>
              {SITE.email}
            </a>
          </p>

          <h3>Registro profissional</h3>
          <p>{SITE.creci}</p>
        </div>

        <div className="painel-contato" style={{ position: 'static' }}>
          <span className="rotulo">Envie uma mensagem</span>
          <p style={{ color: 'var(--grafite)', fontSize: 14, marginTop: 12 }}>
            Respondemos em até 1 hora útil.
          </p>
          <FormularioInteresse />
        </div>
      </div>
    </div>
  );
}
