import {
  ResumoCadastro,
  InformacoesCadastro,
} from "@/components/ui/DetalhesCadastro";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Image,
} from "react-native";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import EnderecosVeiculo from "@/components/veiculos/EnderecosVeiculo";
import EnderecosVeiculoRascunho from "@/components/veiculos/EnderecosVeiculoRascunho";
import { prepararEnderecosCadastro } from "@/components/veiculos/EnderecosVeiculoCadastro";
import Header from "@/components/layout/Header";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import UnsavedChanges from "@/components/forms/UnsavedChanges";
import LogoPicker from "@/components/forms/LogoPicker";
import TierSelector from "@/components/forms/TierSelector";
import ContatosVinculados from "@/components/veiculos/ContatosVinculados";
import ClippingsVinculados from "@/components/clipping/ClippingsVinculados";

import { DESCRICOES_TIER, rotuloTier, Tier } from "@/constants/tier";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import {
  atualizarVeiculo,
  atualizarVeiculoComLogo,
  listarEnderecosVeiculo,
  buscarVeiculo,
  excluirVeiculo,
  obterUrlLogoVeiculo,
  Veiculo,
  carregarEnderecosVeiculoComVersao,
} from "@/services/api/veiculo";
import type {
  ArquivoLogoVeiculo,
  EnderecoVeiculo,
  NovoEnderecoVeiculo,
  DadosVeiculo,
} from "@/services/api/veiculo";
import { ErrosVeiculo, validarFormularioVeiculo } from "@/utils/validarVeiculo";

interface Formulario {
  nome: string;
  descricao: string;
  logo_path: string;
  alcance: string;
  tier: Tier | null;
  ativo: boolean;
}

function dadosFormulario(dados: Veiculo): Formulario {
  return {
    nome: dados.nome,
    descricao: dados.descricao ?? "",
    logo_path: dados.logo_path ?? "",
    alcance: dados.alcance ?? "",
    tier: dados.tier ?? null,
    ativo: dados.ativo === 1,
  };
}

function enderecosParaEdicao(lista: EnderecoVeiculo[]): NovoEnderecoVeiculo[] {
  return lista.map((endereco) => ({
    id: endereco.id,
    host: `${endereco.protocolo}://${endereco.host}`,
    caminho_prefixo: endereco.caminho_prefixo,
    incluir_subdominios: endereco.incluir_subdominios,
  }));
}
export default function VeiculoDetalhes() {
  const router = useRouter();
  const retornar = useRetornoSeguro("/veiculos");
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const {
    id: idParam,
    origemRelatorioId,
    origemClippingId,
    origemMailingId,
    origemMailingVeiculoId,
    origemMailingInicio,
    origemTipo,
    origemId,
    retornoVinculado,
  } = useLocalSearchParams<{
    id: string;
    origemRelatorioId?: string;
    origemClippingId?: string;
    origemMailingId?: string;
    origemMailingVeiculoId?: string;
    origemMailingInicio?: string;
    origemTipo?: string;
    origemId?: string;
    retornoVinculado?: "origem" | "lista";
  }>();
  const id = Number(idParam);
  const clippingId = Number(origemClippingId);
  const veioDoClipping = Number.isSafeInteger(clippingId) && clippingId > 0;

  const [erros, setErros] = useState<ErrosVeiculo>({});
  const [erroGeral, setErroGeral] = useState("");
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [formulario, setFormulario] = useState<Formulario>({
    nome: "",
    descricao: "",
    logo_path: "",
    alcance: "",
    tier: null,
    ativo: true,
  });
  const [formularioOriginal, setFormularioOriginal] =
    useState<Formulario | null>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [feedbackEdicao, setFeedbackEdicao] = useState<{
    variant: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [abaVinculos, setAbaVinculos] = useState<"contatos" | "clippings">(
    "contatos"
  );
  const [excluindoVinculos, setExcluindoVinculos] = useState(false);
  const [novoLogo, setNovoLogo] = useState<ArquivoLogoVeiculo | null>(null);

  const [logoRemovido, setLogoRemovido] = useState(false);
  const [enderecosOriginais, setEnderecosOriginais] = useState<
    NovoEnderecoVeiculo[]
  >([]);
  const [enderecosRascunho, setEnderecosRascunho] = useState<
    NovoEnderecoVeiculo[]
  >([]);
  const [versaoEnderecos, setVersaoEnderecos] = useState<number | null>(null);
  const [erroEnderecos, setErroEnderecos] = useState("");

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [modoEdicao]);

  const voltarDoVeiculo = useCallback(() => {
    const contatoId = Number(origemMailingId);

    if (Number.isSafeInteger(contatoId) && contatoId > 0) {
      const veiculoOrigemId = Number(origemMailingVeiculoId);
      const origemVeiculoValida =
        Number.isSafeInteger(veiculoOrigemId) && veiculoOrigemId > 0;

      router.navigate({
        pathname: "/mailing/[id]",
        params: {
          id: String(contatoId),
          origem: origemVeiculoValida
            ? "veiculo"
            : origemMailingInicio === "1"
              ? "dashboard"
              : undefined,
          veiculo_id: origemVeiculoValida ? String(veiculoOrigemId) : undefined,
        },
      });
      return;
    }

    if (veioDoClipping) {
      router.navigate({
        pathname: "/clipping/[id]",
        params: {
          id: String(clippingId),
          origemTipo,
          origemId,
          retornoVinculado,
        },
      });
      return;
    }

    const relatorioId = Number(origemRelatorioId);

    if (Number.isSafeInteger(relatorioId) && relatorioId > 0) {
      router.navigate({
        pathname: "/relatorios/[id]",
        params: { id: String(relatorioId) },
      });
      return;
    }

    retornar();
  }, [
    clippingId,
    origemId,
    origemMailingId,
    origemMailingVeiculoId,
    origemMailingInicio,
    origemRelatorioId,
    origemTipo,
    retornoVinculado,
    router,
    veioDoClipping,
    retornar,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (
        Platform.OS !== "android" ||
        !veioDoClipping ||
        modoEdicao ||
        excluindo ||
        excluindoVinculos
      ) {
        return;
      }

      const inscricao = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          voltarDoVeiculo();
          return true;
        }
      );

      return () => inscricao.remove();
    }, [
      excluindo,
      excluindoVinculos,
      modoEdicao,
      veioDoClipping,
      voltarDoVeiculo,
    ])
  );

  const carregarVeiculo = useCallback(async () => {
    if (!id || Number.isNaN(id)) {
      Alert.alert("Erro", "Veículo inválido.");
      voltarDoVeiculo();
      return;
    }

    try {
      setCarregando(true);

      const [dados, enderecos] = await Promise.all([
        buscarVeiculo(id),
        listarEnderecosVeiculo(id),
      ]);

      const listaFormulario = enderecosParaEdicao(enderecos);

      const novoFormulario = dadosFormulario(dados);

      setVeiculo(dados);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);
      setEnderecosOriginais(listaFormulario);
      setEnderecosRascunho(listaFormulario.map((item) => ({ ...item })));
      setErroEnderecos("");
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o veículo."
      );

      voltarDoVeiculo();
    } finally {
      setCarregando(false);
      setNovoLogo(null);
      setLogoRemovido(false);
    }
  }, [id, voltarDoVeiculo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void carregarVeiculo();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [carregarVeiculo]);

  async function atualizarResumoVeiculo() {
    if (!id || Number.isNaN(id)) {
      return;
    }

    const dados = await buscarVeiculo(id);

    setVeiculo(dados);
  }

  function atualizarCampo<Campo extends keyof Formulario>(
    campo: Campo,
    valor: Formulario[Campo]
  ) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  function campoAlterado(campo: keyof Formulario) {
    if (campo === "logo_path") {
      return novoLogo !== null || logoRemovido;
    }

    return formularioOriginal
      ? formulario[campo] !== formularioOriginal[campo]
      : false;
  }

  async function iniciarEdicao() {
    if (!veiculo) return;

    try {
      const snapshot = await carregarEnderecosVeiculoComVersao(veiculo.id);

      const lista = enderecosParaEdicao(snapshot.enderecos);

      setVersaoEnderecos(snapshot.versao);
      setEnderecosOriginais(lista);
      setEnderecosRascunho(lista.map((item) => ({ ...item })));
      setErroEnderecos("");
      setModoEdicao(true);
    } catch (error) {
      setFeedbackEdicao({
        variant: "error",
        title: "Não foi possível abrir a edição",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os endereços.",
      });
    }
  }

  function cancelarEdicao() {
    if (!veiculo) return;
    const original = dadosFormulario(veiculo);
    setFormulario(original);
    setFormularioOriginal(original);
    setErros({});
    setErroGeral("");
    setNovoLogo(null);
    setLogoRemovido(false);
    setEnderecosRascunho(enderecosOriginais.map((item) => ({ ...item })));
    setErroEnderecos("");
    setModoEdicao(false);
  }

  function camposAlterados(): Array<keyof Formulario | "enderecos"> {
    if (!formularioOriginal) return [];

    const campos: Array<keyof Formulario | "enderecos"> = (
      Object.keys(formulario) as (keyof Formulario)[]
    ).filter((campo) => formulario[campo] !== formularioOriginal[campo]);

    if ((novoLogo !== null || logoRemovido) && !campos.includes("logo_path")) {
      campos.push("logo_path");
    }

    if (
      JSON.stringify(enderecosRascunho) !== JSON.stringify(enderecosOriginais)
    ) {
      campos.push("enderecos");
    }

    return campos;
  }

  const saida = useSaidaFormulario(
    camposAlterados().length > 0,
    salvando || excluindo || excluindoVinculos
  );

  function handleBack() {
    if (salvando || excluindo || excluindoVinculos) return;
    if (!modoEdicao) {
      voltarDoVeiculo();
      return;
    }

    if (camposAlterados().length > 0) {
      saida.confirmarSaida(cancelarEdicao);
      return;
    }
    cancelarEdicao();
  }

  function limparErro(campo: keyof ErrosVeiculo) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }

  function mostrarErroApi(mensagem: string) {
    const texto = mensagem.toLocaleLowerCase();

    let campo: keyof ErrosVeiculo | null = null;

    if (
      texto.includes("endereço") ||
      texto.includes("domínio") ||
      texto.includes("subdomínio")
    ) {
      setErroEnderecos(mensagem);
      return;
    }
    if (texto.includes("nome")) {
      campo = "nome";
    } else if (texto.includes("descrição")) {
      campo = "descricao";
    } else if (texto.includes("alcance")) {
      campo = "alcance";
    } else if (
      texto.includes("logo") ||
      texto.includes("caminho") ||
      texto.includes("imagem")
    ) {
      campo = "logo_path";
    }

    if (campo) {
      setErros({ [campo]: mensagem });
      return;
    }

    setErroGeral(mensagem);
  }

  async function salvarAlteracoes() {
    if (!veiculo) return;

    const errosValidacao = validarFormularioVeiculo({
      nome: formulario.nome,
      descricao: formulario.descricao,
      alcance: formulario.alcance,
      logo_path: logoRemovido ? "" : formulario.logo_path,
    });

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    const enderecosMudaram =
      JSON.stringify(enderecosRascunho) !== JSON.stringify(enderecosOriginais);

    let enderecosParaSalvar: NovoEnderecoVeiculo[] | undefined;

    try {
      if (enderecosMudaram) {
        enderecosParaSalvar = prepararEnderecosCadastro(enderecosRascunho);
      }
    } catch (error) {
      setErroEnderecos(
        error instanceof Error ? error.message : "Verifique os endereços."
      );
      return;
    }

    setErroEnderecos("");

    const dadosAtualizacao: DadosVeiculo = {
      nome: formulario.nome.trim(),
      descricao: formulario.descricao.trim() || undefined,
      logo_path: logoRemovido ? null : formulario.logo_path.trim() || undefined,
      alcance: formulario.alcance.trim() || undefined,
      ativo: formulario.ativo,
      tier: formulario.tier,
    };

    if (enderecosParaSalvar !== undefined) {
      if (versaoEnderecos === null) {
        setErroEnderecos(
          "Reabra a edição para carregar a versão dos endereços."
        );
        return;
      }

      dadosAtualizacao.enderecos = enderecosParaSalvar;
      dadosAtualizacao.enderecos_versao = versaoEnderecos;
    }

    try {
      setSalvando(true);

      const atualizado =
        novoLogo !== null || logoRemovido
          ? await atualizarVeiculoComLogo(
              veiculo.id,
              dadosAtualizacao,
              novoLogo ?? undefined,
              logoRemovido
            )
          : await atualizarVeiculo(veiculo.id, dadosAtualizacao);

      const novoFormulario = dadosFormulario(atualizado);

      setVeiculo(atualizado);
      setNovoLogo(null);
      setLogoRemovido(false);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);
      if (enderecosParaSalvar !== undefined) {
        setEnderecosOriginais(
          enderecosParaSalvar.map((item) => ({
            ...item,
          }))
        );
        setEnderecosRascunho(
          enderecosParaSalvar.map((item) => ({
            ...item,
          }))
        );
      }
      setModoEdicao(false);

      setFeedbackEdicao({
        variant: "success",
        title: "Veículo atualizado",
        message: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o veículo.";

      mostrarErroApi(mensagem);
      setFeedbackEdicao({
        variant: "error",
        title: "Não foi possível salvar",
        message: mensagem,
      });
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!veiculo) return;

    const mensagem = `Deseja realmente excluir ${veiculo.nome}?`;

    if (Platform.OS === "web") {
      if (window.confirm(mensagem)) excluir();
      return;
    }

    Alert.alert("Excluir veículo", mensagem, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: excluir },
    ]);
  }

  async function excluir() {
    if (!veiculo) return;

    try {
      setExcluindo(true);
      await excluirVeiculo(veiculo.id);

      if (Platform.OS === "web") {
        window.alert("Veículo excluído com sucesso.");
        saida.concluirSaida(() => router.dismissTo("/veiculos"));
        return;
      }

      Alert.alert("Sucesso", "Veículo excluído com sucesso.", [
        {
          text: "OK",
          onPress: () =>
            saida.concluirSaida(() => router.dismissTo("/veiculos")),
        },
      ]);
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o veículo.";

      if (Platform.OS === "web") {
        window.alert(mensagem);
      } else {
        Alert.alert("Erro", mensagem);
      }
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title="Veículo" showBackButton onBackPress={voltarDoVeiculo} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primaria} />
        </View>
        <FeedbackAlert {...saida.alertaProps} />
      </View>
    );
  }

  if (!veiculo) return null;

  const podeVerContatos = temPermissao("MAILING", "VISUALIZAR");
  const podeVerClippings = temPermissao("CLIPPING", "VISUALIZAR");
  const abaVinculosAtiva =
    podeVerContatos && (!podeVerClippings || abaVinculos === "contatos")
      ? "contatos"
      : "clippings";

  const logoPerfil = obterUrlLogoVeiculo(veiculo.logo_path);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title={modoEdicao ? "Editar veículo" : "Veículo"}
        showBackButton
        onBackPress={handleBack}
      />

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!modoEdicao ? (
          <View style={styles.acoesDetalhes}>
            {temPermissao("VEICULOS", "EDITAR") ? (
              <Button
                title="EDITAR"
                icon="create-outline"
                variant="outline"
                onPress={() => void iniciarEdicao()}
                disabled={excluindo || excluindoVinculos}
                style={styles.botaoDetalhes}
              />
            ) : null}
            {temPermissao("VEICULOS", "EXCLUIR") ? (
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
            nome={veiculo.nome}
            categoria="VEÍCULO DE COMUNICAÇÃO"
            ativo={veiculo.ativo === 1}
            avatar={
              logoPerfil ? (
                <Image
                  source={{ uri: logoPerfil }}
                  style={styles.logoProfileImage}
                  resizeMode="contain"
                  accessibilityLabel={"Logo de " + veiculo.nome}
                />
              ) : (
                <Ionicons
                  name="newspaper-outline"
                  size={24}
                  color={theme.textoContainer}
                />
              )
            }
          />
        </View>

        {modoEdicao ? (
          <>
            <Text weight="Bold" style={styles.sectionTitle}>
              DADOS DO VEÍCULO
            </Text>
            <Input
              label="NOME"
              value={formulario.nome}
              onChangeText={(texto) => {
                atualizarCampo("nome", texto);
                limparErro("nome");
              }}
              error={erros.nome}
              placeholder="Nome do veículo"
              autoCapitalize="words"
              showChanged={campoAlterado("nome")}
            />

            <Input
              label="DESCRIÇÃO"
              value={formulario.descricao}
              onChangeText={(texto) => {
                atualizarCampo("descricao", texto);
                limparErro("descricao");
              }}
              error={erros.descricao}
              placeholder="Descrição do veículo"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              showChanged={campoAlterado("descricao")}
            />

            <Input
              label="ALCANCE"
              value={formulario.alcance}
              onChangeText={(texto) => {
                atualizarCampo("alcance", texto);
                limparErro("alcance");
              }}
              error={erros.alcance}
              placeholder="Ex.: Nacional, 250 mil leitores/mês"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              showChanged={campoAlterado("alcance")}
            />

            <TierSelector
              value={formulario.tier}
              onChange={(valor) => {
                atualizarCampo("tier", valor);
                setErroGeral("");
              }}
              disabled={salvando}
              showChanged={campoAlterado("tier")}
            />
            <LogoPicker
              logoAtualUri={
                logoRemovido ? null : obterUrlLogoVeiculo(formulario.logo_path)
              }
              logoSelecionado={novoLogo}
              onSelect={(arquivo) => {
                setNovoLogo(arquivo);
                setLogoRemovido(false);
                limparErro("logo_path");
              }}
              onRemove={() => {
                setNovoLogo(null);
                setLogoRemovido(Boolean(formulario.logo_path));
                limparErro("logo_path");
              }}
              disabled={salvando}
              error={erros.logo_path}
              showChanged={campoAlterado("logo_path")}
            />
            <EnderecosVeiculoRascunho
              value={enderecosRascunho}
              onChange={(lista) => {
                setEnderecosRascunho(lista);
                setErroEnderecos("");
              }}
              disabled={salvando}
              error={erroEnderecos}
            />
            <View style={[styles.statusRow, { borderColor: theme.borda }]}>
              <View style={styles.statusInfo}>
                <Text weight="SemiBold" style={styles.statusTitle}>
                  STATUS
                </Text>
                <Text
                  style={[styles.statusDescription, { color: theme.textoSub }]}
                >
                  Veículo disponível para vinculação no mailing
                </Text>
              </View>
              <Switch
                value={formulario.ativo}
                onValueChange={(valor) => atualizarCampo("ativo", valor)}
                trackColor={{ false: theme.surface, true: theme.primaria }}
                thumbColor={theme.branco}
              />
            </View>
            {erroGeral ? (
              <Text weight="Medium" style={styles.errorGeral}>
                {erroGeral}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button
                title="CANCELAR"
                variant="outline"
                onPress={cancelarEdicao}
                disabled={salvando}
                style={styles.actionButton}
              />
              <Button
                title="SALVAR"
                loading={salvando}
                onPress={salvarAlteracoes}
                style={styles.actionButton}
              />
            </View>
            <UnsavedChanges
              visible={camposAlterados().length > 0}
              saving={salvando}
              alterations={camposAlterados().length}
              onSave={salvarAlteracoes}
              onDiscard={cancelarEdicao}
            />
          </>
        ) : (
          <>
            <View style={styles.informacoesCadastro}>
              <InformacoesCadastro
                grupos={[
                  {
                    id: "cadastro",
                    titulo: "Dados do veículo",
                    campos: [
                      {
                        id: "descricao",
                        icone: "document-text-outline",
                        rotulo: "Descrição",
                        valor: veiculo.descricao || "Não informada",
                      },
                      {
                        id: "alcance",
                        icone: "stats-chart-outline",
                        rotulo: "Alcance",
                        valor: veiculo.alcance || "Não informado",
                      },
                      {
                        id: "tier",
                        icone: "ribbon-outline",
                        rotulo: "Tier",
                        valor:
                          veiculo.tier == null
                            ? "Não definido"
                            : rotuloTier(veiculo.tier) +
                              " · " +
                              DESCRICOES_TIER[veiculo.tier],
                      },
                      {
                        id: "logo",
                        icone: "image-outline",
                        rotulo: "Logo",
                        valor: veiculo.logo_path
                          ? "Logo cadastrado"
                          : "Não informado",
                      },
                    ],
                  },
                ]}
              />
            </View>
            <EnderecosVeiculo veiculoId={veiculo.id} editavel={false} />
            {podeVerContatos || podeVerClippings ? (
              <View
                style={[
                  styles.vinculos,
                  { borderTopColor: theme.borda + "25" },
                ]}
              >
                <Text weight="SemiBold" style={styles.tituloVinculos}>
                  Vínculos do veículo
                </Text>

                {podeVerContatos && podeVerClippings ? (
                  <View style={styles.actions}>
                    <Button
                      title="CONTATOS"
                      size="small"
                      variant={
                        abaVinculosAtiva === "contatos" ? "primary" : "outline"
                      }
                      disabled={excluindoVinculos || excluindo}
                      onPress={() => setAbaVinculos("contatos")}
                      style={styles.actionButton}
                    />
                    <Button
                      title="CLIPPINGS"
                      size="small"
                      variant={
                        abaVinculosAtiva === "clippings" ? "primary" : "outline"
                      }
                      disabled={excluindoVinculos || excluindo}
                      onPress={() => setAbaVinculos("clippings")}
                      style={styles.actionButton}
                    />
                  </View>
                ) : null}

                {abaVinculosAtiva === "contatos" ? (
                  <ContatosVinculados
                    key={`contatos-${veiculo.id}`}
                    veiculoId={veiculo.id}
                    totalVinculados={veiculo.contatos_vinculados}
                    onContatosAlterados={atualizarResumoVeiculo}
                    onExcluindoChange={setExcluindoVinculos}
                  />
                ) : (
                  <ClippingsVinculados
                    key={`veiculo-${veiculo.id}`}
                    tipo="veiculo"
                    id={veiculo.id}
                    nome={veiculo.nome}
                    onExcluindoChange={setExcluindoVinculos}
                  />
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <FeedbackAlert {...saida.alertaProps} />
      <FeedbackAlert
        visible={feedbackEdicao !== null}
        variant={feedbackEdicao?.variant ?? "success"}
        title={feedbackEdicao?.title ?? ""}
        message={feedbackEdicao?.message ?? ""}
        onClose={() => setFeedbackEdicao(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  resumoCadastro: { marginBottom: 12 },
  informacoesCadastro: { marginBottom: 12 },
  acoesDetalhes: { flexDirection: "row", gap: 8, marginBottom: 12 },
  botaoDetalhes: { flex: 1, width: "auto", minWidth: 0 },

  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoProfileImage: { width: "100%", height: "100%" },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  statusRow: {
    minHeight: 68,
    borderWidth: 1.5,
    borderRadius: 15,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statusInfo: {
    flex: 1,
    marginRight: 10,
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
    marginTop: 0,
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
  actionButton: {
    flex: 1,
  },
  errorGeral: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
});
