/**
 * Leitura e escrita da base de demonstração, no formato que cada tela
 * do painel espera.
 *
 * As funções aqui fazem o que o banco faria: juntam os nomes das
 * pessoas aos registros, aplicam o mesmo recorte de permissão do RLS e
 * reproduzem os efeitos em cascata (concluir uma venda tira o imóvel da
 * vitrine, por exemplo). Sem isso a demonstração enganaria: pareceria
 * funcionar e depois se comportaria diferente com o banco real.
 */

import type {
  BaseIndicadores,
  Compromisso,
  Foto,
  CompromissoDetalhado,
  Imovel,
  ImovelDaVenda,
  Interacao,
  Lead,
  Perfil,
  Prospecto,
  Proprietario,
  ProprietarioComCarteira,
  Venda,
  VendaDetalhada,
  VendaParcela,
} from '@imob/core';
import {
  permissoesPadrao,
  pontuarProspecto,
  resumirCarteira,
  slugify,
  validarAlteracaoAcesso,
} from '@imob/core';
import { alterarBase, lerBase, novoId, proximoCodigo } from '@imob/demo';

function nomes(): Map<string, string> {
  return new Map(lerBase().perfis.map((p) => [p.id, p.nome]));
}

// ------------------------------------------------------------
// AGENDA
// ------------------------------------------------------------

export function compromissosDemo(inicio: Date, fim: Date): CompromissoDetalhado[] {
  const base = lerBase();
  const porPessoa = nomes();
  const porImovel = new Map(base.imoveis.map((i) => [i.id, i.titulo]));
  const porLead = new Map(base.leads.map((l) => [l.id, l.nome]));

  return base.compromissos
    .filter((c) => c.inicio >= inicio.toISOString() && c.inicio <= fim.toISOString())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((c) => ({
      ...c,
      responsavel_nome: porPessoa.get(c.responsavel_id) ?? 'Sem responsável',
      criado_por_nome: c.criado_por ? (porPessoa.get(c.criado_por) ?? null) : null,
      imovel_titulo: c.imovel_id ? (porImovel.get(c.imovel_id) ?? null) : null,
      lead_nome: c.lead_id ? (porLead.get(c.lead_id) ?? null) : null,
    }));
}

/**
 * Mesma regra da função pode_gerir_compromisso() do banco. Repetida aqui
 * porque na demonstração não há Postgres recusando a operação, e sem
 * isso o corretor conseguiria apagar o plantão que a gestão fixou.
 */
function podeGerir(usuario: Perfil, compromisso: Compromisso): boolean {
  if (usuario.papel === 'admin' || usuario.papel === 'gestor') return true;
  if (compromisso.travado) return false;
  return compromisso.responsavel_id === usuario.id;
}

export function salvarCompromissoDemo(
  usuario: Perfil,
  dados: Partial<Compromisso> & { id?: string },
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();

    if (dados.id) {
      const indice = base.compromissos.findIndex((c) => c.id === dados.id);
      if (indice < 0) return { ok: false, erro: 'Compromisso não encontrado.' };

      if (!podeGerir(usuario, base.compromissos[indice])) {
        return {
          ok: false,
          erro: 'Este compromisso foi fixado pela gestão e não pode ser alterado por você.',
        };
      }

      base.compromissos[indice] = {
        ...base.compromissos[indice],
        ...dados,
        atualizado_em: agora,
      } as Compromisso;

      return { ok: true };
    }

    base.compromissos.push({
      id: novoId(),
      titulo: dados.titulo ?? 'Sem título',
      observacao: dados.observacao ?? null,
      tipo: dados.tipo ?? 'visita',
      inicio: dados.inicio!,
      fim: dados.fim!,
      dia_inteiro: dados.dia_inteiro ?? false,
      local: dados.local ?? null,
      responsavel_id: dados.responsavel_id ?? usuario.id,
      criado_por: usuario.id,
      imovel_id: dados.imovel_id ?? null,
      lead_id: dados.lead_id ?? null,
      status: dados.status ?? 'agendado',
      travado: dados.travado ?? false,
      lembrete_minutos: dados.lembrete_minutos ?? 60,
      canais: ['app'],
      notificado_em: null,
      criado_em: agora,
      atualizado_em: agora,
    });

    return { ok: true };
  });
}

export function excluirCompromissoDemo(
  usuario: Perfil,
  id: string,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const alvo = base.compromissos.find((c) => c.id === id);
    if (!alvo) return { ok: false, erro: 'Compromisso não encontrado.' };

    if (!podeGerir(usuario, alvo)) {
      return { ok: false, erro: 'Você não tem permissão para excluir este compromisso.' };
    }

    base.compromissos = base.compromissos.filter((c) => c.id !== id);
    return { ok: true };
  });
}

export function statusCompromissoDemo(
  usuario: Perfil,
  id: string,
  status: string,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const alvo = base.compromissos.find((c) => c.id === id);
    if (!alvo) return { ok: false, erro: 'Compromisso não encontrado.' };

    if (!podeGerir(usuario, alvo)) {
      return { ok: false, erro: 'Você não tem permissão para alterar este compromisso.' };
    }

    alvo.status = status as Compromisso['status'];
    alvo.atualizado_em = new Date().toISOString();
    return { ok: true };
  });
}

// ------------------------------------------------------------
// FINANCEIRO
// ------------------------------------------------------------

export function vendasDemo(status?: string, de?: string, ate?: string): VendaDetalhada[] {
  const base = lerBase();
  const porPessoa = nomes();

  return base.vendas
    .filter((v) => !status || v.status === status)
    .filter((v) => (!de || v.data_proposta >= de) && (!ate || v.data_proposta <= ate))
    .sort((a, b) => b.data_proposta.localeCompare(a.data_proposta))
    .map((v) => ({
      ...v,
      consultor_nome: v.consultor_id ? (porPessoa.get(v.consultor_id) ?? null) : null,
      captador_nome: v.captador_id ? (porPessoa.get(v.captador_id) ?? null) : null,
    }));
}

/** Espelha salvarParcela na base de demonstração. */
export function salvarParcelaDemo(
  usuario: Perfil,
  dados: Partial<VendaParcela> & { id?: string; venda_id?: string },
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    if (dados.id) {
      const parcela = base.parcelas.find((p) => p.id === dados.id);
      if (!parcela) return { ok: false, erro: 'Parcela não encontrada.' };
      Object.assign(parcela, dados);
      return { ok: true };
    }

    if (!dados.venda_id) return { ok: false, erro: 'Escolha o negócio da parcela.' };

    base.parcelas.push({
      id: novoId(),
      venda_id: dados.venda_id,
      descricao: dados.descricao ?? 'Parcela',
      beneficiario_id: dados.beneficiario_id ?? null,
      destino: dados.destino ?? 'casa',
      valor: Number(dados.valor ?? 0),
      vencimento: dados.vencimento ?? new Date().toISOString().slice(0, 10),
      pago_em: dados.pago_em ?? null,
      status: dados.status ?? 'pendente',
      observacoes: dados.observacoes ?? null,
      criado_em: new Date().toISOString(),
    } as VendaParcela);

    return { ok: true };
  });
}

/** Espelha excluirParcela: só a gestão. */
export function excluirParcelaDemo(usuario: Perfil, id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
      return { ok: false, erro: 'Apenas a gestão exclui uma parcela.' };
    }
    base.parcelas = base.parcelas.filter((p) => p.id !== id);
    return { ok: true };
  });
}

/** Espelha aplicarEfeitoNoImovel na base de demonstração. */
export function efeitoNoImovelDemo(imovelId: string, efeito: 'tirar_do_ar' | 'excluir'): void {
  alterarBase((base) => {
    if (efeito === 'excluir') {
      base.imoveis = base.imoveis.filter((i) => i.id !== imovelId);
      return;
    }

    const imovel = base.imoveis.find((i) => i.id === imovelId);
    if (imovel) Object.assign(imovel, { publicado: false, destaque: false });
  });
}

/** Espelha excluirVenda: some com o lançamento e com as parcelas dele. */
export function excluirVendaDemo(usuario: Perfil, id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
      return { ok: false, erro: 'Apenas a gestão exclui um negócio em definitivo.' };
    }

    base.vendas = base.vendas.filter((v) => v.id !== id);
    base.parcelas = base.parcelas.filter((p) => p.venda_id !== id);
    return { ok: true };
  });
}

/** Espelha carregarCarteira: o que ainda pode ser negociado. */
export function carteiraParaVendaDemo(): ImovelDaVenda[] {
  return lerBase()
    .imoveis.filter((i) => i.status === 'disponivel' || i.status === 'reservado')
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((i) => ({
      id: i.id,
      codigo: i.codigo,
      titulo: i.titulo,
      bairro: i.bairro,
      cidade: i.cidade,
      valor: Number(i.valor),
      valor_locacao: i.valor_locacao === null ? null : Number(i.valor_locacao),
      status: i.status,
      publicado: i.publicado,
    }));
}

export function parcelasDemo(): VendaParcela[] {
  return [...lerBase().parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Recalcula as colunas que no banco são geradas pelo Postgres. */
function derivar(v: Venda): Venda {
  const bruta = arredondar((v.valor_venda * v.percentual_comissao) / 100);
  const casa = arredondar(bruta * (v.percentual_casa / 100));
  const captador = arredondar(bruta * (v.percentual_captador / 100));

  return {
    ...v,
    desconto: Math.max(0, arredondar(v.valor_tabela - v.valor_venda)),
    comissao_bruta: bruta,
    comissao_casa: casa,
    comissao_captador: captador,
    comissao_consultor: arredondar(bruta - casa - captador),
    margem: arredondar(casa - v.custos),
  };
}

/**
 * Efeitos de concluir uma venda, iguais aos do gatilho do banco: o
 * imóvel sai da vitrine, o lead vinculado fecha e a data é preenchida.
 */
function aoConcluir(base: ReturnType<typeof lerBase>, venda: Venda): void {
  if (!venda.data_conclusao) venda.data_conclusao = new Date().toISOString().slice(0, 10);

  if (venda.imovel_id) {
    const imovel = base.imoveis.find((i) => i.id === venda.imovel_id);
    if (imovel) {
      imovel.status = venda.tipo === 'locacao' ? 'locado' : 'vendido';
      imovel.publicado = false;
      imovel.destaque = false;
      imovel.atualizado_em = new Date().toISOString();
    }
  }

  if (venda.lead_id) {
    const lead = base.leads.find((l) => l.id === venda.lead_id);
    if (lead) lead.etapa = 'fechado';
  }
}

export function salvarVendaDemo(
  usuario: Perfil,
  dados: Partial<Venda> & { id?: string },
): { ok: boolean; erro?: string; codigo?: string } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();

    if (dados.id) {
      const indice = base.vendas.findIndex((v) => v.id === dados.id);
      if (indice < 0) return { ok: false, erro: 'Negócio não encontrado.' };

      const atual = base.vendas[indice];
      const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
      const donoPodendo =
        atual.consultor_id === usuario.id && ['proposta', 'aprovada'].includes(atual.status);

      if (!gestor && !donoPodendo) {
        return {
          ok: false,
          erro: 'Negócio concluído vira histórico contábil e só a gestão pode alterar.',
        };
      }

      const atualizado = derivar({ ...atual, ...dados, atualizado_em: agora } as Venda);

      if (atualizado.status === 'concluida' && atual.status !== 'concluida') {
        aoConcluir(base, atualizado);
      }

      base.vendas[indice] = atualizado;
      return { ok: true, codigo: atualizado.codigo };
    }

    const nova = derivar({
      id: novoId(),
      codigo: proximoCodigo('VEN', base.vendas),
      tipo: dados.tipo ?? 'venda',
      imovel_id: dados.imovel_id ?? null,
      imovel_titulo: dados.imovel_titulo ?? 'Imóvel',
      lead_id: dados.lead_id ?? null,
      comprador_nome: dados.comprador_nome ?? '',
      comprador_telefone: dados.comprador_telefone ?? null,
      comprador_email: dados.comprador_email ?? null,
      proprietario_nome: dados.proprietario_nome ?? null,
      valor_tabela: dados.valor_tabela ?? 0,
      valor_venda: dados.valor_venda ?? 0,
      desconto: 0,
      forma_pagamento: dados.forma_pagamento ?? 'financiado',
      entrada: dados.entrada ?? 0,
      valor_financiado: dados.valor_financiado ?? 0,
      banco: dados.banco ?? null,
      percentual_comissao: dados.percentual_comissao ?? 6,
      percentual_casa: dados.percentual_casa ?? 50,
      percentual_captador: dados.percentual_captador ?? 0,
      comissao_bruta: 0,
      comissao_casa: 0,
      comissao_captador: 0,
      comissao_consultor: 0,
      custos: dados.custos ?? 0,
      margem: 0,
      consultor_id: dados.consultor_id ?? usuario.id,
      captador_id: dados.captador_id ?? null,
      status: dados.status ?? 'proposta',
      data_proposta: dados.data_proposta ?? agora.slice(0, 10),
      data_assinatura: dados.data_assinatura ?? null,
      data_conclusao: dados.data_conclusao ?? null,
      motivo_cancelamento: dados.motivo_cancelamento ?? null,
      observacoes: dados.observacoes ?? null,
      criado_por: usuario.id,
      criado_em: agora,
      atualizado_em: agora,
    });

    if (nova.status === 'concluida') aoConcluir(base, nova);

    base.vendas.push(nova);

    // Parcelas sugeridas, como faz a ação real ao criar o negócio.
    if (nova.comissao_bruta > 0) {
      const sinal = arredondar(nova.comissao_bruta * 0.3);
      const somarDias = (dias: number) => {
        const d = new Date(nova.data_proposta);
        d.setDate(d.getDate() + dias);
        return d.toISOString().slice(0, 10);
      };

      const parcelas =
        nova.forma_pagamento === 'a_vista'
          ? [{ descricao: 'Comissão integral', valor: nova.comissao_bruta, vencimento: somarDias(7) }]
          : [
              { descricao: 'Sinal na assinatura', valor: sinal, vencimento: somarDias(5) },
              {
                descricao: 'Saldo na liberação do recurso',
                valor: arredondar(nova.comissao_bruta - sinal),
                vencimento: somarDias(45),
              },
            ];

      for (const p of parcelas) {
        base.parcelas.push({
          id: novoId(),
          venda_id: nova.id,
          descricao: p.descricao,
          beneficiario_id: null,
          destino: 'casa',
          valor: p.valor,
          vencimento: p.vencimento,
          pago_em: null,
          status: 'pendente',
          observacoes: null,
          criado_em: agora,
        });
      }
    }

    return { ok: true, codigo: nova.codigo };
  });
}

export function statusVendaDemo(
  usuario: Perfil,
  id: string,
  status: string,
  motivo?: string,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const venda = base.vendas.find((v) => v.id === id);
    if (!venda) return { ok: false, erro: 'Negócio não encontrado.' };

    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
    if (!gestor && venda.consultor_id !== usuario.id) {
      return { ok: false, erro: 'Este negócio é de outro consultor.' };
    }

    venda.status = status as Venda['status'];
    if (motivo) venda.motivo_cancelamento = motivo;
    venda.atualizado_em = new Date().toISOString();

    if (status === 'concluida') aoConcluir(base, venda);

    return { ok: true };
  });
}

export function baixarParcelaDemo(id: string, pago: boolean): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const parcela = base.parcelas.find((p) => p.id === id);
    if (!parcela) return { ok: false, erro: 'Parcela não encontrada.' };

    parcela.status = pago ? 'pago' : 'pendente';
    parcela.pago_em = pago ? new Date().toISOString().slice(0, 10) : null;
    return { ok: true };
  });
}

// ------------------------------------------------------------
// LEADS
// ------------------------------------------------------------

/** Aplica o mesmo recorte do RLS: gestão vê tudo, corretor vê os seus. */
export function leadsDemo(usuario: Perfil, incluirArquivados = false): Lead[] {
  const base = lerBase();
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  return base.leads
    .filter((l) => incluirArquivados || !l.arquivado)
    .filter((l) => gestor || l.corretor_id === usuario.id || l.corretor_id === null)
    .sort((a, b) => b.score - a.score);
}

export function moverLeadDemo(id: string, etapa: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const lead = base.leads.find((l) => l.id === id);
    if (!lead) return { ok: false, erro: 'Lead não encontrado.' };

    lead.etapa = etapa as Lead['etapa'];
    lead.atualizado_em = new Date().toISOString();
    return { ok: true };
  });
}

export function assumirLeadDemo(usuario: Perfil, id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const lead = base.leads.find((l) => l.id === id);
    if (!lead) return { ok: false, erro: 'Lead não encontrado.' };
    if (lead.corretor_id) return { ok: false, erro: 'Este lead já tem responsável.' };

    lead.corretor_id = usuario.id;
    lead.atualizado_em = new Date().toISOString();
    return { ok: true };
  });
}

export function salvarLeadDemo(
  usuario: Perfil,
  dados: Partial<Lead> & { id?: string },
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();

    if (dados.id) {
      const indice = base.leads.findIndex((l) => l.id === dados.id);
      if (indice < 0) return { ok: false, erro: 'Lead não encontrado.' };
      base.leads[indice] = { ...base.leads[indice], ...dados, atualizado_em: agora } as Lead;
      return { ok: true };
    }

    base.leads.push({
      id: novoId(),
      nome: dados.nome ?? '',
      telefone: dados.telefone ?? null,
      email: dados.email ?? null,
      mensagem: dados.mensagem ?? null,
      origem: dados.origem ?? 'manual',
      etapa: dados.etapa ?? 'novo',
      temperatura: dados.temperatura ?? 'morno',
      score: dados.score ?? 50,
      imovel_id: dados.imovel_id ?? null,
      imovel_titulo: dados.imovel_titulo ?? null,
      valor: dados.valor ?? 0,
      corretor_id: dados.corretor_id ?? usuario.id,
      consentimento_lgpd: true,
      consentimento_em: agora,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      pagina_origem: null,
      arquivado: false,
      motivo_perda: null,
      proximo_contato: dados.proximo_contato ?? null,
      criado_em: agora,
      atualizado_em: agora,
    });

    return { ok: true };
  });
}

// ------------------------------------------------------------
// IMÓVEIS
// ------------------------------------------------------------

export function imoveisDemo(): Imovel[] {
  return [...lerBase().imoveis].sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
}

export function alterarImovelDemo(
  usuario: Perfil,
  id: string,
  mudancas: Partial<Imovel>,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const imovel = base.imoveis.find((i) => i.id === id);
    if (!imovel) return { ok: false, erro: 'Imóvel não encontrado.' };

    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
    if (!gestor && imovel.corretor_id !== usuario.id) {
      return {
        ok: false,
        erro: 'Este imóvel está na carteira de outro consultor. Só ele ou a gestão pode alterá-lo.',
      };
    }

    /**
     * Espelha o gatilho da migration 0012.
     *
     * Vincular era chave mestra: o corretor lia o proprietario_id de um
     * imóvel alheio, gravava esse id num imóvel seu, e a leitura do
     * proprietário passava a ser liberada porque agora existia vínculo.
     * Aqui a conferência é feita antes da escrita, com o mundo de antes
     * dela, que é a mesma pergunta que o banco faz: já tinha acesso, ou
     * está tentando conquistá-lo agora?
     */
    const novoDono = mudancas.proprietario_id;

    if (
      novoDono &&
      novoDono !== imovel.proprietario_id &&
      !alcancaProprietario(base, usuario, novoDono)
    ) {
      return {
        ok: false,
        erro: 'Este proprietário não está na sua carteira. Vincule apenas quem você cadastrou ou quem já é dono de outro imóvel seu.',
      };
    }

    Object.assign(imovel, mudancas, { atualizado_em: new Date().toISOString() });
    return { ok: true };
  });
}

/** Espelha buscarFichaImovel: um imóvel inteiro, pelo id. */
export function fichaImovelDemo(id: string): Imovel | null {
  return lerBase().imoveis.find((i) => i.id === id) ?? null;
}

/**
 * Espelha buscarContatoProprietario.
 *
 * Aqui a regra precisa ser dita em JavaScript, porque na demonstração
 * não existe Postgres recusando a linha. É a mesma conta que a política
 * da 0012 faz, pela mesma função que o resto da demonstração já usa, e é
 * o que faz a demonstração esconder exatamente o que a produção esconde.
 */
export function contatoProprietarioDemo(
  usuario: Perfil,
  imovelId: string,
):
  | { estado: 'sem-proprietario' }
  | { estado: 'sem-acesso' }
  | { estado: 'ok'; nome: string; telefone: string | null; email: string | null } {
  const base = lerBase();

  const imovel = base.imoveis.find((i) => i.id === imovelId);
  if (!imovel?.proprietario_id) return { estado: 'sem-proprietario' };

  if (!podeVerProprietarioDemo(usuario, imovel.proprietario_id)) return { estado: 'sem-acesso' };

  const dono = base.proprietarios.find((p) => p.id === imovel.proprietario_id);
  if (!dono) return { estado: 'sem-proprietario' };

  return {
    estado: 'ok',
    nome: dono.nome,
    telefone: dono.telefone ?? null,
    email: dono.email ?? null,
  };
}

/**
 * Espelha buscarCapas na base de demonstração.
 *
 * A base começa sem foto nenhuma, e não é falha: o arquivo em si mora no
 * Storage do Supabase, que é justamente o que não existe quando o
 * sistema roda sem banco. Então a lista abre com o bloco neutro em todas
 * as linhas, que é o mesmo caminho de um imóvel sem foto no banco de
 * verdade.
 *
 * O mapa deixa de ficar vazio quando alguém usa a aba de fotos: a
 * demonstração guarda o caminho como o banco guardaria, e a miniatura
 * passa a apontar para lá. A imagem só aparece de fato se aquele caminho
 * existir num Storage alcançável, o que na demonstração pura não
 * acontece — e é isso mesmo, porque prometer imagem aqui faria a
 * demonstração mostrar uma tela que a produção não entrega.
 */
export function capasDemo(ids: string[]): Record<string, string> {
  const alvos = new Set(ids);

  const fotos = (lerBase().fotos ?? [])
    .filter((f) => alvos.has(f.imovel_id))
    .sort((a, b) => Number(b.capa) - Number(a.capa) || a.ordem - b.ordem);

  const capas: Record<string, string> = {};
  for (const foto of fotos) {
    if (!capas[foto.imovel_id]) capas[foto.imovel_id] = foto.path;
  }

  return capas;
}

export function contarImoveisDemo() {
  const imoveis = lerBase().imoveis;
  return {
    total: imoveis.length,
    publicados: imoveis.filter((i) => i.publicado).length,
    reservados: imoveis.filter((i) => i.status === 'reservado').length,
  };
}

// ------------------------------------------------------------
// IMÓVEIS: CADASTRO, EDIÇÃO E EXCLUSÃO
// ------------------------------------------------------------

/**
 * Grava um imóvel novo ou altera um existente.
 *
 * O `proprietario_id` chega obrigatório da ação, e é conferido aqui
 * também. Repetir a checagem não é desconfiança do código que chama: é
 * que esta função é o único ponto por onde imóvel entra na base da
 * demonstração, e uma regra que vale sempre pertence ao lugar por onde
 * tudo passa, não a cada chamador que precisa lembrar dela.
 */
export function salvarImovelDemo(
  usuario: Perfil,
  dados: Partial<Imovel> & { id?: string },
): { ok: boolean; erro?: string; id?: string } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();
    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

    if (!dados.proprietario_id) {
      return { ok: false, erro: 'Todo imóvel precisa de um proprietário vinculado.' };
    }
    if (!base.proprietarios.some((p) => p.id === dados.proprietario_id)) {
      return { ok: false, erro: 'Proprietário não encontrado. Cadastre-o antes.' };
    }

    /**
     * Mesmo crivo do gatilho da 0012, aqui também.
     *
     * Vale para o imóvel novo e para o editado: salvar a ficha inteira é
     * outro caminho para gravar proprietario_id, e um caminho que
     * escapasse da conferência tornaria o gatilho decorativo. A gestão
     * passa direto, que é o ponto do papel.
     */
    const jaEraDele =
      Boolean(dados.id) &&
      base.imoveis.some((i) => i.id === dados.id && i.proprietario_id === dados.proprietario_id);

    if (!jaEraDele && !alcancaProprietario(base, usuario, dados.proprietario_id)) {
      return {
        ok: false,
        erro: 'Este proprietário não está na sua carteira. Vincule apenas quem você cadastrou ou quem já é dono de outro imóvel seu.',
      };
    }

    if (dados.id) {
      const indice = base.imoveis.findIndex((i) => i.id === dados.id);
      if (indice < 0) return { ok: false, erro: 'Imóvel não encontrado.' };

      const atual = base.imoveis[indice];
      if (!gestor && atual.corretor_id !== usuario.id) {
        return {
          ok: false,
          erro: 'Este imóvel está na carteira de outro consultor. Só ele ou a gestão pode alterá-lo.',
        };
      }

      base.imoveis[indice] = { ...atual, ...dados, atualizado_em: agora } as Imovel;
      return { ok: true, id: atual.id };
    }

    const id = novoId();
    const titulo = dados.titulo ?? 'Imóvel sem título';

    base.imoveis.push({
      id,
      codigo: proximoCodigo('BST', base.imoveis),
      // O sufixo com o id curto evita colisão de slug entre dois
      // imóveis de mesmo título, que no alto padrão acontece muito:
      // duas unidades do mesmo andar do mesmo prédio.
      slug: `${slugify(titulo)}-${id.slice(0, 6)}`,

      titulo,
      descricao: dados.descricao ?? null,
      tipo: dados.tipo ?? 'Apartamento',
      finalidade: dados.finalidade ?? 'venda',
      status: dados.status ?? 'disponivel',

      cep: dados.cep ?? null,
      logradouro: dados.logradouro ?? null,
      numero: dados.numero ?? null,
      complemento: dados.complemento ?? null,
      bairro: dados.bairro ?? null,
      cidade: dados.cidade ?? 'Uberlândia',
      uf: dados.uf ?? 'MG',
      latitude: null,
      longitude: null,
      exibir_endereco: dados.exibir_endereco ?? false,

      valor: dados.valor ?? 0,
      valor_locacao: dados.valor_locacao ?? null,
      valor_condominio: dados.valor_condominio ?? null,
      valor_iptu: dados.valor_iptu ?? null,
      aceita_permuta: dados.aceita_permuta ?? false,
      aceita_financiamento: dados.aceita_financiamento ?? true,

      area_util: dados.area_util ?? 0,
      area_total: dados.area_total ?? 0,
      hectares: dados.hectares ?? null,
      quartos: dados.quartos ?? 0,
      suites: dados.suites ?? 0,
      banheiros: dados.banheiros ?? 0,
      vagas: dados.vagas ?? 0,
      ano_construcao: dados.ano_construcao ?? null,
      andar: dados.andar ?? null,
      mobiliado: dados.mobiliado ?? false,
      caracteristicas: dados.caracteristicas ?? [],

      condominio_id: dados.condominio_id ?? null,
      condominio_nome: dados.condominio_nome ?? null,

      referencia_externa: null,
      fonte: 'manual',
      importado_em: null,

      proprietario_id: dados.proprietario_id,
      // Corretor cadastra em nome próprio; a gestão escolhe de quem é.
      corretor_id: gestor ? (dados.corretor_id ?? null) : usuario.id,
      exclusividade: dados.exclusividade ?? false,
      autorizacao_ate: dados.autorizacao_ate ?? null,
      matricula: dados.matricula ?? null,
      observacoes_internas: dados.observacoes_internas ?? null,

      // Nasce fora do ar. Publicar é um segundo gesto, deliberado:
      // imóvel recém-cadastrado ainda não tem foto nem revisão de
      // texto, e mandá-lo direto para a vitrine é como deixar a
      // vitrine aberta durante a arrumação.
      publicado: false,
      destaque: false,
      publicar_portais: false,
      cover: dados.cover ?? `cv${1 + (base.imoveis.length % 6)}`,
      visualizacoes: 0,

      meta_titulo: null,
      meta_descricao: null,

      criado_em: agora,
      atualizado_em: agora,
    });

    return { ok: true, id };
  });
}

/**
 * Exclusão definitiva do imóvel.
 *
 * Some junto o que só existia por causa dele: os compromissos de
 * visita e o vínculo dos leads. O lead em si fica — a pessoa continua
 * procurando, só que agora sem aquele imóvel — e a venda concluída
 * também, porque a comissão daquele mês aconteceu e não desaparece
 * porque o registro do imóvel saiu.
 */
export function excluirImovelDemo(usuario: Perfil, id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const imovel = base.imoveis.find((i) => i.id === id);
    if (!imovel) return { ok: false, erro: 'Imóvel não encontrado.' };

    if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
      return { ok: false, erro: 'Apenas a gestão exclui um imóvel em definitivo.' };
    }

    const vendaAberta = base.vendas.find(
      (v) => v.imovel_id === id && !['cancelada', 'concluida'].includes(v.status),
    );
    if (vendaAberta) {
      return {
        ok: false,
        erro: `Existe uma negociação em andamento (${vendaAberta.codigo}) neste imóvel. Conclua ou cancele antes de excluir.`,
      };
    }

    base.imoveis = base.imoveis.filter((i) => i.id !== id);
    base.compromissos = base.compromissos.filter((c) => c.imovel_id !== id);

    for (const lead of base.leads) {
      if (lead.imovel_id === id) lead.imovel_id = null;
    }

    return { ok: true };
  });
}

// ------------------------------------------------------------
// PROPRIETÁRIOS
// ------------------------------------------------------------

/**
 * A lista, já com a carteira de cada um contada.
 *
 * O recorte por papel espelha o RLS da migration 0003: a gestão vê
 * todo mundo, e o corretor vê apenas os proprietários de imóveis que
 * estão na própria carteira. É dado sensível — CPF, telefone
 * particular, endereço residencial — e não há motivo para um consultor
 * enxergar o proprietário de um imóvel que ele não atende.
 */
export function proprietariosDemo(usuario: Perfil): ProprietarioComCarteira[] {
  const base = lerBase();
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  return base.proprietarios
    .filter((p) => gestor || alcancaProprietario(base, usuario, p.id))
    .map((p) => ({
      ...p,
      ...resumirCarteira(base.imoveis.filter((i) => i.proprietario_id === p.id)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Só o par id/nome, para alimentar os seletores sem carregar o resto.
 *
 * Recortado por pessoa, como a política de leitura da 0003 recorta no
 * banco: o consultor só enxerga quem ele cadastrou ou quem é dono de
 * imóvel da carteira dele. Sem esse recorte a demonstração mostraria a
 * lista inteira no seletor de proprietário, que é justamente o que a
 * imobiliária pediu para fechar, e quem conferisse a regra pela
 * demonstração concluiria que ela não funciona.
 */
export function nomesProprietariosDemo(usuario: Perfil): Pick<Proprietario, 'id' | 'nome'>[] {
  const base = lerBase();

  return base.proprietarios
    .filter((p) => podeVerProprietarioDemo(usuario, p.id))
    .map((p) => ({ id: p.id, nome: p.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Espelha pode_ver_proprietario() da migration 0012.
 *
 * Recebe a base já em mãos, e não a lê por conta própria, porque as
 * escritas chamam esta função de dentro de alterarBase: reabrir o
 * arquivo no meio de uma alteração leria a versão anterior dele e a
 * conferência responderia sobre um mundo que já não existe.
 */
function alcancaProprietario(
  base: ReturnType<typeof lerBase>,
  usuario: Perfil,
  proprietarioId: string | null | undefined,
): boolean {
  if (!proprietarioId) return false;
  if (usuario.papel === 'admin' || usuario.papel === 'gestor') return true;

  // Vigência: tem imóvel deste dono na carteira, agora. É a única porta
  // que fica aberta com o tempo, e ela fecha sozinha no dia em que o
  // imóvel passar para outro consultor.
  const naCarteira = base.imoveis.some(
    (i) => i.proprietario_id === proprietarioId && i.corretor_id === usuario.id,
  );
  if (naCarteira) return true;

  // Janela do cadastro: criou e ainda não vinculou a imóvel nenhum, de
  // ninguém. Existe só para o intervalo entre cadastrar o proprietário e
  // escolhê-lo na ficha do imóvel, que são dois gestos separados.
  const cadastrouEle = base.proprietarios.some(
    (p) => p.id === proprietarioId && p.criado_por === usuario.id,
  );
  const semVinculo = !base.imoveis.some((i) => i.proprietario_id === proprietarioId);

  return cadastrouEle && semVinculo;
}

/** A mesma pergunta, para quem só quer ler. */
export function podeVerProprietarioDemo(usuario: Perfil, proprietarioId: string | null): boolean {
  return alcancaProprietario(lerBase(), usuario, proprietarioId);
}

export function imoveisDoProprietarioDemo(id: string): Imovel[] {
  return lerBase()
    .imoveis.filter((i) => i.proprietario_id === id)
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
}

export function salvarProprietarioDemo(
  usuario: Perfil,
  dados: Partial<Proprietario> & { id?: string },
): { ok: boolean; erro?: string; id?: string } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();
    const nome = (dados.nome ?? '').trim();

    if (nome.length < 2) return { ok: false, erro: 'Informe o nome do proprietário.' };
    if (!dados.telefone && !dados.email) {
      return { ok: false, erro: 'Informe ao menos um telefone ou um e-mail de contato.' };
    }

    if (dados.id) {
      const indice = base.proprietarios.findIndex((p) => p.id === dados.id);
      if (indice < 0) return { ok: false, erro: 'Proprietário não encontrado.' };

      /**
       * Mesma regra da política "proprietarios - editar" da 0012:
       * editar segue exatamente quem pode ler.
       *
       * Antes bastava ter sido quem cadastrou, e isso não expirava
       * nunca. Quem não pode mais nem ver o telefone não tem por que
       * poder trocá-lo.
       */
      if (!alcancaProprietario(base, usuario, dados.id)) {
        return {
          ok: false,
          erro: 'Este proprietário não está mais na sua carteira. Só quem tem imóvel dele agora, ou a gestão, pode alterar os dados.',
        };
      }

      base.proprietarios[indice] = {
        ...base.proprietarios[indice],
        ...dados,
        nome,
        atualizado_em: agora,
      } as Proprietario;

      return { ok: true, id: dados.id };
    }

    const id = novoId();

    base.proprietarios.push({
      id,
      nome,
      cpf_cnpj: dados.cpf_cnpj ?? null,
      email: dados.email ?? null,
      telefone: dados.telefone ?? null,
      endereco: dados.endereco ?? null,
      observacoes: dados.observacoes ?? null,
      criado_por: usuario.id,
      criado_em: agora,
      atualizado_em: agora,
    });

    return { ok: true, id };
  });
}

/**
 * Excluir proprietário só quando ele não tem imóvel.
 *
 * A alternativa seria desvincular os imóveis e apagar mesmo assim, mas
 * isso deixaria a carteira com registros órfãos — exatamente o estado
 * que a obrigatoriedade do proprietário existe para evitar. Quem quer
 * mesmo remover, primeiro transfere os imóveis.
 */
export function excluirProprietarioDemo(
  usuario: Perfil,
  id: string,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
      return { ok: false, erro: 'Apenas a gestão exclui um proprietário.' };
    }

    const vinculados = base.imoveis.filter((i) => i.proprietario_id === id);
    if (vinculados.length > 0) {
      return {
        ok: false,
        erro: `Este proprietário tem ${vinculados.length} ${
          vinculados.length === 1 ? 'imóvel vinculado' : 'imóveis vinculados'
        }. Transfira ou exclua antes.`,
      };
    }

    const antes = base.proprietarios.length;
    base.proprietarios = base.proprietarios.filter((p) => p.id !== id);

    return antes === base.proprietarios.length
      ? { ok: false, erro: 'Proprietário não encontrado.' }
      : { ok: true };
  });
}

// ------------------------------------------------------------
// INTERAÇÕES DO LEAD
// ------------------------------------------------------------

/**
 * A linha do tempo de um atendimento.
 *
 * Reproduz a policy "interacoes - ler" da migration 0003: quem não
 * enxerga o lead também não enxerga o histórico dele. Sem isso a
 * demonstração mostraria ao corretor a anotação que o colega fez sobre
 * um cliente que não é dele.
 */
export function interacoesDemo(usuario: Perfil, leadId?: string): Interacao[] {
  const base = lerBase();
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const visiveis = new Set(
    base.leads
      .filter((l) => gestor || l.corretor_id === usuario.id || l.corretor_id === null)
      .map((l) => l.id),
  );

  return base.interacoes
    .filter((i) => visiveis.has(i.lead_id))
    .filter((i) => !leadId || i.lead_id === leadId)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

export function registrarInteracaoDemo(
  usuario: Perfil,
  leadId: string,
  tipo: string,
  conteudo: string,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const lead = base.leads.find((l) => l.id === leadId);
    if (!lead) return { ok: false, erro: 'Lead não encontrado.' };

    base.interacoes.push({
      id: novoId(),
      lead_id: leadId,
      tipo: tipo as Interacao['tipo'],
      conteudo,
      autor_id: usuario.id,
      autor_nome: usuario.nome,
      criado_em: new Date().toISOString(),
    });

    // Registrar contato é sinal de vida do atendimento. Atualizar a data
    // aqui é o que faz o lead sair da lista de parados sem ninguém
    // precisar lembrar de mexer em outro campo.
    lead.atualizado_em = new Date().toISOString();

    return { ok: true };
  });
}

export function excluirInteracaoDemo(usuario: Perfil, id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const alvo = base.interacoes.find((i) => i.id === id);
    if (!alvo) return { ok: false, erro: 'Registro não encontrado.' };

    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
    if (!gestor && alvo.autor_id !== usuario.id) {
      return { ok: false, erro: 'Só o autor da anotação ou a gestão pode apagá-la.' };
    }

    base.interacoes = base.interacoes.filter((i) => i.id !== id);
    return { ok: true };
  });
}

// ------------------------------------------------------------
// LEADS: TRANSFERÊNCIA, ARQUIVO E EXCLUSÃO
// ------------------------------------------------------------

/** Última interação de cada lead, para a lista não varrer o histórico por linha. */
export function ultimoContatoDemo(usuario: Perfil): Record<string, string> {
  const mapa: Record<string, string> = {};

  for (const i of interacoesDemo(usuario)) {
    if (!mapa[i.lead_id] || i.criado_em > mapa[i.lead_id]) mapa[i.lead_id] = i.criado_em;
  }

  return mapa;
}

export function transferirLeadDemo(
  usuario: Perfil,
  id: string,
  destinoId: string | null,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const lead = base.leads.find((l) => l.id === id);
    if (!lead) return { ok: false, erro: 'Lead não encontrado.' };

    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
    const meu = lead.corretor_id === usuario.id || lead.corretor_id === null;

    if (!gestor && !meu) {
      return { ok: false, erro: 'Este lead está na carteira de outro consultor.' };
    }

    if (destinoId) {
      const destino = base.perfis.find((p) => p.id === destinoId);
      if (!destino) return { ok: false, erro: 'Consultor não encontrado.' };
      if (!destino.ativo) return { ok: false, erro: 'Este consultor está com o acesso desativado.' };
    }

    const anterior = lead.corretor_id
      ? (base.perfis.find((p) => p.id === lead.corretor_id)?.nome ?? 'ninguém')
      : 'ninguém';
    const novo = destinoId
      ? (base.perfis.find((p) => p.id === destinoId)?.nome ?? 'ninguém')
      : 'ninguém';

    lead.corretor_id = destinoId;
    lead.atualizado_em = new Date().toISOString();

    base.interacoes.push({
      id: novoId(),
      lead_id: id,
      tipo: 'sistema',
      conteudo: `Atendimento transferido de ${anterior} para ${novo}.`,
      autor_id: usuario.id,
      autor_nome: usuario.nome,
      criado_em: new Date().toISOString(),
    });

    return { ok: true };
  });
}

export function arquivarLeadDemo(
  usuario: Perfil,
  id: string,
  motivo: string,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const lead = base.leads.find((l) => l.id === id);
    if (!lead) return { ok: false, erro: 'Lead não encontrado.' };

    const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
    if (!gestor && lead.corretor_id !== usuario.id && lead.corretor_id !== null) {
      return { ok: false, erro: 'Este lead está na carteira de outro consultor.' };
    }

    lead.arquivado = true;
    lead.etapa = 'perdido';
    lead.motivo_perda = motivo;
    lead.atualizado_em = new Date().toISOString();

    base.interacoes.push({
      id: novoId(),
      lead_id: id,
      tipo: 'sistema',
      conteudo: `Atendimento arquivado. Motivo: ${motivo}.`,
      autor_id: usuario.id,
      autor_nome: usuario.nome,
      criado_em: new Date().toISOString(),
    });

    return { ok: true };
  });
}

/**
 * Exclusão definitiva.
 *
 * Só a gestão, como na policy "leads - excluir". A diferença entre isto
 * e arquivar não é de conveniência: arquivar preserva o histórico do
 * atendimento para o relatório, excluir apaga a pessoa do sistema, que
 * é o que a LGPD exige quando o titular pede a remoção dos dados.
 */
export function excluirLeadDemo(usuario: Perfil, id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    if (usuario.papel !== 'admin' && usuario.papel !== 'gestor') {
      return { ok: false, erro: 'Apenas a gestão exclui um lead em definitivo.' };
    }

    const existe = base.leads.some((l) => l.id === id);
    if (!existe) return { ok: false, erro: 'Lead não encontrado.' };

    base.leads = base.leads.filter((l) => l.id !== id);
    base.interacoes = base.interacoes.filter((i) => i.lead_id !== id);

    // O vínculo com o negócio é desfeito, não apagado: a venda continua
    // existindo na contabilidade mesmo sem o lead de origem.
    for (const venda of base.vendas) {
      if (venda.lead_id === id) venda.lead_id = null;
    }
    for (const compromisso of base.compromissos) {
      if (compromisso.lead_id === id) compromisso.lead_id = null;
    }

    return { ok: true };
  });
}

// ------------------------------------------------------------
// EQUIPE
// ------------------------------------------------------------

export function equipeCompletaDemo(): Perfil[] {
  return [...lerBase().perfis].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Quanto cada pessoa carrega hoje. Mostrado antes de desativar ou remover. */
export function carteiraDemo(id: string): { leads: number; imoveis: number; negocios: number } {
  const base = lerBase();

  return {
    leads: base.leads.filter((l) => l.corretor_id === id && !l.arquivado).length,
    imoveis: base.imoveis.filter((i) => i.corretor_id === id).length,
    negocios: base.vendas.filter(
      (v) => v.consultor_id === id && !['concluida', 'cancelada'].includes(v.status),
    ).length,
  };
}

export function salvarPessoaDemo(
  usuario: Perfil,
  dados: Partial<Perfil> & { id?: string },
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const agora = new Date().toISOString();

    if (dados.id) {
      const alvo = base.perfis.find((p) => p.id === dados.id);
      if (!alvo) return { ok: false, erro: 'Pessoa não encontrada.' };

      // Dados de contato: o admin edita de qualquer um, e cada pessoa
      // edita os próprios. Papel e permissão não passam por aqui.
      if (usuario.papel !== 'admin' && usuario.id !== alvo.id) {
        return { ok: false, erro: 'Apenas o administrador edita os dados de outra pessoa.' };
      }

      alvo.nome = dados.nome ?? alvo.nome;
      alvo.email = dados.email ?? alvo.email;
      alvo.telefone = dados.telefone ?? alvo.telefone;
      alvo.creci = dados.creci ?? alvo.creci;
      alvo.atualizado_em = agora;

      return { ok: true };
    }

    if (usuario.papel !== 'admin') {
      return { ok: false, erro: 'Apenas o administrador cadastra novos integrantes.' };
    }

    const email = String(dados.email ?? '').toLowerCase();
    if (base.perfis.some((p) => (p.email ?? '').toLowerCase() === email)) {
      return { ok: false, erro: 'Já existe alguém na equipe com este e-mail.' };
    }

    base.perfis.push({
      id: novoId(),
      nome: dados.nome ?? 'Novo integrante',
      email: dados.email ?? null,
      telefone: dados.telefone ?? null,
      creci: dados.creci ?? null,
      avatar_url: null,
      papel: dados.papel ?? 'corretor',
      permissoes: dados.permissoes ?? permissoesPadrao(dados.papel ?? 'corretor'),
      meta_mensal: dados.meta_mensal ?? 0,
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
    });

    return { ok: true };
  });
}

/**
 * Mesma trava da função definir_acesso() do banco (migration 0003):
 * papel, permissões e situação de acesso só mudam por ato de
 * administrador, e nunca sobre a própria conta.
 */
export function definirAcessoDemo(
  usuario: Perfil,
  alvoId: string,
  mudancas: { papel?: Perfil['papel']; permissoes?: Perfil['permissoes']; ativo?: boolean; meta_mensal?: number },
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    const validacao = validarAlteracaoAcesso(usuario, alvoId, mudancas, base.perfis);
    if (!validacao.ok) return { ok: false, erro: validacao.erro };

    const alvo = base.perfis.find((p) => p.id === alvoId);
    if (!alvo) return { ok: false, erro: 'Pessoa não encontrada.' };

    if (mudancas.papel !== undefined) alvo.papel = mudancas.papel;
    if (mudancas.permissoes !== undefined) alvo.permissoes = mudancas.permissoes;
    if (mudancas.ativo !== undefined) alvo.ativo = mudancas.ativo;
    if (mudancas.meta_mensal !== undefined) alvo.meta_mensal = mudancas.meta_mensal;

    alvo.atualizado_em = new Date().toISOString();
    return { ok: true };
  });
}

/**
 * Remove alguém da equipe.
 *
 * Exige informar quem recebe a carteira quando ainda existe algo no nome
 * da pessoa. Apagar direto deixaria leads sem responsável e imóveis sem
 * captador, e a operação descobriria isso no pior momento possível, que
 * é quando o cliente liga.
 */
export function removerPessoaDemo(
  usuario: Perfil,
  alvoId: string,
  substitutoId: string | null,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    if (usuario.papel !== 'admin') {
      return { ok: false, erro: 'Apenas o administrador remove integrantes.' };
    }
    if (alvoId === usuario.id) {
      return { ok: false, erro: 'Você não pode remover o próprio acesso.' };
    }

    const alvo = base.perfis.find((p) => p.id === alvoId);
    if (!alvo) return { ok: false, erro: 'Pessoa não encontrada.' };

    const admins = base.perfis.filter((p) => p.papel === 'admin' && p.ativo);
    if (alvo.papel === 'admin' && admins.length <= 1) {
      return { ok: false, erro: 'A imobiliária ficaria sem nenhum administrador ativo.' };
    }

    const carteira = {
      leads: base.leads.filter((l) => l.corretor_id === alvoId && !l.arquivado).length,
      imoveis: base.imoveis.filter((i) => i.corretor_id === alvoId).length,
      negocios: base.vendas.filter(
        (v) => v.consultor_id === alvoId && !['concluida', 'cancelada'].includes(v.status),
      ).length,
    };

    const temCarteira = carteira.leads + carteira.imoveis + carteira.negocios > 0;

    if (temCarteira && !substitutoId) {
      return {
        ok: false,
        erro: `Esta pessoa ainda responde por ${carteira.leads} leads, ${carteira.imoveis} imóveis e ${carteira.negocios} negócios em aberto. Escolha quem assume antes de remover.`,
      };
    }

    if (substitutoId) {
      const substituto = base.perfis.find((p) => p.id === substitutoId && p.ativo);
      if (!substituto) return { ok: false, erro: 'Quem assume precisa ser alguém ativo na equipe.' };

      for (const lead of base.leads) if (lead.corretor_id === alvoId) lead.corretor_id = substitutoId;
      for (const imovel of base.imoveis) if (imovel.corretor_id === alvoId) imovel.corretor_id = substitutoId;
      for (const venda of base.vendas) {
        if (venda.consultor_id === alvoId && !['concluida', 'cancelada'].includes(venda.status)) {
          venda.consultor_id = substitutoId;
        }
      }
      for (const c of base.compromissos) {
        if (c.responsavel_id === alvoId && c.status !== 'concluido') c.responsavel_id = substitutoId;
      }
    }

    base.perfis = base.perfis.filter((p) => p.id !== alvoId);
    return { ok: true };
  });
}

// ------------------------------------------------------------
// INDICADORES
// ------------------------------------------------------------

/** Tudo que o cálculo de indicadores precisa, em uma leitura só. */
export function baseIndicadoresDemo(): BaseIndicadores {
  const base = lerBase();

  return {
    perfis: base.perfis,
    imoveis: base.imoveis,
    leads: base.leads,
    interacoes: base.interacoes,
    compromissos: base.compromissos,
    vendas: base.vendas,
  };
}

export function parcelasVencidasDemo(): number {
  const hoje = new Date().toISOString().slice(0, 10);
  return lerBase().parcelas.filter((p) => p.status === 'pendente' && p.vencimento < hoje).length;
}

// ------------------------------------------------------------
// PROSPECÇÃO
// ------------------------------------------------------------

/**
 * Resultados simulados da busca por empresas.
 *
 * Existe para a tela de prospecção poder ser avaliada antes de alguém
 * cadastrar a chave do Google e começar a pagar por chamada. Os
 * números são construídos a partir do termo buscado, então a mesma
 * busca devolve sempre o mesmo resultado — o que permite conferir se o
 * filtro e a ordenação funcionam.
 *
 * A pontuação passa pela mesma pontuarProspecto() da busca real. Se a
 * regra de score mudar, a demonstração muda junto, e nunca mostra uma
 * ordem que a produção não reproduziria.
 */
export function prospectosDemo(segmento: string, cidade: string, limite: number): Prospecto[] {
  const modelos = [
    { sufixo: 'Centro Clínico', tipo: 'clinic', nota: 4.7, avaliacoes: 412, site: true, tel: true },
    { sufixo: 'Unidade Norte', tipo: 'gym', nota: 4.5, avaliacoes: 268, site: true, tel: true },
    { sufixo: 'Matriz', tipo: 'restaurant', nota: 4.2, avaliacoes: 1340, site: false, tel: true },
    { sufixo: 'Jardim Karaíba', tipo: 'dental_clinic', nota: 4.9, avaliacoes: 96, site: true, tel: true },
    { sufixo: 'Santa Mônica', tipo: 'veterinary_care', nota: 4.4, avaliacoes: 154, site: false, tel: true },
    { sufixo: 'Filial Tibery', tipo: 'store', nota: 3.9, avaliacoes: 47, site: false, tel: true },
    { sufixo: 'Sede', tipo: 'lawyer', nota: 4.8, avaliacoes: 63, site: true, tel: true },
    { sufixo: 'Unidade Umuarama', tipo: 'school', nota: 4.6, avaliacoes: 221, site: true, tel: false },
    { sufixo: 'Alto Padrão', tipo: 'beauty_salon', nota: 4.3, avaliacoes: 388, site: false, tel: true },
    { sufixo: 'Express', tipo: 'bakery', nota: 4.1, avaliacoes: 512, site: false, tel: true },
    { sufixo: 'Corporate', tipo: 'accounting', nota: 4.5, avaliacoes: 29, site: true, tel: true },
    { sufixo: 'Praça Tubal Vilela', tipo: 'cafe', nota: 4.6, avaliacoes: 743, site: false, tel: true },
  ];

  const raiz = segmento.trim().replace(/s$/, '').replace(/^\w/, (c) => c.toUpperCase()) || 'Empresa';

  // Ordena igual a busca real. Sem isto a demonstracao mostraria a
  // lista na ordem em que foi escrita, e quem avaliasse a tela
  // aprenderia um comportamento que a producao nao repete.
  return modelos.slice(0, Math.min(limite, modelos.length)).map((m, i) => {
    const base = {
      id: `demo_${i + 1}`,
      origem_id: `demo_${i + 1}`,
      nome: `${raiz} ${m.sufixo}`,
      categoria: m.tipo.replace(/_/g, ' '),
      endereco: `Av. Rondon Pacheco, ${1200 + i * 137} - ${cidade}`,
      telefone: m.tel ? `3499${String(8000000 + i * 4321).slice(0, 7)}` : '',
      site: m.site ? `https://exemplo${i + 1}.com.br` : '',
      latitude: -18.9186 + i * 0.004,
      longitude: -48.2772 + i * 0.006,
      distancia_km: Number((0.8 + i * 1.4).toFixed(1)),
      mapa_url: 'https://www.google.com/maps',
      nota: m.nota,
      avaliacoes: m.avaliacoes,
      situacao: 'OPERATIONAL',
      tipos: [m.tipo],
    };

    return { ...base, ...pontuarProspecto(base) };
  })
  .sort((a, b) => b.score - a.score || b.avaliacoes - a.avaliacoes);
}

// ------------------------------------------------------------
// FOTOS (espelham as ações de imóveis na base de demonstração)
// ------------------------------------------------------------

export function fotosDoImovelDemo(imovelId: string): Foto[] {
  return (lerBase().fotos ?? [])
    .filter((f) => f.imovel_id === imovelId)
    .sort((a, b) => Number(b.capa) - Number(a.capa) || a.ordem - b.ordem);
}

export function registrarFotoDemo(
  imovelId: string,
  path: string,
  legenda: string | null,
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    base.fotos = base.fotos ?? [];
    const existentes = base.fotos.filter((f) => f.imovel_id === imovelId).length;

    base.fotos.push({
      id: novoId(),
      imovel_id: imovelId,
      path,
      legenda,
      ordem: existentes,
      // A primeira vira capa sozinha: álbum sem capa aparece na vitrine
      // como imóvel sem foto nenhuma.
      capa: existentes === 0,
      largura: null,
      altura: null,
    });

    return { ok: true };
  });
}

export function excluirFotoDemo(id: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    base.fotos = base.fotos ?? [];
    const foto = base.fotos.find((f) => f.id === id);
    if (!foto) return { ok: false, erro: 'Foto não encontrada.' };

    base.fotos = base.fotos.filter((f) => f.id !== id);

    if (foto.capa) {
      const proxima = base.fotos
        .filter((f) => f.imovel_id === foto.imovel_id)
        .sort((a, b) => a.ordem - b.ordem)[0];
      if (proxima) proxima.capa = true;
    }

    return { ok: true };
  });
}

export function definirCapaDemo(imovelId: string, fotoId: string): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    for (const f of base.fotos ?? []) {
      if (f.imovel_id === imovelId) f.capa = f.id === fotoId;
    }
    return { ok: true };
  });
}

export function reordenarFotosDemo(
  imovelId: string,
  ids: string[],
): { ok: boolean; erro?: string } {
  return alterarBase((base) => {
    for (const f of base.fotos ?? []) {
      if (f.imovel_id !== imovelId) continue;
      const posicao = ids.indexOf(f.id);
      if (posicao >= 0) f.ordem = posicao;
    }
    return { ok: true };
  });
}
