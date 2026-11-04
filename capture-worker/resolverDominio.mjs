import { lookup } from "node:dns/promises";
import { ipPublico, validarUrlCaptura } from "./proxyCaptura.mjs";
import { erroCaptura } from "./filaCaptura.mjs";

export function criarResolvedorDominio({
  consultarDns = (host) => lookup(host, { all: true, family: 4 }),
  maxConsultas = 2,
  prazoMs = 1500,
  cacheMs = 5000,
  agora = Date.now,
} = {}) {
  const consultas = new Map();
  const cache = new Map();
  let fechado = false;

  function consultar(host) {
    const anterior = consultas.get(host);
    if (anterior) return anterior;

    if (fechado || consultas.size >= maxConsultas) {
      throw erroCaptura(
        "A consulta de endereços está ocupada. Tente novamente em instantes.",
        503
      );
    }

    const promessa = Promise.resolve()
      .then(() => consultarDns(host))
      .then((registros) => {
        if (
          !Array.isArray(registros) ||
          !registros.length ||
          registros.length > 64 ||
          registros.some((registro) =>
            typeof registro?.address !== "string" || !ipPublico(registro.address)
          )
        ) {
          throw erroCaptura("Este endereço não pode ser consultado.");
        }

        const ips = [...new Set(registros.map((registro) => registro.address))];

        // o sistema não informa o TTL então reaproveita só por cinco segundos
        if (!fechado && cacheMs > 0) {
          if (cache.size >= 128) cache.delete(cache.keys().next().value);
          cache.set(host, { ips, ate: agora() + cacheMs });
        }

        return ips;
      })
      .catch((erro) => {
        if (erro?.status) throw erro;
        if (["ENOTFOUND", "ENODATA"].includes(erro?.code)) {
          throw erroCaptura("Não foi possível localizar o site.");
        }

        throw erroCaptura(
          "A consulta de endereços está indisponível. Tente novamente em instantes.",
          503
        );
      })
      .finally(() => {
        consultas.delete(host);
      });

    consultas.set(host, promessa);
    return promessa;
  }

  return {
    async resolver(host, restanteMs) {
      if (fechado) {
        throw erroCaptura("O serviço de consulta está reiniciando.", 503);
      }

      if (
        typeof host !== "string" ||
        host.length > 253 ||
        !Number.isSafeInteger(restanteMs) ||
        restanteMs < 1 ||
        restanteMs > 10_000
      ) {
        throw erroCaptura("Consulta de endereço inválida.");
      }

      const endereco = validarUrlCaptura(`https://${host}/`);
      if (endereco.hostname !== host) {
        throw erroCaptura("Domínio inválido.");
      }

      const anterior = cache.get(host);
      if (anterior?.ate > agora()) return anterior.ips;
      cache.delete(host);

      let temporizador;

      try {
        return await Promise.race([
          consultar(host),
          new Promise((_, rejeitar) => {
            temporizador = setTimeout(() => {
              rejeitar(erroCaptura("A consulta do endereço demorou demais.", 504));
            }, Math.min(restanteMs, prazoMs));
          }),
        ]);
      } finally {
        clearTimeout(temporizador);
        // lookup não cancela no sistema então mantém a vaga até a consulta terminar
      }
    },

    fechar() {
      fechado = true;
      cache.clear();
    },
  };
}
