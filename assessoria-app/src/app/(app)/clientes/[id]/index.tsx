import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import {
  ResumoCadastro,
  InformacoesCadastro,
} from "@/components/ui/DetalhesCadastro";

import { useCallback, useEffect, useState, useRef } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import FeedbackAlert, {
  type FeedbackAlertVariant,
} from "@/components/forms/FeedbackAlert";
import LogoPicker from "@/components/forms/LogoPicker";
import ClippingsVinculados from "@/components/clipping/ClippingsVinculados";
import RelatoriosVinculados from "@/components/relatorios/RelatoriosVinculados";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  ArquivoLogoCliente,
  atualizarClienteComLogo,
  buscarCliente,
  Cliente,
  excluirCliente,
  obterUrlLogoCliente,
} from "@/services/api/cliente";

import { ErrosCliente, validarFormularioCliente } from "@/utils/validarCliente";

interface FormularioCliente {
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  site: string;
  cidade: string;
  estado: string;
  descricao: string;
  segmento: string;
  responsavel: string;
  logo_path: string;
  ativo: boolean;
}

interface FeedbackState {
  variant: FeedbackAlertVariant;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDanger?: boolean;
  onPrimary?: () => void;
  onClose?: () => void;
}

function dadosFormulario(dados: Cliente): FormularioCliente {
  return {
    nome: dados.nome ?? "",
    email: dados.email ?? "",
    telefone: dados.telefone ?? "",
    cnpj: dados.cnpj ?? "",
    site: dados.site ?? "",
    cidade: dados.cidade ?? "",
    estado: dados.estado ?? "",
    descricao: dados.descricao ?? "",
    segmento: dados.segmento ?? "",
    responsavel: dados.responsavel ?? "",
    logo_path: dados.logo_path ?? "",
    ativo: dados.ativo === 1,
  };
}

export default function ClienteDetalhes() {
  const { usuario } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ClienteDetalhesConta
      key={[usuario?.assessoria_id, usuario?.id, id].join(":")}
    />
  );
}

function ClienteDetalhesConta() {
  const router = useRouter();
  const retornar = useRetornoSeguro("/clientes");
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const { id: idParam, vinculo } = useLocalSearchParams<{
    id: string;
    vinculo?: string;
  }>();

  const id = Number(idParam);
  const podeVerClippings = temPermissao("CLIPPING", "VISUALIZAR");
  const podeVerRelatorios = temPermissao("RELATORIOS", "VISUALIZAR");

  const [abaVinculos, setAbaVinculos] = useState<"clippings" | "relatorios">(
    vinculo === "relatorios" ? "relatorios" : "clippings"
  );
  const [excluindoVinculos, setExcluindoVinculos] = useState(false);

  const abaVinculosAtiva =
    podeVerClippings && (!podeVerRelatorios || abaVinculos === "clippings")
      ? "clippings"
      : "relatorios";

  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [formulario, setFormulario] = useState<FormularioCliente>({
    nome: "",
    email: "",
    telefone: "",
    cnpj: "",
    site: "",
    cidade: "",
    estado: "",
    descricao: "",
    segmento: "",
    responsavel: "",
    logo_path: "",
    ativo: true,
  });

  const [formularioOriginal, setFormularioOriginal] =
    useState<FormularioCliente | null>(null);

  const [novoLogo, setNovoLogo] = useState<ArquivoLogoCliente | null>(null);

  const [logoRemovido, setLogoRemovido] = useState(false);

  const [erros, setErros] = useState<ErrosCliente>({});

  const [erroLogo, setErroLogo] = useState("");
  const [erroGeral, setErroGeral] = useState("");

  const [modoEdicao, setModoEdicao] = useState(false);

  const [carregando, setCarregando] = useState(true);

  const [erroCarregamento, setErroCarregamento] = useState("");

  const [salvando, setSalvando] = useState(false);

  const [excluindo, setExcluindo] = useState(false);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const salvamentoEmCurso = useRef(false);
  const exclusaoEmCurso = useRef(false);
  const consultaEmCurso = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [modoEdicao]);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setAbaVinculos(vinculo === "relatorios" ? "relatorios" : "clippings"),
      0
    );
    return () => clearTimeout(timer);
  }, [id, vinculo]);

  const carregarCliente = useCallback(async () => {
    consultaEmCurso.current?.abort();
    const controller = new AbortController();
    consultaEmCurso.current = controller;
    const prazo = setTimeout(() => controller.abort(), 15000);
    if (!Number.isSafeInteger(id) || id <= 0) {
      clearTimeout(prazo);
      consultaEmCurso.current = null;
      setErroCarregamento("Cliente inválido.");
      setCarregando(false);

      return;
    }

    try {
      setCarregando(true);
      setErroCarregamento("");

      const dados = await buscarCliente(id, controller.signal);
      if (consultaEmCurso.current !== controller) return;
      const novoFormulario = dadosFormulario(dados);

      setCliente(dados);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);

      setNovoLogo(null);
      setLogoRemovido(false);
    } catch (error) {
      if (consultaEmCurso.current !== controller) return;
      setErroCarregamento(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o cliente."
      );
    } finally {
      clearTimeout(prazo);
      if (consultaEmCurso.current === controller) {
        consultaEmCurso.current = null;
        setCarregando(false);
      }
    }
  }, [id]);
  useEffect(() => {
    const timer = setTimeout(() => void carregarCliente(), 0);
    return () => {
      clearTimeout(timer);
      consultaEmCurso.current?.abort();
      consultaEmCurso.current = null;
    };
  }, [carregarCliente]);

  function mostrarFeedback(dados: FeedbackState) {
    setFeedback(dados);
  }

  function fecharFeedback() {
    if (salvando || excluindo) return;
    const aoFechar = feedback?.onClose;

    setFeedback(null);
    aoFechar?.();
  }

  function atualizarCampo(
    campo: Exclude<keyof FormularioCliente, "logo_path">,
    valor: string | boolean
  ) {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    if (campo !== "ativo") {
      limparErro(campo as keyof ErrosCliente);
    }
  }

  function limparErro(campo: keyof ErrosCliente) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }

  function campoAlterado(campo: keyof FormularioCliente): boolean {
    if (campo === "logo_path") {
      return novoLogo !== null || logoRemovido;
    }

    return formularioOriginal
      ? formulario[campo] !== formularioOriginal[campo]
      : false;
  }

  function camposAlterados(): (keyof FormularioCliente)[] {
    if (!formularioOriginal) {
      return [];
    }

    const campos = (
      Object.keys(formulario) as (keyof FormularioCliente)[]
    ).filter((campo) => {
      if (campo === "logo_path") {
        return false;
      }

      return formulario[campo] !== formularioOriginal[campo];
    });

    if ((novoLogo !== null || logoRemovido) && !campos.includes("logo_path")) {
      campos.push("logo_path");
    }

    return campos;
  }

  function cancelarEdicao() {
    if (!cliente) {
      return;
    }

    const original = dadosFormulario(cliente);

    setFormulario(original);
    setFormularioOriginal(original);

    setNovoLogo(null);
    setLogoRemovido(false);

    setErros({});
    setErroLogo("");
    setErroGeral("");

    setModoEdicao(false);
  }

  const saida = useSaidaFormulario(
    camposAlterados().length > 0,
    salvando || excluindo || excluindoVinculos
  );

  function handleBack() {
    if (salvando || excluindo || excluindoVinculos) return;
    if (!modoEdicao) {
      retornar();
      return;
    }

    if (camposAlterados().length > 0) {
      saida.confirmarSaida(cancelarEdicao);
      return;
    }

    cancelarEdicao();
  }

  function mostrarErroApi(mensagem: string) {
    const texto = mensagem.toLocaleLowerCase();

    if (
      texto.includes("logo") ||
      texto.includes("imagem") ||
      texto.includes("arquivo")
    ) {
      setErroLogo(mensagem);
      return;
    }

    const campo: keyof ErrosCliente | null = texto.includes("cnpj")
      ? "cnpj"
      : texto.includes("e-mail")
        ? "email"
        : texto.includes("telefone")
          ? "telefone"
          : texto.includes("site")
            ? "site"
            : texto.includes("cidade")
              ? "cidade"
              : texto.includes("estado")
                ? "estado"
                : texto.includes("segmento")
                  ? "segmento"
                  : texto.includes("responsável")
                    ? "responsavel"
                    : texto.includes("descrição")
                      ? "descricao"
                      : texto.includes("nome")
                        ? "nome"
                        : null;

    if (campo) {
      setErros({
        [campo]: mensagem,
      });

      return;
    }

    setErroGeral(mensagem);
  }

  async function salvarAlteracoes() {
    if (
      !cliente ||
      salvamentoEmCurso.current ||
      excluindo ||
      !temPermissao("CLIENTES", "EDITAR")
    ) {
      return;
    }

    const errosValidacao = validarFormularioCliente({
      nome: formulario.nome,
      email: formulario.email,
      telefone: formulario.telefone,
      cnpj: formulario.cnpj,
      site: formulario.site,
      cidade: formulario.cidade,
      estado: formulario.estado,
      descricao: formulario.descricao,
      segmento: formulario.segmento,
      responsavel: formulario.responsavel,
    });

    setErros(errosValidacao);
    setErroLogo("");
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    try {
      salvamentoEmCurso.current = true;
      setSalvando(true);

      const atualizado = await atualizarClienteComLogo(
        cliente.id,
        {
          nome: formulario.nome.trim(),
          email: formulario.email.trim() || undefined,
          telefone: formulario.telefone.trim() || undefined,
          cnpj: formulario.cnpj.trim() || undefined,
          site: formulario.site.trim() || undefined,
          cidade: formulario.cidade.trim() || undefined,
          estado: formulario.estado.trim() || undefined,
          descricao: formulario.descricao.trim() || undefined,
          segmento: formulario.segmento.trim() || undefined,
          responsavel: formulario.responsavel.trim() || undefined,
          ativo: formulario.ativo,
        },
        novoLogo ?? undefined,
        logoRemovido
      );

      const novoFormulario = dadosFormulario(atualizado);

      setCliente(atualizado);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);

      setNovoLogo(null);
      setLogoRemovido(false);

      setModoEdicao(false);

      mostrarFeedback({
        variant: "success",
        title: "Cliente atualizado",
        message: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      mostrarErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o cliente."
      );
    } finally {
      salvamentoEmCurso.current = false;
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (
      !cliente ||
      salvando ||
      exclusaoEmCurso.current ||
      !temPermissao("CLIENTES", "EXCLUIR")
    ) {
      return;
    }

    mostrarFeedback({
      variant: "warning",
      title: "Excluir cliente?",
      message:
        `Deseja realmente excluir ${cliente.nome}? ` +
        "Essa ação não pode ser desfeita.",
      primaryLabel: "EXCLUIR",
      secondaryLabel: "CANCELAR",
      primaryDanger: true,
      onPrimary: () => {
        void excluirClienteAtual();
      },
    });
  }

  async function excluirClienteAtual() {
    if (
      !cliente ||
      salvando ||
      exclusaoEmCurso.current ||
      !temPermissao("CLIENTES", "EXCLUIR")
    ) {
      return;
    }

    exclusaoEmCurso.current = true;
    fecharFeedback();
    setExcluindo(true);

    try {
      await excluirCliente(cliente.id);

      mostrarFeedback({
        variant: "success",
        title: "Cliente excluído",
        message: "O cliente foi excluído com sucesso.",
        onPrimary: () =>
          saida.concluirSaida(() => router.dismissTo("/clientes")),
        onClose: () => saida.concluirSaida(() => router.dismissTo("/clientes")),
      });
    } catch (error) {
      mostrarFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o cliente.",
      });
    } finally {
      exclusaoEmCurso.current = false;
      setExcluindo(false);
    }
  }

  async function abrirWhatsApp() {
    const telefone = cliente?.telefone?.trim();

    if (!telefone) {
      return;
    }

    const numeroLimpo = telefone.replace(/\D/g, "");

    if (numeroLimpo.length < 10 || numeroLimpo.length > 13) {
      mostrarFeedback({
        variant: "warning",
        title: "Telefone inválido",
        message: "Não foi possível abrir o WhatsApp para este cliente.",
      });

      return;
    }

    const numeroWhatsApp =
      numeroLimpo.startsWith("55") &&
      (numeroLimpo.length === 12 || numeroLimpo.length === 13)
        ? numeroLimpo
        : `55${numeroLimpo}`;

    try {
      await Linking.openURL(`https://wa.me/${numeroWhatsApp}`);
    } catch {
      mostrarFeedback({
        variant: "error",
        title: "WhatsApp indisponível",
        message: "Não foi possível abrir o WhatsApp.",
      });
    }
  }

  async function abrirEmail() {
    const email = cliente?.email?.trim();

    if (!email) {
      return;
    }

    try {
      await Linking.openURL(`mailto:${encodeURIComponent(email)}`);
    } catch {
      mostrarFeedback({
        variant: "error",
        title: "E-mail indisponível",
        message: "Não foi possível abrir o aplicativo de e-mail.",
      });
    }
  }

  async function abrirSite() {
    const site = cliente?.site?.trim();

    if (!site) {
      return;
    }

    try {
      await Linking.openURL(site);
    } catch {
      mostrarFeedback({
        variant: "error",
        title: "Site indisponível",
        message: "Não foi possível abrir o site do cliente.",
      });
    }
  }

  if (carregando) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <Header title="Cliente" showBackButton />

        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primaria} />
        </View>
        <FeedbackAlert {...saida.alertaProps} />
      </View>
    );
  }

  if (!cliente) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <Header title="Cliente" showBackButton backFallback="/clientes" />

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={34} color="#EF4444" />

          <Text weight="SemiBold" style={styles.errorTitle}>
            Não foi possível carregar
          </Text>

          <Text style={[styles.errorDescription, { color: theme.textoSub }]}>
            {erroCarregamento || "O cliente não está disponível."}
          </Text>

          <View style={styles.errorActions}>
            <Button
              title="VOLTAR"
              variant="outline"
              onPress={() => {
                retornar();
              }}
              style={styles.actionButton}
            />

            <Button
              title="TENTAR NOVAMENTE"
              onPress={() => void carregarCliente()}
              style={styles.actionButton}
            />
          </View>
        </View>
        <FeedbackAlert {...saida.alertaProps} />
      </View>
    );
  }

  const logoPerfil = obterUrlLogoCliente(cliente.logo_path);

  const localizacao = [cliente.cidade, cliente.estado]
    .filter(Boolean)
    .join(" - ");

  return (
    <EdicaoCompacta ativa={modoEdicao}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <Header
          title={modoEdicao ? "Editar cliente" : "Cliente"}
          showBackButton
          onBackPress={handleBack}
        />

        <ScrollView
          style={{ flex: 1 }}
          automaticallyAdjustKeyboardInsets={false}
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {!modoEdicao ? (
            <View style={styles.acoesDetalhes}>
              {temPermissao("CLIENTES", "EDITAR") ? (
                <Button
                  title="EDITAR"
                  icon="create-outline"
                  variant="outline"
                  onPress={() => setModoEdicao(true)}
                  disabled={excluindo || excluindoVinculos}
                  style={styles.botaoDetalhes}
                />
              ) : null}
              {temPermissao("CLIENTES", "EXCLUIR") ? (
                <Button
                  title="EXCLUIR"
                  variant="danger"
                  onPress={confirmarExclusao}
                  loading={excluindo}
                  disabled={excluindoVinculos}
                  style={styles.botaoDetalhes}
                />
              ) : null}
            </View>
          ) : null}
          <View style={styles.resumoCadastro}>
            <ResumoCadastro
              nome={cliente.nome}
              categoria="CLIENTE"
              ativo={cliente.ativo === 1}
              avatar={
                logoPerfil ? (
                  <Image
                    source={{ uri: logoPerfil }}
                    style={styles.logoProfileImage}
                    resizeMode="contain"
                    accessibilityLabel={"Logo de " + cliente.nome}
                  />
                ) : (
                  <Ionicons
                    name="briefcase-outline"
                    size={24}
                    color={theme.textoContainer}
                  />
                )
              }
            />
          </View>

          {modoEdicao ? (
            <View style={styles.formularioEdicao}>
              <SecaoEdicao titulo="Dados principais">
                <Input
                  label="Nome"
                  value={formulario.nome}
                  onChangeText={(texto) => atualizarCampo("nome", texto)}
                  placeholder="Nome do cliente"
                  autoCapitalize="words"
                  error={erros.nome}
                  showChanged={campoAlterado("nome")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Segmento"
                  value={formulario.segmento}
                  onChangeText={(texto) => atualizarCampo("segmento", texto)}
                  placeholder="Ex.: Tecnologia, Saúde, Varejo"
                  autoCapitalize="words"
                  error={erros.segmento}
                  showChanged={campoAlterado("segmento")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Responsável"
                  value={formulario.responsavel}
                  onChangeText={(texto) => atualizarCampo("responsavel", texto)}
                  placeholder="Nome do responsável"
                  autoCapitalize="words"
                  error={erros.responsavel}
                  showChanged={campoAlterado("responsavel")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="CNPJ"
                  value={formulario.cnpj}
                  onChangeText={(texto) => atualizarCampo("cnpj", texto)}
                  placeholder="Ex.: 12.345.678/0001-95"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={erros.cnpj}
                  showChanged={campoAlterado("cnpj")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Descrição"
                  value={formulario.descricao}
                  onChangeText={(texto) => atualizarCampo("descricao", texto)}
                  placeholder="Informações sobre o cliente"
                  multiline
                  textAlignVertical="top"
                  style={styles.textArea}
                  error={erros.descricao}
                  showChanged={campoAlterado("descricao")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
              </SecaoEdicao>
              <SecaoEdicao titulo="Contato">
                <Input
                  label="E-mail"
                  value={formulario.email}
                  onChangeText={(texto) => atualizarCampo("email", texto)}
                  placeholder="contato@cliente.com.br"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={erros.email}
                  showChanged={campoAlterado("email")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Telefone"
                  value={formulario.telefone}
                  onChangeText={(texto) => atualizarCampo("telefone", texto)}
                  placeholder="Ex.: (11) 99999-9999"
                  keyboardType="phone-pad"
                  error={erros.telefone}
                  showChanged={campoAlterado("telefone")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Site"
                  value={formulario.site}
                  onChangeText={(texto) => atualizarCampo("site", texto)}
                  placeholder="https://www.exemplo.com.br"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={erros.site}
                  showChanged={campoAlterado("site")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
              </SecaoEdicao>
              <SecaoEdicao titulo="Localização">
                <Input
                  label="Cidade"
                  value={formulario.cidade}
                  onChangeText={(texto) => atualizarCampo("cidade", texto)}
                  placeholder="Ex.: São Paulo"
                  autoCapitalize="words"
                  error={erros.cidade}
                  showChanged={campoAlterado("cidade")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Estado"
                  value={formulario.estado}
                  onChangeText={(texto) => atualizarCampo("estado", texto)}
                  placeholder="Ex.: São Paulo"
                  autoCapitalize="words"
                  error={erros.estado}
                  showChanged={campoAlterado("estado")}
                  clearable
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
              </SecaoEdicao>
              <SecaoEdicao titulo="Identidade visual">
                <LogoPicker
                  logoAtualUri={
                    logoRemovido
                      ? null
                      : obterUrlLogoCliente(formulario.logo_path)
                  }
                  logoSelecionado={novoLogo}
                  onSelect={(arquivo) => {
                    setNovoLogo(arquivo);
                    setLogoRemovido(false);
                    setErroLogo("");
                  }}
                  onRemove={() => {
                    setNovoLogo(null);

                    setLogoRemovido(Boolean(formulario.logo_path));

                    setErroLogo("");
                  }}
                  disabled={salvando}
                  error={erroLogo}
                  showChanged={campoAlterado("logo_path")}
                />
              </SecaoEdicao>
              <SecaoEdicao titulo="Disponibilidade">
                <View
                  style={[
                    styles.statusRow,
                    {
                      borderColor: theme.borda,
                    },
                  ]}
                >
                  <View style={styles.statusInfo}>
                    <View style={styles.statusTitleRow}>
                      <Text weight="SemiBold" style={styles.statusTitle}>
                        STATUS
                      </Text>

                      {campoAlterado("ativo") ? (
                        <Ionicons
                          name="create-outline"
                          size={15}
                          color={theme.primaria}
                        />
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.statusDescription,
                        {
                          color: theme.textoSub,
                        },
                      ]}
                    >
                      Cliente ativo e disponível no sistema.
                    </Text>
                  </View>

                  <Switch
                    value={formulario.ativo}
                    onValueChange={(valor) => atualizarCampo("ativo", valor)}
                    trackColor={{
                      false: theme.surface,
                      true: theme.primaria,
                    }}
                    thumbColor={theme.branco}
                    disabled={salvando}
                  />
                </View>
              </SecaoEdicao>
              {erroGeral ? (
                <Text weight="Medium" style={styles.errorGeral}>
                  {erroGeral}
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <InformacoesCadastro
                grupos={[
                  {
                    id: "contato",
                    titulo: "Contato",
                    campos: [
                      {
                        id: "responsavel",
                        icone: "person-outline",
                        rotulo: "Responsável",
                        valor: cliente.responsavel || "Não informado",
                      },
                      {
                        id: "email",
                        icone: "mail-outline",
                        rotulo: "E-mail",
                        valor: cliente.email || "Não informado",
                        acao: cliente.email
                          ? {
                              icone: "mail-outline",
                              rotulo: "Enviar e-mail para o cliente",
                              onPress: abrirEmail,
                            }
                          : undefined,
                      },
                      {
                        id: "telefone",
                        icone: "call-outline",
                        rotulo: "Telefone",
                        valor: cliente.telefone || "Não informado",
                        acao: cliente.telefone
                          ? {
                              icone: "logo-whatsapp",
                              rotulo: "Abrir conversa no WhatsApp",
                              onPress: abrirWhatsApp,
                            }
                          : undefined,
                      },
                      {
                        id: "site",
                        icone: "globe-outline",
                        rotulo: "Site",
                        valor: cliente.site || "Não informado",
                        acao: cliente.site
                          ? {
                              icone: "open-outline",
                              rotulo: "Abrir site do cliente",
                              onPress: abrirSite,
                            }
                          : undefined,
                      },
                    ],
                  },
                  {
                    id: "cadastro",
                    titulo: "Dados do cliente",
                    campos: [
                      {
                        id: "segmento",
                        icone: "briefcase-outline",
                        rotulo: "Segmento",
                        valor: cliente.segmento || "Não informado",
                      },
                      {
                        id: "cnpj",
                        icone: "card-outline",
                        rotulo: "CNPJ",
                        valor: cliente.cnpj || "Não informado",
                      },
                      {
                        id: "localizacao",
                        icone: "location-outline",
                        rotulo: "Localização",
                        valor: localizacao || "Não informada",
                      },
                      {
                        id: "logo",
                        icone: "image-outline",
                        rotulo: "Logo",
                        valor: cliente.logo_path
                          ? "Logo cadastrado"
                          : "Não informado",
                      },
                    ],
                  },
                  ...(cliente.descricao
                    ? [
                        {
                          id: "descricao",
                          titulo: "Sobre o cliente",
                          campos: [
                            {
                              id: "descricao",
                              icone: "document-text-outline" as const,
                              rotulo: "Descrição",
                              valor: cliente.descricao,
                            },
                          ],
                        },
                      ]
                    : []),
                ]}
              />
              {podeVerClippings || podeVerRelatorios ? (
                <View
                  style={[
                    styles.vinculos,
                    { borderTopColor: theme.borda + "25" },
                  ]}
                >
                  <Text weight="SemiBold" style={styles.tituloVinculos}>
                    Vínculos do cliente
                  </Text>

                  {podeVerClippings && podeVerRelatorios ? (
                    <View style={styles.actions}>
                      <Button
                        title="CLIPPINGS"
                        size="small"
                        variant={
                          abaVinculosAtiva === "clippings"
                            ? "primary"
                            : "outline"
                        }
                        disabled={excluindo || excluindoVinculos}
                        onPress={() => setAbaVinculos("clippings")}
                        style={styles.actionButton}
                      />
                      <Button
                        title="RELATÓRIOS"
                        size="small"
                        variant={
                          abaVinculosAtiva === "relatorios"
                            ? "primary"
                            : "outline"
                        }
                        disabled={excluindo || excluindoVinculos}
                        onPress={() => setAbaVinculos("relatorios")}
                        style={styles.actionButton}
                      />
                    </View>
                  ) : null}

                  {abaVinculosAtiva === "clippings" ? (
                    <ClippingsVinculados
                      key={`cliente-${cliente.id}`}
                      tipo="cliente"
                      id={cliente.id}
                      nome={cliente.nome}
                      onExcluindoChange={setExcluindoVinculos}
                    />
                  ) : (
                    <RelatoriosVinculados
                      key={cliente.id}
                      clienteId={cliente.id}
                    />
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
        {modoEdicao ? (
          <SalvarAlteracoes
            error={erroGeral || Object.values(erros).find(Boolean)}
            alterations={camposAlterados().length}
            saving={salvando}
            onSave={salvarAlteracoes}
            onDiscard={handleBack}
          />
        ) : null}

        <FeedbackAlert
          visible={feedback !== null}
          variant={feedback?.variant ?? "info"}
          title={feedback?.title ?? ""}
          message={feedback?.message ?? ""}
          primaryLabel={feedback?.primaryLabel}
          secondaryLabel={feedback?.secondaryLabel}
          primaryDanger={feedback?.primaryDanger}
          loading={salvando || excluindo}
          onClose={fecharFeedback}
          onPrimary={() => {
            if (feedback?.onPrimary) {
              feedback.onPrimary();
              return;
            }

            fecharFeedback();
          }}
          onSecondary={fecharFeedback}
        />
        <FeedbackAlert {...saida.alertaProps} />
      </KeyboardAvoidingView>
    </EdicaoCompacta>
  );
}

const styles = StyleSheet.create({
  resumoCadastro: {
    marginBottom: 12,
  },
  acoesDetalhes: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  botaoDetalhes: {
    flex: 1,
    width: "auto",
    minWidth: 0,
  },

  container: {
    flex: 1,
  },

  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 28,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  errorTitle: {
    fontSize: 17,
    marginTop: 12,
  },

  errorDescription: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },

  errorActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  logoProfileImage: {
    width: "100%",
    height: "100%",
  },

  vinculos: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  tituloVinculos: {
    fontSize: 13,
    lineHeight: 19,
  },

  textArea: {
    height: 100,
    paddingTop: 14,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  statusInfo: {
    flex: 1,
    minWidth: 0,
  },

  statusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  statusTitle: {
    fontSize: 12,
  },

  statusDescription: {
    fontSize: 11,
    marginTop: 3,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  actionButton: {
    flex: 1,
  },

  errorGeral: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  formularioEdicao: {
    gap: 14,
  },
});
