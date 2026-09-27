/**
 * Entrada de leads vindos do mundo externo (formulario do site, WhatsApp).
 *
 * Roda SEMPRE no servidor, com o cliente admin. O visitante anonimo nao
 * tem permissao de escrita na tabela leads justamente para que nao exista
 * endpoint publico gravando direto no banco: tudo passa por aqui, onde da
 * para validar, deduplicar e registrar consentimento.
 */

import type { Cliente } from './clientes';
import { calcularScore, temperaturaPorScore } from '@imob/core';
import type { Lead, OrigemLead } from '@imob/core';

export interface NovoLeadPublico {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  mensagem?: string | null;
  origem: OrigemLead;
  imovel_id?: string | null;
  imovel_titulo?: string | null;
  valor?: number | null;
  consentimento_lgpd: boolean;
  ip_origem?: string | null;
  pagina_origem?: string | null;
  utm?: Partial<Record<'source' | 'medium' | 'campaign' | 'term' | 'content', string | null>>;
}

export interface ResultadoLead {
  lead: Lead;
  duplicado: boolean;
}

/** Guarda so os digitos. "(34) 99911-0001" e "34999110001" viram a mesma coisa. */
function normalizarTelefone(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
}

/**
 * Cria o lead. Se a mesma pessoa (mesmo telefone) ja entrou nos ultimos
 * 30 dias, NAO cria outro registro: anexa a nova mensagem como interacao
 * no lead existente.
 *
 * Isso conserta o comportamento do prototipo, em que cada mensagem de
 * WhatsApp virava um lead novo e o funil enchia de duplicata da mesma
 * pessoa.
 */
export async function registrarLeadPublico(
  admin: Cliente,
  entrada: NovoLeadPublico,
): Promise<ResultadoLead> {
  const telefone = normalizarTelefone(entrada.telefone);
  const email = entrada.email?.trim().toLowerCase().slice(0, 160) || null;
  const agora = new Date().toISOString();

  // Telefone identifica melhor que e-mail, entao ele vem primeiro. Sem
  // telefone, o e-mail assume o papel: quem assina as novidades duas
  // vezes na mesma semana nao pode virar dois cartoes no funil.
  if (telefone || email) {
    const trintaDiasAtras = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const consulta = admin
      .from('leads')
      .select('*')
      .gte('criado_em', trintaDiasAtras)
      .order('criado_em', { ascending: false })
      .limit(1);

    const filtrada = telefone
      ? consulta.eq('telefone', telefone)
      : consulta.eq('email', email as string);

    const { data: existente } = await filtrada.maybeSingle();

    if (existente) {
      const lead = existente as Lead;
      await admin.from('lead_interacoes').insert({
        lead_id: lead.id,
        tipo: 'sistema',
        conteudo: montarResumoContato(entrada),
        autor_nome: 'Site',
      });

      // Contato repetido esquenta o lead: reabre se estava arquivado e
      // recalcula o score com a interacao nova.
      const score = Math.min(100, lead.score + 10);
      await admin
        .from('leads')
        .update({
          arquivado: false,
          score,
          temperatura: temperaturaPorScore(score),
        })
        .eq('id', lead.id);

      return { lead: { ...lead, score, arquivado: false }, duplicado: true };
    }
  }

  const score = calcularScore({
    telefone,
    email,
    mensagem: entrada.mensagem,
    imovel_id: entrada.imovel_id,
    valor: entrada.valor,
    origem: entrada.origem,
    criado_em: agora,
  });

  const { data, error } = await admin
    .from('leads')
    .insert({
      nome: entrada.nome.trim().slice(0, 120),
      telefone,
      email,
      mensagem: entrada.mensagem?.trim().slice(0, 2000) || null,
      origem: entrada.origem,
      etapa: 'novo',
      score,
      temperatura: temperaturaPorScore(score),
      imovel_id: entrada.imovel_id ?? null,
      imovel_titulo: entrada.imovel_titulo ?? null,
      valor: entrada.valor ?? 0,
      consentimento_lgpd: entrada.consentimento_lgpd,
      consentimento_em: entrada.consentimento_lgpd ? agora : null,
      ip_origem: entrada.ip_origem ?? null,
      pagina_origem: entrada.pagina_origem ?? null,
      utm_source: entrada.utm?.source ?? null,
      utm_medium: entrada.utm?.medium ?? null,
      utm_campaign: entrada.utm?.campaign ?? null,
      utm_term: entrada.utm?.term ?? null,
      utm_content: entrada.utm?.content ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;

  const lead = data as Lead;

  await admin.from('lead_interacoes').insert({
    lead_id: lead.id,
    tipo: 'sistema',
    conteudo: montarResumoContato(entrada),
    autor_nome: 'Site',
  });

  return { lead, duplicado: false };
}

function montarResumoContato(entrada: NovoLeadPublico): string {
  const linhas = [`Contato recebido pelo ${rotuloOrigem(entrada.origem)}.`];
  if (entrada.imovel_titulo) linhas.push(`Imóvel de interesse: ${entrada.imovel_titulo}.`);
  if (entrada.mensagem?.trim()) linhas.push(`Mensagem: "${entrada.mensagem.trim()}"`);
  if (entrada.pagina_origem) linhas.push(`Página: ${entrada.pagina_origem}`);
  if (entrada.utm?.campaign) linhas.push(`Campanha: ${entrada.utm.campaign}`);
  return linhas.join('\n');
}

function rotuloOrigem(origem: OrigemLead): string {
  const mapa: Record<OrigemLead, string> = {
    site: 'site',
    vitrine: 'vitrine',
    whatsapp: 'WhatsApp',
    portal: 'portal imobiliário',
    indicacao: 'indicação',
    instagram: 'Instagram',
    telefone: 'telefone',
    prospeccao: 'prospecção ativa',
    presencial: 'atendimento presencial',
    manual: 'cadastro manual',
  };
  return mapa[origem] ?? origem;
}
