import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SearchBar from "@/components/ui/SearchBar";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarClientesDoAno,
  type ClienteClippingAno,
} from "@/services/api/clipping";
import { criarCliente } from "@/services/api/cliente";
import {
  MAX_CNPJ_CLIENTE,
  MAX_EMAIL_CLIENTE,
  MAX_NOME_CLIENTE,
  MAX_TELEFONE_CLIENTE,
  validarFormularioCliente,
  type DadosClienteParaValidacao,
  type ErrosCliente,
} from "@/utils/validarCliente";

type ClienteDoSeletor = Pick<
  ClienteClippingAno,
  "id" | "nome" | "ativo"
>;

type BuscarClientes = (params: {
  busca: string;
  page: number;
  limit: number;
}) => Promise<{
  clientes: ClienteDoSeletor[];
  pagination: { has_next: boolean };
}>;

interface ClippingContextoProps {
  clienteId: number | null;
  clienteNome: string;
  ano: number;
  anoPelaData: boolean;
  apenasCliente?: boolean;
  erroCliente?: string;
  erroAno?: string;
  disabled?: boolean;
  buscarClientes?: BuscarClientes;
  onCliente: (cliente: ClienteDoSeletor) => void;
  onAno?: (ano: number) => void;
  clienteAlterado?: boolean;
  anoAlterado?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function ClippingContexto({
  clienteId,
  clienteNome,
  ano,
  anoPelaData,
  erroCliente,
  clienteAlterado = false,
  anoAlterado = false,
  erroAno,
  disabled = false,
  buscarClientes,
  onCliente,
  onAno,
  apenasCliente = false,
  style,
}: ClippingContextoProps) {
  const { theme } = useTheme();

  const [painel, setPainel] = useState<"cliente" | "ano" | null>(
    null
  );

  const anoValido =
    Number.isInteger(ano) && ano >= 1000 && ano <= 9999;

  function abrir(tipo: "cliente" | "ano") {
    Keyboard.dismiss();
    setPainel(tipo);
  }

  function fechar() {
    Keyboard.dismiss();
    setPainel(null);
  }

  return (
    <View style={[styles.contexto, style]}>
      <CampoContexto
        label="CLIENTE"
        value={
          clienteId !== null
            ? clienteNome || `Cliente #${clienteId}`
            : "Selecione o cliente"
        }
        action={clienteId !== null ? "Alterar" : "Selecionar"}
        disabled={disabled || (!apenasCliente && !anoValido)}        
        error={erroCliente}
        onPress={() => abrir("cliente")}
        showChanged={clienteAlterado}
        
      />

      {!apenasCliente ? (
        <>
          <CampoContexto
            label="ANO DE REFERÊNCIA"
            value={anoValido ? String(ano) : "Defina o ano"}
            action={anoPelaData ? "Pela data" : "Alterar"}
            disabled={disabled || anoPelaData}
            error={erroAno}
            onPress={() => abrir("ano")}
            showChanged={anoAlterado}
          />

          <Text style={[styles.ajuda, { color: theme.textoSub }]}>
            {!anoValido
              ? "Defina um ano válido para selecionar o cliente."
              : anoPelaData
                ? `O clipping será agrupado em ${ano}, conforme a data da publicação.`
                : `Sem data de publicação, o clipping ficará em ${ano}.`}
          </Text>
        </>
      ) : null}

      {painel === "cliente" ? (
        <PainelClientes
          key={ano}
          ano={ano}
          selecionado={clienteId}
          buscarClientes={buscarClientes}
          onClose={fechar}
          onSelecionar={(cliente) => {
            onCliente(cliente);
            fechar();
          }}
        />
      ) : null}

      {!apenasCliente && painel === "ano" ? (
        <PainelAno
          ano={ano}
          onClose={fechar}
          onAplicar={(novoAno) => {
            onAno?.(novoAno);
            fechar();
          }}
        />
      ) : null}
    </View>
  );
}

function CampoContexto({
  label,
  value,
  action,
  disabled,
  error,
  onPress,
  
  showChanged = false,
}: {
  label: string;
  value: string;
  action: string;
  disabled: boolean;
  error?: string;
  onPress: () => void;
  showChanged?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.campo,
          {
            borderColor: error ? "#EF4444" : theme.borda,
            backgroundColor: theme.background,
          },
        ]}
      >
        <View style={styles.campoInfo}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Text
              style={[
                styles.label,
                {
                  color: theme.textoSub,
                  marginBottom: 0,
                },
              ]}
            >
              {label}
            </Text>

            {showChanged ? (
              <Ionicons
                name="create-outline"
                size={15}
                color={theme.primaria}
                accessibilityLabel={`${label}: valor alterado`}
              />
            ) : null}
          </View>

          <Text weight="SemiBold" style={styles.valor}>
            {value}
          </Text>
        </View>

        <Text
          weight="SemiBold"
          style={[
            styles.acaoCampo,
            {
              color: disabled
                ? theme.textoSub
                : theme.textoTerciaria,
            },
          ]}
        >
          {action}
        </Text>
      </TouchableOpacity>

      {error ? <Text style={styles.erro}>{error}</Text> : null}
    </View>
  );
}

function Painel({
  title,
  lista = false,
  onClose,
  children,
}: {
  title: string;
  lista?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.overlay, { paddingTop: insets.top }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar seleção"
        />

        <View
          accessibilityViewIsModal
          style={[
            styles.painel,
            lista && styles.painelLista,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.cabecalho}>
            <Text weight="Bold" style={styles.titulo}>
              {title}
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={onClose}
              style={[
                styles.fechar,
                { backgroundColor: theme.backgroundContainer },
              ]}
            >
              <Ionicons
                name="close"
                size={22}
                color={theme.textoContainer}
              />
            </TouchableOpacity>
          </View>

          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PainelAno({
  ano,
  onClose,
  onAplicar,
}: {
  ano: number;
  onClose: () => void;
  onAplicar: (ano: number) => void;
}) {
  const [valor, setValor] = useState(
    Number.isInteger(ano) ? String(ano) : ""
  );
  const [erro, setErro] = useState("");

  function aplicar() {
    const texto = valor.trim();
    const numero = Number(texto);

    if (
      !/^\d{4}$/.test(texto) ||
      numero < 1000 ||
      numero > 9999
    ) {
      setErro("Informe um ano entre 1000 e 9999.");
      return;
    }

    onAplicar(numero);
  }

  return (
    <Painel title="Ano de referência" onClose={onClose}>
      <Input
        label="ANO"
        value={valor}
        onChangeText={(texto) => {
          setValor(texto);
          setErro("");
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={aplicar}
        placeholder="Ex.: 2026"
        error={erro}
        clearable
        autoFocus
      />

      <Button title="APLICAR ANO" onPress={aplicar} />
    </Painel>
  );
}

type DadosCadastroRapido = Pick<
  DadosClienteParaValidacao,
  "nome" | "cnpj" | "email" | "telefone"
>;

function PainelClientes({
  ano,
  selecionado,
  buscarClientes,
  onClose,
  onSelecionar,
}: {
  ano: number;
  selecionado: number | null;
  buscarClientes?: BuscarClientes;
  onClose: () => void;
  onSelecionar: (cliente: ClienteDoSeletor) => void;
}) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const podeCriar = temPermissao("CLIENTES", "CRIAR");

  const travaCadastro = useRef(false);
  const [cadastro, setCadastro] = useState<DadosCadastroRapido | null>(null);
  const [errosCadastro, setErrosCadastro] = useState<ErrosCliente>({});
  const [erroCadastro, setErroCadastro] = useState("");
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);

  const [busca, setBusca] = useState("");
  const [consulta, setConsulta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [clientes, setClientes] = useState<ClienteDoSeletor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = buscarClientes
          ? await buscarClientes({
              busca: consulta,
              page: pagina,
              limit: 50,
            })
          : await listarClientesDoAno(ano, {
              busca: consulta,
              page: pagina,
              limit: 50,
        });

        if (!ativo) return;

        setClientes((anteriores) => {
          if (pagina === 1) return resposta.clientes;

          const porId = new Map(
            anteriores.map((cliente) => [cliente.id, cliente] as const)
          );

          resposta.clientes.forEach((cliente) => {
            porId.set(cliente.id, cliente);
          });

          return Array.from(porId.values());
        });

        setTemMais(resposta.pagination.has_next);
      } catch (error) {
        if (!ativo) return;

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os clientes."
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [ano, consulta, pagina, tentativa, buscarClientes]);

  function pesquisar(termo = busca) {
    Keyboard.dismiss();

    const texto = termo.trim();

    if (texto === consulta && pagina === 1) return;

    setBusca(termo);
    setConsulta(texto);
    setPagina(1);
    setClientes([]);
    setTemMais(false);
    setErro("");
    setCarregando(true);
  }

  function carregarMais() {
    if (carregando || !temMais) return;

    setCarregando(true);
    setPagina((atual) => atual + 1);
  }

  function tentarNovamente() {
    if (carregando) return;

    setErro("");
    setCarregando(true);
    setTentativa((atual) => atual + 1);
  }

  function alterarCadastro(campo: keyof DadosCadastroRapido, valor: string) {
    setCadastro((atual) => atual ? { ...atual, [campo]: valor } : atual);
    setErrosCadastro((atual) => ({ ...atual, [campo]: undefined }));
    setErroCadastro("");
  }

  function voltarParaBusca() {
    if (travaCadastro.current) return;

    Keyboard.dismiss();
    setCadastro(null);
    setErrosCadastro({});
    setErroCadastro("");
  }

  async function cadastrarCliente() {
    if (!podeCriar || !cadastro || travaCadastro.current) return;

    const dados = {
      nome: cadastro.nome.trim(),
      cnpj: cadastro.cnpj.trim(),
      email: cadastro.email.trim(),
      telefone: cadastro.telefone.trim(),
      site: "",
      cidade: "",
      estado: "",
      descricao: "",
      segmento: "",
      responsavel: "",
    };

    const erros = validarFormularioCliente(dados);
    setErrosCadastro(erros);
    setErroCadastro("");

    if (Object.keys(erros).length > 0) return;

    travaCadastro.current = true;
    setSalvandoCadastro(true);
    Keyboard.dismiss();

    let cliente: ClienteDoSeletor;

    try {
      cliente = await criarCliente({ ...dados, ativo: true });
    } catch (error) {
      setErroCadastro(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o cliente."
      );
      return;
    } finally {
      travaCadastro.current = false;
      setSalvandoCadastro(false);
    }

    onSelecionar(cliente);
  }

  if (cadastro) {
    const cadastroBloqueado = salvandoCadastro || !podeCriar;

    return (
      <Painel title="Novo cliente" onClose={voltarParaBusca}>
        <ScrollView
          style={styles.formularioCadastro}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Input
            label="NOME DO CLIENTE"
            value={cadastro.nome}
            onChangeText={(texto) => alterarCadastro("nome", texto)}
            placeholder="Informe o nome do cliente"
            maxLength={MAX_NOME_CLIENTE}
            autoCapitalize="words"
            editable={!cadastroBloqueado}
            error={errosCadastro.nome}
          />

          <Input
            label="CNPJ (OPCIONAL)"
            value={cadastro.cnpj}
            onChangeText={(texto) => alterarCadastro("cnpj", texto)}
            placeholder="Ex.: 12.345.678/0001-95"
            maxLength={MAX_CNPJ_CLIENTE}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!cadastroBloqueado}
            error={errosCadastro.cnpj}
          />

          <Input
            label="E-MAIL (OPCIONAL)"
            value={cadastro.email}
            onChangeText={(texto) => alterarCadastro("email", texto)}
            placeholder="contato@cliente.com.br"
            maxLength={MAX_EMAIL_CLIENTE}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!cadastroBloqueado}
            error={errosCadastro.email}
          />

          <Input
            label="TELEFONE (OPCIONAL)"
            value={cadastro.telefone}
            onChangeText={(texto) => alterarCadastro("telefone", texto)}
            placeholder="Ex.: (11) 99999-9999"
            maxLength={MAX_TELEFONE_CLIENTE}
            keyboardType="phone-pad"
            editable={!cadastroBloqueado}
            error={errosCadastro.telefone}
            onSubmitEditing={() => void cadastrarCliente()}
          />
        </ScrollView>

        {erroCadastro ? (
          <Text accessibilityRole="alert" style={styles.erro}>
            {erroCadastro}
          </Text>
        ) : null}

        <View style={styles.acoesCadastro}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Voltar à busca"
            disabled={salvandoCadastro}
            onPress={voltarParaBusca}
            style={[
              styles.botaoCadastro,
              {
                backgroundColor: theme.primaria,
                opacity: salvandoCadastro ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back-outline" size={15} color={theme.branco} />
            <Text
              weight="SemiBold"
              style={[styles.textoBotaoCadastro, { color: theme.branco }]}
            >
              VOLTAR À BUSCA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cadastrar e selecionar cliente"
            disabled={cadastroBloqueado}
            onPress={() => void cadastrarCliente()}
            style={[
              styles.botaoCadastro,
              { backgroundColor: theme.primaria, opacity: !podeCriar ? 0.5 : 1 },
            ]}
          >
            {salvandoCadastro ? (
              <ActivityIndicator size="small" color={theme.branco} />
            ) : (
              <Ionicons name="checkmark-outline" size={15} color={theme.branco} />
            )}
            <Text
              weight="SemiBold"
              style={[styles.textoBotaoCadastro, { color: theme.branco }]}
            >
              {salvandoCadastro ? "CADASTRANDO..." : "CADASTRAR"}
            </Text>
          </TouchableOpacity>
        </View>
      </Painel>
    );
  }

  return (
    <Painel title="Selecionar cliente" lista onClose={onClose}>
      <SearchBar
        value={busca}
        onChangeText={setBusca}
        onSearch={() => pesquisar()}
        onClear={() => pesquisar("")}
        placeholder="Buscar cliente..."
      />
      {podeCriar ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            Keyboard.dismiss();
            setCadastro({
              nome: busca.trim(),
              cnpj: "",
              email: "",
              telefone: "",
            });
          }}
          style={styles.atalhoCadastro}
        >
          <Ionicons name="person-add-outline" size={16} color={theme.textoTerciaria} />
          <Text weight="SemiBold" style={{ color: theme.textoTerciaria, fontSize: 13 }}>
            Cadastro rápido de cliente
          </Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        style={styles.lista}
        data={clientes}
        keyExtractor={(cliente) => String(cliente.id)}
        extraData={selecionado}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => {
          const escolhido = item.id === selecionado;

          const corTexto = escolhido
            ? theme.textoContainer
            : theme.texto;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: escolhido }}
              onPress={() => onSelecionar(item)}
              style={[
                styles.cliente,
                {
                  borderColor: theme.borda,
                  backgroundColor: escolhido
                    ? theme.backgroundContainer
                    : theme.background,
                },
              ]}
            >
              <View style={styles.campoInfo}>
                <Text
                  weight="SemiBold"
                  style={[styles.valor, { color: corTexto }]}
                >
                  {item.nome}
                </Text>

                {item.ativo !== 1 ? (
                  <Text
                    style={[styles.label, { color: corTexto }]}
                  >
                    Inativo
                  </Text>
                ) : null}
              </View>

              <Ionicons
                name={
                  escolhido
                    ? "checkmark-circle"
                    : "ellipse-outline"
                }
                size={22}
                color={corTexto}
              />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator
              color={theme.primaria}
              style={styles.carregamento}
            />
          ) : !erro ? (
            <Text
              style={[styles.vazio, { color: theme.textoSub }]}
            >
              {consulta
                ? "Nenhum cliente encontrado para essa busca."
                : buscarClientes
                  ? "Nenhum cliente cadastrado nesta assessoria."
                  : "Nenhum cliente disponível neste ano."}
            </Text>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.rodapeLista}>
            {erro ? (
              <>
                <Text style={styles.erro}>{erro}</Text>
                <Button
                  title="TENTAR NOVAMENTE"
                  size="small"
                  onPress={tentarNovamente}
                />
              </>
            ) : carregando && clientes.length > 0 ? (
              <ActivityIndicator color={theme.primaria} />
            ) : temMais && !carregando ? (
              <Button
                title="CARREGAR MAIS"
                variant="outline"
                size="small"
                onPress={carregarMais}
              />
            ) : null}
          </View>
        }
      />
    </Painel>
  );
}

const styles = StyleSheet.create({
  contexto: {
    gap: 8,
    marginBottom: 20,
  },
  campo: {
    minHeight: 62,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  campoInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
  },
  valor: {
    fontSize: 14,
    lineHeight: 20,
  },
  acaoCampo: {
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 0,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
  },
  erro: {
    color: "#EF4444",
    fontSize: 12,
    lineHeight: 18,
    marginVertical: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  painel: {
    maxHeight: "90%",
    borderTopWidth: 1.5,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },
  painelLista: {
    height: "75%",
  },
  atalhoCadastro: {
    alignSelf: "flex-start",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    marginTop: -6,
  },
  formularioCadastro: {
    flexShrink: 1,
  },
  acoesCadastro: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  botaoCadastro: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  textoBotaoCadastro: {
    flexShrink: 1,
    fontSize: 10,
    textAlign: "center",
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  titulo: {
    flex: 1,
    fontSize: 17,
    lineHeight: 23,
  },
  fechar: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  lista: {
    flex: 1,
  },
  cliente: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  carregamento: {
    marginVertical: 24,
  },
  vazio: {
    paddingVertical: 24,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  rodapeLista: {
    paddingVertical: 8,
    gap: 8,
  },
});