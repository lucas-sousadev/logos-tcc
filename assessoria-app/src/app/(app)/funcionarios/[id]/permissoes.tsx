import EdicaoCompacta from "@/components/forms/EdicaoCompacta";
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import SalvarAlteracoes from "@/components/forms/SalvarAlteracoes";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import AvatarUsuario from "@/components/perfil/AvatarUsuario";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { ResumoCadastro } from "@/components/ui/DetalhesCadastro";
import { useSaidaFormulario } from "@/hooks/useSaidaFormulario";
import { useRetornoSeguro } from "@/hooks/useNavegacaoModulos";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  buscarFuncionario,
  listarTodasPermissoes,
  listarPermissoesFuncionario,
  atualizarPermissoesFuncionario,
  type Funcionario,
  type Permissao,
} from "@/services/api/auth";

export default function Permissoes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  return (
    <PermissoesFuncionario
      key={[usuario?.assessoria_id, usuario?.id, id].join(":")}
      id={Number(id)}
    />
  );
}

function PermissoesFuncionario({ id }: { id: number }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { temPermissao, carregando: carregandoAuth } = useAuth();
  const podeGerenciar = temPermissao("USUARIOS", "GERENCIAR_PERMISSOES");
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [originais, setOriginais] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const montado = useRef(true);
  const envio = useRef(false);
  const alteracoes =
    selecionadas.filter((item) => !originais.includes(item)).length +
    originais.filter((item) => !selecionadas.includes(item)).length;
  const saida = useSaidaFormulario(alteracoes > 0, salvando);
  const retornar = useRetornoSeguro({
    pathname: "/funcionarios/[id]",
    params: { id: String(id) },
  });

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (carregandoAuth || !podeGerenciar) return;
    const controller = new AbortController();
    let ativo = true;
    const timer = setTimeout(() => controller.abort(), 15000);

    async function carregar() {
      setCarregando(true);
      setErro("");
      setFuncionario(null);
      try {
        if (!Number.isSafeInteger(id) || id <= 0)
          throw new Error("Funcionário não encontrado.");
        const [pessoa, todas, atuais] = await Promise.all([
          buscarFuncionario(id, controller.signal),
          listarTodasPermissoes(controller.signal),
          listarPermissoesFuncionario(id, controller.signal),
        ]);
        if (!ativo) return;
        setFuncionario(pessoa);
        setPermissoes(todas);
        setSelecionadas(atuais.map((item) => item.id));
        setOriginais(atuais.map((item) => item.id));
      } catch (error) {
        if (ativo)
          setErro(
            controller.signal.aborted
              ? "A consulta demorou mais que o esperado. Tente novamente."
              : error instanceof Error
                ? error.message
                : "Não foi possível carregar as permissões."
          );
      } finally {
        clearTimeout(timer);
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [carregandoAuth, podeGerenciar, id, tentativa]);

  function bloqueada(permissao: Permissao) {
    return (
      permissao.acao !== "VISUALIZAR" &&
      !permissoes.some(
        (item) =>
          item.modulo === permissao.modulo &&
          item.acao === "VISUALIZAR" &&
          selecionadas.includes(item.id)
      )
    );
  }

  function alternar(permissao: Permissao) {
    if (envio.current || !podeGerenciar || bloqueada(permissao)) return;
    setSelecionadas((atuais) => {
      if (!atuais.includes(permissao.id)) return [...atuais, permissao.id];
      return atuais.filter(
        (item) =>
          item !== permissao.id &&
          (permissao.acao !== "VISUALIZAR" ||
            !permissoes.some(
              (outra) => outra.id === item && outra.modulo === permissao.modulo
            ))
      );
    });
  }

  async function salvar() {
    if (envio.current || !podeGerenciar || !funcionario || !alteracoes) return;
    envio.current = true;
    setSalvando(true);
    setErro("");
    const ids = [...selecionadas];
    try {
      await atualizarPermissoesFuncionario(id, ids);
      if (!montado.current) return;
      setOriginais(ids);
      setFeedback("As permissões do funcionário foram atualizadas.");
    } catch (error) {
      if (montado.current)
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar as permissões."
        );
    } finally {
      envio.current = false;
      if (montado.current) setSalvando(false);
    }
  }

  const grupos = Object.entries(
    permissoes.reduce<Record<string, Permissao[]>>((todos, item) => {
      (todos[item.modulo] ??= []).push(item);
      return todos;
    }, {})
  );

  return (
    <EdicaoCompacta ativa={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <Header
          title="Permissões"
          showBackButton
          showSettings={false}
          onBackPress={retornar}
        />
        {carregandoAuth || (podeGerenciar && carregando) ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primaria} />
          </View>
        ) : !podeGerenciar ? (
          <View style={styles.center}>
            <Text weight="Bold">Acesso restrito</Text>
            <Text style={[styles.mensagem, { color: theme.textoSub }]}>
              Você não possui permissão para gerenciar permissões.
            </Text>
          </View>
        ) : !funcionario ? (
          <View style={styles.center}>
            <Text style={[styles.mensagem, { color: theme.textoSub }]}>
              {erro}
            </Text>
            <Button
              title="TENTAR NOVAMENTE"
              variant="outline"
              onPress={() => setTentativa((atual) => atual + 1)}
            />
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              automaticallyAdjustKeyboardInsets={false}
              contentContainerStyle={[
                styles.content,
                {
                  paddingBottom: 24 + insets.bottom,
                  paddingLeft: 16 + insets.left,
                  paddingRight: 16 + insets.right,
                },
              ]}
            >
              <ResumoCadastro
                nome={funcionario.nome}
                categoria="PERMISSÕES DO COLABORADOR"
                ativo={Number(funcionario.ativo) === 1}
                avatar={<AvatarUsuario usuario={funcionario} tamanho={48} />}
              />
              <View style={styles.introducao}>
                <Text weight="Bold" style={styles.titulo}>
                  Acessos por módulo
                </Text>
                <Text style={[styles.descricao, { color: theme.textoSub }]}>
                  Escolha o que o funcionário pode fazer. Habilite Visualizar
                  para liberar as demais ações de cada módulo.
                </Text>
                <View
                  style={[
                    styles.contagem,
                    { backgroundColor: theme.primaria + "0D" },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color={theme.textoTerciaria}
                  />
                  <Text
                    weight="SemiBold"
                    style={[
                      styles.contagemTexto,
                      { color: theme.textoTerciaria },
                    ]}
                  >
                    {selecionadas.length}{" "}
                    {selecionadas.length === 1
                      ? "permissão habilitada"
                      : "permissões habilitadas"}
                  </Text>
                </View>
              </View>
              {grupos.map(([modulo, lista]) => (
                <View
                  key={modulo}
                  style={[
                    styles.modulo,
                    {
                      backgroundColor: theme.backgroundSecundario,
                      borderColor: theme.borda + "40",
                    },
                  ]}
                >
                  <View style={styles.moduloHeader}>
                    <View
                      style={[
                        styles.moduloIcone,
                        { backgroundColor: theme.primaria + "0D" },
                      ]}
                    >
                      <Ionicons
                        name={obterIconeModulo(modulo)}
                        size={20}
                        color={theme.textoTerciaria}
                      />
                    </View>
                    <Text weight="SemiBold" style={styles.moduloTitulo}>
                      {NOMES_MODULOS[modulo] ?? formatarNome(modulo)}
                    </Text>
                    <Text
                      weight="Medium"
                      style={[styles.proporcao, { color: theme.textoSub }]}
                    >
                      {
                        lista.filter((item) => selecionadas.includes(item.id))
                          .length
                      }
                      /{lista.length}
                    </Text>
                  </View>
                  {lista.map((permissao) => {
                    const marcada = selecionadas.includes(permissao.id);
                    const impedida = bloqueada(permissao);
                    const mudou = marcada !== originais.includes(permissao.id);
                    const cor = marcada ? theme.alteracao : "#EF4444";
                    return (
                      <TouchableOpacity
                        key={permissao.id}
                        accessibilityRole="checkbox"
                        aria-checked={marcada}
                        aria-disabled={impedida || salvando}
                        accessibilityLabel={
                          formatarNome(permissao.acao) +
                          ": " +
                          (NOMES_MODULOS[modulo] ?? modulo)
                        }
                        accessibilityState={{
                          checked: marcada,
                          disabled: impedida || salvando,
                        }}
                        disabled={impedida || salvando}
                        activeOpacity={0.7}
                        onPress={() => alternar(permissao)}
                        style={[
                          styles.permissao,
                          { borderTopColor: theme.borda + "20" },
                        ]}
                      >
                        <View style={styles.permissaoConteudo}>
                          <View style={styles.acaoLinha}>
                            <Text
                              weight="SemiBold"
                              style={[
                                styles.acao,
                                {
                                  color: impedida
                                    ? theme.textoSub
                                    : theme.texto,
                                },
                              ]}
                            >
                              {formatarNome(permissao.acao)}
                            </Text>
                            {impedida && (
                              <Ionicons
                                name="lock-closed-outline"
                                size={12}
                                color={theme.textoSub}
                              />
                            )}
                            {mudou && (
                              <Text
                                weight="Medium"
                                style={[styles.alteracao, { color: cor }]}
                              >
                                {marcada ? "Adicionada" : "Removida"}
                              </Text>
                            )}
                          </View>
                          <Text
                            style={[styles.detalhe, { color: theme.textoSub }]}
                          >
                            {impedida
                              ? "Habilite Visualizar neste módulo."
                              : permissao.descricao ||
                                "Permite esta ação no módulo."}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: marcada
                                ? theme.primaria
                                : theme.borda + "80",
                              backgroundColor: marcada
                                ? theme.primaria
                                : "transparent",
                              opacity: impedida ? 0.5 : 1,
                            },
                          ]}
                        >
                          {marcada && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={theme.branco}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              {!grupos.length && (
                <Text style={[styles.descricao, { color: theme.textoSub }]}>
                  Não há permissões disponíveis para gerenciar.
                </Text>
              )}
              {erro ? (
                <Text
                  accessibilityRole="alert"
                  style={[styles.descricao, { color: "#EF4444" }]}
                >
                  {erro}
                </Text>
              ) : null}
              {alteracoes > 0 && (
                <View
                  style={[
                    styles.pendencias,
                    { backgroundColor: theme.primaria + "0A" },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={17}
                    color={theme.textoTerciaria}
                  />
                  <Text
                    style={[
                      styles.pendenciasTexto,
                      { color: theme.textoTerciaria },
                    ]}
                  >
                    {alteracoes}{" "}
                    {alteracoes === 1
                      ? "alteração pendente"
                      : "alterações pendentes"}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Descartar alterações"
                    disabled={salvando}
                    onPress={() => {
                      setSelecionadas([...originais]);
                      setErro("");
                    }}
                  >
                    <Text
                      weight="SemiBold"
                      style={[
                        styles.contagemTexto,
                        { color: theme.textoTerciaria },
                      ]}
                    >
                      Desfazer
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
            <SalvarAlteracoes
              alterations={alteracoes}
              saving={salvando}
              error={erro}
              onSave={() => void salvar()}
              onDiscard={retornar}
            />
          </>
        )}
        <FeedbackAlert {...saida.alertaProps} />
        <FeedbackAlert
          visible={!!feedback}
          variant="success"
          title="Permissões salvas"
          message={feedback ?? ""}
          onClose={() => setFeedback(null)}
        />
      </KeyboardAvoidingView>
    </EdicaoCompacta>
  );
}

const NOMES_MODULOS: Record<string, string> = {
  MAILING: "Mailing",
  CLIENTES: "Clientes",
  VEICULOS: "Veículos",
  RELEASES: "Releases",
  TEMPLATES: "Templates",
  CLIPPING: "Clipping",
  RELATORIOS: "Relatórios",
  AUDITORIA: "Auditoria",
  USUARIOS: "Funcionários",
  CONVITES: "Convites",
};

function formatarNome(valor: string) {
  const nomes: Record<string, string> = {
    VISUALIZAR: "Visualizar",
    CRIAR: "Criar",
    EDITAR: "Editar",
    EXCLUIR: "Excluir",
    GERENCIAR_PERMISSOES: "Gerenciar permissões",
    IMPORTAR: "Importar",
    EXPORTAR: "Exportar",
  };
  return (
    nomes[valor] ??
    valor
      .toLocaleLowerCase("pt-BR")
      .replace(/_/g, " ")
      .replace(/^./, (letra) => letra.toLocaleUpperCase("pt-BR"))
  );
}

function obterIconeModulo(
  modulo: string
): ComponentProps<typeof Ionicons>["name"] {
  const icones: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
    MAILING: "people-outline",
    CLIENTES: "business-outline",
    VEICULOS: "radio-outline",
    RELEASES: "paper-plane-outline",
    TEMPLATES: "layers-outline",
    CLIPPING: "document-text-outline",
    RELATORIOS: "bar-chart-outline",
    AUDITORIA: "shield-checkmark-outline",
    USUARIOS: "people-outline",
    CONVITES: "mail-outline",
  };
  return icones[modulo] ?? "apps-outline";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  mensagem: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingTop: 16,
    gap: 12,
  },
  introducao: {
    gap: 8,
    paddingVertical: 4,
  },
  titulo: {
    fontSize: 17,
    lineHeight: 24,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 19,
  },
  contagem: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  contagemTexto: {
    fontSize: 11,
    lineHeight: 16,
  },
  modulo: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  moduloHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  moduloIcone: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  moduloTitulo: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
  },
  proporcao: {
    fontSize: 11,
  },
  permissao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    minHeight: 64,
  },
  permissaoConteudo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  acaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  acao: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  alteracao: {
    fontSize: 10,
    lineHeight: 16,
  },
  detalhe: {
    fontSize: 11,
    lineHeight: 17,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderWidth: 1,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pendencias: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
  },
  pendenciasTexto: {
    flex: 1,
    minWidth: 100,
    fontSize: 11,
    lineHeight: 17,
  },
});
