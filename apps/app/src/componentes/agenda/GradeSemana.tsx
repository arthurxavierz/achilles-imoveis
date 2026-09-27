'use client';

import { useEffect, useRef, useState } from 'react';

import {
  corTipo,
  diaLocal,
  duracaoMinutos,
  horaLocal,
  minutosDoDia,
  NOMES_DIA_CURTO,
  podeGerirCompromisso,
  rotuloTipo,
  STATUS_COMPROMISSO,
  type CompromissoDetalhado,
  type Perfil,
} from '@imob/core';

/**
 * Grade de horarios, usada tanto na semana quanto no dia.
 *
 * E a visao que faz a agenda parecer uma agenda de verdade: o
 * compromisso ocupa espaco proporcional a duracao, e um buraco de duas
 * horas na terca aparece como um buraco de duas horas na tela. A lista
 * diz o que existe; isto diz onde cabe mais uma visita.
 *
 * Compromissos que se sobrepoem dividem a largura da coluna. Sem isso um
 * cobriria o outro e a pessoa marcaria em cima de algo que ja existe,
 * que e o erro que a agenda compartilhada deveria justamente evitar.
 */

/** Faixa exibida. Fora dela quase nada acontece numa imobiliaria. */
const HORA_INICIAL = 7;
const HORA_FINAL = 21;
const ALTURA_HORA = 58;

interface Posicionado {
  compromisso: CompromissoDetalhado;
  topo: number;
  altura: number;
  coluna: number;
  colunas: number;
}

/** Distribui em colunas os compromissos que se cruzam no tempo. */
function posicionar(itens: CompromissoDetalhado[]): Posicionado[] {
  const ordenados = [...itens].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const resultado: Posicionado[] = [];

  let grupo: CompromissoDetalhado[] = [];
  let fimDoGrupo = -1;

  const fechar = () => {
    // Dentro de um grupo que se toca, cada compromisso pega a primeira
    // coluna livre. Colunas iguais para o grupo inteiro mantem o
    // alinhamento vertical, que e o que deixa a leitura limpa.
    const colunas: number[] = [];

    for (const c of grupo) {
      const inicio = new Date(c.inicio).getTime();
      let coluna = colunas.findIndex((fim) => fim <= inicio);
      if (coluna === -1) {
        coluna = colunas.length;
        colunas.push(0);
      }
      colunas[coluna] = new Date(c.fim).getTime();

      // Um compromisso das 6h ou das 23h continua visivel, encostado na
      // borda da faixa, em vez de sumir ou vazar para fora da grade.
      const minutoInicial = Math.min(
        Math.max(minutosDoDia(c.inicio), HORA_INICIAL * 60),
        HORA_FINAL * 60 - 30,
      );
      const minutoFinal = Math.min(
        Math.max(minutosDoDia(c.inicio) + duracaoMinutos(c), minutoInicial + 30),
        HORA_FINAL * 60,
      );

      resultado.push({
        compromisso: c,
        topo: ((minutoInicial - HORA_INICIAL * 60) / 60) * ALTURA_HORA,
        altura: Math.max(26, ((minutoFinal - minutoInicial) / 60) * ALTURA_HORA - 3),
        coluna,
        colunas: 1,
      });
    }

    // Todos do grupo compartilham a mesma quantidade de colunas.
    const largura = Math.max(1, colunas.length);
    for (let i = resultado.length - grupo.length; i < resultado.length; i++) {
      resultado[i].colunas = largura;
    }

    grupo = [];
    fimDoGrupo = -1;
  };

  for (const c of ordenados) {
    const inicio = new Date(c.inicio).getTime();
    if (grupo.length > 0 && inicio >= fimDoGrupo) fechar();

    grupo.push(c);
    fimDoGrupo = Math.max(fimDoGrupo, new Date(c.fim).getTime());
  }

  if (grupo.length > 0) fechar();

  return resultado;
}

export function GradeSemana({
  dias,
  porDia,
  usuario,
  aoAbrirCompromisso,
  aoCriarEm,
}: {
  dias: string[];
  porDia: Map<string, CompromissoDetalhado[]>;
  usuario: Perfil;
  aoAbrirCompromisso: (c: CompromissoDetalhado) => void;
  aoCriarEm: (dia: string, hora: string) => void;
}) {
  const hoje = diaLocal(new Date());
  const rolagem = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState<number | null>(null);

  const horas = Array.from({ length: HORA_FINAL - HORA_INICIAL }, (_, i) => HORA_INICIAL + i);

  // A linha do horario atual só existe depois da montagem: renderizar no
  // servidor daria um horário que já estaria errado quando a página
  // chegasse ao navegador.
  useEffect(() => {
    function marcar() {
      const [h, m] = horaLocal(new Date()).split(':').map(Number);
      const minutos = h * 60 + m;
      if (minutos < HORA_INICIAL * 60 || minutos > HORA_FINAL * 60) {
        setAgora(null);
        return;
      }
      setAgora(((minutos - HORA_INICIAL * 60) / 60) * ALTURA_HORA);
    }

    marcar();
    const relogio = setInterval(marcar, 60000);
    return () => clearInterval(relogio);
  }, []);

  // Abre já na altura do expediente, e não às 7h da manhã com metade da
  // grade vazia acima.
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollTop = ALTURA_HORA * 1.5;
  }, []);

  const diasInteiros = dias.map((dia) => (porDia.get(dia) ?? []).filter((c) => c.dia_inteiro));
  const temDiaInteiro = diasInteiros.some((lista) => lista.length > 0);

  return (
    <div className={`grade-horarios${dias.length === 1 ? ' grade-horarios-dia' : ''}`}>
      <div className="grade-cabecalho">
        <span className="grade-canto" />
        {dias.map((dia) => {
          const data = new Date(`${dia}T12:00:00`);
          return (
            <button
              key={dia}
              className={`grade-dia-topo${dia === hoje ? ' e-hoje' : ''}`}
              onClick={() => aoCriarEm(dia, '09:00')}
              title="Marcar compromisso neste dia"
            >
              <span className="grade-dia-semana">{NOMES_DIA_CURTO[data.getDay()]}</span>
              <span className="grade-dia-numero">{data.getDate()}</span>
            </button>
          );
        })}
      </div>

      {temDiaInteiro && (
        <div className="grade-dia-inteiro">
          <span className="grade-canto">Dia</span>
          {dias.map((dia, indice) => (
            <div key={dia} className="grade-coluna-dia-inteiro">
              {diasInteiros[indice].map((c) => (
                <button
                  key={c.id}
                  className={`marca marca-${corTipo(c.tipo)}`}
                  onClick={() => aoAbrirCompromisso(c)}
                >
                  <span className="texto-truncado">{c.titulo}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="grade-rolagem" ref={rolagem}>
        <div className="grade-corpo" style={{ height: horas.length * ALTURA_HORA }}>
          <div className="grade-horas">
            {horas.map((h) => (
              <div key={h} className="grade-hora" style={{ height: ALTURA_HORA }}>
                <span>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const doDia = (porDia.get(dia) ?? []).filter((c) => !c.dia_inteiro);
            const blocos = posicionar(doDia);

            return (
              <div key={dia} className={`grade-coluna${dia === hoje ? ' coluna-hoje' : ''}`}>
                {horas.map((h) => (
                  <button
                    key={h}
                    className="grade-celula"
                    style={{ height: ALTURA_HORA }}
                    onClick={() => aoCriarEm(dia, `${String(h).padStart(2, '0')}:00`)}
                    aria-label={`Marcar às ${h}h`}
                  />
                ))}

                {dia === hoje && agora !== null && (
                  <div className="linha-agora" style={{ top: agora }} aria-hidden="true" />
                )}

                {blocos.map(({ compromisso: c, topo, altura, coluna, colunas }) => {
                  const editavel = podeGerirCompromisso(usuario, c);
                  const meu = c.responsavel_id === usuario.id;
                  const compacto = altura < 46;

                  return (
                    <button
                      key={c.id}
                      className={[
                        'bloco',
                        `bloco-${corTipo(c.tipo)}`,
                        c.status === 'cancelado' && 'bloco-cancelado',
                        c.status === 'concluido' && 'bloco-concluido',
                        !meu && 'bloco-alheio',
                        compacto && 'bloco-compacto',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        top: topo,
                        height: altura,
                        left: `calc(${(coluna / colunas) * 100}% + 3px)`,
                        width: `calc(${100 / colunas}% - 6px)`,
                      }}
                      onClick={() => aoAbrirCompromisso(c)}
                      title={
                        `${horaLocal(c.inicio)} às ${horaLocal(c.fim)} · ${c.titulo}` +
                        `\n${rotuloTipo(c.tipo)} · ${STATUS_COMPROMISSO[c.status].rotulo}` +
                        `\nResponsável: ${c.responsavel_nome}` +
                        (c.local ? `\nLocal: ${c.local}` : '') +
                        (editavel ? '' : '\nSomente a gestão pode alterar')
                      }
                    >
                      <span className="bloco-hora">{horaLocal(c.inicio)}</span>
                      <span className="bloco-titulo">{c.titulo}</span>
                      {!compacto && !meu && (
                        <span className="bloco-pessoa">{c.responsavel_nome.split(' ')[0]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
