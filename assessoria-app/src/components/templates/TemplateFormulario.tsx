import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import { useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ReleaseConteudoEditor from "@/components/releases/ReleaseConteudoEditor";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ErroApiRelease,
  type TemplateRelease,
} from "@/services/api/release";
import { salvarTemplate } from "@/services/api/template";

interface Props {
  modelo: TemplateRelease | null;
  editar: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function TemplateFormulario({
  modelo,
  editar,
  onClose,
  onSaved,
}: Props) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const navigation = useNavigation();

  const scroll = useRef<ScrollView>(null);
  const conteudo = useRef<View>(null);
  const trava = useRef(false);
  const acaoSaida = useRef<NavigationAction | null>(null);

  const [nome, setNome] = useState(
    modelo
      ? editar
        ? modelo.nome
        : ("Cópia de " + modelo.nome).slice(0, 150)
      : ""
  );

  const [blocos, setBlocos] = useState(
    () => modelo?.blocos.map((b) => ({ ...b })) ?? []
  );

  const inicial = useRef(JSON.stringify({ nome, blocos }));

  const [salvando, setSalvando] = useState(false);
  const [imagemOcupada, setImagemOcupada] = useState(false);
  const [avisoSaida, setAvisoSaida] = useState(false);
  const [erro, setErro] = useState("");
  const [desatualizado, setDesatualizado] = useState(false);

  const permitido = temPermissao(
    "TEMPLATES",
    editar ? "EDITAR" : "CRIAR"
  );

  const bloqueado = salvando || imagemOcupada || !permitido;

  const sujo =
    JSON.stringify({ nome, blocos }) !== inicial.current ||
    (!editar && modelo !== null);

  usePreventRemove(
    sujo || salvando || imagemOcupada,
    ({ data }) => {
      if (
        trava.current ||
        imagemOcupada ||
        acaoSaida.current
      ) {
        return;
      }

      acaoSaida.current = data.action;
      Keyboard.dismiss();
      setAvisoSaida(true);
    }
  );

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      (!sujo && !salvando && !imagemOcupada)
    ) {
      return;
    }

    const impedir = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };

    window.addEventListener("beforeunload", impedir);

    return () => {
      window.removeEventListener("beforeunload", impedir);
    };
  }, [sujo, salvando, imagemOcupada]);

  function sair() {
    if (trava.current || imagemOcupada) return;

    Keyboard.dismiss();

    if (sujo) {
      setAvisoSaida(true);
    } else {
      onClose();
    }
  }

  function continuar() {
    acaoSaida.current = null;
    setAvisoSaida(false);
  }

  function confirmarSaida() {
    const acao = acaoSaida.current;
    continuar();

    if (acao) {
      navigation.dispatch(acao);
    } else {
      onClose();
    }
  }

  function mostrarCampo(campo: TextInput) {
    if (!conteudo.current || bloqueado) return;

    campo.measureLayout(
      conteudo.current,
      (_x, y) => {
        scroll.current?.scrollTo({
          y: Math.max(0, y - 48),
          animated: false,
        });
      },
      () => {}
    );
  }

  async function salvar() {
    if (
      bloqueado ||
      trava.current ||
      desatualizado
    ) {
      return;
    }

    if (!nome.trim()) {
      setErro("Informe o nome do template.");
      return;
    }

    if (!blocos.length) {
      setErro("Adicione pelo menos um bloco ao template.");
      return;
    }

    trava.current = true;
    setSalvando(true);
    setErro("");
    Keyboard.dismiss();

    try {
      await salvarTemplate(
        { nome: nome.trim(), blocos },
        editar && modelo ? modelo : undefined
      );

      onSaved();
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível salvar."
      );

      if (
        falha instanceof ErroApiRelease &&
        [404, 409].includes(falha.status)
      ) {
        setDesatualizado(true);
      }
    } finally {
      trava.current = false;
      setSalvando(false);
    }
  }

  return (
    <View
      style={[
        styles.tela,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title={editar ? "Editar template" : "Novo template"}
        showBackButton
        onBackPress={sair}
      />

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.conteudo}
      >
        <View
          ref={conteudo}
          collapsable={false}
          style={styles.campos}
        >
          <Input
            label="NOME DO TEMPLATE"
            placeholder="Ex.: Release institucional"
            value={nome}
            onChangeText={setNome}
            maxLength={150}
            editable={!bloqueado}
            containerStyle={{ marginBottom: 0 }}
          />

          <Text
            style={{
              color: theme.textoSub,
              fontSize: 12,
            }}
          >
            Este modelo ficará disponível para os próximos
            releases da assessoria.
          </Text>

          <ReleaseConteudoEditor
            blocos={blocos}
            nomeTemplate={nome || "Novo template"}
            contextoImagem="TEMPLATES"
            disabled={bloqueado}
            imagemOcupada={imagemOcupada}
            onImagemOcupadaChange={setImagemOcupada}
            onMostrarCampo={mostrarCampo}
            onChange={(alterar) => {
              if (!trava.current && permitido) {
                setBlocos(alterar);
              }
            }}
          />

          {erro ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: theme.erro }}
            >
              {erro}
            </Text>
          ) : null}

          {desatualizado ? (
            <Text style={{ color: theme.textoSub }}>
              Volte à lista e reabra o template para carregar
              a versão atual.
            </Text>
          ) : null}

          {!permitido ? (
            <Text style={{ color: theme.erro }}>
              Você não possui permissão para salvar.
            </Text>
          ) : null}

          <View style={styles.acoes}>
            <Button
              title="VOLTAR"
              variant="outline"
              disabled={salvando || imagemOcupada}
              onPress={sair}
              style={styles.botao}
            />

            <Button
              title="SALVAR"
              icon="checkmark-outline"
              loading={salvando}
              disabled={bloqueado || desatualizado}
              onPress={() => void salvar()}
              style={styles.botao}
            />
          </View>
        </View>
      </ScrollView>

      <FeedbackAlert
        visible={avisoSaida}
        variant="warning"
        title="Sair sem salvar?"
        message="Se sair agora, você perderá as alterações deste template."
        primaryLabel="SAIR"
        secondaryLabel="CONTINUAR"
        primaryDanger
        onClose={continuar}
        onSecondary={continuar}
        onPrimary={confirmarSaida}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  conteudo: {
    padding: 16,
    paddingBottom: 30,
  },
  campos: {
    gap: 12,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  acoes: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  botao: {
    flex: 1,
  },
});