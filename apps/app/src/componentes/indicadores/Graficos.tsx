import { brlCurto, numero } from '@imob/core';

/**
 * Graficos do painel de indicadores.
 *
 * Feitos com div e CSS, sem biblioteca de grafico. Nao e economia de
 * dependencia por esporte: um pacote de charts custa algumas centenas de
 * kilobytes no primeiro carregamento, e o que estas telas precisam
 * mostrar sao barras proporcionais e porcentagens. Barra em CSS lida por
 * leitor de tela tambem, o que canvas nao faz sem trabalho extra.
 *
 * Tudo aqui e componente de servidor: nao ha estado nem interacao, entao
 * nao ha motivo para enviar JavaScript ao navegador.
 */

export function Barras({
  itens,
  formato = 'moeda',
}: {
  itens: { rotulo: string; valor: number; apoio?: string; destaque?: boolean }[];
  formato?: 'moeda' | 'numero';
}) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));

  return (
    <div className="grafico-barras">
      {itens.map((item) => (
        <div key={item.rotulo} className={`barra-linha${item.destaque ? ' em-destaque' : ''}`}>
          <span className="barra-rotulo">{item.rotulo}</span>
          <div className="barra-trilho">
            <div
              className="barra-valor"
              style={{ width: `${Math.max(2, (item.valor / maior) * 100)}%` }}
            />
          </div>
          <span className="barra-numero">
            {formato === 'moeda' ? brlCurto(item.valor) : numero(item.valor)}
            {item.apoio && <small>{item.apoio}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Colunas verticais, para série temporal. */
export function Colunas({
  itens,
}: {
  itens: { rotulo: string; valor: number; apoio?: string; atual?: boolean }[];
}) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));

  return (
    <div className="grafico-colunas">
      {itens.map((item) => (
        <div key={item.rotulo} className={`coluna-grafico${item.atual ? ' e-atual' : ''}`}>
          <span className="coluna-numero">{brlCurto(item.valor)}</span>
          <div className="coluna-trilho">
            <div
              className="coluna-preenchida"
              style={{ height: `${Math.max(3, (item.valor / maior) * 100)}%` }}
            />
          </div>
          <span className="coluna-rotulo">{item.rotulo}</span>
          {item.apoio && <span className="coluna-apoio">{item.apoio}</span>}
        </div>
      ))}
    </div>
  );
}

/** Funil em degraus, com a taxa de passagem entre etapas. */
export function Degraus({
  etapas,
}: {
  etapas: { rotulo: string; quantidade: number; passagem: number; valor: number }[];
}) {
  const maior = Math.max(1, ...etapas.map((e) => e.quantidade));

  return (
    <div className="grafico-degraus">
      {etapas.map((etapa, indice) => (
        <div key={etapa.rotulo} className="degrau">
          <div className="degrau-cabecalho">
            <span className="degrau-rotulo">{etapa.rotulo}</span>
            <span className="degrau-quantidade">{etapa.quantidade}</span>
          </div>

          <div className="degrau-trilho">
            <div
              className="degrau-preenchido"
              style={{ width: `${Math.max(4, (etapa.quantidade / maior) * 100)}%` }}
            />
          </div>

          <div className="degrau-apoio">
            <span>{brlCurto(etapa.valor)}</span>
            {indice > 0 && (
              <span className={etapa.passagem < 40 ? 'passagem-fraca' : 'passagem'}>
                {etapa.passagem}% seguiram da etapa anterior
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Distribuição em faixa única, para participação por categoria. */
export function Faixa({
  fatias,
}: {
  fatias: { rotulo: string; parte: number; cor: string }[];
}) {
  const visiveis = fatias.filter((f) => f.parte > 0);

  return (
    <div className="grafico-faixa">
      <div className="faixa-trilho">
        {visiveis.map((f) => (
          <span
            key={f.rotulo}
            className={`faixa-parte faixa-${f.cor}`}
            style={{ width: `${f.parte}%` }}
            title={`${f.rotulo}: ${Math.round(f.parte)}%`}
          />
        ))}
      </div>

      <ul className="faixa-legenda">
        {visiveis.map((f) => (
          <li key={f.rotulo}>
            <span className={`ponto ponto-${f.cor}`} />
            {f.rotulo}
            <strong>{Math.round(f.parte)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barra de meta, com marcação de atingimento. */
export function Meta({ atingimento }: { atingimento: number }) {
  const largura = Math.min(100, Math.max(0, atingimento));

  return (
    <div className="meta">
      <div className="meta-barra">
        <div
          className={`meta-preenchimento${atingimento >= 100 ? ' batida' : atingimento < 40 ? ' atrasada' : ''}`}
          style={{ width: `${largura}%` }}
        />
      </div>
      <span>{atingimento}%</span>
    </div>
  );
}
