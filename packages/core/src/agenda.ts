/**
 * Agenda da equipe.
 *
 * O fuso e sempre America/Sao_Paulo, mesmo que o servidor rode em UTC.
 * Isso nao e detalhe: um compromisso das 21h30 gravado em UTC cai no dia
 * seguinte se alguem calcular "o dia" com o fuso do servidor, e o
 * corretor abre a agenda de terca sem ver a visita que marcou para
 * segunda a noite.
 */

export const FUSO = 'America/Sao_Paulo';

export type TipoCompromisso =
  | 'visita'
  | 'reuniao'
  | 'plantao'
  | 'captacao'
  | 'assinatura'
  | 'pessoal'
  | 'outro';

export type StatusCompromisso =
  | 'agendado'
  | 'confirmado'
  | 'concluido'
  | 'cancelado'
  | 'remarcado';

export interface Compromisso {
  id: string;
  titulo: string;
  observacao: string | null;
  tipo: TipoCompromisso;
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  responsavel_id: string;
  criado_por: string | null;
  imovel_id: string | null;
  lead_id: string | null;
  status: StatusCompromisso;
  travado: boolean;
  lembrete_minutos: number;
  canais: string[];
  notificado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Compromisso com os nomes ja resolvidos, como vem das telas de lista. */
export interface CompromissoDetalhado extends Compromisso {
  responsavel_nome: string;
  criado_por_nome: string | null;
  imovel_titulo: string | null;
  lead_nome: string | null;
}

export const TIPOS_COMPROMISSO: {
  chave: TipoCompromisso;
  rotulo: string;
  cor: string;
}[] = [
  { chave: 'visita', rotulo: 'Visita', cor: 'marinho' },
  { chave: 'reuniao', rotulo: 'Reunião', cor: 'roxo' },
  { chave: 'plantao', rotulo: 'Plantão', cor: 'ouro' },
  { chave: 'captacao', rotulo: 'Captação', cor: 'verde' },
  { chave: 'assinatura', rotulo: 'Assinatura', cor: 'ambar' },
  { chave: 'pessoal', rotulo: 'Pessoal', cor: 'cinza' },
  { chave: 'outro', rotulo: 'Outro', cor: 'cinza' },
];

export const STATUS_COMPROMISSO: Record<StatusCompromisso, { rotulo: string; cor: string }> = {
  agendado: { rotulo: 'Agendado', cor: 'marinho' },
  confirmado: { rotulo: 'Confirmado', cor: 'verde' },
  concluido: { rotulo: 'Concluído', cor: 'cinza' },
  cancelado: { rotulo: 'Cancelado', cor: 'rubro' },
  remarcado: { rotulo: 'Remarcado', cor: 'ambar' },
};

export const rotuloTipo = (tipo: TipoCompromisso): string =>
  TIPOS_COMPROMISSO.find((t) => t.chave === tipo)?.rotulo ?? 'Outro';

export const corTipo = (tipo: TipoCompromisso): string =>
  TIPOS_COMPROMISSO.find((t) => t.chave === tipo)?.cor ?? 'cinza';

// ------------------------------------------------------------
// PERMISSAO
// ------------------------------------------------------------

/**
 * Espelha a funcao pode_gerir_compromisso() do banco (migration 0006).
 *
 * O banco e quem decide de verdade. Esta copia existe para a interface
 * nao mostrar um botao de excluir que vai falhar: e frustrante clicar em
 * apagar e receber erro de permissao.
 */
export function podeGerirCompromisso(
  usuario: { id: string; papel: string } | null | undefined,
  compromisso: Pick<Compromisso, 'responsavel_id' | 'travado'>,
): boolean {
  if (!usuario) return false;
  if (usuario.papel === 'admin' || usuario.papel === 'gestor') return true;
  if (compromisso.travado) return false;
  return compromisso.responsavel_id === usuario.id;
}

// ------------------------------------------------------------
// DATAS
// ------------------------------------------------------------

/**
 * Converte o instante gravado no banco para a data local no formato
 * AAAA-MM-DD, no fuso de Uberlandia.
 *
 * O caminho pelo "en-CA" e proposital: e a unica localidade que o Intl
 * formata nativamente como AAAA-MM-DD, o que evita montar a string a
 * mao e errar o zero a esquerda.
 */
export function diaLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** "14:30" no fuso de Uberlandia. */
export function horaLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** "14:30 às 15:30" ou "Dia inteiro". */
export function faixaHoraria(c: Pick<Compromisso, 'inicio' | 'fim' | 'dia_inteiro'>): string {
  if (c.dia_inteiro) return 'Dia inteiro';
  return `${horaLocal(c.inicio)} às ${horaLocal(c.fim)}`;
}

/** Minutos desde a meia-noite local. Posiciona o bloco na grade do dia. */
export function minutosDoDia(iso: string): number {
  const [h, m] = horaLocal(iso).split(':').map(Number);
  return h * 60 + m;
}

export function duracaoMinutos(c: Pick<Compromisso, 'inicio' | 'fim'>): number {
  return Math.max(15, Math.round((new Date(c.fim).getTime() - new Date(c.inicio).getTime()) / 60000));
}

/**
 * Monta o instante UTC a partir do que a pessoa digitou nos campos de
 * data e hora locais.
 *
 * O truque do deslocamento existe porque o navegador do usuario pode
 * estar em outro fuso (um gestor viajando, ou um celular configurado
 * errado). Sem isso, "14:00" digitado em Lisboa gravaria 14:00 de
 * Lisboa, e a visita apareceria as 10:00 para a equipe em Uberlandia.
 */
export function montarInstante(data: string, hora: string): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);

  // Primeiro chute: trata o que foi digitado como se fosse UTC.
  const chute = Date.UTC(ano, mes - 1, dia, h, m, 0);

  // Descobre quantos minutos o fuso de Uberlandia estava deslocado
  // naquele instante e corrige. Cobre horario de verao automaticamente.
  const deslocamento = deslocamentoFuso(new Date(chute));
  return new Date(chute - deslocamento * 60000).toISOString();
}

/** Minutos de diferenca entre o fuso de Uberlandia e o UTC na data dada. */
function deslocamentoFuso(instante: Date): number {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const partes: Record<string, string> = {};
  for (const p of formatador.formatToParts(instante)) {
    if (p.type !== 'literal') partes[p.type] = p.value;
  }

  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) === 24 ? 0 : Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );

  return (comoUtc - instante.getTime()) / 60000;
}

/** Campos de data e hora prontos para preencher o formulario de edicao. */
export function separarInstante(iso: string): { data: string; hora: string } {
  return { data: diaLocal(iso), hora: horaLocal(iso) };
}

/** "Segunda-feira, 18 de agosto" */
export function rotuloDia(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  const data = new Date(ano, mes - 1, d);
  const texto = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Hoje", "Amanhã", ou o rotulo completo do dia. */
export function rotuloDiaRelativo(dia: string): string {
  const hoje = diaLocal(new Date());
  if (dia === hoje) return 'Hoje';

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (dia === diaLocal(amanha)) return 'Amanhã';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  if (dia === diaLocal(ontem)) return 'Ontem';

  return rotuloDia(dia);
}

/**
 * Todos os dias que a grade do mes precisa mostrar, incluindo os dias
 * vizinhos que completam a primeira e a ultima semana. A grade sempre
 * comeca no domingo, como o calendario de parede brasileiro.
 */
export function gradeDoMes(ano: number, mes: number): string[] {
  const primeiro = new Date(ano, mes - 1, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(inicio.getDate() - primeiro.getDay());

  const dias: string[] = [];
  const cursor = new Date(inicio);

  // Seis semanas cobrem qualquer mes, inclusive fevereiro comecando no
  // sabado. Numero fixo evita a grade mudar de altura entre meses.
  for (let i = 0; i < 42; i++) {
    dias.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate(),
      ).padStart(2, '0')}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

/** Os sete dias da semana que contem a data informada, domingo a sabado. */
export function gradeDaSemana(dia: string): string[] {
  const [ano, mes, d] = dia.split('-').map(Number);
  const base = new Date(ano, mes - 1, d);
  base.setDate(base.getDate() - base.getDay());

  return Array.from({ length: 7 }, (_, i) => {
    const atual = new Date(base);
    atual.setDate(base.getDate() + i);
    return `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}-${String(
      atual.getDate(),
    ).padStart(2, '0')}`;
  });
}

export const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const NOMES_DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Agrupa por dia local, pronto para a lista e para a grade do mes. */
export function agruparPorDia<T extends { inicio: string }>(itens: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();

  for (const item of itens) {
    const dia = diaLocal(item.inicio);
    const lista = mapa.get(dia) ?? [];
    lista.push(item);
    mapa.set(dia, lista);
  }

  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  return mapa;
}

/** Compromissos que se sobrepoem no tempo, para avisar antes de salvar. */
export function detectarConflitos<T extends { id: string; inicio: string; fim: string }>(
  compromissos: T[],
  novo: { inicio: string; fim: string },
  ignorarId?: string,
): T[] {
  const inicio = new Date(novo.inicio).getTime();
  const fim = new Date(novo.fim).getTime();

  return compromissos.filter((c) => {
    if (ignorarId && c.id === ignorarId) return false;
    return new Date(c.inicio).getTime() < fim && new Date(c.fim).getTime() > inicio;
  });
}
