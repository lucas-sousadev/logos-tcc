import { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import { useRouter } from "expo-router";

import AcessoLayout, {
  CampoAcesso,
  MensagemAcesso,
  SecaoAcesso,
} from "@/components/auth/AcessoLayout";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  perfil: "ASSESSOR" | "FUNCIONARIO";
}

export default function LoginFormulario({
  perfil,
}: Props) {
  const router = useRouter();
  const { login } = useAuth();
  const { theme } = useTheme();

  const assessor = perfil === "ASSESSOR";
  const trava = useRef(false);
  const senhaRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [erros, setErros] = useState<{
    email?: string;
    senha?: string;
  }>({});

  async function entrar() {
    if (trava.current) return;

    setErro("");

    const novosErros: typeof erros = {};

    if (!email.trim()) {
      novosErros.email = "Informe seu e-mail.";
    }

    if (!senha) {
      novosErros.senha = "Informe sua senha.";
    }

    setErros(novosErros);

    if (Object.keys(novosErros).length) return;

    trava.current = true;
    setCarregando(true);

    try {
      await login(
        email.trim(),
        senha,
        perfil
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar. Tente novamente."
      );
    } finally {
      trava.current = false;
      setCarregando(false);
    }
  }

  function voltar() {
    if (trava.current) return;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/entrar");
    }
  }

  return (
    <AcessoLayout
      titulo={
        assessor
          ? "Entre na sua assessoria"
          : "Entre na sua equipe"
      }
      descricao={
        assessor
          ? "Use sua conta de assessor para continuar no LOGOS."
          : "Entre com sua conta de colaborador para continuar no LOGOS."
      }
      onBack={voltar}
      ocupado={carregando}
    >
      <SecaoAcesso
        titulo="Faça seu login"
        icone={
          assessor
            ? "business-outline"
            : "people-outline"
        }
      >
        <CampoAcesso
          label="E-mail"
          placeholder="voce@exemplo.com.br"
          value={email}
          onChangeText={(valor) => {
            setEmail(valor);

            setErros((atuais) => ({
              ...atuais,
              email: undefined,
            }));

            setErro("");
          }}
          error={erros.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() =>
            senhaRef.current?.focus()
          }
          editable={!carregando}
          clearable
        />

        <CampoAcesso
          inputRef={senhaRef}
          label="Senha"
          placeholder="Sua senha"
          value={senha}
          onChangeText={(valor) => {
            setSenha(valor);

            setErros((atuais) => ({
              ...atuais,
              senha: undefined,
            }));

            setErro("");
          }}
          error={erros.senha}
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void entrar()}
          editable={!carregando}
        />
      </SecaoAcesso>

      <MensagemAcesso mensagem={erro} />

      <Button
        title="ENTRAR"
        icon="log-in-outline"
        size="large"
        loading={carregando}
        onPress={() => void entrar()}
      />

      <View
        style={[
          styles.cadastro,
          {
            borderTopColor: theme.borda + "25",
          },
        ]}
      >
        <Text
          style={[
            styles.legenda,
            { color: theme.textoSub },
          ]}
        >
          {assessor
            ? "Sua assessoria ainda não está no LOGOS?"
            : "Recebeu um convite e ainda não tem conta?"}
        </Text>

        <Button
          title={
            assessor
              ? "CRIAR ASSESSORIA"
              : "USAR MEU CONVITE"
          }
          variant="outline"
          icon={
            assessor
              ? "add-outline"
              : "mail-open-outline"
          }
          disabled={carregando}
          onPress={() =>
            router.push(
              assessor
                ? "/cadastro"
                : "/cadastro-funcionario"
            )
          }
        />
      </View>
    </AcessoLayout>
  );
}

const styles = StyleSheet.create({
  cadastro: {
    marginTop: 6,
    paddingTop: 18,
    borderTopWidth: 1,
    gap: 10,
  },
  legenda: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
});