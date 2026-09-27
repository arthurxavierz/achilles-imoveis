'use client';

import { useState } from 'react';

import { IconeAlerta, IconeCheck, IconeEnviar } from './Icones';

/**
 * Cadastro para receber novidades.
 *
 * Grava como lead de origem "site", pela mesma rota do formulario de
 * interesse. Nao existe lista de e-mail separada: quem deixa o contato
 * aqui aparece no funil junto com o resto, e a equipe decide o que fazer.
 *
 * O consentimento e explicito porque a LGPD exige base legal para
 * comunicacao de marketing, e "ele digitou o e-mail" nao e uma delas.
 */
export function Newsletter() {
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [aceite, setAceite] = useState(false);
  const [armadilha, setArmadilha] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'ok' | 'erro'>('parado');
  const [recado, setRecado] = useState('');

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEstado('erro');
      setRecado('Confira o e-mail digitado.');
      return;
    }

    if (!aceite) {
      setEstado('erro');
      setRecado('Precisamos da sua autorização para enviar novidades.');
      return;
    }

    setEstado('enviando');

    try {
      const resposta = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim() || email.split('@')[0],
          email: email.trim().toLowerCase(),
          mensagem: 'Quer receber novidades e lançamentos por e-mail.',
          origem: 'site',
          consentimento: true,
          pagina_origem: typeof window !== 'undefined' ? window.location.pathname : null,
          empresa: armadilha,
        }),
      });

      if (!resposta.ok) throw new Error(String(resposta.status));

      setEstado('ok');
      setRecado('Pronto. Você receberá as novidades da carteira em primeira mão.');
      setEmail('');
      setNome('');
      setAceite(false);
    } catch {
      setEstado('erro');
      setRecado('Não foi possível enviar agora. Tente novamente em instantes.');
    }
  }

  return (
    <div className="newsletter">
      <div>
        <span className="rotulo">Antes de todo mundo</span>
        <h2 className="titulo-2" style={{ marginTop: 18 }}>
          Receba o que entra na carteira
        </h2>
        <p className="texto-apoio" style={{ marginTop: 16 }}>
          Boa parte dos imóveis de alto padrão é negociada com discrição e passa poucos dias na
          vitrine. Quem está na lista recebe antes da publicação.
        </p>
      </div>

      <form onSubmit={enviar}>
        <div className="newsletter-forma">
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            aria-label="Seu nome"
            autoComplete="name"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seunome@email.com.br"
            aria-label="Seu e-mail"
            autoComplete="email"
            required
          />

          {/* Campo isca: fica fora da tela, invisivel a quem usa o site e
              preenchido por robo de formulario. */}
          <div className="armadilha" aria-hidden="true">
            <label htmlFor="site-newsletter">Não preencha</label>
            <input
              id="site-newsletter"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={armadilha}
              onChange={(e) => setArmadilha(e.target.value)}
            />
          </div>

          <button className="btn btn-ouro" type="submit" disabled={estado === 'enviando'}>
            <IconeEnviar />
            {estado === 'enviando' ? 'Enviando...' : 'Enviar'}
          </button>
        </div>

        <label className="caixa-marcar" style={{ marginTop: 16 }}>
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
          />
          <span>
            Autorizo a Achilles a enviar novidades e oportunidades por e-mail e WhatsApp. Posso
            cancelar quando quiser.
          </span>
        </label>

        {estado === 'ok' && (
          <div className="aviso aviso-ok" style={{ marginTop: 16 }}>
            <IconeCheck />
            <span>{recado}</span>
          </div>
        )}

        {estado === 'erro' && (
          <div className="aviso aviso-erro" style={{ marginTop: 16 }}>
            <IconeAlerta />
            <span>{recado}</span>
          </div>
        )}
      </form>
    </div>
  );
}
