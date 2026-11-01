import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export function erroCaptura(message, status = 422) {
  return Object.assign(new Error(message), { status });
}

// guarda só os dados do pedido e abre o navegador quando tiver vaga
export function criarFilaCaptura({
  executar,
  concorrencia = 1,
  maxFila = 12,
  esperaMs = 90_000,
  abandonoMs = 20_000,
  resultadoMs = 60_000,
  maxResultados = 32,
  maxBytesResultados = 32 * 1024 * 1024,
  agora = () => performance.now(),
} = {}) {
  if (typeof executar !== "function") {
    throw new TypeError("Informe o executor de captura.");
  }

  for (const [nome, valor] of Object.entries({
    concorrencia,
    maxFila,
    esperaMs,
    abandonoMs,
    resultadoMs,
    maxResultados,
    maxBytesResultados,
  })) {
    if (!Number.isSafeInteger(valor) || valor < 1) {
      throw new TypeError(`Configuração inválida: ${nome}.`);
    }
  }

  const tarefas = new Map();
  const pendentes = new Map();
  const usuariosAtivos = new Set();
  const execucoes = new Set();

  let ativas = 0;
  let ultimaAssessoria = null;
  let fechada = false;
  let agendada = false;

  const usuarioChave = (dono) => `${dono.assessoria_id}:${dono.usuario_id}`;

  const mesmaPessoa = (a, b) =>
    a.assessoria_id === b.assessoria_id &&
    a.usuario_id === b.usuario_id &&
    a.origem === b.origem;

  const terminal = (tarefa) =>
    !["aguardando", "processando"].includes(tarefa.estado);

  function totalPendentes() {
    let total = 0;

    for (const lista of pendentes.values()) {
      total += lista.length;
    }

    return total;
  }

  function retirarPendente(tarefa) {
    const lista = pendentes.get(tarefa.dono.assessoria_id);

    if (!lista) return;

    const indice = lista.indexOf(tarefa.id);

    if (indice !== -1) {
      lista.splice(indice, 1);
    }

    if (lista.length === 0) {
      pendentes.delete(tarefa.dono.assessoria_id);
    }
  }

  function terminar(tarefa, estado, erro = null) {
    retirarPendente(tarefa);
    tarefa.estado = estado;
    tarefa.erro = erro;
    tarefa.fim = agora();

    if (estado !== "concluida") {
      tarefa.resultado = null;
    }
  }

  function cancelarTarefa(tarefa) {
    if (tarefa.estado === "cancelada") return;

    terminar(tarefa, "cancelada", erroCaptura("A captura foi cancelada.", 409));
    tarefa.controlador?.abort(tarefa.erro);
    agendar();
  }

  function limpar() {
    const instante = agora();

    for (const tarefa of tarefas.values()) {
      if (!terminal(tarefa) && instante - tarefa.acompanhadaEm > abandonoMs) {
        cancelarTarefa(tarefa);
      } else if (
        tarefa.estado === "aguardando" &&
        instante - tarefa.criadaEm > esperaMs
      ) {
        terminar(
          tarefa,
          "falhou",
          erroCaptura(
            "A espera pela captura demorou demais. Tente novamente em instantes.",
            503
          )
        );
      }

      if (
        terminal(tarefa) &&
        !tarefa.emExecucao &&
        instante - tarefa.fim > resultadoMs
      ) {
        tarefas.delete(tarefa.id);
      }
    }
    // limpa as imagens antigas pra não acumular memória
    const finais = [...tarefas.values()]
      .filter((tarefa) => terminal(tarefa) && !tarefa.emExecucao)
      .sort((a, b) => a.fim - b.fim);

    let bytes = finais.reduce(
      (soma, tarefa) => soma + (tarefa.resultado?.imagem.length ?? 0),
      0
    );

    while (finais.length > maxResultados || bytes > maxBytesResultados) {
      const antiga = finais.shift();
      bytes -= antiga.resultado?.imagem.length ?? 0;
      tarefas.delete(antiga.id);
    }
  }

  function proxima() {
    const grupos = [...pendentes.keys()];
    const indiceUltima = grupos.indexOf(ultimaAssessoria);

    if (indiceUltima !== -1) {
      grupos.push(...grupos.splice(0, indiceUltima + 1));
    }

    for (const assessoria of grupos) {
      const lista = pendentes.get(assessoria);
      const indice = lista.findIndex(
        (id) => !usuariosAtivos.has(usuarioChave(tarefas.get(id).dono))
      );

      if (indice === -1) continue;

      const tarefa = tarefas.get(lista[indice]);
      retirarPendente(tarefa);
      ultimaAssessoria = assessoria;

      return tarefa;
    }

    return null;
  }

  function iniciar(tarefa) {
    ativas++;
    tarefa.emExecucao = true;
    tarefa.estado = "processando";
    tarefa.controlador = new AbortController();

    const chave = usuarioChave(tarefa.dono);
    usuariosAtivos.add(chave);

    const promessa = (async () => {
      try {
        const resultado = await executar(tarefa.dados, tarefa.controlador.signal);

        if (tarefa.estado !== "processando") return;

        if (
          !Buffer.isBuffer(resultado?.imagem) ||
          resultado.imagem.length > 4 * 1024 * 1024
        ) {
          throw erroCaptura("O serviço retornou uma imagem inválida.", 502);
        }

        tarefa.resultado = resultado;
        terminar(tarefa, "concluida");
      } catch (erro) {
        if (tarefa.estado === "processando") {
          const status = erro?.status === 422 ? 422 : 502;

          terminar(
            tarefa,
            "falhou",
            erroCaptura(
              status === 422
                ? erro.message
                : "Não foi possível capturar esta página.",
              status
            )
          );
        }
      } finally {
        tarefa.emExecucao = false;
        tarefa.controlador = null;
        ativas--;
        usuariosAtivos.delete(chave);
        limpar();
        agendar();
      }
    })();

    execucoes.add(promessa);
    void promessa.finally(() => execucoes.delete(promessa));
  }

  function agendar() {
    if (fechada || agendada) return;

    agendada = true;
    setImmediate(() => {
      agendada = false;
      if (fechada) return;

      limpar();

      while (ativas < concorrencia) {
        const tarefa = proxima();

        if (!tarefa) break;

        iniciar(tarefa);
      }
    });
  }

  function localizar(id, dono) {
    limpar();
    const tarefa = tarefas.get(id);

    if (!tarefa || !mesmaPessoa(tarefa.dono, dono)) {
      throw erroCaptura(
        "Esta captura expirou ou não está disponível. Inicie outra captura.",
        404
      );
    }

    return tarefa;
  }

  function resumo(tarefa) {
    return {
      id: tarefa.id,
      estado: tarefa.estado,
      consultar_em_ms: 1500,
    };
  }

  const limpeza = setInterval(() => {
    limpar();
    agendar();
  }, 1000);

  limpeza.unref();

  return {
    adicionar(dados, dono) {
      if (fechada) {
        throw erroCaptura(
          "O serviço de captura está reiniciando. Tente novamente.",
          503
        );
      }

      limpar();

      const minhas = [...tarefas.values()].filter(
        (tarefa) =>
          !terminal(tarefa) &&
          usuarioChave(tarefa.dono) === usuarioChave(dono)
      );

      const igual = minhas.find(
        (tarefa) =>
          mesmaPessoa(tarefa.dono, dono) &&
          tarefa.dados.link === dados.link &&
          tarefa.dados.trecho === dados.trecho
      );

      if (igual) {
        igual.acompanhadaEm = agora();
        return resumo(igual);
      }

      if (minhas.length >= 2) {
        throw erroCaptura(
          "Você já tem capturas em andamento. Aguarde ou cancele uma delas para continuar.",
          429
        );
      }

      if (totalPendentes() >= maxFila) {
        throw erroCaptura(
          "A fila de capturas está cheia neste momento. Tente novamente em instantes.",
          429
        );
      }

      const tarefa = {
        id: randomUUID(),
        dados: { ...dados },
        dono: { ...dono },
        estado: "aguardando",
        criadaEm: agora(),
        acompanhadaEm: agora(),
        fim: null,
        erro: null,
        resultado: null,
        controlador: null,
        emExecucao: false,
      };

      tarefas.set(tarefa.id, tarefa);

      const lista = pendentes.get(dono.assessoria_id) ?? [];
      lista.push(tarefa.id);
      pendentes.set(dono.assessoria_id, lista);
      agendar();

      return resumo(tarefa);
    },

    consultar(id, dono) {
      const tarefa = localizar(id, dono);
      tarefa.acompanhadaEm = agora();

      if (tarefa.erro) throw tarefa.erro;

      return tarefa.resultado ?? resumo(tarefa);
    },

    cancelar(id, dono) {
      const tarefa = localizar(id, dono);
      cancelarTarefa(tarefa);

      return resumo(tarefa);
    },

    get estatisticas() {
      limpar();

      return {
        ativas,
        aguardando: totalPendentes(),
        tarefas: tarefas.size,
      };
    },

    async fechar() {
      fechada = true;
      clearInterval(limpeza);

      for (const tarefa of tarefas.values()) {
        cancelarTarefa(tarefa);
      }

      await Promise.allSettled([...execucoes]);
      tarefas.clear();
      pendentes.clear();
    },
  };
}
