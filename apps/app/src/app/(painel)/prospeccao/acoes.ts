'use server';

import { revalidatePath } from 'next/cache';

import {
  pontuarProspecto,
  type FiltroProspeccao,
  type Prospecto,
} from '@imob/core';

import { modoDemo } from '@/lib/demonstracao';
import { prospectosDemo, salvarLeadDemo } from '@/lib/dados-demo';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';

export interface EstadoBusca {
  ok: boolean;
  erro?: string;
  aviso?: string;
  resultados?: Prospecto[];
  /** Quantas chamadas à API a busca custou. Aparece na tela porque
   *  Places é cobrado por chamada, e quem busca deve enxergar o custo. */
  chamadas?: number;
  origem?: { lat: number; lon: number; rotulo: string } | null;
}

const AGENTE = 'AchillesImoveis/1.0 (+https://achillesimoveis.com.br)';
const ENDERECO_PLACES = 'https://places.googleapis.com/v1/places:searchText';

/**
 * Só os campos que a tela usa.
 *
 * O Places cobra por SKU, e o SKU é decidido pelos campos pedidos:
 * quanto mais campo, mais caro fica cada chamada. Pedir `places.*`
 * seria simples e multiplicaria a conta do mês por várias vezes.
 */
const CAMPOS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',');

const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number(n)));

const primeiro = (...v: (string | undefined | null)[]) =>
  v.find((x) => x !== undefined && x !== null && String(x).trim() !== '') ?? '';

const limparTelefone = (v = '') => String(v).replace(/[^\d+]/g, '').replace(/^00/, '+');

/** Distância em linha reta entre dois pontos, em quilômetros. */
function distancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Onde fica o centro da cidade buscada.
 *
 * Usa o Nominatim, do OpenStreetMap, que é gratuito. O Geocoding do
 * Google resolveria melhor, mas é mais uma chamada cobrada por busca —
 * e para centralizar um raio de vinte quilômetros, a precisão do
 * Nominatim sobra.
 *
 * Falhar aqui não interrompe nada: sem centro, a busca cai no modo
 * textual ("clínicas em Uberlândia, MG") e o filtro de raio é
 * desligado. Menos preciso, mas continua útil.
 */
async function localizarCidade(cidade: string, uf: string) {
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), 7000);

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', [cidade, uf, 'Brasil'].filter(Boolean).join(', '));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'br');

    const r = await fetch(url, {
      signal: controle.signal,
      headers: { 'User-Agent': AGENTE, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    if (!r.ok) return null;

    const dados = await r.json();
    if (!dados?.length) return null;

    return { lat: Number(dados[0].lat), lon: Number(dados[0].lon), rotulo: dados[0].display_name };
  } catch {
    return null;
  } finally {
    clearTimeout(prazo);
  }
}

interface LugarBruto {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

function converter(
  lugar: LugarBruto,
  centro: { lat: number; lon: number } | null,
): Prospecto | null {
  const lat = Number(lugar.location?.latitude);
  const lon = Number(lugar.location?.longitude);
  const nome = lugar.displayName?.text ?? '';

  if (!nome || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const base = {
    id: `gplace_${lugar.id}`,
    origem_id: String(lugar.id ?? ''),
    nome,
    categoria: primeiro(
      lugar.primaryTypeDisplayName?.text,
      lugar.primaryType,
      lugar.types?.[0],
      'Empresa local',
    ).replace(/_/g, ' '),
    endereco: lugar.formattedAddress ?? '',
    telefone: limparTelefone(primeiro(lugar.internationalPhoneNumber, lugar.nationalPhoneNumber)),
    site: lugar.websiteUri ?? '',
    latitude: lat,
    longitude: lon,
    distancia_km: centro ? Number(distancia(centro.lat, centro.lon, lat, lon).toFixed(1)) : null,
    mapa_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      nome,
    )}&query_place_id=${encodeURIComponent(String(lugar.id ?? ''))}`,
    nota: Number(lugar.rating ?? 0),
    avaliacoes: Number(lugar.userRatingCount ?? 0),
    situacao: lugar.businessStatus ?? '',
    tipos: lugar.types ?? [],
  };

  return { ...base, ...pontuarProspecto(base) };
}

/**
 * Busca empresas de um segmento numa cidade.
 *
 * A chave nunca sai do servidor: esta função roda no Node, e o
 * navegador recebe apenas a lista já pontuada. Uma chave de Places no
 * front seria cobrada por qualquer pessoa que abrisse o inspetor.
 */
export async function buscarEmpresas(filtro: FiltroProspeccao): Promise<EstadoBusca> {
  const usuario = await exigirUsuario();

  if (usuario.papel !== 'admin' && usuario.papel !== 'gestor' && !usuario.permissoes?.leads) {
    return { ok: false, erro: 'Você não tem acesso à prospecção.' };
  }

  const segmento = filtro.segmento.trim();
  const cidade = filtro.cidade.trim();
  const uf = filtro.uf.trim().toUpperCase();

  if (!segmento || !cidade) {
    return { ok: false, erro: 'Informe o segmento e a cidade.' };
  }

  const raioKm = limitar(filtro.raioKm || 20, 2, 50);
  const limite = limitar(filtro.limite || 30, 5, 60);

  if (modoDemo()) {
    return {
      ok: true,
      resultados: prospectosDemo(segmento, cidade, limite),
      chamadas: 0,
      origem: null,
      aviso:
        'Demonstração: estes resultados são simulados. Com a chave do Google Places configurada, a busca é real.',
    };
  }

  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) {
    return {
      ok: false,
      erro:
        'Falta a variável GOOGLE_PLACES_API_KEY no servidor. Cadastre-a no Netlify e faça um novo deploy.',
    };
  }

  const centro = await localizarCidade(cidade, uf);

  try {
    const lugares: LugarBruto[] = [];
    let pagina = '';
    let chamadas = 0;

    // O Places devolve no máximo 20 por chamada. Três páginas cobrem os
    // 60 do limite máximo da tela, e param cedo quando o segmento tem
    // menos empresas do que isso.
    const maxPaginas = Math.min(3, Math.ceil(limite / 20));

    for (let i = 0; i < maxPaginas && lugares.length < limite; i++) {
      const corpo: Record<string, unknown> = {
        textQuery: centro ? segmento : `${segmento} em ${cidade}${uf ? `, ${uf}` : ''}, Brasil`,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        pageSize: Math.min(20, limite - lugares.length),
      };

      if (centro) {
        corpo.locationBias = {
          circle: {
            center: { latitude: centro.lat, longitude: centro.lon },
            radius: Math.min(50000, Math.max(1000, raioKm * 1000)),
          },
        };
      }
      if (pagina) corpo.pageToken = pagina;

      const controle = new AbortController();
      const prazo = setTimeout(() => controle.abort(), 12000);

      let resposta: Response;
      try {
        resposta = await fetch(ENDERECO_PLACES, {
          method: 'POST',
          signal: controle.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': chave,
            'X-Goog-FieldMask': CAMPOS,
          },
          body: JSON.stringify(corpo),
        });
      } finally {
        clearTimeout(prazo);
      }

      chamadas += 1;
      const texto = await resposta.text();
      const dados = texto ? JSON.parse(texto) : {};

      if (!resposta.ok) {
        console.error('[prospeccao] Places recusou:', dados?.error?.message ?? resposta.status);
        return { ok: false, erro: traduzirErroPlaces(dados?.error?.message, resposta.status) };
      }

      lugares.push(...(dados.places ?? []));
      pagina = dados.nextPageToken ?? '';
      if (!pagina) break;
    }

    const vistos = new Set<string>();
    let resultados = lugares
      .map((l) => converter(l, centro))
      .filter((p): p is Prospecto => p !== null)
      .filter((p) => p.situacao !== 'CLOSED_PERMANENTLY')
      .filter((p) => {
        if (vistos.has(p.origem_id)) return false;
        vistos.add(p.origem_id);
        return true;
      });

    // O locationBias do Google é uma preferência, não um limite: ele
    // devolve resultado de fora do círculo quando falta gente dentro.
    // Sem este corte, uma busca de "raio 5 km" traz empresa a 40 km.
    if (centro) {
      resultados = resultados.filter((p) => p.distancia_km == null || p.distancia_km <= raioKm + 1);
    }

    resultados = resultados
      .sort((a, b) => b.score - a.score || b.avaliacoes - a.avaliacoes)
      .slice(0, limite);

    return {
      ok: true,
      resultados,
      chamadas,
      origem: centro,
      aviso: centro
        ? undefined
        : 'Não foi possível localizar o centro desta cidade. A busca funcionou, mas o filtro de raio não foi aplicado.',
    };
  } catch (erro) {
    const abortou = erro instanceof Error && erro.name === 'AbortError';
    console.error('[prospeccao] falha na busca:', erro);
    return {
      ok: false,
      erro: abortou
        ? 'A consulta ao Google demorou demais. Tente de novo, ou reduza o limite.'
        : 'Falha ao consultar o Google Places.',
    };
  }
}

/**
 * Traduz o erro do Google, sem esconder o original.
 *
 * A primeira versao desta funcao trocava a mensagem do Google por um
 * texto amigavel — e o texto amigavel listava tres causas possiveis,
 * o que obrigava a testar as tres. A mensagem do Google diz qual das
 * tres e, em uma linha.
 *
 * Ela vai junto, entre parenteses. Isto e tela interna, atras de
 * login: nao ha para quem vazar, e o minuto que ela economiza no
 * diagnostico vale mais que a elegancia de uma frase limpa.
 */
function traduzirErroPlaces(mensagem: string | undefined, status: number): string {
  const original = (mensagem ?? '').trim();
  const m = original.toLowerCase();
  const rodape = original ? ` (Google: "${original}")` : ` (HTTP ${status})`;

  // O erro mais comum, e o mais confuso: existem DUAS Places API no
  // console do Google. A antiga chama "Places API"; esta usa a
  // "Places API (New)". Restringir a chave a antiga passa despercebido
  // porque o nome quase nao muda.
  if (m.includes('places api') && (m.includes('not enabled') || m.includes('disabled'))) {
    return `A "Places API (New)" nao esta ativada neste projeto do Google. Cuidado: existe tambem uma "Places API" antiga, e nao e ela.${rodape}`;
  }
  if (m.includes('referer') || m.includes('referrer')) {
    return `A chave tem restricao por site (referenciador HTTP). A chamada sai do servidor e nao manda referenciador, entao o Google recusa. Troque para "Nenhuma" ou restrinja por IP.${rodape}`;
  }
  if (status === 403 || m.includes('permission') || m.includes('not authorized')) {
    return `A chave foi recusada. Quase sempre e a restricao de API: abra a chave no console e confirme que "Places API (New)" esta na lista de APIs permitidas.${rodape}`;
  }
  if (status === 429 || m.includes('quota') || m.includes('resource_exhausted')) {
    return `A cota do Google acabou. Verifique o faturamento do projeto no Google Cloud.${rodape}`;
  }
  if (m.includes('billing')) {
    return `O projeto do Google esta sem faturamento ativo. A Places API exige cartao cadastrado mesmo dentro do credito gratuito.${rodape}`;
  }
  if (m.includes('api key not valid') || m.includes('api_key_invalid')) {
    return `A chave nao existe ou foi revogada. Confira a GOOGLE_PLACES_API_KEY no Netlify.${rodape}`;
  }

  return original || `O Google recusou a consulta (HTTP ${status}).`;
}

export interface EstadoAcao {
  ok: boolean;
  erro?: string;
  mensagem?: string;
}

/**
 * Traz o prospecto para o funil como lead.
 *
 * Não existe tabela separada de prospectos de propósito. O resultado da
 * busca é descartável — ele pode ser refeito a qualquer momento pela
 * mesma consulta — e o que interessa guardar é a decisão: esta empresa
 * a gente vai abordar. Essa decisão já tem lugar no sistema, que é o
 * lead, com dono, etapa e histórico.
 *
 * O que a busca sabe e o lead não teria como saber vai na mensagem
 * inicial: categoria, nota, avaliações e o encaixe comercial. Quem
 * abrir o lead daqui a duas semanas entende de onde ele veio.
 */
export async function importarProspecto(prospecto: Prospecto): Promise<EstadoAcao> {
  const usuario = await exigirUsuario();

  const contexto = [
    `${prospecto.categoria} · ${prospecto.endereco}`,
    prospecto.nota > 0
      ? `Google: nota ${prospecto.nota.toFixed(1)} com ${prospecto.avaliacoes.toLocaleString('pt-BR')} avaliações.`
      : 'Sem avaliações no Google.',
    prospecto.site ? `Site: ${prospecto.site}` : 'Sem site identificado.',
    '',
    `Potencial ${prospecto.faixa.toLowerCase()} (${prospecto.score}/100). ${prospecto.encaixe}`,
  ].join('\n');

  const registro = {
    nome: prospecto.nome.slice(0, 120),
    telefone: prospecto.telefone.replace(/\D/g, '') || null,
    email: null,
    mensagem: contexto,
    origem: 'prospeccao' as const,
    etapa: 'novo' as const,
    imovel_titulo: null,
    valor: 0,
    corretor_id: usuario.id,
    temperatura: prospecto.score >= 82 ? 'quente' : prospecto.score >= 66 ? 'morno' : 'frio',
    score: prospecto.score,
  };

  if (modoDemo()) {
    const r = salvarLeadDemo(usuario, registro as never);
    revalidatePath('/leads');
    revalidatePath('/prospeccao');
    return r.ok
      ? { ok: true, mensagem: `${prospecto.nome} entrou no funil.` }
      : { ok: false, erro: r.erro };
  }

  const supabase = await supabaseServidor();

  // O telefone é a chave para não duplicar: a mesma empresa buscada em
  // duas rodadas viraria dois leads, e quem atende ligaria duas vezes.
  if (registro.telefone) {
    const { data: existente } = await supabase
      .from('leads')
      .select('id, nome')
      .eq('telefone', registro.telefone)
      .limit(1)
      .maybeSingle();

    if (existente) {
      return {
        ok: false,
        erro: `Já existe um lead com este telefone: ${existente.nome}. Abra o funil para ver em que pé está.`,
      };
    }
  }

  const { error } = await supabase
    .from('leads')
    .insert({ ...registro, consentimento_lgpd: false });

  if (error) {
    console.error('[prospeccao] falha ao importar:', error);
    if (error.message.includes('leads_origem_check')) {
      return {
        ok: false,
        erro: 'O banco ainda não conhece a origem "prospeccao". Rode a migration 0011.',
      };
    }
    return { ok: false, erro: 'Não foi possível trazer esta empresa para o funil.' };
  }

  revalidatePath('/leads');
  revalidatePath('/prospeccao');
  return { ok: true, mensagem: `${prospecto.nome} entrou no funil, com você como responsável.` };
}
