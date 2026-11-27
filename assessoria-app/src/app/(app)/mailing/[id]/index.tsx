import { useFeedbackAlert } from "@/hooks/useFeedbackAlert";
import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Linking,
} from "react-native";

import { useCallback, useEffect, useState, useRef } from "react";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import ReleasesVinculados from "@/components/releases/ReleasesVinculados";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import SecaoEdicao from "@/components/forms/SecaoEdicao";
import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";
import {
  ResumoCadastro,
  InformacoesCadastro,
} from "@/components/ui/DetalhesCadastro";

import {
  ErrosJornalista,
  validarFormularioJornalista,
} from "@/utils/validarMailing";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  Jornalista,
  atualizarJornalista,
  buscarJornalista,
  excluirJornalista,
} from "@/services/api/jornalista";

interface Formulario {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  estado: string;
  cidade: string;
  observacoes: string;
  ativo: boolean;
  veiculo_id: number | null;
  veiculo_nome: string;
}

export default function JornalistaDetalhes() {
  const { usuario } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <JornalistaDetalhesConta
      key={[usuario?.assessoria_id, usuario?.id, id].join(":")}
    />
  );
}

function JornalistaDetalhesConta() {
  const router = useRouter();
  const navigation = useNavigation();
  const retornar = useRetornoSeguro("/mailing");
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [erros, setErros] = useState<ErrosJornalista>({});

  const [erroGeral, setErroGeral] = useState("");

  const params = useLocalSearchParams<{
    id: string;
    origem?: string;
    veiculo_id?: string;
    origemNavegacao?: string;
  }>();

  const id = Number(params.id);

  const veiculoOrigemId = Number(params.veiculo_id);

  const veioDaTelaVeiculo =
    params.origem === "veiculo" &&
    Number.isInteger(veiculoOrigemId) &&
    veiculoOrigemId > 0;

  const [jornalista, setJornalista] = useState<Jornalista | null>(null);

  const [formulario, setFormulario] = useState<Formulario>({
    nome: "",
    email: "",
    telefone: "",
    cargo: "",
    estado: "",
    cidade: "",
    observacoes: "",
    ativo: true,
    veiculo_id: null,
    veiculo_nome: "",
  });

  const [formularioOriginal, setFormularioOriginal] =
    useState<Formulario | null>(null);

  const [modoEdicao, setModoEdicao] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const salvamentoEmCurso = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const { mostrar: setFeedback, alertaProps: feedbackProps } = useFeedbackAlert(
    salvando || excluindo
  );
  const [erroCarregamento, setErroCarregamento] = useState("");
  const exclusaoEmCurso = useRef(false);
  const consultaEmCurso = useRef<AbortController | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [modoEdicao]);

  const voltarParaOrigem = useCallback(() => {
    if (!navigation.isFocused()) return;
    if (veioDaTelaVeiculo) {
      router.navigate({
        pathname: "/veiculos/[id]",
        params: {
          id: veiculoOrigemId.toString(),
        },
      });

      return;
    }

    retornar();
  }, [navigation, router, veioDaTelaVeiculo, veiculoOrigemId, retornar]);
  const carregarJornalista = useCallback(async () => {
    consultaEmCurso.current?.abort();
    const controller = new AbortController();
    consultaEmCurso.current = controller;
    const prazo = setTimeout(() => controller.abort(), 15000);
    setCarregando(true);
    setErroCarregamento("");
    try {
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error("Contato inválido.");
      const dados = await buscarJornalista(id, controller.signal);
      if (consultaEmCurso.current !== controller) return;
      const original: Formulario = {
        nome: dados.nome ?? "",
        email: dados.email ?? "",
        telefone: dados.telefone ?? "",
        cargo: dados.cargo ?? "",
        estado: dados.estado ?? "",
        cidade: dados.cidade ?? "",
        observacoes: dados.observacoes ?? "",
        ativo: dados.ativo === 1,
        veiculo_id: dados.veiculo_id,
        veiculo_nome: dados.veiculo_nome ?? "",
      };
      setJornalista(dados);
      setFormulario(original);
      setFormularioOriginal(original);
    } catch (error) {
      if (consultaEmCurso.current !== controller) return;
      const mensagem = controller.signal.aborted
        ? "A consulta demorou mais que o esperado. Tente novamente."
        : error instanceof Error
          ? error.message
          : "Não foi possível carregar o contato.";
      setErroCarregamento(mensagem);
      setFeedback({
        variant: "error",
        title: "Não foi possível abrir o contato",
        message: mensagem,
      });
    } finally {
      clearTimeout(prazo);
      if (consultaEmCurso.current === controller) {
        consultaEmCurso.current = null;
        setCarregando(false);
      }
    }
  }, [id, setFeedback]);
  useEffect(() => {
    const timer = setTimeout(() => void carregarJornalista(), 0);
    return () => {
      clearTimeout(timer);
      const consulta = consultaEmCurso.current;
      consultaEmCurso.current = null;
      consulta?.abort();
    };
  }, [carregarJornalista]);

  function atualizarCampo(campo: keyof Formulario, valor: string | boolean) {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    if (campo === "email" || campo === "telefone") {
      limparErrosDeContato();
    } else if (
      campo === "nome" ||
      campo === "cargo" ||
      campo === "estado" ||
      campo === "cidade" ||
      campo === "observacoes"
    ) {
      limparErro(campo);
    }
  }

  function limparErro(campo: keyof ErrosJornalista) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }
  function limparErrosDeContato() {
    setErros((atual) => ({
      ...atual,
      email: undefined,
      telefone: undefined,
    }));

    setErroGeral("");
  }

  function exibirErroDaApi(mensagemOriginal: string) {
    const mensagem = mensagemOriginal;

    const texto = mensagem.toLocaleLowerCase();

    let campo: keyof ErrosJornalista | null = null;

    if (
      texto.includes("e-mail ou telefone") ||
      texto.includes("email ou telefone")
    ) {
      setErros({
        email: mensagem,
        telefone: mensagem,
      });

      return;
    }

    if (texto.includes("veículo")) {
      campo = "veiculo";
    } else if (texto.includes("e-mail") || texto.includes("email")) {
      campo = "email";
    } else if (texto.includes("telefone")) {
      campo = "telefone";
    } else if (texto.includes("cargo")) {
      campo = "cargo";
    } else if (texto.includes("estado")) {
      campo = "estado";
    } else if (texto.includes("cidade")) {
      campo = "cidade";
    } else if (texto.includes("observações")) {
      campo = "observacoes";
    } else if (texto.includes("nome")) {
      campo = "nome";
    }

    if (campo) {
      setErros({ [campo]: mensagem });
      return;
    }

    setErroGeral(mensagem);
  }

  function cancelarEdicao() {
    if (!jornalista) return;

    const dadosFormulario: Formulario = {
      nome: jornalista.nome ?? "",
      email: jornalista.email ?? "",
      telefone: jornalista.telefone ?? "",
      cargo: jornalista.cargo ?? "",
      estado: jornalista.estado ?? "",
      cidade: jornalista.cidade ?? "",
      observacoes: jornalista.observacoes ?? "",
      ativo: jornalista.ativo === 1,
      veiculo_id: jornalista.veiculo_id,
      veiculo_nome: jornalista.veiculo_nome ?? "",
    };

    setFormulario(dadosFormulario);
    setFormularioOriginal(dadosFormulario);
    setErros({});
    setErroGeral("");

    setModoEdicao(false);
  }

  function atualizarVeiculo(selecao: SelecaoVeiculo) {
    setFormulario((atual) => ({
      ...atual,
      veiculo_id: selecao.id,
      veiculo_nome: selecao.nome,
    }));

    limparErro("veiculo");
  }

  function camposAlterados(): (keyof Formulario)[] {
    if (!formularioOriginal) return [];

    return (Object.keys(formulario) as (keyof Formulario)[]).filter(
      (campo) => formulario[campo] !== formularioOriginal[campo]
    );
  }

  function veiculoAlterado(): boolean {
    return campoAlterado("veiculo_id") || campoAlterado("veiculo_nome");
  }

  function quantidadeAlteracoes(): number {
    const alteracoesSemVeiculo = camposAlterados().filter(
      (campo) => campo !== "veiculo_id" && campo !== "veiculo_nome"
    ).length;

    return alteracoesSemVeiculo + (veiculoAlterado() ? 1 : 0);
  }

  const saida = useSaidaFormulario(
    camposAlterados().length > 0,
    salvando || excluindo
  );

  function handleBack() {
    if (salvando || excluindo) return;
    if (!modoEdicao) {
      voltarParaOrigem();
      return;
    }

    if (camposAlterados().length > 0) {
      saida.confirmarSaida(cancelarEdicao);
      return;
    }
    cancelarEdicao();
  }

  async function salvarAlteracoes() {
    if (
      !jornalista ||
      salvamentoEmCurso.current ||
      excluindo ||
      !temPermissao("MAILING", "EDITAR")
    )
      return;

    const errosValidacao = validarFormularioJornalista({
      nome: formulario.nome,
      email: formulario.email,
      telefone: formulario.telefone,
      cargo: formulario.cargo,
      estado: formulario.estado,
      cidade: formulario.cidade,
      observacoes: formulario.observacoes,
      veiculoId: formulario.veiculo_id,
      veiculoNome: formulario.veiculo_nome,
    });

    if (
      !temPermissao("VEICULOS", "CRIAR") &&
      formulario.veiculo_id === null &&
      formulario.veiculo_nome.trim()
    ) {
      errosValidacao.veiculo =
        "Selecione um veículo existente. Você não possui permissão para criar outro.";
    }

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    try {
      salvamentoEmCurso.current = true;
      setSalvando(true);

      const { jornalista: atualizado } = await atualizarJornalista(
        jornalista.id,
        {
          nome: formulario.nome.trim(),
          email: formulario.email.trim() || null,
          telefone: formulario.telefone.trim() || null,
          cargo: formulario.cargo.trim() || null,
          estado: formulario.estado.trim() || null,
          cidade: formulario.cidade.trim() || null,
          observacoes: formulario.observacoes.trim() || null,
          ativo: formulario.ativo ? 1 : 0,
          veiculo_id: formulario.veiculo_id,
          veiculo_nome:
            formulario.veiculo_id === null
              ? formulario.veiculo_nome.trim() || null
              : null,
        }
      );

      const novoFormularioOriginal: Formulario = {
        nome: atualizado.nome ?? "",
        email: atualizado.email ?? "",
        telefone: atualizado.telefone ?? "",
        cargo: atualizado.cargo ?? "",
        estado: atualizado.estado ?? "",
        cidade: atualizado.cidade ?? "",
        observacoes: atualizado.observacoes ?? "",
        ativo: atualizado.ativo === 1,
        veiculo_id: atualizado.veiculo_id,
        veiculo_nome: atualizado.veiculo_nome ?? "",
      };

      setFormulario(novoFormularioOriginal);
      setFormularioOriginal(novoFormularioOriginal);

      setJornalista(atualizado);

      setModoEdicao(false);

      setFeedback({
        variant: "success",
        title: "Contato atualizado",
        message: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o contato.";

      exibirErroDaApi(mensagem);
      setFeedback({
        variant: "error",
        title: "Não foi possível salvar",
        message: mensagem,
      });
    } finally {
      salvamentoEmCurso.current = false;
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (
      !jornalista ||
      exclusaoEmCurso.current ||
      salvando ||
      !temPermissao("MAILING", "EXCLUIR")
    )
      return;
    setFeedback({
      variant: "warning",
      title: "Excluir contato?",
      message:
        "Deseja realmente excluir " +
        jornalista.nome +
        "? Essa ação não pode ser desfeita.",
      primaryLabel: "EXCLUIR",
      secondaryLabel: "CANCELAR",
      primaryDanger: true,
      onPrimary: () => void excluir(),
    });
  }

  async function excluir() {
    if (
      !jornalista ||
      exclusaoEmCurso.current ||
      salvando ||
      !temPermissao("MAILING", "EXCLUIR")
    )
      return;
    exclusaoEmCurso.current = true;
    setExcluindo(true);
    try {
      await excluirJornalista(jornalista.id);
      setFeedback({
        variant: "success",
        title: "Contato excluído",
        message: "Contato excluído com sucesso.",
        onClose: () => saida.concluirSaida(voltarParaOrigem),
      });
    } catch (error) {
      setFeedback({
        variant: "error",
        title: "Não foi possível excluir",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o contato.",
      });
    } finally {
      exclusaoEmCurso.current = false;
      setExcluindo(false);
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
        <Header title="Contato" showBackButton onBackPress={voltarParaOrigem} />

        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primaria} />
        </View>
        <FeedbackAlert {...saida.alertaProps} />
      </View>
    );
  }

  if (!jornalista)
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Contato" showBackButton onBackPress={voltarParaOrigem} />
        <View style={[styles.loading, { padding: 24, gap: 14 }]}>
          <Text style={{ color: theme.textoSub, textAlign: "center" }}>
            {erroCarregamento || "Registro não encontrado."}
          </Text>
          {Number.isSafeInteger(id) && id > 0 ? (
            <Button
              title="TENTAR NOVAMENTE"
              variant="outline"
              onPress={() => void carregarJornalista()}
            />
          ) : null}
          <Button title="VOLTAR" onPress={voltarParaOrigem} />
        </View>
        <FeedbackAlert {...feedbackProps} />
        <FeedbackAlert {...saida.alertaProps} />
      </View>
    );

  function campoAlterado(campo: keyof Formulario) {
    if (!formularioOriginal) {
      return false;
    }

    return formulario[campo] !== formularioOriginal[campo];
  }

  async function abrirWhatsApp() {
    if (!jornalista?.telefone) {
      return;
    }

    const numeroLimpo = jornalista.telefone.replace(/\D/g, "");

    if (numeroLimpo.length < 10) {
      setFeedback({
        variant: "error",
        title: "Telefone inválido",
        message: "Não foi possível abrir o WhatsApp para este contato.",
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
      setFeedback({
        variant: "error",
        title: "WhatsApp indisponível",
        message: "Não foi possível abrir o WhatsApp.",
      });
    }
  }

  async function abrirEmail() {
    const email = jornalista?.email?.trim();

    if (!email) {
      return;
    }

    try {
      await Linking.openURL(`mailto:${encodeURIComponent(email)}`);
    } catch {
      setFeedback({
        variant: "error",
        title: "E-mail indisponível",
        message: "Não foi possível abrir o aplicativo de e-mail.",
      });
    }
  }

  function abrirVeiculoVinculado() {
    const veiculoId = jornalista?.veiculo_id;

    if (
      !jornalista ||
      !veiculoId ||
      !Number.isSafeInteger(veiculoId) ||
      veiculoId <= 0 ||
      !temPermissao("VEICULOS", "VISUALIZAR") ||
      !navigation.isFocused() ||
      salvando ||
      excluindo
    ) {
      return;
    }

    if (veioDaTelaVeiculo && veiculoOrigemId === veiculoId) {
      voltarParaOrigem();
      return;
    }

    router.navigate({
      pathname: "/veiculos/[id]",
      params: {
        id: String(veiculoId),
        origemMailingId: String(jornalista.id),
        origemMailingVeiculoId: veioDaTelaVeiculo
          ? String(veiculoOrigemId)
          : undefined,
        origemMailingInicio:
          params.origemNavegacao === "inicio" || params.origem === "dashboard"
            ? "1"
            : undefined,
        origemClippingId: undefined,
        origemRelatorioId: undefined,
        origemTipo: undefined,
        origemId: undefined,
        retornoVinculado: undefined,
        origemNavegacao: undefined,
      },
    });
  }

  // modo de ediçao
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
          title={modoEdicao ? "Editar contato" : "Contato"}
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
              {temPermissao("MAILING", "EDITAR") ? (
                <Button
                  title="EDITAR"
                  icon="create-outline"
                  variant="outline"
                  disabled={excluindo}
                  onPress={() => setModoEdicao(true)}
                  style={styles.botaoDetalhes}
                />
              ) : null}

              {temPermissao("MAILING", "EXCLUIR") ? (
                <Button
                  title="EXCLUIR"
                  variant="danger"
                  loading={excluindo}
                  onPress={confirmarExclusao}
                  style={styles.botaoDetalhes}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.resumoCadastro}>
            <ResumoCadastro
              nome={jornalista.nome}
              categoria="CONTATO DO MAILING"
              ativo={jornalista.ativo === 1}
            />
          </View>

          {modoEdicao ? (
            <View style={styles.formularioEdicao}>
              <SecaoEdicao titulo="Dados pessoais">
                <Input
                  label="Nome"
                  value={formulario.nome}
                  onChangeText={(texto) => atualizarCampo("nome", texto)}
                  placeholder="Nome completo"
                  showChanged={campoAlterado("nome")}
                  error={erros.nome}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="E-mail"
                  value={formulario.email}
                  onChangeText={(texto) => atualizarCampo("email", texto)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="E-mail"
                  showChanged={campoAlterado("email")}
                  error={erros.email}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Telefone"
                  value={formulario.telefone}
                  onChangeText={(texto) => atualizarCampo("telefone", texto)}
                  keyboardType="phone-pad"
                  placeholder="Telefone"
                  showChanged={campoAlterado("telefone")}
                  error={erros.telefone}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
              </SecaoEdicao>
              <SecaoEdicao titulo="Perfil profissional">
                <Input
                  label="Cargo / função"
                  value={formulario.cargo}
                  onChangeText={(texto) => atualizarCampo("cargo", texto)}
                  placeholder="Ex.: Repórter"
                  showChanged={campoAlterado("cargo")}
                  error={erros.cargo}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Estado"
                  value={formulario.estado}
                  onChangeText={(texto) => atualizarCampo("estado", texto)}
                  placeholder="Ex.: São Paulo"
                  showChanged={campoAlterado("estado")}
                  error={erros.estado}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <Input
                  label="Cidade"
                  value={formulario.cidade}
                  onChangeText={(texto) => atualizarCampo("cidade", texto)}
                  placeholder="Ex.: Campinas"
                  showChanged={campoAlterado("cidade")}
                  error={erros.cidade}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
                />
                <VeiculoSelector
                  value={{
                    id: formulario.veiculo_id,
                    nome: formulario.veiculo_nome,
                  }}
                  onChange={atualizarVeiculo}
                  showChanged={
                    campoAlterado("veiculo_id") || campoAlterado("veiculo_nome")
                  }
                  criacaoAoSalvar={temPermissao("VEICULOS", "CRIAR")}
                  error={erros.veiculo}
                  disabled={salvando}
                />
              </SecaoEdicao>
              <SecaoEdicao titulo="Informações adicionais">
                <Input
                  label="Observações"
                  value={formulario.observacoes}
                  onChangeText={(texto) => atualizarCampo("observacoes", texto)}
                  placeholder="Observações"
                  multiline
                  textAlignVertical="top"
                  style={styles.textArea}
                  showChanged={campoAlterado("observacoes")}
                  error={erros.observacoes}
                  containerStyle={{ marginBottom: 0 }}
                  editable={!salvando}
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

                      {campoAlterado("ativo") && (
                        <Ionicons
                          name="create-outline"
                          size={15}
                          color={theme.primaria}
                        />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.statusDescription,
                        {
                          color: theme.textoSub,
                        },
                      ]}
                    >
                      Contato disponível no mailing
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
            <InformacoesCadastro
              grupos={[
                {
                  id: "contato",
                  titulo: "Contato",
                  campos: [
                    {
                      id: "email",
                      icone: "mail-outline",
                      rotulo: "E-mail",
                      valor: jornalista.email || "Não informado",
                      acao: jornalista.email
                        ? {
                            icone: "mail-outline",
                            rotulo: "Enviar e-mail para o contato",
                            onPress: abrirEmail,
                          }
                        : undefined,
                    },
                    {
                      id: "telefone",
                      icone: "call-outline",
                      rotulo: "Telefone",
                      valor: jornalista.telefone || "Não informado",
                      acao: jornalista.telefone
                        ? {
                            icone: "logo-whatsapp",
                            rotulo: "Abrir conversa no WhatsApp",
                            onPress: abrirWhatsApp,
                          }
                        : undefined,
                    },
                  ],
                },
                {
                  id: "profissional",
                  titulo: "Perfil profissional",
                  campos: [
                    {
                      id: "cargo",
                      icone: "briefcase-outline",
                      rotulo: "Cargo",
                      valor: jornalista.cargo || "Não informado",
                    },
                    {
                      id: "localizacao",
                      icone: "location-outline",
                      rotulo: "Localização",
                      valor:
                        [jornalista.cidade, jornalista.estado]
                          .filter(Boolean)
                          .join(" · ") || "Não informado",
                    },
                    {
                      id: "veiculo",
                      icone: "newspaper-outline",
                      rotulo: "Veículo",
                      valor:
                        jornalista.veiculo_nome || "Nenhum veículo vinculado",
                      vinculo: Boolean(jornalista.veiculo_id),
                      acao:
                        Number.isSafeInteger(jornalista.veiculo_id) &&
                        (jornalista.veiculo_id ?? 0) > 0 &&
                        temPermissao("VEICULOS", "VISUALIZAR")
                          ? {
                              icone: "arrow-forward-outline",
                              rotulo: "Ir para os detalhes do veículo",
                              onPress: abrirVeiculoVinculado,
                            }
                          : undefined,
                    },
                  ],
                },
                ...(jornalista.observacoes
                  ? [
                      {
                        id: "observacoes",
                        titulo: "Observações",
                        campos: [
                          {
                            id: "observacoes",
                            icone: "document-text-outline" as const,
                            rotulo: "Anotações do contato",
                            valor: jornalista.observacoes,
                          },
                        ],
                      },
                    ]
                  : []),
              ]}
            />
          )}
          {!modoEdicao && temPermissao("RELEASES", "VISUALIZAR") ? (
            <ReleasesVinculados
              contatoId={jornalista.id}
              disabled={salvando || excluindo}
            />
          ) : null}
        </ScrollView>
        {modoEdicao ? (
          <SalvarAlteracoes
            error={erroGeral || Object.values(erros).find(Boolean)}
            alterations={quantidadeAlteracoes()}
            saving={salvando}
            onSave={salvarAlteracoes}
            onDiscard={handleBack}
          />
        ) : null}
        <FeedbackAlert {...feedbackProps} />

        <FeedbackAlert {...saida.alertaProps} />
      </KeyboardAvoidingView>
    </EdicaoCompacta>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: "center",
    alignItems: "center",
  },
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

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  statusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  statusInfo: {
    flex: 1,
    minWidth: 0,
  },

  statusTitle: {
    fontSize: 12,
  },

  statusDescription: {
    fontSize: 11,
    marginTop: 3,
  },

  textArea: {
    height: 100,
    paddingTop: 14,
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
