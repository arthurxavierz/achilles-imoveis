/**
 * Armazém da demonstração.
 *
 * Guarda tudo num único arquivo JSON na raiz do repositório, em
 * `.achilles-demo/dados.json`. A escolha por arquivo, e não por memória,
 * tem um motivo prático: o site e o painel são dois processos separados,
 * cada um com a própria memória. Só um ponto em disco permite publicar
 * um imóvel no painel e vê-lo aparecer no site logo em seguida, que é
 * justamente a integração que interessa testar antes do banco existir.
 *
 * Isto NUNCA roda em produção: tudo aqui está atrás de modoDemo(), que
 * exige a ausência de NEXT_PUBLIC_SUPABASE_URL. Em produção essa
 * variável é obrigatória.
 */

import fs from 'node:fs';
import path from 'node:path';

import { baseInicial, VERSAO_BASE, type BaseDemo } from './sementes';

export type { BaseDemo };

/** Verdadeiro quando não há Supabase configurado. */
export function modoDemo(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Sobe as pastas procurando a raiz do repositório.
 *
 * Cada app roda com o diretório de trabalho na própria pasta
 * (apps/site ou apps/app), então o caminho não pode ser fixo. Procurar
 * pelo package-lock.json evita quebrar se alguém mover as pastas.
 */
function raizRepositorio(): string {
  let atual = process.cwd();

  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(atual, 'package-lock.json')) ||
      fs.existsSync(path.join(atual, '.git'))
    ) {
      return atual;
    }
    const acima = path.dirname(atual);
    if (acima === atual) break;
    atual = acima;
  }

  return process.cwd();
}

function caminhoArquivo(): string {
  return path.join(raizRepositorio(), '.achilles-demo', 'dados.json');
}

/**
 * Cache em memória para não ler o disco a cada componente renderizado.
 * Fica em globalThis porque o recarregamento a quente do Next recria os
 * módulos, e sem isso o cache seria perdido a cada alteração de código.
 */
const CHAVE_CACHE = Symbol.for('achilles.demo.cache');

interface Cache {
  base: BaseDemo | null;
  lidoEm: number;
}

function cache(): Cache {
  const global = globalThis as unknown as Record<symbol, Cache>;
  if (!global[CHAVE_CACHE]) global[CHAVE_CACHE] = { base: null, lidoEm: 0 };
  return global[CHAVE_CACHE];
}

/**
 * Lê a base. Revalida a cada dois segundos para captar alterações
 * feitas pelo outro processo: sem isso, publicar um imóvel no painel
 * não apareceria no site até reiniciar o servidor.
 */
export function lerBase(): BaseDemo {
  const c = cache();
  const agora = Date.now();

  if (c.base && agora - c.lidoEm < 2000) return c.base;

  const arquivo = caminhoArquivo();

  try {
    if (fs.existsSync(arquivo)) {
      const conteudo = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as BaseDemo;

      // Estrutura antiga: refaz do zero em vez de tentar migrar. São
      // dados descartáveis, e migração aqui seria complexidade à toa.
      if (conteudo.versao === VERSAO_BASE) {
        c.base = conteudo;
        c.lidoEm = agora;
        return conteudo;
      }
    }
  } catch (erro) {
    console.error('[demo] arquivo ilegível, recriando:', erro);
  }

  const nova = baseInicial();
  gravarBase(nova);
  return nova;
}

export function gravarBase(base: BaseDemo): void {
  const arquivo = caminhoArquivo();

  // O cache é atualizado antes da escrita, e não depois. Numa hospedagem
  // com disco somente leitura (a demonstração publicada no Netlify) a
  // gravação falha sempre; sem isto a base seria refeita do zero a cada
  // requisição e nenhuma alteração sobreviveria ao próprio clique.
  const c = cache();
  c.base = base;
  c.lidoEm = Number.POSITIVE_INFINITY;

  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(base, null, 2), 'utf8');
    c.lidoEm = Date.now();
  } catch (erro) {
    console.error('[demo] falha ao gravar:', erro);
  }
}

/** Lê, deixa a função alterar, grava. Todas as escritas passam por aqui. */
export function alterarBase<T>(operacao: (base: BaseDemo) => T): T {
  const base = lerBase();
  const resultado = operacao(base);
  gravarBase(base);
  return resultado;
}

/** Volta tudo ao estado original. */
export function reiniciarBase(): void {
  gravarBase(baseInicial());
}

/** Identificador no formato UUID, para conviver com os dados semeados. */
export function novoId(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
}

/** Próximo código sequencial de um conjunto, no formato PREFIXO-0001. */
export function proximoCodigo(prefixo: string, existentes: { codigo?: string | null }[]): string {
  const numeros = existentes
    .map((item) => Number(String(item.codigo ?? '').split('-')[1]))
    .filter((n) => Number.isFinite(n));

  const proximo = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `${prefixo}-${String(proximo).padStart(4, '0')}`;
}
