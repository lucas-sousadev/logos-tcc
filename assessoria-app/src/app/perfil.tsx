import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import { useCallback, useEffect, useRef, useState } from "react";

import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/layout/Header";
import AvatarUsuario from "@/components/perfil/AvatarUsuario";
import FotoPerfilPicker from "@/components/perfil/FotoPerfilPicker";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import { InformacoesCadastro } from "@/components/ui/DetalhesCadastro";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import {
  buscarPerfil,
  salvarPerfil,
  ErroPerfil,
  type DadosPerfil,
  type PerfilUsuario,
} from "@/services/api/perfil";
import type { ArquivoUpload } from "@/services/arquivoUpload";

function dadosEdicao(perfil: PerfilUsuario): DadosPerfil {
  return {
    nome: perfil.nome,
    email: perfil.email,
    telefone: perfil.telefone ?? "",
    cargo: perfil.cargo ?? "",
    cidade: perfil.cidade ?? "",
    uf: perfil.uf ?? "",
    perfil_versao: perfil.perfil_versao,
  };
}

export default function Perfil() {
  const { usuario } = useAuth();
  return (
    <PerfilConta
      key={usuario ? usuario.assessoria_id + ":" + usuario.id : "sem-conta"}
    />
  );
}

function PerfilConta() {
  const { usuario, atualizarUsuario } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [edicao, setEdicao] = useState<DadosPerfil | null>(null);
  const [foto, setFoto] = useState<ArquivoUpload | null>(null);
  const [removerFoto, setRemoverFoto] = useState(false);
  const [selecionando, setSelecionando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [consultando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [tentativaLida, setTentativaLida] = useState(-1);
  const carregando = consultando || tentativaLida !== tentativa;
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState<"sucesso" | "conflito" | null>(null);
  const [conflito, setConflito] = useState(false);
  const trava = useRef(false);
  const montado = useRef(true);
  const editando = edicao !== null;
  const alterado = Boolean(
    perfil &&
    edicao &&
    (JSON.stringify({ ...edicao, senha_atual: undefined }) !==
      JSON.stringify(dadosEdicao(perfil)) ||
      foto ||
      removerFoto)
  );
  const ocupado = salvando || selecionando;
  const saida = useSaidaFormulario(alterado, ocupado);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (editando) return;
      let ativa = true;
      const controller = new AbortController();
      const prazo = setTimeout(() => controller.abort(), 15_000);
      setCarregando(true);
      buscarPerfil(controller.signal)
        .then((dados) => {
          if (!ativa) return;
          setPerfil(dados);
          atualizarUsuario(dados);
          setErro("");
        })
        .catch((falha) => {
          if (ativa)
            setErro(
              controller.signal.aborted
                ? "O perfil demorou para responder. Tente novamente."
                : falha instanceof Error
                  ? falha.message
                  : "Não foi possível carregar seu perfil."
            );
        })
        .finally(() => {
          clearTimeout(prazo);
          if (ativa) {
            setCarregando(false);
            setTentativaLida(tentativa);
          }
        });
      return () => {
        ativa = false;
        clearTimeout(prazo);
        controller.abort();
      };
    }, [editando, tentativa, atualizarUsuario])
  );

  function encerrarEdicao() {
    setEdicao(null);
    setFoto(null);
    setRemoverFoto(false);
    setErro("");
    setConflito(false);
  }

  function alterar(campo: keyof DadosPerfil, valor: string) {
    setEdicao((atual) =>
      atual
        ? {
            ...atual,
            [campo]: valor,
            ...(campo === "email" ? { senha_atual: "" } : {}),
          }
        : atual
    );
    setErro("");
  }

  async function salvar() {
    if (!edicao || trava.current || ocupado) return;
    if (!edicao.nome.trim()) {
      setErro("Informe seu nome.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edicao.email.trim())) {
      setErro("Informe um e-mail válido.");
      return;
    }
    if (
      edicao.telefone &&
      !/^\d{10,11}$/.test(edicao.telefone.replace(/\D/g, ""))
    ) {
      setErro("Informe um telefone com DDD válido.");
      return;
    }
    if (
      edicao.email.trim().toLowerCase() !== perfil?.email.toLowerCase() &&
      !edicao.senha_atual
    ) {
      setErro("Confirme sua senha atual para alterar o e-mail.");
      return;
    }
    trava.current = true;
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await salvarPerfil(
        { ...edicao, nome: edicao.nome.trim(), email: edicao.email.trim() },
        foto,
        removerFoto
      );
      if (!montado.current) return;
      setPerfil(atualizado);
      atualizarUsuario(atualizado);
      encerrarEdicao();
      setFeedback("sucesso");
    } catch (falha) {
      if (!montado.current) return;
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível salvar o perfil."
      );
      if (falha instanceof ErroPerfil && [408, 409].includes(falha.status)) {
        setConflito(true);
        setFeedback("conflito");
      }
    } finally {
      trava.current = false;
      if (montado.current) setSalvando(false);
    }
  }

  async function conferirVersao() {
    if (trava.current) return;
    trava.current = true;
    setSalvando(true);
    const controller = new AbortController();
    const prazo = setTimeout(() => controller.abort(), 15_000);
    try {
      const atualizado = await buscarPerfil(controller.signal);
      if (!montado.current) return;
      setPerfil(atualizado);
      atualizarUsuario(atualizado);
      encerrarEdicao();
      setFeedback(null);
    } catch (falha) {
      if (montado.current) {
        setFeedback(null);
        setErro(
          falha instanceof Error
            ? falha.message
            : "Não foi possível carregar a versão atual."
        );
      }
    } finally {
      clearTimeout(prazo);
      trava.current = false;
      if (montado.current) setSalvando(false);
    }
  }

  const identidade = perfil ?? usuario;
  const tipo =
    identidade?.perfil === "FUNCIONARIO" ? "Funcionário" : "Assessor";
  const corVerificacao = perfil?.email_verificado
    ? theme.alteracao
    : theme.aviso;
  const mudouEmail = Boolean(
    edicao &&
    perfil &&
    edicao.email.trim().toLowerCase() !== perfil.email.toLowerCase()
  );

  return (
    <EdicaoCompacta ativa={editando}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.tela, { backgroundColor: theme.background }]}
      >
        <Header title="Meu perfil" showBackButton />
        <ScrollView
          style={{ flex: 1 }}
          automaticallyAdjustKeyboardInsets={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: Math.max(insets.left, 16),
              paddingRight: Math.max(insets.right, 16),
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            },
          ]}
        >
          <View style={styles.conteudo}>
            <View
              style={[
                styles.card,
                styles.identidade,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda + "40",
                },
              ]}
            >
              <AvatarUsuario usuario={identidade} tamanho={64} />
              <View style={styles.textos}>
                <Text style={[styles.rotulo, { color: theme.textoSub }]}>
                  SUA CONTA
                </Text>
                <Text weight="Bold" selectable style={styles.nome}>
                  {identidade?.nome || "Usuário"}
                </Text>
                {perfil?.cargo ? (
                  <Text style={[styles.descricao, { color: theme.textoSub }]}>
                    {perfil.cargo}
                  </Text>
                ) : null}
                <Text
                  weight="SemiBold"
                  style={[styles.tipo, { color: theme.textoTerciaria }]}
                >
                  {tipo}
                </Text>
              </View>
            </View>

            {carregando ? (
              <View style={styles.carregamento}>
                <ActivityIndicator color={theme.primaria} />
                <Text style={[styles.descricao, { color: theme.textoSub }]}>
                  Atualizando perfil...
                </Text>
              </View>
            ) : null}
            {!editando && perfil ? (
              <Button
                title="EDITAR PERFIL"
                icon="create-outline"
                onPress={() => {
                  setEdicao(dadosEdicao(perfil));
                  setErro("");
                }}
                disabled={carregando}
              />
            ) : null}

            {perfil && !editando ? (
              <>
                <InformacoesCadastro
                  grupos={[
                    {
                      id: "contato",
                      titulo: "Informações pessoais",
                      campos: [
                        {
                          id: "email",
                          icone: "mail-outline",
                          rotulo: "E-mail",
                          valor: perfil.email,
                        },
                        {
                          id: "telefone",
                          icone: "call-outline",
                          rotulo: "Telefone",
                          valor: perfil.telefone || "Não informado",
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
                          rotulo: "Cargo / função",
                          valor: perfil.cargo || "Não informado",
                        },
                        {
                          id: "cidade",
                          icone: "location-outline",
                          rotulo: "Cidade / UF",
                          valor:
                            [perfil.cidade, perfil.uf]
                              .filter(Boolean)
                              .join(" · ") || "Não informado",
                        },
                      ],
                    },
                    {
                      id: "vinculo",
                      titulo: "Seu vínculo no LOGOS",
                      campos: [
                        {
                          id: "assessoria",
                          icone: "business-outline",
                          rotulo: "Assessoria",
                          valor: perfil.assessoria_nome,
                        },
                        {
                          id: "acesso",
                          icone: "shield-checkmark-outline",
                          rotulo: "Tipo de acesso",
                          valor: tipo,
                        },
                        {
                          id: "entrada",
                          icone: "calendar-outline",
                          rotulo: "No LOGOS desde",
                          valor: perfil.created_at
                            .slice(0, 10)
                            .split("-")
                            .reverse()
                            .join("/"),
                        },
                      ],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.verificacao,
                    { backgroundColor: corVerificacao + "0C" },
                  ]}
                >
                  <Ionicons
                    name={
                      perfil.email_verificado
                        ? "checkmark-circle-outline"
                        : "time-outline"
                    }
                    size={19}
                    color={corVerificacao}
                  />
                  <Text
                    weight="Medium"
                    style={[styles.descricao, { color: corVerificacao }]}
                  >
                    {perfil.email_verificado
                      ? "E-mail verificado"
                      : "E-mail ainda não verificado"}
                  </Text>
                </View>
              </>
            ) : null}

            {perfil && edicao ? (
              <>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "40",
                    },
                  ]}
                >
                  <FotoPerfilPicker
                    usuario={perfil}
                    foto={foto}
                    removida={removerFoto}
                    disabled={ocupado}
                    onBusy={setSelecionando}
                    onSelect={(arquivo) => {
                      setFoto(arquivo);
                      setRemoverFoto(false);
                    }}
                    onRemove={() => {
                      setFoto(null);
                      setRemoverFoto(Boolean(perfil.foto_path));
                    }}
                  />
                </View>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "40",
                    },
                  ]}
                >
                  <Text weight="SemiBold" style={styles.tituloGrupo}>
                    Dados pessoais
                  </Text>
                  <Input
                    label="Nome *"
                    accessibilityLabel="Nome"
                    value={edicao.nome}
                    onChangeText={(v) => alterar("nome", v)}
                    maxLength={150}
                    editable={!ocupado}
                    autoComplete="name"
                    containerStyle={{ marginBottom: 0 }}
                  />
                  <Input
                    label="E-mail *"
                    accessibilityLabel="E-mail"
                    value={edicao.email}
                    onChangeText={(v) => alterar("email", v)}
                    maxLength={150}
                    editable={!ocupado}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    containerStyle={{ marginBottom: 0 }}
                  />
                  {mudouEmail ? (
                    <>
                      <Text
                        style={[styles.descricao, { color: theme.textoSub }]}
                      >
                        Seu novo e-mail será usado para entrar no LOGOS.
                      </Text>
                      <Input
                        label="Senha atual *"
                        accessibilityLabel="Senha atual"
                        value={edicao.senha_atual ?? ""}
                        onChangeText={(v) => alterar("senha_atual", v)}
                        secureTextEntry
                        showPasswordToggle
                        autoComplete="current-password"
                        editable={!ocupado}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </>
                  ) : null}
                  <Input
                    label="Telefone com DDD"
                    accessibilityLabel="Telefone com DDD"
                    value={edicao.telefone}
                    onChangeText={(v) => alterar("telefone", v)}
                    maxLength={30}
                    editable={!ocupado}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="(11) 99999-9999"
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "40",
                    },
                  ]}
                >
                  <Text weight="SemiBold" style={styles.tituloGrupo}>
                    Perfil profissional
                  </Text>
                  <Input
                    label="Cargo / função"
                    accessibilityLabel="Cargo / função"
                    value={edicao.cargo}
                    onChangeText={(v) => alterar("cargo", v)}
                    maxLength={100}
                    editable={!ocupado}
                    placeholder="Ex.: Redator"
                    containerStyle={{ marginBottom: 0 }}
                  />
                  <View style={styles.localizacao}>
                    <Input
                      label="Cidade"
                      accessibilityLabel="Cidade"
                      value={edicao.cidade}
                      onChangeText={(v) => alterar("cidade", v)}
                      maxLength={100}
                      editable={!ocupado}
                      containerStyle={[styles.cidade, { marginBottom: 0 }]}
                    />
                    <Input
                      label="UF"
                      accessibilityLabel="UF"
                      value={edicao.uf}
                      onChangeText={(v) => alterar("uf", v.toUpperCase())}
                      maxLength={2}
                      autoCapitalize="characters"
                      editable={!ocupado}
                      placeholder="SP"
                      containerStyle={[styles.uf, { marginBottom: 0 }]}
                    />
                  </View>
                  <Text style={[styles.descricao, { color: theme.textoSub }]}>
                    O cargo descreve sua função profissional. As permissões são
                    gerenciadas pela assessoria.
                  </Text>
                </View>
              </>
            ) : null}

            {erro ? (
              <Text
                accessibilityRole="alert"
                style={[styles.descricao, { color: theme.erro }]}
              >
                {erro}
              </Text>
            ) : null}
            {!editando && erro ? (
              <Button
                title="TENTAR NOVAMENTE"
                variant="outline"
                disabled={carregando}
                onPress={() => setTentativa((v) => v + 1)}
              />
            ) : null}
            {conflito && editando ? (
              <Button
                title="CONFERIR VERSÃO ATUAL"
                variant="outline"
                onPress={() => setFeedback("conflito")}
                disabled={ocupado}
              />
            ) : null}
          </View>
        </ScrollView>
        {editando ? (
          <SalvarAlteracoes
            changed={alterado}
            saving={salvando}
            busy={selecionando}
            disabled={conflito}
            safeArea
            error={erro}
            onSave={() => void salvar()}
            onDiscard={() => saida.confirmarSaida(encerrarEdicao)}
          />
        ) : null}
        <FeedbackAlert {...saida.alertaProps} />
        {feedback ? (
          <FeedbackAlert
            visible
            variant={feedback === "sucesso" ? "success" : "warning"}
            title={
              feedback === "sucesso"
                ? "Perfil atualizado"
                : "Conferir versão atual?"
            }
            message={
              feedback === "sucesso"
                ? "Seus dados foram salvos com sucesso."
                : "Suas alterações locais serão substituídas pela versão salva no servidor somente depois que ela for carregada."
            }
            primaryLabel={feedback === "sucesso" ? "ENTENDI" : "RECARREGAR"}
            secondaryLabel={feedback === "conflito" ? "CONTINUAR" : undefined}
            onClose={() => {
              if (!salvando) setFeedback(null);
            }}
            onPrimary={
              feedback === "conflito" ? () => void conferirVersao() : undefined
            }
            onSecondary={() => setFeedback(null)}
            loading={salvando}
          />
        ) : null}
      </KeyboardAvoidingView>
    </EdicaoCompacta>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  scroll: {
    paddingTop: 18,
  },
  conteudo: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    minWidth: 0,
  },
  identidade: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.6,
  },
  nome: {
    fontSize: 20,
    lineHeight: 27,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 19,
  },
  tipo: {
    fontSize: 11,
    lineHeight: 17,
  },
  tituloGrupo: {
    fontSize: 14,
    lineHeight: 21,
  },
  carregamento: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 12,
  },
  verificacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 13,
    borderRadius: 13,
  },
  localizacao: {
    flexDirection: "row",
    gap: 12,
  },
  cidade: {
    flex: 1,
    minWidth: 0,
  },
  uf: {
    width: 76,
  },
});
