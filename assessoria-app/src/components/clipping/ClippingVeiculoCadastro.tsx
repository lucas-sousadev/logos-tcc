import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import TierSelector from "@/components/forms/TierSelector";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Tier } from "@/constants/tier";
import {
  criarVeiculo,
  type Veiculo,
} from "@/services/api/veiculo";
import {
  validarFormularioVeiculo,
  type ErrosVeiculo,
} from "@/utils/validarVeiculo";

type ErrosCadastro = ErrosVeiculo & {
  tier?: string;
};

interface ClippingVeiculoCadastroProps {
  nomeInicial: string;
  onClose: () => void;
  onCriado: (veiculo: Veiculo) => void;
}

export default function ClippingVeiculoCadastro({
  nomeInicial,
  onClose,
  onCriado,
}: ClippingVeiculoCadastroProps) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const insets = useSafeAreaInsets();

  const [nome, setNome] = useState(nomeInicial);
  const [descricao, setDescricao] = useState("");
  const [alcance, setAlcance] = useState("");
  const [tier, setTier] = useState<Tier | null>(null);

  const [erros, setErros] = useState<ErrosCadastro>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);

  const trava = useRef(false);
  const podeCriar = temPermissao("VEICULOS", "CRIAR");

  function limparErro(campo: keyof ErrosCadastro) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));
    setErroGeral("");
  }

  function fechar() {
    if (trava.current) return;

    Keyboard.dismiss();
    onClose();
  }

  async function salvar() {
    if (trava.current) return;

    if (!podeCriar) {
      setErroGeral(
        "Você não possui permissão para cadastrar veículos."
      );
      return;
    }

    const validacao: ErrosCadastro =
      validarFormularioVeiculo({
        nome,
        descricao,
        alcance,
        logo_path: "",
      });

    if (tier !== null && ![1, 2, 3].includes(tier)) {
      validacao.tier = "Escolha Tier 1, 2, 3 ou Não definido.";
    }

    setErros(validacao);
    setErroGeral("");

    if (Object.keys(validacao).length > 0) return;

    trava.current = true;
    setSalvando(true);
    Keyboard.dismiss();

    let criado: Veiculo | undefined;

    try {
      criado = await criarVeiculo({
        nome: nome.trim(),
        descricao: descricao.trim(),
        alcance: alcance.trim(),
        tier,
        ativo: true,
      });
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o veículo.";

      const texto = mensagem
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (texto.includes("cadastrado")) {
        setErros({
          nome:
            "Este veículo já está cadastrado. Feche este painel e selecione-o na busca.",
        });
      } else if (texto.includes("nome")) {
        setErros({ nome: mensagem });
      } else if (texto.includes("descricao")) {
        setErros({ descricao: mensagem });
      } else if (texto.includes("alcance")) {
        setErros({ alcance: mensagem });
      } else if (texto.includes("tier")) {
        setErros({ tier: mensagem });
      } else {
        setErroGeral(mensagem);
      }
    } finally {
      trava.current = false;
      setSalvando(false);
    }

    if (criado) {
      onCriado(criado);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={fechar}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={fechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar cadastro de veículo"
          disabled={salvando}
        />

        <View
          accessibilityViewIsModal
          style={[
            styles.painel,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.conteudo}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cabecalho}>
              <Text weight="Bold" style={styles.titulo}>
                Cadastrar veículo
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                disabled={salvando}
                onPress={fechar}
                style={styles.fechar}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.texto}
                />
              </TouchableOpacity>
            </View>

            <Text
              style={[styles.ajuda, { color: theme.textoSub }]}
            >
              Ao cadastrar e usar, o veículo ficará disponível no
              módulo Veículos e será selecionado neste clipping.
            </Text>

            <Input
              label="NOME"
              value={nome}
              onChangeText={(texto) => {
                setNome(texto);
                limparErro("nome");
              }}
              editable={!salvando}
              autoCapitalize="words"
              error={erros.nome}
              placeholder="Nome do veículo"
            />

            <Input
              label="DESCRIÇÃO"
              value={descricao}
              onChangeText={(texto) => {
                setDescricao(texto);
                limparErro("descricao");
              }}
              editable={!salvando}
              error={erros.descricao}
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              placeholder="Detalhes do veículo"
            />

            <Input
              label="ALCANCE"
              value={alcance}
              onChangeText={(texto) => {
                setAlcance(texto);
                limparErro("alcance");
              }}
              editable={!salvando}
              error={erros.alcance}
              multiline
              textAlignVertical="top"
              style={styles.textArea}
              placeholder="Redes sociais, seguidores e outras informações"
            />

            <TierSelector
              value={tier}
              onChange={(valor) => {
                setTier(valor);
                limparErro("tier");
              }}
              disabled={salvando}
            />

            {erros.tier ? (
              <Text style={styles.erro}>{erros.tier}</Text>
            ) : null}

            {erroGeral ? (
              <Text
                accessibilityRole="alert"
                style={styles.erro}
              >
                {erroGeral}
              </Text>
            ) : null}

            {!podeCriar ? (
              <Text style={styles.erro}>
                Você não possui permissão para cadastrar veículos.
              </Text>
            ) : null}

            <Button
              title="CADASTRAR E USAR"
              onPress={() => void salvar()}
              loading={salvando}
              disabled={!podeCriar}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  painel: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "100%",
    borderWidth: 1.5,
    borderRadius: 18,
    overflow: "hidden",
  },
  scroll: {
    flexGrow: 0,
  },
  conteudo: {
    padding: 16,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  titulo: {
    flex: 1,
    fontSize: 17,
  },
  fechar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  erro: {
    color: "#EF4444",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
});