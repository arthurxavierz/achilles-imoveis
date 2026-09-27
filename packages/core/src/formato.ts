/**
 * Formatacao para o padrao brasileiro. Sem dependencia externa: tudo
 * sai de Intl, que ja vem no Node e no navegador.
 */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const MOEDA_CENTAVOS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMERO = new Intl.NumberFormat('pt-BR');

/** 2850000 -> "R$ 2.850.000" */
export function brl(valor: number | null | undefined): string {
  return MOEDA.format(Number(valor ?? 0));
}

/** 1234.56 -> "R$ 1.234,56". Use no financeiro, onde centavo importa. */
export function brlExato(valor: number | null | undefined): string {
  return MOEDA_CENTAVOS.format(Number(valor ?? 0));
}

/** 2850000 -> "R$ 2,85 mi". Para cartao e KPI, onde espaco e curto. */
export function brlCurto(valor: number | null | undefined): string {
  const v = Number(valor ?? 0);
  if (v >= 1_000_000) {
    const mi = v / 1_000_000;
    return `R$ ${NUMERO.format(Number(mi.toFixed(mi >= 10 ? 1 : 2)))} mi`;
  }
  if (v >= 1_000) return `R$ ${NUMERO.format(Math.round(v / 1000))} mil`;
  return brl(v);
}

/** 412 -> "412 m²" */
export function area(m2: number | null | undefined): string {
  return `${NUMERO.format(Number(m2 ?? 0))} m²`;
}

export function numero(v: number | null | undefined): string {
  return NUMERO.format(Number(v ?? 0));
}

/** "2026-08-17" ou ISO completo -> "17/08/2026" */
export function data(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('pt-BR');
}

/** "17/08/2026 às 14:30" */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** "há 12 minutos", "há 3 dias". Para o feed de atividade. */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '--';
  const seg = Math.floor((Date.now() - d) / 1000);
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  return data(iso);
}

/** "34999110001" -> "(34) 99911-0001" */
export function telefone(v: string | null | undefined): string {
  const d = String(v ?? '').replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(v ?? '');
}

/** Numero pronto para o link do WhatsApp: 5534999110001 */
export function telefoneWhatsApp(v: string | null | undefined): string {
  const d = String(v ?? '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
}

/** Iniciais para o avatar: "Diego Martins" -> "DM" */
export function iniciais(nome: string | null | undefined): string {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '--';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Mesmo par de strings do translate() usado pela funcao slugify() do
// banco, na migration 0002. Manter os dois lados identicos garante que o
// slug calculado no frontend bate com o que o Postgres gravou.
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn';

/**
 * Mesma regra do slugify() do banco (migration 0002). Serve para montar
 * links no frontend sem precisar de ida ao servidor.
 */
export function slugify(txt: string): string {
  let s = '';
  for (const ch of String(txt ?? '').toLowerCase()) {
    const i = COM_ACENTO.indexOf(ch);
    s += i >= 0 ? SEM_ACENTO[i] : ch;
  }
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** "2026-08" -> "Agosto de 2026" */
export function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${nomes[(mes || 1) - 1]} de ${ano}`;
}
