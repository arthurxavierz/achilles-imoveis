/**
 * Mascaras e validacoes dos formularios.
 *
 * A mascara aplica enquanto a pessoa digita, e nao no envio. Ver o
 * proprio telefone se formatando confirma que o campo entendeu o que foi
 * digitado, e derruba boa parte dos erros de digitacao antes de virarem
 * um lead com telefone invalido.
 */

/** Digitos vao virando (34) 99911-0001 conforme a pessoa escreve. */
export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);

  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Telefone brasileiro valido: DDD de 11 a 99 e, quando celular, o nono
 * digito comecando em 9. Fixo de 8 digitos tambem passa, porque muito
 * proprietario ainda deixa o telefone de casa.
 */
export function telefoneValido(valor: string): boolean {
  const d = valor.replace(/\D/g, '');
  if (d.length !== 10 && d.length !== 11) return false;

  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  if (d.length === 11 && d[2] !== '9') return false;

  // Sequencia repetida do tipo (34) 99999-9999 quase sempre e teste ou
  // preenchimento falso.
  if (/^(\d)\1+$/.test(d.slice(2))) return false;

  return true;
}

export function emailValido(valor: string): boolean {
  const v = valor.trim();
  if (!v) return true; // campo opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 160;
}

export function nomeValido(valor: string): boolean {
  const v = valor.trim();
  // Pelo menos duas letras e nada de campo so com numero.
  return v.length >= 2 && /[a-zA-ZÀ-ÿ]{2,}/.test(v);
}

/** Digitos viram 1.250.000 enquanto a pessoa digita. */
export function mascararMoeda(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 12);
  if (!d) return '';
  return Number(d).toLocaleString('pt-BR');
}

export function desmascararNumero(valor: string): number {
  const d = valor.replace(/\D/g, '');
  return d ? Number(d) : 0;
}

/** CEP no formato 38400-000. */
export function mascararCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
