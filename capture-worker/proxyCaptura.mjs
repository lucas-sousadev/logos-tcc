import { createServer, request as requisicaoHttp } from "node:http";
import { connect, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Transform, pipeline } from "node:stream";

export const LIMITES_REDE = Object.freeze({
  downloadBytes: 32 * 1024 * 1024,
  uploadBytes: 2 * 1024 * 1024,
  conexoes: 32,
  dominios: 64,
  dnsMs: 1500,
  conexaoMs: 4000,
});

function erroEntrada(message) {
  return Object.assign(new Error(message), { status: 422 });
}

export function ipPublico(ip) {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function validarUrlCaptura(valor) {
  if (typeof valor !== "string" || valor.length > 2048 || /[\x00-\x20\x7f\\]/.test(valor)) {
    throw erroEntrada("Informe um link HTTP ou HTTPS válido.");
  }
  let url;
  try { url = new URL(valor); }
  catch { throw erroEntrada("Informe um link válido."); }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      isIP(host) !== 0 || host.includes(":") || host.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|invalid)$/.test(host)) {
    throw erroEntrada("Este endereço não pode ser capturado.");
  }
  return url;
}

function limparCabecalhos(headers) {
  const ignorar = new Set([
    'connection', 'proxy-connection', 'proxy-authorization', 'proxy-authenticate',
    'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade',
    ...String(headers.connection ?? '').toLowerCase().split(',').map((h) => h.trim()),
  ]);
  return Object.fromEntries(Object.entries(headers).filter(([nome]) => !ignorar.has(nome.toLowerCase())));
}

// As dependências opcionais permitem testes locais; não recebem valores da API.
export async function criarProxyCaptura({
  limites = LIMITES_REDE,
  aoFalhar = () => {},
  resolverDns = lookup,
  conectarTcp = connect,
  enviarHttp = requisicaoHttp,
} = {}) {
  const usuario = randomBytes(16).toString('hex');
  const senha = randomBytes(32).toString('hex');
  const autorizacao = Buffer.from('Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64'));
  const clientes = new Set();
  const remotos = new Set();
  const destinos = new Map();
  let encerrado = false;
  let falha = null;
  let restricoes = false;
  let vagas = 0;
  let baixados = 0;
  let enviados = 0;

  function conferirAtivo() {
    if (falha) throw falha;
    if (encerrado) throw erroEntrada('A captura foi encerrada.');
  }

  function interromper(erro) {
    if (encerrado || falha) return;
    falha = erro;
    for (const socket of remotos) socket.destroy();
    for (const socket of clientes) socket.destroy();
    try { aoFalhar(erro); } catch { /* A interrupção da rede já foi aplicada. */ }
  }

  function contar(tamanho, download) {
    conferirAtivo();
    if (download) baixados += tamanho;
    else enviados += tamanho;
    if (baixados > limites.downloadBytes || enviados > limites.uploadBytes) {
      const erro = erroEntrada('A página ultrapassou o limite de dados para captura. Selecione uma imagem manualmente ou tente novamente.');
      interromper(erro);
      throw erro;
    }
  }

  function contador(download) {
    return new Transform({
      transform(trecho, codificacao, concluir) {
        try { contar(trecho.length, download); concluir(null, trecho); }
        catch (erro) { concluir(erro); }
      },
    });
  }

  function autenticar(req) {
    const recebida = Buffer.from(String(req.headers['proxy-authorization'] ?? ''));
    return recebida.length === autorizacao.length && timingSafeEqual(recebida, autorizacao);
  }

  function adquirirVaga() {
    conferirAtivo();
    if (vagas >= limites.conexoes) {
      restricoes = true;
      throw erroEntrada('Limite de conexões da captura atingido.');
    }
    vagas++;
    let liberada = false;
    return () => { if (!liberada) { liberada = true; vagas--; } };
  }

  async function resolver(host) {
    conferirAtivo();
    if (!destinos.has(host)) {
      if (destinos.size >= limites.dominios) {
        restricoes = true;
        throw erroEntrada('A página utiliza domínios demais para esta captura.');
      }
      const promessa = (async () => {
        let temporizador;
        try {
          const ips = await Promise.race([
            Promise.resolve().then(() => resolverDns(host, { all: true, family: 4 })),
            new Promise((_, rejeitar) => {
              temporizador = setTimeout(() => rejeitar(erroEntrada('O site demorou para informar seu endereço.')), limites.dnsMs);
            }),
          ]);
          conferirAtivo();
          if (!Array.isArray(ips) || ips.length === 0 || ips.some((ip) => !ipPublico(ip.address))) {
            throw erroEntrada('Este endereço não pode ser capturado.');
          }
          return ips[0].address;
        } finally { clearTimeout(temporizador); }
      })();
      // A mesma captura mantém o IP aprovado, inclusive em novas conexões.
      destinos.set(host, promessa);
    }
    return destinos.get(host);
  }

  async function validarDestino(valor) {
    const url = validarUrlCaptura(valor);
    return { url, ip: await resolver(url.hostname) };
  }

  function acompanharSocket(socket, liberar) {
    remotos.add(socket);
    socket.once('close', () => { remotos.delete(socket); liberar(); });
  }

  function responderFalha(res, erro) {
    if (res.destroyed) return;
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(erro?.status === 422 ? 403 : 502, { 'Connection': 'close', 'Cache-Control': 'no-store' });
    res.end('Recurso indisponível para captura.');
  }

  const servidor = createServer({ maxHeaderSize: 16 * 1024 }, (req, res) => {
    if (!autenticar(req)) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="LOGOS captura"', 'Connection': 'close' });
      res.end();
      return;
    }
    void (async () => {
      let liberar;
      try {
        if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(req.method)) throw erroEntrada('Método não permitido.');
        liberar = adquirirVaga();
        const { url, ip } = await validarDestino(req.url);
        if (url.protocol !== 'http:') throw erroEntrada('HTTPS exige um túnel seguro.');
        conferirAtivo();
        if (req.destroyed || res.destroyed) { liberar(); return; }
        const headers = { ...limparCabecalhos(req.headers), host: url.host, connection: 'close' };
        const destino = enviarHttp({
          hostname: ip,
          port: 80,
          family: 4,
          method: req.method,
          path: url.pathname + url.search,
          headers,
          agent: false,
        }, (resposta) => {
          try {
            contar(Buffer.byteLength(resposta.rawHeaders.join('\r\n')), true);
            res.writeHead(resposta.statusCode ?? 502, limparCabecalhos(resposta.headers));
            pipeline(resposta, contador(true), res, () => { destino.destroy(); });
          } catch (erro) { destino.destroy(); responderFalha(res, erro); }
        });
        destino.on('socket', (socket) => {
          acompanharSocket(socket, liberar);
          const prazo = setTimeout(() => destino.destroy(new Error('Tempo de conexão excedido.')), limites.conexaoMs);
          socket.once('connect', () => clearTimeout(prazo));
          socket.once('close', () => clearTimeout(prazo));
          if (!socket.connecting) clearTimeout(prazo);
        });
        destino.on('error', (erro) => { liberar(); responderFalha(res, erro); });
        res.once('close', () => destino.destroy());
        pipeline(req, contador(false), destino, (erro) => { if (erro) destino.destroy(); });
      } catch (erro) { liberar?.(); restricoes = true; responderFalha(res, erro); }
    })();
  });

  servidor.on('connect', (req, cliente, inicio) => {
    if (!autenticar(req)) {
      cliente.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="LOGOS captura"\r\nConnection: close\r\n\r\n');
      return;
    }
    void (async () => {
      let liberar;
      let remoto;
      try {
        if (!/^[a-z0-9.-]+:443$/i.test(req.url)) throw erroEntrada('Destino do túnel inválido.');
        liberar = adquirirVaga();
        const { ip } = await validarDestino('https://' + req.url);
        conferirAtivo();
        if (cliente.destroyed) { liberar(); return; }
        // O socket recebe o IP numérico aprovado; não faz outra consulta DNS.
        remoto = conectarTcp({ host: ip, port: 443, family: 4 });
        acompanharSocket(remoto, liberar);
        const prazo = setTimeout(() => remoto.destroy(new Error('Tempo de conexão excedido.')), limites.conexaoMs);
        remoto.once('close', () => clearTimeout(prazo));
        remoto.once('error', () => { if (!cliente.destroyed) cliente.destroy(); });
        cliente.once('close', () => remoto.destroy());
        remoto.once('connect', () => {
          clearTimeout(prazo);
          try {
            conferirAtivo();
            cliente.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (inicio.length) { contar(inicio.length, false); remoto.write(inicio); }
            pipeline(remoto, contador(true), cliente, () => { remoto.destroy(); });
            pipeline(cliente, contador(false), remoto, () => { cliente.destroy(); });
          } catch { cliente.destroy(); remoto.destroy(); }
        });
      } catch {
        liberar?.();
        restricoes = true;
        if (!cliente.destroyed) cliente.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        remoto?.destroy();
      }
    })();
  });

  servidor.on('connection', (socket) => {
    clientes.add(socket);
    socket.on('error', () => {});
    socket.once('close', () => clientes.delete(socket));
    socket.setTimeout(20_000, () => socket.destroy());
  });
  servidor.on('upgrade', (req, socket) => socket.destroy());
  servidor.on('clientError', (erro, socket) => socket.destroy());
  servidor.maxConnections = 64;
  servidor.requestTimeout = 10_000;
  servidor.headersTimeout = 5000;
  servidor.keepAliveTimeout = 1000;
  await new Promise((concluir, rejeitar) => {
    servidor.once('error', rejeitar);
    servidor.listen(0, '127.0.0.1', () => { servidor.off('error', rejeitar); concluir(); });
  });

  return {
    configuracao: {
      server: `http://127.0.0.1:${servidor.address().port}`,
      username: usuario,
      password: senha,
      bypass: '<-loopback>',
    },
    validarDestino,
    interromper,
    get falha() { return falha; },
    get restricoes() { return restricoes; },
    get estatisticas() { return { baixados, enviados, dominios: destinos.size, conexoes: vagas }; },
    async fechar() {
      if (encerrado) return;
      encerrado = true;
      for (const socket of remotos) socket.destroy();
      for (const socket of clientes) socket.destroy();
      await new Promise((concluir) => servidor.close(() => concluir()));
    },
  };
}


