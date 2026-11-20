import { useCallback, useRef, useState } from "react";
import { BackHandler, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import AcessoLayout, {
  CampoAcesso,
  MensagemAcesso,
  SecaoAcesso,
} from "@/components/auth/AcessoLayout";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { validarSenha } from "@/utils/validarSenha";

const INICIAL = {
  nome: "",
  email: "",
  telefone: "",
  senha: "",
  confirmarSenha: "",
};

type Dados = typeof INICIAL;
type Campo = keyof Dados | "codigo";
type Erros = Partial<Record<Campo, string>>;

function validarDadosFuncionario(dados: Dados): Erros {
  const erros: Erros = {};

  if (!dados.nome.trim()) {
    erros.nome = "Informe seu nome.";
  }

  if (!dados.email.trim()) {
    erros.email = "Informe seu e-mail.";
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      dados.email.trim()
    )
  ) {
    erros.email = "Informe um e-mail válido.";
  }

  if (
    dados.telefone.trim() &&
    !/^\d{10,11}$/.test(
      dados.telefone.replace(/\D/g, "")
    )
  ) {
    erros.telefone =
      "O telefone deve possuir 10 ou 11 dígitos.";
  }

  const erroSenha = dados.senha
    ? validarSenha(dados.senha)
    : "Informe uma senha.";

  if (erroSenha) erros.senha = erroSenha;

  if (!dados.confirmarSenha) {
    erros.confirmarSenha = "Confirme sua senha.";
  } else if (dados.senha !== dados.confirmarSenha) {
    erros.confirmarSenha =
      "As senhas não coincidem.";
  }

  return erros;
}

export default function CadastroFuncionario() {
  const router = useRouter();
  const {
    validarConvite,
    registerFuncionario,
  } = useAuth();

  const trava = useRef(false);

  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [codigo, setCodigo] = useState("");
  const [dados, setDados] = useState(INICIAL);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [carregando, setCarregando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (etapa !== 2 && !carregando) return;

      const evento = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (!trava.current) {
            setErroGeral("");
            setEtapa(1);
          }

          return true;
        }
      );

      return () => evento.remove();
    }, [etapa, carregando])
  );

  function alterar(
    campo: keyof Dados,
    valor: string
  ) {
    setDados((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    setErros((atuais) => ({
      ...atuais,
      [campo]: undefined,
      ...(campo === "senha"
        ? { confirmarSenha: undefined }
        : {}),
    }));

    setErroGeral("");
  }

  async function validarCodigo() {
    if (trava.current || etapa !== 1) return;

    setErroGeral("");
    setErros({});

    const valor = codigo.trim().toUpperCase();

    if (!valor) {
      setErros({
        codigo: "Digite o código do convite.",
      });
      return;
    }

    trava.current = true;
    setCarregando(true);

    try {
      await validarConvite(valor);
      setCodigo(valor);
      setEtapa(2);
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível validar o convite.";

      if (
        mensagem
          .toLowerCase()
          .includes("muitas tentativas")
      ) {
        setErroGeral(mensagem);
      } else {
        setErros({ codigo: mensagem });
      }
    } finally {
      trava.current = false;
      setCarregando(false);
    }
  }

  async function cadastrar() {
    if (trava.current || etapa !== 2) return;

    setErroGeral("");

    const novosErros = validarDadosFuncionario(dados);
    setErros(novosErros);

    if (Object.keys(novosErros).length) return;

    trava.current = true;
    setCarregando(true);

    try {
      await registerFuncionario({
        codigo: codigo.trim().toUpperCase(),
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        telefone: dados.telefone.trim(),
        senha: dados.senha,
      });
    } catch (error) {
      setErroGeral(
        error instanceof Error
          ? error.message
          : "Não foi possível criar sua conta."
      );
    } finally {
      trava.current = false;
      setCarregando(false);
    }
  }

  function voltar() {
    if (trava.current) return;

    setErroGeral("");

    if (etapa === 2) {
      setEtapa(1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/entrar");
    }
  }

  return (
    <AcessoLayout
      titulo={
        etapa === 1
          ? "Faça parte da equipe"
          : "Crie sua conta"
      }
      descricao={
        etapa === 1
          ? "Informe o convite recebido para se vincular à sua assessoria."
          : "Convite validado. Preencha seus dados para concluir o cadastro. Os campos com * são obrigatórios."
      }
      ocupado={carregando}
      onBack={voltar}
    >
      {etapa === 1 ? (
        <>
          <SecaoAcesso
            titulo="Seu convite"
            descricao="Etapa 1 de 2"
            icone="mail-open-outline"
          >
            <CampoAcesso
              label="Código do convite"
              placeholder="Digite seu código"
              value={codigo}
              onChangeText={(v) => {
                setCodigo(v.toUpperCase());
                setErros({});
                setErroGeral("");
              }}
              error={erros.codigo}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!carregando}
              clearable
              returnKeyType="go"
              onSubmitEditing={() =>
                void validarCodigo()
              }
            />
          </SecaoAcesso>

          <MensagemAcesso mensagem={erroGeral} />

          <Button
            title="VALIDAR CONVITE"
            icon="arrow-forward-outline"
            size="large"
            loading={carregando}
            onPress={() => void validarCodigo()}
          />
        </>
      ) : (
        <>
          <SecaoAcesso
            titulo="Seu perfil"
            descricao="Etapa 2 de 2 · Seus dados de acesso."
            icone="person-outline"
          >
            <CampoAcesso
              label="Seu nome *"
              placeholder="Nome completo"
              value={dados.nome}
              onChangeText={(v) => alterar("nome", v)}
              error={erros.nome}
              autoCapitalize="words"
              editable={!carregando}
              clearable
            />

            <CampoAcesso
              label="Seu e-mail *"
              placeholder="voce@exemplo.com.br"
              value={dados.email}
              onChangeText={(v) => alterar("email", v)}
              error={erros.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!carregando}
              clearable
            />

            <CampoAcesso
              label="Seu telefone"
              placeholder="DDD + número"
              value={dados.telefone}
              onChangeText={(v) =>
                alterar("telefone", v)
              }
              error={erros.telefone}
              keyboardType="phone-pad"
              editable={!carregando}
              clearable
            />
          </SecaoAcesso>

          <SecaoAcesso
            titulo="Senha de acesso"
            descricao="Use pelo menos 8 caracteres."
            icone="lock-closed-outline"
          >
            <CampoAcesso
              label="Senha *"
              placeholder="Crie sua senha"
              value={dados.senha}
              onChangeText={(v) => alterar("senha", v)}
              error={erros.senha}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!carregando}
            />

            <CampoAcesso
              label="Confirmar senha *"
              placeholder="Digite a senha novamente"
              value={dados.confirmarSenha}
              onChangeText={(v) =>
                alterar("confirmarSenha", v)
              }
              error={erros.confirmarSenha}
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!carregando}
            />
          </SecaoAcesso>

          <MensagemAcesso mensagem={erroGeral} />

          <View
            style={{
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Button
              title="VOLTAR"
              variant="outline"
              disabled={carregando}
              onPress={voltar}
              style={{
                flex: 1,
                width: "auto",
                minWidth: 0,
              }}
            />

            <Button
              title="CRIAR CONTA"
              icon="checkmark-outline"
              loading={carregando}
              onPress={() => void cadastrar()}
              style={{
                flex: 1,
                width: "auto",
                minWidth: 0,
              }}
            />
          </View>
        </>
      )}
    </AcessoLayout>
  );
}