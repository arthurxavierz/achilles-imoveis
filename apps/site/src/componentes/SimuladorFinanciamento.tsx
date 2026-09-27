'use client';

import { useMemo, useState } from 'react';

import { brl } from '@imob/core';

import { IconeAlerta, IconeCalculadora } from './Icones';

/**
 * Simulador de financiamento.
 *
 * Usa a Tabela Price, que e o sistema de parcelas fixas praticado pela
 * maioria dos bancos em credito imobiliario. A conta e a formula padrao
 * de amortizacao:
 *
 *   parcela = principal * (i * (1+i)^n) / ((1+i)^n - 1)
 *
 * onde i e a taxa mensal e n o numero de meses.
 *
 * Duas honestidades importantes na tela: a parcela mostrada nao inclui
 * seguros obrigatorios e taxa de administracao, que os bancos somam
 * depois, e a taxa padrao aqui e uma media de mercado, nao uma proposta.
 * Um simulador que promete numero fechado gera cliente frustrado na
 * agencia, e o corretor e quem ouve a reclamacao.
 */

const TAXA_PADRAO = 10.5; // ao ano, media do credito imobiliario
const ENTRADA_MINIMA = 20; // percentual exigido na maior parte dos bancos

export function SimuladorFinanciamento({ valorImovel }: { valorImovel: number }) {
  const [entradaPercentual, setEntradaPercentual] = useState(ENTRADA_MINIMA);
  const [anos, setAnos] = useState(30);
  const [taxaAnual, setTaxaAnual] = useState(TAXA_PADRAO);

  const conta = useMemo(() => {
    const entrada = (valorImovel * entradaPercentual) / 100;
    const financiado = valorImovel - entrada;
    const meses = anos * 12;

    // Taxa anual efetiva convertida para mensal equivalente. Dividir por
    // 12 seria a conta errada e subestimaria a parcela.
    const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;

    const fator = Math.pow(1 + taxaMensal, meses);
    const parcela = financiado * ((taxaMensal * fator) / (fator - 1));
    const total = parcela * meses;

    return {
      entrada,
      financiado,
      parcela,
      total,
      juros: total - financiado,
      // Regra de bolso dos bancos: a parcela nao passa de 30% da renda.
      rendaSugerida: parcela / 0.3,
    };
  }, [valorImovel, entradaPercentual, anos, taxaAnual]);

  if (!valorImovel || valorImovel <= 0) return null;

  return (
    <div className="simulador">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.3rem' }}>
        <IconeCalculadora style={{ width: 22, height: 22, color: 'var(--ouro-600)' }} />
        Simule seu financiamento
      </h3>
      <p style={{ color: 'var(--grafite)', fontSize: '0.92rem', marginTop: 8 }}>
        Ajuste os valores e veja como fica a parcela.
      </p>

      <div className="simulador-grade" style={{ marginTop: 26 }}>
        <div className="controle-faixa">
          <div className="controle-faixa-topo">
            <label htmlFor="sim-entrada">Entrada</label>
            <output htmlFor="sim-entrada">
              {entradaPercentual}% · {brl(conta.entrada)}
            </output>
          </div>
          <input
            id="sim-entrada"
            type="range"
            min={ENTRADA_MINIMA}
            max={80}
            step={5}
            value={entradaPercentual}
            onChange={(e) => setEntradaPercentual(Number(e.target.value))}
          />
        </div>

        <div className="controle-faixa">
          <div className="controle-faixa-topo">
            <label htmlFor="sim-prazo">Prazo</label>
            <output htmlFor="sim-prazo">{anos} anos</output>
          </div>
          <input
            id="sim-prazo"
            type="range"
            min={5}
            max={35}
            step={1}
            value={anos}
            onChange={(e) => setAnos(Number(e.target.value))}
          />
        </div>

        <div className="controle-faixa">
          <div className="controle-faixa-topo">
            <label htmlFor="sim-taxa">Juros ao ano</label>
            <output htmlFor="sim-taxa">{taxaAnual.toFixed(1).replace('.', ',')}%</output>
          </div>
          <input
            id="sim-taxa"
            type="range"
            min={7}
            max={14}
            step={0.1}
            value={taxaAnual}
            onChange={(e) => setTaxaAnual(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="simulador-resultado">
        <div className="resultado-item principal">
          <strong>{brl(conta.parcela)}</strong>
          <span>Primeira parcela</span>
        </div>
        <div className="resultado-item">
          <strong>{brl(conta.financiado)}</strong>
          <span>Valor financiado</span>
        </div>
        <div className="resultado-item">
          <strong>{brl(conta.rendaSugerida)}</strong>
          <span>Renda sugerida</span>
        </div>
        <div className="resultado-item">
          <strong>{brl(conta.juros)}</strong>
          <span>Juros no período</span>
        </div>
      </div>

      <div className="aviso aviso-info" style={{ marginTop: 18 }}>
        <IconeAlerta />
        <span>
          Simulação pela Tabela Price, com parcelas fixas. O valor não inclui seguros obrigatórios
          nem taxa de administração, que cada banco cobra de forma diferente. A taxa de juros real
          depende do seu relacionamento bancário e da análise de crédito. Use este número para se
          orientar, e fale com um consultor para uma simulação com o banco.
        </span>
      </div>
    </div>
  );
}
