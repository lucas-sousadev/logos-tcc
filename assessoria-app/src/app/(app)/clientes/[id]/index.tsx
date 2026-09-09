import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

import {
  useEffect,
  useState,
} from "react";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

import UnsavedChanges from "@/components/forms/UnsavedChanges";
import FeedbackAlert, {
  type FeedbackAlertVariant,
} from "@/components/forms/FeedbackAlert";
import LogoPicker from "@/components/forms/LogoPicker";

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

import {
  ErrosCliente,
  validarFormularioCliente,
} from "@/utils/validarCliente";

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

export default function ClienteDetalhes() {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const { id: idParam } =
    useLocalSearchParams<{ id: string }>();

  const id = Number(idParam);

  const [cliente, setCliente] =
    useState<Cliente | null>(null);

  const [formulario, setFormulario] =
    useState<FormularioCliente>({
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

  const [
    formularioOriginal,
    setFormularioOriginal,
  ] = useState<FormularioCliente | null>(null);

  const [novoLogo, setNovoLogo] =
    useState<ArquivoLogoCliente | null>(null);

  const [logoRemovido, setLogoRemovido] =
    useState(false);

  const [erros, setErros] =
    useState<ErrosCliente>({});

  const [erroLogo, setErroLogo] = useState("");
  const [erroGeral, setErroGeral] = useState("");

  const [modoEdicao, setModoEdicao] =
    useState(false);

  const [carregando, setCarregando] =
    useState(true);

  const [erroCarregamento, setErroCarregamento] =
    useState("");

  const [salvando, setSalvando] =
    useState(false);

  const [excluindo, setExcluindo] =
    useState(false);

  const [feedback, setFeedback] =
    useState<FeedbackState | null>(null);

  useEffect(() => {
    void carregarCliente();
  }, [id]);

  function dadosFormulario(
    dados: Cliente
  ): FormularioCliente {
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

  async function carregarCliente() {
    if (!id || Number.isNaN(id)) {
      setErroCarregamento("Cliente inválido.");
      setCarregando(false);

      return;
    }

    try {
      setCarregando(true);
      setErroCarregamento("");

      const dados = await buscarCliente(id);
      const novoFormulario =
        dadosFormulario(dados);

      setCliente(dados);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);

      setNovoLogo(null);
      setLogoRemovido(false);
    } catch (error) {
      setErroCarregamento(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o cliente."
      );
    } finally {
      setCarregando(false);
    }
  }

  function mostrarFeedback(
    dados: FeedbackState
  ) {
    setFeedback(dados);
  }

  function fecharFeedback() {
    const aoFechar = feedback?.onClose;

    setFeedback(null);
    aoFechar?.();
  }

  function atualizarCampo(
    campo: Exclude<
      keyof FormularioCliente,
      "logo_path"
    >,
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

  function limparErro(
    campo: keyof ErrosCliente
  ) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }

  function campoAlterado(
    campo: keyof FormularioCliente
  ): boolean {
    if (campo === "logo_path") {
      return novoLogo !== null || logoRemovido;
    }

    return formularioOriginal
      ? formulario[campo] !==
          formularioOriginal[campo]
      : false;
  }

  function camposAlterados(): (
    keyof FormularioCliente
  )[] {
    if (!formularioOriginal) {
      return [];
    }

    const campos = (
      Object.keys(formulario) as (
        keyof FormularioCliente
      )[]
    ).filter((campo) => {
      if (campo === "logo_path") {
        return false;
      }

      return (
        formulario[campo] !==
        formularioOriginal[campo]
      );
    });

    if (
      (novoLogo !== null || logoRemovido) &&
      !campos.includes("logo_path")
    ) {
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

  function handleBack() {
    if (!modoEdicao) {
      router.back();
      return;
    }

    if (camposAlterados().length > 0) {
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

    const campo: keyof ErrosCliente | null =
      texto.includes("cnpj")
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
    if (!cliente) {
      return;
    }

    const errosValidacao =
      validarFormularioCliente({
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
      setSalvando(true);

      const atualizado =
        await atualizarClienteComLogo(
          cliente.id,
          {
            nome: formulario.nome.trim(),
            email:
              formulario.email.trim() || undefined,
            telefone:
              formulario.telefone.trim() || undefined,
            cnpj:
              formulario.cnpj.trim() || undefined,
            site:
              formulario.site.trim() || undefined,
            cidade:
              formulario.cidade.trim() || undefined,
            estado:
              formulario.estado.trim() || undefined,
            descricao:
              formulario.descricao.trim() || undefined,
            segmento:
              formulario.segmento.trim() || undefined,
            responsavel:
              formulario.responsavel.trim() || undefined,
            ativo: formulario.ativo,
          },
          novoLogo ?? undefined,
          logoRemovido
        );

      const novoFormulario =
        dadosFormulario(atualizado);

      setCliente(atualizado);
      setFormulario(novoFormulario);
      setFormularioOriginal(novoFormulario);

      setNovoLogo(null);
      setLogoRemovido(false);

      setModoEdicao(false);

      mostrarFeedback({
        variant: "success",
        title: "Cliente atualizado",
        message:
          "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      mostrarErroApi(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o cliente."
      );
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!cliente) {
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
    if (!cliente) {
      return;
    }

    fecharFeedback();
    setExcluindo(true);

    try {
      await excluirCliente(cliente.id);

      mostrarFeedback({
        variant: "success",
        title: "Cliente excluído",
        message:
          "O cliente foi excluído com sucesso.",
        onPrimary: () =>
          router.replace("/clientes"),
        onClose: () =>
          router.replace("/clientes"),
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
      setExcluindo(false);
    }
  }

  async function abrirWhatsApp() {
    const telefone = cliente?.telefone?.trim();

    if (!telefone) {
      return;
    }

    const numeroLimpo = telefone.replace(
      /\D/g,
      ""
    );

    if (
      numeroLimpo.length < 10 ||
      numeroLimpo.length > 13
    ) {
      mostrarFeedback({
        variant: "warning",
        title: "Telefone inválido",
        message:
          "Não foi possível abrir o WhatsApp para este cliente.",
      });

      return;
    }

    const numeroWhatsApp =
      numeroLimpo.startsWith("55") &&
      (
        numeroLimpo.length === 12 ||
        numeroLimpo.length === 13
      )
        ? numeroLimpo
        : `55${numeroLimpo}`;

    try {
      await Linking.openURL(
        `https://wa.me/${numeroWhatsApp}`
      );
    } catch {
      mostrarFeedback({
        variant: "error",
        title: "WhatsApp indisponível",
        message:
          "Não foi possível abrir o WhatsApp.",
      });
    }
  }

  async function abrirEmail() {
    const email = cliente?.email?.trim();

    if (!email) {
      return;
    }

    try {
      await Linking.openURL(
        `mailto:${encodeURIComponent(email)}`
      );
    } catch {
      mostrarFeedback({
        variant: "error",
        title: "E-mail indisponível",
        message:
          "Não foi possível abrir o aplicativo de e-mail.",
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
        message:
          "Não foi possível abrir o site do cliente.",
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
        <Header
          title="Cliente"
          showBackButton
        />

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={theme.primaria}
          />
        </View>
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
        <Header
          title="Cliente"
          showBackButton
          onBackPress={() =>
            router.replace("/clientes")
          }
        />

        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color="#EF4444"
          />

          <Text
            weight="SemiBold"
            style={styles.errorTitle}
          >
            Não foi possível carregar
          </Text>

          <Text
            style={[
              styles.errorDescription,
              { color: theme.textoSub },
            ]}
          >
            {erroCarregamento ||
              "O cliente não está disponível."}
          </Text>

          <View style={styles.errorActions}>
            <Button
              title="VOLTAR"
              variant="outline"
              onPress={() =>
                router.replace("/clientes")
              }
              style={styles.actionButton}
            />

            <Button
              title="TENTAR NOVAMENTE"
              onPress={() =>
                void carregarCliente()
              }
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    );
  }

  const logoPerfil = obterUrlLogoCliente(
    cliente.logo_path
  );

  const localizacao = [
    cliente.cidade,
    cliente.estado,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
        },
      ]}
    >
      <Header
        title={
          modoEdicao
            ? "Editar cliente"
            : "Cliente"
        }
        showBackButton
        onBackPress={handleBack}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.profile,
            {
              borderColor: theme.borda,
            },
          ]}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor:
                  theme.backgroundContainer,
              },
            ]}
          >
            {logoPerfil ? (
              <Image
                source={{ uri: logoPerfil }}
                style={styles.logoProfileImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons
                name="briefcase-outline"
                size={29}
                color={theme.textoContainer}
              />
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text
              weight="Bold"
              style={styles.profileName}
            >
              {cliente.nome}
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.profileSubtitle,
                { color: theme.textoSub },
              ]}
            >
              {cliente.segmento ||
                "Segmento não informado"}
            </Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    cliente.ativo === 1
                      ? theme.backgroundContainer
                      : theme.surface,
                },
              ]}
            >
              <Text
                weight="SemiBold"
                style={{
                  color:
                    cliente.ativo === 1
                      ? theme.textoContainer
                      : theme.textoSub,
                  fontSize: 11,
                }}
              >
                {cliente.ativo === 1
                  ? "ATIVO"
                  : "INATIVO"}
              </Text>
            </View>
          </View>
        </View>

        {modoEdicao ? (
          <>
            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              DADOS PRINCIPAIS
            </Text>

            <Input
              label="NOME"
              value={formulario.nome}
              onChangeText={(texto) =>
                atualizarCampo("nome", texto)
              }
              placeholder="Nome do cliente"
              autoCapitalize="words"
              error={erros.nome}
              showChanged={campoAlterado("nome")}
            />

            <Input
              label="SEGMENTO"
              value={formulario.segmento}
              onChangeText={(texto) =>
                atualizarCampo("segmento", texto)
              }
              placeholder="Ex.: Tecnologia, Saúde, Varejo"
              autoCapitalize="words"
              error={erros.segmento}
              showChanged={campoAlterado(
                "segmento"
              )}
            />

            <Input
              label="RESPONSÁVEL"
              value={formulario.responsavel}
              onChangeText={(texto) =>
                atualizarCampo("responsavel", texto)
              }
              placeholder="Nome do responsável"
              autoCapitalize="words"
              error={erros.responsavel}
              showChanged={campoAlterado(
                "responsavel"
              )}
            />

            <Input
              label="CNPJ"
              value={formulario.cnpj}
              onChangeText={(texto) =>
                atualizarCampo("cnpj", texto)
              }
              placeholder="Ex.: 12.345.678/0001-95"
              autoCapitalize="characters"
              autoCorrect={false}
              error={erros.cnpj}
              showChanged={campoAlterado("cnpj")}
            />

            <Input
              label="DESCRIÇÃO"
              value={formulario.descricao}
              onChangeText={(texto) =>
                atualizarCampo("descricao", texto)
              }
              placeholder="Informações sobre o cliente"
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              error={erros.descricao}
              showChanged={campoAlterado(
                "descricao"
              )}
            />

            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              CONTATO
            </Text>

            <Input
              label="E-MAIL"
              value={formulario.email}
              onChangeText={(texto) =>
                atualizarCampo("email", texto)
              }
              placeholder="contato@cliente.com.br"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={erros.email}
              showChanged={campoAlterado("email")}
            />

            <Input
              label="TELEFONE"
              value={formulario.telefone}
              onChangeText={(texto) =>
                atualizarCampo("telefone", texto)
              }
              placeholder="Ex.: (11) 99999-9999"
              keyboardType="phone-pad"
              error={erros.telefone}
              showChanged={campoAlterado(
                "telefone"
              )}
            />

            <Input
              label="SITE"
              value={formulario.site}
              onChangeText={(texto) =>
                atualizarCampo("site", texto)
              }
              placeholder="https://www.exemplo.com.br"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              error={erros.site}
              showChanged={campoAlterado("site")}
            />

            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              LOCALIZAÇÃO
            </Text>

            <Input
              label="CIDADE"
              value={formulario.cidade}
              onChangeText={(texto) =>
                atualizarCampo("cidade", texto)
              }
              placeholder="Ex.: São Paulo"
              autoCapitalize="words"
              error={erros.cidade}
              showChanged={campoAlterado("cidade")}
            />

            <Input
              label="ESTADO"
              value={formulario.estado}
              onChangeText={(texto) =>
                atualizarCampo("estado", texto)
              }
              placeholder="Ex.: São Paulo"
              autoCapitalize="words"
              error={erros.estado}
              showChanged={campoAlterado("estado")}
            />

            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              IDENTIDADE VISUAL
            </Text>

            <LogoPicker
              logoAtualUri={
                logoRemovido
                  ? null
                  : obterUrlLogoCliente(
                      formulario.logo_path
                    )
              }
              logoSelecionado={novoLogo}
              onSelect={(arquivo) => {
                setNovoLogo(arquivo);
                setLogoRemovido(false);
                setErroLogo("");
              }}
              onRemove={() => {
                setNovoLogo(null);

                setLogoRemovido(
                  Boolean(formulario.logo_path)
                );

                setErroLogo("");
              }}
              disabled={salvando}
              error={erroLogo}
              showChanged={campoAlterado(
                "logo_path"
              )}
            />

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
                  <Text
                    weight="SemiBold"
                    style={styles.statusTitle}
                  >
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
                onValueChange={(valor) =>
                  atualizarCampo("ativo", valor)
                }
                trackColor={{
                  false: theme.surface,
                  true: theme.primaria,
                }}
                thumbColor={theme.branco}
              />
            </View>

            {erroGeral ? (
              <Text
                weight="Medium"
                style={styles.errorGeral}
              >
                {erroGeral}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button
                title="CANCELAR"
                variant="outline"
                onPress={cancelarEdicao}
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
            <Text
              weight="Bold"
              style={styles.sectionTitle}
            >
              INFORMAÇÕES
            </Text>

            <InfoRow
              icon="person-outline"
              label="RESPONSÁVEL"
              value={
                cliente.responsavel ||
                "Não informado"
              }
            />

            <InfoRow
              icon="briefcase-outline"
              label="SEGMENTO"
              value={
                cliente.segmento ||
                "Não informado"
              }
            />

            <InfoRow
              icon="card-outline"
              label="CNPJ"
              value={cliente.cnpj || "Não informado"}
            />

            <InfoRow
              icon="mail-outline"
              label="E-MAIL"
              value={cliente.email || "Não informado"}
              actionIcon={
                cliente.email
                  ? "mail-outline"
                  : undefined
              }
              actionLabel="Enviar e-mail para o cliente"
              onActionPress={
                cliente.email
                  ? abrirEmail
                  : undefined
              }
            />

            <InfoRow
              icon="call-outline"
              label="TELEFONE"
              value={
                cliente.telefone || "Não informado"
              }
              actionIcon={
                cliente.telefone
                  ? "logo-whatsapp"
                  : undefined
              }
              actionLabel="Abrir conversa no WhatsApp"
              onActionPress={
                cliente.telefone
                  ? abrirWhatsApp
                  : undefined
              }
            />

            <InfoRow
              icon="globe-outline"
              label="SITE"
              value={cliente.site || "Não informado"}
              actionIcon={
                cliente.site
                  ? "open-outline"
                  : undefined
              }
              actionLabel="Abrir site do cliente"
              onActionPress={
                cliente.site
                  ? abrirSite
                  : undefined
              }
            />

            <InfoRow
              icon="location-outline"
              label="LOCALIZAÇÃO"
              value={
                localizacao || "Não informada"
              }
            />

            <InfoRow
              icon="image-outline"
              label="LOGO"
              value={
                cliente.logo_path
                  ? "Logo cadastrado"
                  : "Não informado"
              }
            />

            {cliente.descricao ? (
              <InfoRow
                icon="document-text-outline"
                label="DESCRIÇÃO"
                value={cliente.descricao}
              />
            ) : null}

            <View style={styles.actions}>
              {temPermissao(
                "CLIENTES",
                "EDITAR"
              ) ? (
                <Button
                  title="EDITAR"
                  onPress={() =>
                    setModoEdicao(true)
                  }
                  style={styles.actionButton}
                />
              ) : null}

              {temPermissao(
                "CLIENTES",
                "EXCLUIR"
              ) ? (
                <Button
                  title="EXCLUIR"
                  variant="outline"
                  loading={excluindo}
                  onPress={confirmarExclusao}
                  style={styles.actionButton}
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <FeedbackAlert
        visible={feedback !== null}
        variant={feedback?.variant ?? "info"}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        primaryLabel={feedback?.primaryLabel}
        secondaryLabel={feedback?.secondaryLabel}
        primaryDanger={feedback?.primaryDanger}
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
    </View>
  );
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onActionPress?: () => void;
}

function InfoRow({
  icon,
  label,
  value,
  actionIcon,
  actionLabel,
  onActionPress,
}: InfoRowProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.infoRow,
        {
          borderColor: theme.borda,
        },
      ]}
    >
      <View
        style={[
          styles.infoIcon,
          {
            backgroundColor:
              theme.backgroundContainer,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={theme.textoContainer}
        />
      </View>

      <View style={styles.infoContent}>
        <Text
          weight="SemiBold"
          style={styles.infoLabel}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.infoValue,
            {
              color: theme.texto,
            },
          ]}
        >
          {value}
        </Text>
      </View>

      {actionIcon && onActionPress ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onActionPress}
          accessibilityLabel={actionLabel}
          style={[
            styles.infoActionButton,
            {
              backgroundColor:
                theme.backgroundContainer,
            },
          ]}
        >
          <Ionicons
            name={actionIcon}
            size={18}
            color={theme.textoContainer}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
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

  profile: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  logoProfileImage: {
    width: "100%",
    height: "100%",
  },

  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },

  profileName: {
    fontSize: 19,
  },

  profileSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },

  infoRow: {
    minHeight: 68,
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 12,
  },

  infoLabel: {
    fontSize: 10,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 14,
  },

  infoActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
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
    marginBottom: 22,
  },

  statusInfo: {
    flex: 1,
    marginRight: 10,
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
    marginTop: 10,
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