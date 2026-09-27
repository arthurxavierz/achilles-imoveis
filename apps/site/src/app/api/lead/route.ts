import { NextResponse } from 'next/server';

import { criarClienteAdmin, registrarLeadPublico } from '@imob/db';

import { registrarLeadDemo, semBanco } from '@/lib/demonstracao';

/**
 * Recebe o formulario publico e grava o lead.
 *
 * Esta rota existe para que o visitante NAO precise de permissao de
 * escrita no banco. Ela roda no servidor, com a service_role, e e o
 * unico caminho pelo qual um lead externo entra no CRM.
 *
 * Camadas de defesa, na ordem em que agem:
 *   1. honeypot        -> robo simples que preenche tudo cai aqui
 *   2. limite por IP   -> impede rajada de envios
 *   3. Turnstile       -> se configurado, valida que ha um humano
 *   4. validacao       -> nome e telefone reais, tamanho limitado
 *   5. deduplicacao    -> mesmo telefone em 30 dias vira interacao
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE_JANELA_MS = 60_000;
const LIMITE_ENVIOS = 5;

/**
 * Contador por IP na memoria da instancia.
 *
 * Em ambiente serverless isso NAO e um limitador global: cada instancia
 * tem o proprio mapa. Serve como primeira barreira barata contra rajada.
 * A protecao real contra ataque distribuido e o Turnstile abaixo, ou uma
 * regra de rate limiting na Cloudflare, que ja esta na frente do dominio.
 */
const contador = new Map<string, { total: number; expira: number }>();

function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const atual = contador.get(ip);

  if (!atual || atual.expira < agora) {
    contador.set(ip, { total: 1, expira: agora + LIMITE_JANELA_MS });
    return false;
  }

  atual.total += 1;

  // Limpeza oportunista: sem isto o mapa cresce sem limite numa
  // instancia de vida longa.
  if (contador.size > 5000) {
    for (const [chave, valor] of contador) {
      if (valor.expira < agora) contador.delete(chave);
    }
  }

  return atual.total > LIMITE_ENVIOS;
}

function ipDaRequisicao(req: Request): string {
  const encaminhado = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for');
  return encaminhado?.split(',')[0]?.trim() ?? 'desconhecido';
}

/** Valida o token do Cloudflare Turnstile, quando configurado. */
async function turnstileValido(token: string | null, ip: string): Promise<boolean> {
  const segredo = process.env.TURNSTILE_SECRET_KEY;
  if (!segredo) return true; // nao configurado: nao bloqueia

  if (!token) return false;

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: segredo, response: token, remoteip: ip }),
    });
    const dados = (await r.json()) as { success?: boolean };
    return dados.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ip = ipDaRequisicao(req);

  if (excedeuLimite(ip)) {
    return NextResponse.json(
      { erro: 'Muitos envios seguidos. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  // Honeypot conferido tambem no servidor: um robo que fale direto com a
  // API nao passa pelo JavaScript da pagina.
  if (texto(corpo.empresa)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!(await turnstileValido(texto(corpo.turnstile, 4000) || null, ip))) {
    return NextResponse.json({ erro: 'Não foi possível validar o envio.' }, { status: 403 });
  }

  const nome = texto(corpo.nome);
  const telefone = texto(corpo.telefone);
  const email = texto(corpo.email);
  const consentimento = corpo.consentimento === true;

  if (nome.length < 2) {
    return NextResponse.json({ erro: 'Informe seu nome.' }, { status: 400 });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }

  /**
   * Um canal de retorno basta, e ele pode ser telefone ou e-mail.
   *
   * O formulario de interesse continua pedindo WhatsApp, porque e por ali
   * que o atendimento acontece. Ja quem assina as novidades so quer
   * receber e-mail, e exigir telefone dessa pessoa afasta contato bom por
   * um dado que ninguem vai usar.
   */
  const digitos = telefone.replace(/\D/g, '');

  if (telefone && (digitos.length < 10 || digitos.length > 13)) {
    return NextResponse.json({ erro: 'Informe um WhatsApp válido com DDD.' }, { status: 400 });
  }

  if (!telefone && !email) {
    return NextResponse.json(
      { erro: 'Informe um WhatsApp ou um e-mail para retorno.' },
      { status: 400 },
    );
  }

  // Consentimento e requisito da LGPD para tratar o dado. Sem ele, nao
  // gravamos: um lead sem base legal e passivo, nao ativo.
  if (!consentimento) {
    return NextResponse.json(
      { erro: 'É necessário aceitar a política de privacidade.' },
      { status: 400 },
    );
  }

  const utm = (corpo.utm ?? {}) as Record<string, string | null>;

  /**
   * Sem banco configurado, o lead vai para o arquivo da demonstracao.
   *
   * Nao e enfeite: e o que fecha o circuito site mais painel antes de o
   * Supabase existir. Quem preenche o formulario aqui ve o contato
   * aparecer na coluna Novo do funil, que e justamente a integracao que
   * precisa ser conferida antes de subir.
   */
  if (semBanco()) {
    const { duplicado } = registrarLeadDemo({
      nome,
      telefone: telefone || null,
      email: email || null,
      mensagem: texto(corpo.mensagem, 2000) || null,
      origem: 'site',
      imovel_id: texto(corpo.imovel_id) || null,
      imovel_titulo: texto(corpo.imovel_titulo) || null,
      valor: Number(corpo.valor) || 0,
      pagina_origem: texto(corpo.pagina_origem, 300) || null,
      utm_source: texto(utm.source) || null,
      utm_medium: texto(utm.medium) || null,
      utm_campaign: texto(utm.campaign) || null,
    });

    return NextResponse.json({ ok: true, duplicado, demonstracao: true });
  }

  try {
    const admin = criarClienteAdmin();

    const { duplicado } = await registrarLeadPublico(admin, {
      nome,
      telefone,
      email: email || null,
      mensagem: texto(corpo.mensagem, 2000) || null,
      origem: 'site',
      imovel_id: texto(corpo.imovel_id) || null,
      imovel_titulo: texto(corpo.imovel_titulo) || null,
      valor: Number(corpo.valor) || 0,
      consentimento_lgpd: true,
      ip_origem: ip,
      pagina_origem: texto(corpo.pagina_origem, 300) || null,
      utm: {
        source: texto(utm.source) || null,
        medium: texto(utm.medium) || null,
        campaign: texto(utm.campaign) || null,
        term: texto(utm.term) || null,
        content: texto(utm.content) || null,
      },
    });

    return NextResponse.json({ ok: true, duplicado });
  } catch (erro) {
    // O motivo real fica no log do Netlify. Para quem enviou, uma
    // mensagem util e sem detalhe de infraestrutura.
    console.error('[api/lead] falha ao registrar lead:', erro);
    return NextResponse.json(
      { erro: 'Não conseguimos registrar seu contato agora. Chame no WhatsApp, por favor.' },
      { status: 500 },
    );
  }
}

/**
 * Le um campo de texto do corpo, ja aparado e com teto de tamanho.
 *
 * O teto nao e capricho. Nome, e-mail e mensagem sao cortados la em
 * registrarLeadPublico, mas titulo do imovel, pagina de origem e os
 * cinco campos de UTM chegavam ate o insert do jeito que vieram, e as
 * colunas correspondentes sao text, sem limite no Postgres. Um POST
 * direto nesta rota com um megabyte em utm_source e aceito e gravado; o
 * limite por IP so faz isso demorar mais.
 *
 * Cento e sessenta caracteres e folgado para tudo que passa por aqui:
 * o titulo mais longo da carteira nao chega a cem, e parametro de
 * campanha maior que isso nao existe em anuncio nenhum.
 */
function texto(v: unknown, limite = 160): string {
  return typeof v === 'string' ? v.trim().slice(0, limite) : '';
}
