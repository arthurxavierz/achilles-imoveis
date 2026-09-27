'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { IconeAlerta, IconeCheck } from './Icones';
import { Seletor } from './Seletor';
import { emailValido, mascararTelefone, nomeValido, telefoneValido } from '@/lib/mascaras';

type Modo = 'mensagem' | 'visita';
type Estado = 'parado' | 'enviando' | 'ok' | 'erro';

interface Props {
  imovelId?: string;
  imovelTitulo?: string;
  imovelCodigo?: string;
  valor?: number;
  /** Sem as abas, mostra apenas o formulario de mensagem. */
  comAbas?: boolean;
  textoInicial?: string;
}

/**
 * Formulario de contato.
 *
 * Nao grava no banco direto: envia para /api/lead, que roda no servidor.
 * O visitante anonimo nao tem permissao de escrita na tabela de leads,
 * de proposito, para que o formulario nao seja uma porta aberta de
 * insercao no CRM.
 *
 * A validacao acontece quando a pessoa sai do campo, nunca enquanto ela
 * digita. Acusar erro na terceira letra do nome e hostil, e a pessoa
 * ainda nem terminou de escrever.
 */
export function FormularioInteresse({
  imovelId,
  imovelTitulo,
  imovelCodigo,
  valor,
  comAbas = false,
  textoInicial,
}: Props) {
  const [modo, setModo] = useState<Modo>('mensagem');
  const [estado, setEstado] = useState<Estado>('parado');
  const [erroEnvio, setErroEnvio] = useState('');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState(
    textoInicial ??
      (imovelCodigo
        ? `Tenho interesse no imóvel ${imovelCodigo} e gostaria de mais informações.`
        : ''),
  );
  const [dataVisita, setDataVisita] = useState('');
  const [periodo, setPeriodo] = useState('manha');
  const [aceite, setAceite] = useState(false);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});

  // Visita so pode ser marcada de amanha em diante, ate 60 dias a frente.
  const { minimo, maximo } = useMemo(() => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const limite = new Date();
    limite.setDate(limite.getDate() + 60);
    return { minimo: aaaaMmDd(amanha), maximo: aaaaMmDd(limite) };
  }, []);

  const erros = {
    nome: nomeValido(nome) ? '' : 'Informe seu nome completo.',
    telefone: telefoneValido(telefone) ? '' : 'Informe um WhatsApp válido com DDD.',
    email: emailValido(email) ? '' : 'Confira o endereço de e-mail.',
    dataVisita: modo === 'visita' && !dataVisita ? 'Escolha uma data para a visita.' : '',
  };

  const temErro = Object.values(erros).some(Boolean);

  function marcarTocado(campo: string) {
    setTocados((t) => ({ ...t, [campo]: true }));
  }

  function mostrarErro(campo: keyof typeof erros): string {
    return tocados[campo] ? erros[campo] : '';
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setTocados({ nome: true, telefone: true, email: true, dataVisita: true });
    if (temErro || !aceite) return;

    // Armadilha para robô: campo invisível que humano nunca preenche.
    // Se veio preenchido, fingimos sucesso e descartamos em silêncio,
    // para o robô não aprender que foi barrado.
    const dados = new FormData(evento.currentTarget);
    if (String(dados.get('empresa') ?? '').trim()) {
      setEstado('ok');
      return;
    }

    setEstado('enviando');
    setErroEnvio('');

    const textoFinal =
      modo === 'visita'
        ? [
            `Solicitação de visita para ${formatarData(dataVisita)}, no período da ${rotuloPeriodo(periodo)}.`,
            mensagem.trim(),
          ]
            .filter(Boolean)
            .join('\n\n')
        : mensagem.trim();

    try {
      const resposta = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone,
          email,
          mensagem: textoFinal,
          consentimento: true,
          imovel_id: imovelId ?? null,
          imovel_titulo: imovelTitulo ?? null,
          valor: valor ?? 0,
          pagina_origem: typeof window !== 'undefined' ? window.location.pathname : null,
          utm: lerUtm(),
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        throw new Error(corpo?.erro || 'Não foi possível enviar agora.');
      }

      setEstado('ok');
    } catch (erro) {
      setEstado('erro');
      setErroEnvio(erro instanceof Error ? erro.message : 'Não foi possível enviar agora.');
    }
  }

  if (estado === 'ok') {
    return (
      <div className="confirmacao">
        <div className="selo-ok">
          <IconeCheck />
        </div>
        <h3 style={{ fontSize: '1.3rem' }}>Recebemos seu contato</h3>
        <p style={{ color: 'var(--grafite)', marginTop: 12, fontSize: '0.94rem' }}>
          {modo === 'visita'
            ? `Um consultor confirma a visita de ${formatarData(dataVisita)} com você em até 1 hora útil.`
            : 'Um consultor responde em até 1 hora útil. Se preferir falar agora, chame no WhatsApp.'}
        </p>
        <button
          className="btn btn-contorno"
          style={{ marginTop: 22 }}
          onClick={() => {
            setEstado('parado');
            setMensagem('');
            setTocados({});
          }}
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      {comAbas && (
        <div className="abas" role="tablist">
          <button
            type="button"
            className="aba"
            role="tab"
            aria-selected={modo === 'mensagem'}
            onClick={() => setModo('mensagem')}
          >
            Tenho interesse
          </button>
          <button
            type="button"
            className="aba"
            role="tab"
            aria-selected={modo === 'visita'}
            onClick={() => setModo('visita')}
          >
            Agendar visita
          </button>
        </div>
      )}

      <div className={`campo${mostrarErro('nome') ? ' campo-erro' : ''}`}>
        <label htmlFor="c-nome">Nome completo</label>
        <input
          id="c-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => marcarTocado('nome')}
          autoComplete="name"
          maxLength={120}
          required
        />
        {mostrarErro('nome') && (
          <span className="erro-campo">
            <IconeAlerta style={{ width: 14, height: 14 }} />
            {erros.nome}
          </span>
        )}
      </div>

      <div className="linha-campos">
        <div className={`campo${mostrarErro('telefone') ? ' campo-erro' : ''}`}>
          <label htmlFor="c-telefone">WhatsApp</label>
          <input
            id="c-telefone"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            onBlur={() => marcarTocado('telefone')}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(34) 90000-0000"
            required
          />
          {mostrarErro('telefone') && (
            <span className="erro-campo">
              <IconeAlerta style={{ width: 14, height: 14 }} />
              {erros.telefone}
            </span>
          )}
        </div>

        <div className={`campo${mostrarErro('email') ? ' campo-erro' : ''}`}>
          <label htmlFor="c-email">E-mail</label>
          <input
            id="c-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => marcarTocado('email')}
            autoComplete="email"
            maxLength={160}
            placeholder="opcional"
          />
          {mostrarErro('email') && (
            <span className="erro-campo">
              <IconeAlerta style={{ width: 14, height: 14 }} />
              {erros.email}
            </span>
          )}
        </div>
      </div>

      {modo === 'visita' && (
        <div className="linha-campos">
          <div className={`campo${mostrarErro('dataVisita') ? ' campo-erro' : ''}`}>
            <label htmlFor="c-data">Melhor data</label>
            <input
              id="c-data"
              type="date"
              value={dataVisita}
              min={minimo}
              max={maximo}
              onChange={(e) => setDataVisita(e.target.value)}
              onBlur={() => marcarTocado('dataVisita')}
            />
            {mostrarErro('dataVisita') && (
              <span className="erro-campo">
                <IconeAlerta style={{ width: 14, height: 14 }} />
                {erros.dataVisita}
              </span>
            )}
          </div>

          <div className="campo">
            <label htmlFor="c-periodo">Período</label>
            <Seletor
              id="c-periodo"
              rotulo="Período da visita"
              className="campo-seletor"
              valor={periodo}
              aoMudar={setPeriodo}
              opcoes={[
                { valor: 'manha', rotulo: 'Manhã, 8h às 12h' },
                { valor: 'tarde', rotulo: 'Tarde, 13h às 18h' },
                { valor: 'sabado', rotulo: 'Sábado pela manhã' },
              ]}
            />
          </div>
        </div>
      )}

      <div className="campo">
        <label htmlFor="c-mensagem">
          {modo === 'visita' ? 'Alguma observação' : 'Mensagem'}
        </label>
        <textarea
          id="c-mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={2000}
          style={{ minHeight: modo === 'visita' ? 80 : 110 }}
          placeholder={
            modo === 'visita'
              ? 'Por exemplo: preciso ver a vaga de garagem e a área de lazer.'
              : 'Conte o que você procura.'
          }
        />
      </div>

      {/* Honeypot: fora da tela e fora da ordem de tabulação. */}
      <input
        type="text"
        name="empresa"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      <label className="caixa-marcar">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          required
        />
        <span>
          Autorizo a Achilles a entrar em contato e tratar meus dados conforme a{' '}
          <Link href="/politica-de-privacidade">política de privacidade</Link>.
        </span>
      </label>

      {estado === 'erro' && (
        <div className="aviso aviso-erro">
          <IconeAlerta />
          <span>{erroEnvio}</span>
        </div>
      )}

      <button className="btn btn-bloco" type="submit" disabled={estado === 'enviando' || !aceite}>
        {estado === 'enviando'
          ? 'Enviando...'
          : modo === 'visita'
            ? 'Solicitar visita'
            : 'Quero mais informações'}
      </button>

      <p className="texto-mudo" style={{ textAlign: 'center' }}>
        Resposta em até 1 hora útil. Sem disparo de mala direta.
      </p>
    </form>
  );
}

function aaaaMmDd(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function formatarData(iso: string): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function rotuloPeriodo(valor: string): string {
  if (valor === 'tarde') return 'tarde';
  if (valor === 'sabado') return 'manhã de sábado';
  return 'manhã';
}

/** Preserva a origem da campanha para o relatório de mídia paga. */
function lerUtm() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return {
    source: p.get('utm_source'),
    medium: p.get('utm_medium'),
    campaign: p.get('utm_campaign'),
    term: p.get('utm_term'),
    content: p.get('utm_content'),
  };
}
