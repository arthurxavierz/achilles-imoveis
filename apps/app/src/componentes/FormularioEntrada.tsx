'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { supabaseNavegador } from '@/lib/supabase-navegador';
import { IconeAlerta, IconeCheck, IconeInfo } from './Icones';

type Modo = 'entrar' | 'recuperar';

/**
 * Para onde mandar a pessoa depois que ela entra.
 *
 * O parâmetro "proximo" existe para quem clicou num link do painel sem
 * estar logado voltar ao lugar que queria, e quem o escreve é o
 * middleware. Só que ele chega pela URL, e a URL é escrita por quem
 * quiser: sem esta função, um link para
 *
 *   app.achillesimoveis.com.br/entrar?proximo=https://site-clonado.com
 *
 * levaria a pessoa a fazer login de verdade, no domínio de verdade, e
 * cair logo em seguida numa cópia da tela de entrada pedindo a senha
 * "de novo". O domínio legítimo no começo é justamente o que faz o
 * golpe funcionar.
 *
 * Por isso só passa caminho interno. As duas barras e a barra invertida
 * ficam de fora porque "//outro-site.com" e "/\outro-site.com" começam
 * com barra mas o navegador lê como endereço de outro servidor.
 */
function destinoSeguro(bruto: string | null): string {
  if (!bruto || !bruto.startsWith('/')) return '/';
  if (bruto.startsWith('//') || bruto.startsWith('/\\')) return '/';
  return bruto;
}

export function FormularioEntrada() {
  const router = useRouter();
  const params = useSearchParams();

  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  const motivo = params.get('motivo');
  const proximo = destinoSeguro(params.get('proximo'));

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setErro('');

    const supabase = supabaseNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    if (error) {
      setCarregando(false);
      // Mensagem propositalmente vaga: dizer "este e-mail não existe"
      // entrega a quem tenta invadir quais contas são reais.
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      );
      return;
    }

    // refresh() faz o servidor reler o cookie recem-gravado antes de
    // renderizar o painel. Sem ele, a primeira tela viria sem sessao.
    router.replace(proximo);
    router.refresh();
  }

  async function recuperar(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setErro('');

    const supabase = supabaseNavegador();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    });

    setCarregando(false);

    // Confirma o envio mesmo quando o e-mail não existe, pelo mesmo
    // motivo da mensagem acima: não revelar quais contas são reais.
    if (error) console.error('[entrar] recuperação:', error);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="entrada-caixa">
        <div className="aviso aviso-ok">
          <IconeCheck />
          <span>
            Se houver uma conta com <strong>{email}</strong>, o link de redefinição chega em
            instantes. Confira também a caixa de spam.
          </span>
        </div>
        <button
          className="btn btn-claro btn-bloco"
          style={{ marginTop: 18 }}
          onClick={() => {
            setEnviado(false);
            setModo('entrar');
          }}
        >
          Voltar para o acesso
        </button>
      </div>
    );
  }

  return (
    <div className="entrada-caixa">
      <span className="selo" aria-hidden="true" />

      <h1>{modo === 'entrar' ? 'Acessar o sistema' : 'Recuperar acesso'}</h1>
      <p>
        {modo === 'entrar'
          ? 'Use o e-mail cadastrado pela administração.'
          : 'Informe seu e-mail e enviaremos um link para criar uma senha nova.'}
      </p>

      {motivo === 'inativo' && (
        <div className="aviso aviso-atencao" style={{ marginTop: 20 }}>
          <IconeInfo />
          <span>
            Seu acesso está desativado. Procure a administração para reativar a conta.
          </span>
        </div>
      )}

      <form className="formulario" onSubmit={modo === 'entrar' ? entrar : recuperar}>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
            placeholder="voce@achillesimoveis.com.br"
          />
        </div>

        {modo === 'entrar' && (
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </div>
        )}

        {erro && (
          <div className="aviso aviso-erro">
            <IconeAlerta />
            <span>{erro}</span>
          </div>
        )}

        <button className="btn btn-bloco" type="submit" disabled={carregando}>
          {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Enviar link'}
        </button>

        <button
          type="button"
          className="btn btn-fantasma btn-bloco"
          onClick={() => {
            setModo(modo === 'entrar' ? 'recuperar' : 'entrar');
            setErro('');
          }}
        >
          {modo === 'entrar' ? 'Esqueci minha senha' : 'Voltar para o acesso'}
        </button>
      </form>

      <p className="texto-mudo" style={{ marginTop: 26, textAlign: 'center' }}>
        Acesso restrito à equipe Achilles.
      </p>
    </div>
  );
}
