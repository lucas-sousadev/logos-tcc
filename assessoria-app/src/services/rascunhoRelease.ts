import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { API_URL } from "@/constants/api";
import {
  ErroApiRelease,
  sincronizarRascunhoRelease,
  type DetalheRelease,
  type PedidoRascunhoRelease,
} from "@/services/api/release";
import type { ReleasePendente } from "@/services/releasePendente";

export interface CopiaRascunhoRelease {
  seq: number;
  valor: ReleasePendente;
  remoto: DetalheRelease | null;
  confirmado: string;
  pedido: PedidoRascunhoRelease | null;
  bloqueio: {
    status: number;
    mensagem: string;
    assinatura: string;
  } | null;
  encerrado: boolean;
  remoto_ausente?: boolean;
  recuperacao_chave?: string;
}

const sessoes = new Map<string, SessaoRascunhoRelease>();
const nomes = new Map<string, Promise<string>>();

function chaveSessao(conta: string, identidade: string) {
  return JSON.stringify([API_URL, conta, identidade]);
}

async function nomeCopia(
  conta: string,
  identidade: string
) {
  const chave = chaveSessao(conta, identidade);
  let nome = nomes.get(chave);
  if (!nome) {
    nome = Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      chave
    ).then((hash) => "logos-release-auto-v1-" + hash);
    nomes.set(chave, nome);
    void nome.catch(() => nomes.delete(chave));
  }
  return nome;
}

function validar(copia: CopiaRascunhoRelease) {
  const valor = copia?.valor;
  const idValido = (id: unknown) => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
  const textoOpcional = (texto: unknown) => texto === null || typeof texto === "string";
  const blocosValidos = (blocos: unknown) => Array.isArray(blocos) && blocos.length <= 100 && blocos.every((b) =>
    b && typeof b.id === "string" &&
    ["titulo", "linha_fina", "texto", "imagem", "contato", "divisor", "espacamento", "botao", "arquivo"].includes(b.tipo) &&
    ["texto", "url", "legenda"].every((campo) => b[campo] === undefined || typeof b[campo] === "string")
  );
  const remoto = copia?.remoto;
  const tentativa = copia?.pedido;

  return (
    Number.isSafeInteger(copia?.seq) &&
    copia.seq >= 0 &&
    typeof copia.encerrado === "boolean" &&
    (copia.remoto_ausente === undefined || typeof copia.remoto_ausente === "boolean") &&
    (copia.recuperacao_chave === undefined || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(copia.recuperacao_chave)) &&
    typeof copia.confirmado === "string" &&
    typeof valor?.dados?.titulo === "string" &&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
      valor.dados.chave_rascunho
    ) &&
    (valor.dados.cliente_id === null || idValido(valor.dados.cliente_id)) &&
    typeof valor.conteudoEditado === "boolean" &&
    (valor.cliente === null || (idValido(valor.cliente?.id) && typeof valor.cliente.nome === "string")) &&
    (valor.template === null || (
      typeof valor.template?.nome === "string" && typeof valor.template.assinatura === "string" &&
      (valor.template.id === null || idValido(valor.template.id)) && textoOpcional(valor.template.codigo) &&
      ["LOGOS", "ASSESSORIA"].includes(valor.template.origem) && typeof valor.template.disponivel === "boolean"
    )) &&
    Array.isArray(valor.dados.jornalistas_ids) && valor.dados.jornalistas_ids.every(idValido) &&
    Array.isArray(valor.selecionados) && valor.selecionados.every((c) => c && idValido(c.id) &&
      typeof c.nome === "string" && textoOpcional(c.email) && textoOpcional(c.veiculo_nome) &&
      typeof c.ativo === "number" && typeof c.elegivel === "boolean") &&
    blocosValidos(valor.dados.blocos ?? []) &&
    [
      "DESTINO",
      "TEMPLATE",
      "CONTEUDO",
      "ENVIO",
      "REVISAO",
    ].includes(valor.etapa) &&
    [
      "assunto",
      "primeira_linha",
      "nome_remetente",
      "responder_para",
    ].every(
      (campo) =>
        typeof valor.dados.dados_envio?.[
          campo as keyof typeof valor.dados.dados_envio
        ] === "string"
    ) &&
    (
      remoto === null || (
        idValido(remoto?.id) && /^[a-f0-9]{64}$/.test(remoto.versao_edicao) &&
        typeof remoto.titulo === "string" && textoOpcional(remoto.cliente_nome) &&
        blocosValidos(remoto.blocos) && Array.isArray(remoto.destinatarios) &&
        remoto.destinatarios.every((d) => d && idValido(d.id) && (d.jornalista_id === null || idValido(d.jornalista_id)) &&
          typeof d.email === "string" && textoOpcional(d.jornalista_nome) && textoOpcional(d.veiculo_nome))
      )
    ) &&
    (tentativa === null || (
      tentativa?.chave === valor.dados.chave_rascunho &&
      (tentativa.id === null || idValido(tentativa.id)) &&
      (tentativa.versao === null || /^[a-f0-9]{64}$/.test(tentativa.versao)) &&
      typeof tentativa.dados?.titulo === "string" && Array.isArray(tentativa.dados.jornalistas_ids) &&
      blocosValidos(tentativa.dados.blocos) && typeof tentativa.dados.dados_envio?.assunto === "string"
    )) &&
    (copia.bloqueio === null || (Number.isInteger(copia.bloqueio?.status) &&
      typeof copia.bloqueio.mensagem === "string" && typeof copia.bloqueio.assinatura === "string"))
  );
}

export async function lerCopiaRelease(
  conta: string,
  identidade: string
): Promise<CopiaRascunhoRelease | null> {
  const nome = await nomeCopia(conta, identidade);
  const copias: CopiaRascunhoRelease[] = [];
  let encontrou = false;

  for (const indice of [0, 1]) {
    const chave = nome + "." + indice + ".json";

    const arquivo =
      Platform.OS === "web"
        ? null
        : new File(Paths.document, chave);

    const texto = arquivo
      ? arquivo.exists
        ? await arquivo.text()
        : null
      : await AsyncStorage.getItem(chave);

    if (texto === null) continue;

    encontrou = true;

    try {
      const copia = JSON.parse(
        texto
      ) as CopiaRascunhoRelease;

      if (validar(copia)) {
        copias.push(copia);
      }
    } catch {
      // A outra cópia pode continuar íntegra.
    }
  }

  if (encontrou && !copias.length) {
    throw new Error(
      "Não foi possível recuperar a cópia local. " +
        "Ela foi preservada."
    );
  }

  return (
    copias.sort((a, b) => b.seq - a.seq)[0] ??
    null
  );
}

async function escreverCopia(
  conta: string,
  identidade: string,
  copia: CopiaRascunhoRelease
) {
  const chave =
    (await nomeCopia(conta, identidade)) +
    "." +
    (copia.seq % 2) +
    ".json";

  const texto = JSON.stringify(copia);

  if (Platform.OS === "web") {
    return AsyncStorage.setItem(chave, texto);
  }

  const arquivo = new File(Paths.document, chave);

  arquivo.create({ overwrite: true });
  arquivo.write(texto);
}

function pedido(
  valor: ReleasePendente,
  remoto: DetalheRelease | null
): PedidoRascunhoRelease {
  const dados = valor.dados;

  return {
    id: remoto?.id ?? null,
    chave: dados.chave_rascunho,
    versao: remoto?.versao_edicao ?? null,
    dados: {
      titulo: dados.titulo,
      cliente_id: dados.cliente_id,
      jornalistas_ids: dados.jornalistas_ids,
      template_id: dados.template_id ?? null,
      template_codigo: dados.template_codigo ?? null,
      template_assinatura:
        dados.template_assinatura ?? "",
      blocos: dados.blocos ?? [],
      dados_envio: dados.dados_envio,
    },
  };
}

export class SessaoRascunhoRelease {
  private copia: CopiaRascunhoRelease;
  private fila: Promise<unknown> = Promise.resolve();

  private rede: Promise<
    DetalheRelease | null
  > | null = null;

  private localSeguro = false;
  private seqGravada = 0;
  private geracao = 0;
  private viva = true;
  private carregamento: Promise<ReleasePendente | null> | null = null;
  private possuiCopia = false;
  private dadosIniciais: string;

  pronta = false;

  permitida = false;

  get idRemoto() { return this.copia.remoto?.id ?? this.base?.id ?? null; }
  get remotoAusente() { return this.copia.remoto_ausente === true; }
  get emConflito() { return !this.remotoAusente && [404, 409].includes(this.copia.bloqueio?.status ?? 0); }

  constructor(
    private conta: string,
    private identidade: string,
    inicial: ReleasePendente,
    private base: DetalheRelease | null,
    private avisar: (
      mensagem: string,
      erro?: boolean
    ) => void
  ) {
    this.dadosIniciais = JSON.stringify(pedido(inicial, base).dados);
    this.copia = {
      seq: 0,
      valor: inicial,
      remoto: base,
      confirmado: base
        ? JSON.stringify(pedido(inicial, base).dados)
        : "",
      pedido: null,
      bloqueio: null,
      encerrado: false,
    };
  }

  iniciar() {
    this.carregamento ??= this.carregar();
    return this.carregamento;
  }

  private async carregar() {
    const chave = chaveSessao(this.conta, this.identidade);
    const anterior = sessoes.get(chave);
    if (anterior && anterior !== this && anterior.viva) {
      throw new Error("Este rascunho já está aberto em outra tela. Volte à tela anterior para continuar.");
    }
    sessoes.set(chave, this);

    // Uma resposta da tela anterior pode ainda estar atualizando a cópia local.
    if (anterior && anterior !== this) await anterior.aguardar();

    const salva = await lerCopiaRelease(
      this.conta,
      this.identidade
    );

    if (!this.viva) return null;
    this.pronta = true;
    if (!salva) return null;

    this.seqGravada = salva.seq;

    if (salva.encerrado) {
      this.copia.seq = salva.seq;
      return null;
    }

    if (this.base && (salva.remoto
      ? salva.remoto.id !== this.base.id
      : salva.valor.dados.chave_rascunho !== this.base.chave_rascunho)) {
      this.pronta = false;
      throw new Error("A cópia local pertence a outro rascunho. Ela foi preservada.");
    }

    // Uma cópia já sincronizada pode acompanhar a versão atual do servidor.
    // Alterações locais pendentes continuam usando sua versão original.
    if (
      this.base && salva.remoto &&
      this.base.versao_edicao !== salva.remoto.versao_edicao &&
      !salva.pedido && !salva.bloqueio &&
      JSON.stringify(pedido(salva.valor, salva.remoto).dados) === salva.confirmado
    ) {
      this.copia.seq = salva.seq;
      this.copia.valor.dados.chave_rascunho = salva.valor.dados.chave_rascunho;
      this.copia.valor.etapa = this.copia.valor.template || ["DESTINO", "TEMPLATE"].includes(salva.valor.etapa)
        ? salva.valor.etapa : "TEMPLATE";
      this.possuiCopia = true;
      return this.copia.valor;
    }

    this.copia = salva;
    this.possuiCopia = true;
    this.localSeguro = true;
    this.mostrar();

    return salva.valor;
  }

  private mostrar() {
    if (!this.viva) return;

    const atualizado =
      JSON.stringify(
        pedido(
          this.copia.valor,
          this.copia.remoto
        ).dados
      ) === this.copia.confirmado;
    const somenteEtapa = !this.copia.remoto && !this.copia.pedido &&
      JSON.stringify(pedido(this.copia.valor, null).dados) === this.dadosIniciais;

    this.avisar(
      this.copia.bloqueio?.mensagem ??
        (
          this.localSeguro
            ? somenteEtapa
              ? "Etapa salva neste aparelho."
              : atualizado
              ? "Salvo automaticamente."
              : "Salvo neste aparelho. Aguardando sincronização."
            : "Salvando neste aparelho…"
        ),
      Boolean(this.copia.bloqueio)
    );
  }

  private gravar() {
    const geracao = ++this.geracao;

    const copia = JSON.parse(
      JSON.stringify(this.copia)
    ) as CopiaRascunhoRelease;

    const trabalho = this.fila
      .catch(() => {})
      .then(async () => {
        copia.seq = this.seqGravada + 1;

        await escreverCopia(
          this.conta,
          this.identidade,
          copia
        );

        this.seqGravada = copia.seq;
        this.copia.seq = copia.seq;
      });

    this.fila = trabalho;

    return trabalho
      .then(() => {
        if (geracao === this.geracao) {
          this.localSeguro = true;
        }

        this.mostrar();
      })
      .catch((erro: unknown) => {
        this.localSeguro = false;

        if (this.viva) {
          this.avisar(
            "Não foi possível guardar a cópia neste aparelho. " +
              "Tente salvar antes de sair.",
            true
          );
        }

        throw erro;
      });
  }

  async registrar(valor: ReleasePendente, alterado = true) {
    if (!this.pronta || !this.viva) throw new Error("A recuperação do rascunho ainda não terminou.");
    if (this.copia.encerrado) return;
    if (!alterado && !this.possuiCopia) return;
    this.possuiCopia = true;

    const texto = JSON.stringify(valor);

    if (
      texto === JSON.stringify(this.copia.valor) &&
      this.localSeguro
    ) {
      return;
    }

    this.copia.valor = JSON.parse(
      texto
    ) as ReleasePendente;

    this.localSeguro = false;

    await this.gravar();
  }

  async sincronizar(
    forcar = false
  ): Promise<DetalheRelease | null> {
    while (this.rede) {
      await this.rede;
    }

    if (!this.pronta || !this.viva) throw new Error("A tela do rascunho foi fechada ou ainda está carregando.");
    if (this.copia.encerrado || (!forcar && !this.possuiCopia)) {
      return this.copia.remoto;
    }

    const trabalho = this.executar(forcar);
    this.rede = trabalho;

    try {
      return await trabalho;
    } finally {
      if (this.rede === trabalho) {
        this.rede = null;
      }
    }
  }

  private async executar(forcar: boolean) {
    let verificou = false;

    while (
      this.viva &&
      !this.copia.encerrado &&
      (forcar || this.permitida)
    ) {
      const atual = pedido(
        this.copia.valor,
        this.copia.remoto
      );

      const assinatura = JSON.stringify(
        atual.dados
      );
      if (!forcar && !this.copia.remoto && !this.copia.pedido && assinatura === this.dadosIniciais) {
        return null;
      }

      if (this.copia.bloqueio) {
        const bloqueio = this.copia.bloqueio;
        const validacao = [400, 413, 422].includes(bloqueio.status) ||
          (bloqueio.status === 404 && this.idRemoto === null && !this.remotoAusente);

        if (
          !validacao ||
          bloqueio.assinatura === assinatura
        ) {
          throw new Error(bloqueio.mensagem);
        }

        this.copia.bloqueio = null;
      }

      if (
        !this.copia.pedido &&
        assinatura === this.copia.confirmado &&
        (!forcar || verificou)
      ) {
        return this.copia.remoto;
      }

      this.copia.pedido ??= atual;

      // Guarda a tentativa antes de acessar a rede.
      await this.gravar();

      const tentativa = this.copia.pedido;

      try {
        const remoto =
          await sincronizarRascunhoRelease(
            tentativa
          );

        verificou = true;

        this.copia.remoto = remoto;
        this.copia.confirmado = JSON.stringify(
          tentativa.dados
        );

        this.copia.pedido = null;
        this.copia.bloqueio = null;
        this.copia.remoto_ausente = false;

        await this.gravar();
      } catch (erro) {
        if (
          erro instanceof ErroApiRelease &&
          [
            400,
            401,
            403,
            404,
            409,
            413,
            422,
          ].includes(erro.status)
        ) {
          this.copia.bloqueio = {
            status: erro.status,
            assinatura: JSON.stringify(
              tentativa.dados
            ),
            mensagem:
              erro.status === 409
                ? "O release foi alterado em outra sessão " +
                  "ou já entrou no envio. Sua cópia local " +
                  "foi preservada; confira a versão do " +
                  "servidor antes de continuar."
                : "Cópia local preservada. " +
                  erro.message,
          };

          if ([400, 413, 422].includes(erro.status) || (erro.status === 404 && tentativa.id === null)) {
            this.copia.pedido = null;
          }
        }

        await this.gravar();
        this.mostrar();

        throw erro;
      }
    }

    return this.copia.remoto;
  }

  async confirmar(valor: ReleasePendente) {
    await this.registrar(valor);

    const remoto = await this.sincronizar(true);

    if (!remoto) {
      throw new Error(
        "O servidor ainda não confirmou o rascunho."
      );
    }

    return remoto;
  }

  async usarServidor(release: DetalheRelease, podeMailing: boolean) {
    this.permitida = false;
    await this.aguardar();
    if (!this.viva || release.id !== this.idRemoto || release.status !== "RASCUNHO") {
      throw new Error("Este release não está mais disponível para edição. Sua cópia local foi preservada.");
    }
    const anterior = this.copia;
    const valor: ReleasePendente = {
      dados: {
        titulo: release.titulo, cliente_id: release.cliente_id,
        chave_rascunho: anterior.valor.dados.chave_rascunho,
        jornalistas_ids: release.destinatarios.flatMap((d) => d.jornalista_id === null ? [] : [d.jornalista_id]),
        template_id: release.template_id, template_codigo: release.template_codigo,
        template_assinatura: "", blocos: release.blocos,
        dados_envio: { assunto: release.assunto, primeira_linha: release.primeira_linha,
          nome_remetente: release.nome_remetente, responder_para: release.responder_para },
      },
      etapa: "DESTINO", conteudoEditado: false,
      cliente: release.cliente_id === null ? null : { id: release.cliente_id, nome: release.cliente_nome ?? "Cliente vinculado" },
      template: release.template_id !== null || release.template_codigo !== null || release.blocos.length > 0 ? {
        id: release.template_id, codigo: release.template_codigo, nome: "Conteúdo salvo do release",
        origem: release.template_codigo ? "LOGOS" : "ASSESSORIA", assinatura: "", disponivel: true,
      } : null,
      selecionados: release.destinatarios.flatMap((d) => d.jornalista_id === null ? [] : [{
        id: d.jornalista_id, nome: d.jornalista_nome ?? d.email,
        email: podeMailing ? d.jornalista_email ?? d.email : d.email,
        ativo: Number(d.jornalista_ativo ?? 0), veiculo_nome: d.veiculo_nome,
        elegivel: Number(d.jornalista_ativo) === 1 && Boolean(d.jornalista_email?.trim()),
      }]),
    };
    this.copia = { seq: anterior.seq, valor, remoto: release, confirmado: JSON.stringify(pedido(valor, release).dados),
      pedido: null, bloqueio: null, encerrado: false };
    try { await this.gravar(); }
    catch (erro) { this.copia = anterior; throw erro; }
    return valor;
  }

  async marcarRemotoAusente() {
    this.permitida = false;
    await this.aguardar();
    if (!this.viva || !this.idRemoto) return;
    this.copia.remoto_ausente = true;
    this.copia.bloqueio = {
      status: 404,
      assinatura: JSON.stringify(pedido(this.copia.valor, this.copia.remoto).dados),
      mensagem: "Este release não está mais disponível no servidor. Seu preenchimento continua salvo neste aparelho e pode ser recuperado como um novo rascunho.",
    };
    await this.gravar();
  }

  async recuperarComoNovo() {
    this.permitida = false;
    await this.aguardar();
    if (!this.viva || !this.remotoAusente) {
      throw new Error("Confira a disponibilidade do release antes de recuperar uma nova cópia.");
    }
    const valor = JSON.parse(JSON.stringify(this.copia.valor)) as ReleasePendente;
    valor.dados.chave_rascunho = this.copia.recuperacao_chave ?? Crypto.randomUUID();
    // A cópia conserva o conteúdo sem depender de um modelo que pode ter sido removido.
    valor.dados.template_id = null;
    valor.dados.template_codigo = null;
    valor.dados.template_assinatura = "";
    valor.template = valor.template || valor.dados.blocos?.length ? {
      id: null, codigo: null, assinatura: "", nome: "Conteúdo recuperado",
      origem: "ASSESSORIA", disponivel: true,
    } : null;
    valor.conteudoEditado = Boolean(valor.dados.blocos?.length) || valor.conteudoEditado;
    if (!valor.template && !["DESTINO", "TEMPLATE"].includes(valor.etapa)) valor.etapa = "TEMPLATE";
    delete valor.acao;
    delete valor.release_id;
    delete valor.versao_envio;

    if (this.identidade !== "novo") {
      // Uma repetição após falha local deve continuar a mesma recuperação.
      this.copia.recuperacao_chave = valor.dados.chave_rascunho;
      await this.gravar();
      const anteriorNoCadastro = await lerCopiaRelease(this.conta, "novo");
      if (anteriorNoCadastro?.encerrado && anteriorNoCadastro.valor.dados.chave_rascunho === valor.dados.chave_rascunho) {
        throw new Error("Este conteúdo já foi recuperado. Confira o release salvo na listagem.");
      }
      const destino = new SessaoRascunhoRelease(this.conta, "novo", valor, null, () => {});
      try {
        const existente = await destino.iniciar();
        if (existente && existente.dados.chave_rascunho !== valor.dados.chave_rascunho) {
          throw new Error("Há outro rascunho em criação neste aparelho. Salve-o antes de recuperar este conteúdo.");
        }
        if (!existente) await destino.registrar(valor);
        await this.concluir();
        return existente ?? valor;
      } finally { destino.dispose(); }
    } else {
      const anterior = this.copia;
      const base = this.base;
      this.base = null;
      this.copia = {
        seq: anterior.seq, valor, remoto: null, confirmado: "", pedido: null,
        bloqueio: null, encerrado: false, remoto_ausente: false,
      };
      try { await this.gravar(); }
      catch (erro) { this.copia = anterior; this.base = base; throw erro; }
    }
    return valor;
  }

  async concluir(id?: number, chave?: string) {
    this.permitida = false;
    await this.aguardar();
    if (id !== undefined && this.copia.remoto?.id !== id && this.copia.valor.dados.chave_rascunho !== chave) return;
    this.copia.encerrado = true;
    try {
      await this.gravar();
    } catch (erro) {
      this.copia.encerrado = false;
      throw erro;
    }
  }

  private async aguardar() {
    await this.carregamento?.catch(() => {});
    await this.rede?.catch(() => {});
    await this.fila.catch(() => {});
  }

  dispose() {
    this.permitida = false;
    this.viva = false;
    void this.aguardar().then(() => {
      const chave = chaveSessao(this.conta, this.identidade);
      if (sessoes.get(chave) === this) sessoes.delete(chave);
    });
  }
}

export async function encerrarCopiaRelease(
  conta: string,
  identidade: string,
  id: number,
  chave?: string
) {
  const sessao = sessoes.get(chaveSessao(conta, identidade));
  if (sessao?.pronta) {
    await sessao.concluir(id, chave);
    return;
  }
  const copia = await lerCopiaRelease(
    conta,
    identidade
  );

  if (
    !copia ||
    copia.encerrado ||
    (copia.remoto?.id !== id && copia.valor.dados.chave_rascunho !== chave)
  ) {
    return;
  }

  await escreverCopia(conta, identidade, {
    ...copia,
    seq: copia.seq + 1,
    encerrado: true,
  });
}
