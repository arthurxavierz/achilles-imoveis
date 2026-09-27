'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useTransition } from 'react';

/**
 * Modo apresentação no painel (cópia do componente do site).
 *
 * O layout lê o cookie no servidor e entrega a personalização por este
 * contexto. Cabeçalho e rodapé são componentes diferentes (um de
 * cliente, outro de servidor), e o contexto é o que deixa os dois
 * mostrarem o mesmo nome sem passar a marca de mão em mão.
 *
 * Fora do modo demonstração o provedor recebe null e tudo aqui devolve
 * a marca do código, sem painel nenhum.
 */

const COOKIE = 'imob-demo-marca';

interface Valor {
  demo: boolean;
  nome: string | null;
  cor: string | null;
  iniciais: string | null;
}

const Contexto = createContext<Valor>({ demo: false, nome: null, cor: null, iniciais: null });

export function ProvedorMarca({ valor, children }: { valor: Valor; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMarca() {
  return useContext(Contexto);
}

/** O nome por extenso no logotipo, em minúsculo como a marca se escreve. */
export function NomeMarca({ padrao }: { padrao: string }) {
  const { nome } = useMarca();
  return <>{nome ? nome.toLowerCase() : padrao}</>;
}

/**
 * O símbolo. Na demonstração é sempre a logo da agência Achilles, mesmo
 * com o nome de outro cliente ao lado: é a assinatura de quem fez o
 * sistema, e o lugar onde a logo do cliente entraria em produção.
 */
export function SeloMarca() {
  const { demo } = useMarca();
  if (demo) return <span className="selo selo-achilles" aria-hidden="true" />;
  return <span className="selo" aria-hidden="true" />;
}

const PALETA = [
  { nome: 'Champanhe', cor: '#d4b27a' },
  { nome: 'Esmeralda', cor: '#3ecf8e' },
  { nome: 'Oceano', cor: '#5aa9ff' },
  { nome: 'Coral', cor: '#ff7a6b' },
  { nome: 'Ametista', cor: '#a98bff' },
  { nome: 'Âmbar', cor: '#ffab40' },
  { nome: 'Prata', cor: '#c9d1d9' },
];

function gravar(nome: string, cor: string) {
  const valor = encodeURIComponent(JSON.stringify({ nome, cor }));
  document.cookie = `${COOKIE}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

function apagar() {
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Botão flutuante com o painel de personalização.
 *
 * Fica à esquerda, acima do selo de voltar ao topo, e só existe na
 * demonstração. A troca é gravada em cookie e a página é redesenhada
 * pelo servidor, que é o caminho que a marca de verdade percorre: o que
 * se vê aqui é o que o cliente teria em produção.
 */
export function PersonalizarMarca() {
  const marca = useMarca();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(marca.nome ?? '');
  const [cor, setCor] = useState(marca.cor ?? PALETA[0].cor);
  const [pendente, iniciar] = useTransition();

  if (!marca.demo) return null;

  function aplicar(novoNome = nome, novaCor = cor) {
    gravar(novoNome.trim(), novaCor);
    iniciar(() => router.refresh());
  }

  function restaurar() {
    apagar();
    setNome('');
    setCor(PALETA[0].cor);
    iniciar(() => router.refresh());
  }

  return (
    <div className={`personalizar${aberto ? ' aberto' : ''}`}>
      {aberto && (
        <div className="personalizar-painel" role="dialog" aria-label="Personalizar a demonstração">
          <div className="personalizar-topo">
            <strong>Modo apresentação</strong>
            <span>Veja o sistema com a marca do seu cliente.</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              aplicar();
            }}
          >
            <label className="personalizar-campo">
              <span>Nome da imobiliária</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Prime Imóveis"
                maxLength={40}
                autoFocus
              />
            </label>

            <span className="personalizar-rotulo">Cor da marca</span>
            <div className="personalizar-cores">
              {PALETA.map((p) => (
                <button
                  key={p.cor}
                  type="button"
                  className={`personalizar-cor${cor === p.cor ? ' ativa' : ''}`}
                  style={{ background: p.cor }}
                  title={p.nome}
                  aria-label={p.nome}
                  onClick={() => {
                    setCor(p.cor);
                    aplicar(nome, p.cor);
                  }}
                />
              ))}
              <label className="personalizar-cor personalizar-cor-livre" title="Outra cor">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  onBlur={() => aplicar()}
                  aria-label="Escolher outra cor"
                />
              </label>
            </div>

            <div className="personalizar-acoes">
              <button type="submit" className="personalizar-aplicar" disabled={pendente}>
                {pendente ? 'Aplicando...' : 'Aplicar marca'}
              </button>
              <button type="button" className="personalizar-restaurar" onClick={restaurar}>
                Restaurar
              </button>
            </div>
            <p className="personalizar-nota">Vale também para o site público, neste navegador.</p>
          </form>
        </div>
      )}

      <button
        type="button"
        className="personalizar-gatilho"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label="Personalizar a demonstração"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="13.5" cy="6.5" r="1.5" />
          <circle cx="17.5" cy="10.5" r="1.5" />
          <circle cx="8.5" cy="7.5" r="1.5" />
          <circle cx="6.5" cy="12.5" r="1.5" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.67 0-.43-.17-.83-.44-1.13-.28-.3-.44-.7-.44-1.13 0-.93.75-1.67 1.67-1.67H16c3.07 0 5.56-2.49 5.56-5.56C21.56 6.03 17.25 2 12 2z" />
        </svg>
        <span>{aberto ? 'Fechar' : 'Sua marca aqui'}</span>
      </button>
    </div>
  );
}
