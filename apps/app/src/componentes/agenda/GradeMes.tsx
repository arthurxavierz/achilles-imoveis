'use client';

import {
  corTipo,
  diaLocal,
  gradeDoMes,
  horaLocal,
  NOMES_DIA_CURTO,
  podeGerirCompromisso,
  rotuloTipo,
  STATUS_COMPROMISSO,
  type CompromissoDetalhado,
  type Perfil,
} from '@imob/core';

import { IconeMais } from '@/componentes/Icones';

/**
 * Grade mensal.
 *
 * Cada dia mostra no maximo tres compromissos; o resto vira "mais N",
 * que abre o dia inteiro na visao de horarios. Sem esse limite, um dia
 * cheio estica a linha inteira da semana e a grade perde a forma de
 * calendario, que e justamente o que faz alguem entender o mes de
 * relance.
 */

const LIMITE_POR_DIA = 3;

export function GradeMes({
  ano,
  mes,
  porDia,
  usuario,
  aoAbrirDia,
  aoCriarEm,
  aoAbrirCompromisso,
}: {
  ano: number;
  mes: number;
  porDia: Map<string, CompromissoDetalhado[]>;
  usuario: Perfil;
  aoAbrirDia: (dia: string) => void;
  aoCriarEm: (dia: string) => void;
  aoAbrirCompromisso: (c: CompromissoDetalhado) => void;
}) {
  const dias = gradeDoMes(ano, mes);
  const hoje = diaLocal(new Date());

  return (
    <div className="calendario">
      <div className="calendario-cabecalho">
        {NOMES_DIA_CURTO.map((nome) => (
          <span key={nome}>{nome}</span>
        ))}
      </div>

      <div className="calendario-grade">
        {dias.map((dia) => {
          const doMes = Number(dia.slice(5, 7)) === mes;
          const diaSemana = new Date(`${dia}T12:00:00`).getDay();
          const fimDeSemana = diaSemana === 0 || diaSemana === 6;
          const itens = porDia.get(dia) ?? [];
          const visiveis = itens.slice(0, LIMITE_POR_DIA);
          const escondidos = itens.length - visiveis.length;

          const classes = [
            'dia',
            !doMes && 'dia-fora',
            dia === hoje && 'dia-hoje',
            fimDeSemana && doMes && 'dia-fim-semana',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={dia} className={classes}>
              <div className="dia-topo">
                <button
                  className="dia-numero"
                  onClick={() => aoAbrirDia(dia)}
                  aria-label={`Abrir o dia ${dia.split('-').reverse().join('/')}`}
                >
                  {Number(dia.slice(8, 10))}
                </button>

                <button
                  className="dia-adicionar"
                  onClick={() => aoCriarEm(dia)}
                  aria-label={`Marcar compromisso em ${dia.split('-').reverse().join('/')}`}
                  title="Marcar compromisso"
                >
                  <IconeMais />
                </button>
              </div>

              {visiveis.map((c) => {
                const meu = c.responsavel_id === usuario.id;
                const editavel = podeGerirCompromisso(usuario, c);

                return (
                  <button
                    key={c.id}
                    className={[
                      'marca',
                      `marca-${corTipo(c.tipo)}`,
                      c.status === 'cancelado' && 'marca-cancelada',
                      c.status === 'concluido' && 'marca-concluida',
                      // Compromisso de outra pessoa fica mais discreto: a
                      // agenda continua visivel, mas o proprio dia salta
                      // primeiro aos olhos.
                      !meu && 'marca-alheia',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => aoAbrirCompromisso(c)}
                    title={
                      `${horaLocal(c.inicio)} ${c.titulo}` +
                      `\n${rotuloTipo(c.tipo)} · ${STATUS_COMPROMISSO[c.status].rotulo}` +
                      `\nResponsável: ${c.responsavel_nome}` +
                      (c.local ? `\nLocal: ${c.local}` : '') +
                      (editavel ? '' : '\nSomente a gestão pode alterar')
                    }
                  >
                    <time>{c.dia_inteiro ? 'dia' : horaLocal(c.inicio)}</time>
                    <span className="texto-truncado">{c.titulo}</span>
                  </button>
                );
              })}

              {escondidos > 0 && (
                <button className="dia-mais" onClick={() => aoAbrirDia(dia)}>
                  mais {escondidos}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
