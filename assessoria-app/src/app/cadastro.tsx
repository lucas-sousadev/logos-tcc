import { useRef, useState } from "react";
import { useRouter } from "expo-router";

import AcessoLayout, {
  CampoAcesso,
  MensagemAcesso,
  SecaoAcesso,
} from "@/components/auth/AcessoLayout";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { validarSenha } from "@/utils/validarSenha";
import { cnpjValido } from "@/utils/validarCliente";

const INICIAL = {
  assessoriaNome: "",
  assessoriaEmail: "",
  cnpj: "",
  telefone: "",
  assessorNome: "",
  assessorEmail: "",
  assessorTelefone: "",
  senha: "",
  confirmarSenha: "",
};

type Dados = typeof INICIAL;
type Campo = keyof Dados;
type Erros = Partial<Record<Campo, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarDadosAssessoria(dados: Dados): Erros {
  const erros: Erros = {};

  if (!dados.assessoriaNome.trim()) {
    erros.assessoriaNome =
      "Informe o nome da assessoria.";
  }

  if (!dados.assessorNome.trim()) {
    erros.assessorNome =
      "Informe o nome do assessor.";
  }

  if (
    dados.assessoriaEmail.trim() &&
    !EMAIL.test(dados.assessoriaEmail.trim())
  ) {
    erros.assessoriaEmail =
      "Informe um e-mail válido.";
  }

  if (!dados.assessorEmail.trim()) {
    erros.assessorEmail = "Informe seu e-mail.";
  } else if (!EMAIL.test(dados.assessorEmail.trim())) {
    erros.assessorEmail =
      "Informe um e-mail válido.";
  }

  if (dados.cnpj.trim() && !cnpjValido(dados.cnpj)) {
    erros.cnpj = "Informe um CNPJ válido.";
  }

  for (
    const campo of [
      "telefone",
      "assessorTelefone",
    ] as const
  ) {
    if (
      dados[campo].trim() &&
      !/^\d{10,11}$/.test(
        dados[campo].replace(/\D/g, "")
      )
    ) {
      erros[campo] =
        "O telefone deve possuir 10 ou 11 dígitos.";
    }
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

export default function Cadastro() {
  const router = useRouter();
  const { registerAssessoria } = useAuth();

  const trava = useRef(false);
  const [dados, setDados] = useState(INICIAL);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [carregando, setCarregando] = useState(false);

  function alterar(campo: Campo, valor: string) {
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

  function mostrarErro(mensagem: string) {
    const texto = mensagem.toLowerCase();
    let campo: Campo | undefined;

    if (texto.includes("cnpj")) {
      campo = "cnpj";
    } else if (texto.includes("telefone do assessor")) {
      campo = "assessorTelefone";
    } else if (texto.includes("telefone")) {
      campo = "telefone";
    } else if (texto.includes("e-mail do assessor")) {
      campo = "assessorEmail";
    } else if (texto.includes("e-mail da assessoria")) {
      campo = "assessoriaEmail";
    } else if (
      texto.includes("e-mail") &&
      texto.includes("cadastrado")
    ) {
      campo = "assessorEmail";
    } else if (texto.includes("senha")) {
      campo = "senha";
    }

    if (campo) {
      setErros({ [campo]: mensagem });
    } else {
      setErroGeral(mensagem);
    }
  }

  async function cadastrar() {
    if (trava.current) return;

    setErroGeral("");

    const novosErros = validarDadosAssessoria(dados);
    setErros(novosErros);

    if (Object.keys(novosErros).length) return;

    trava.current = true;
    setCarregando(true);

    try {
      await registerAssessoria({
        assessoria_nome: dados.assessoriaNome.trim(),
        assessoria_email: dados.assessoriaEmail.trim(),
        cnpj: dados.cnpj.trim(),
        telefone: dados.telefone.trim(),
        assessor_nome: dados.assessorNome.trim(),
        assessor_email: dados.assessorEmail.trim(),
        assessor_telefone:
          dados.assessorTelefone.trim(),
        senha: dados.senha,
      });
    } catch (error) {
      mostrarErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a assessoria."
      );
    } finally {
      trava.current = false;
      setCarregando(false);
    }
  }

  return (
    <AcessoLayout
      titulo="Crie sua assessoria"
      descricao="Cadastre a assessoria e seu perfil de assessor. Os campos com * são obrigatórios."
      ocupado={carregando}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/entrar");
      }}
    >
      <SecaoAcesso
        titulo="Sua assessoria"
        descricao="Informações da organização."
        icone="business-outline"
      >
        <CampoAcesso
          label="Nome da assessoria *"
          placeholder="Nome da assessoria"
          value={dados.assessoriaNome}
          onChangeText={(v) =>
            alterar("assessoriaNome", v)
          }
          error={erros.assessoriaNome}
          editable={!carregando}
          autoCapitalize="words"
          clearable
        />

        <CampoAcesso
          label="E-mail da assessoria"
          placeholder="contato@assessoria.com.br"
          value={dados.assessoriaEmail}
          onChangeText={(v) =>
            alterar("assessoriaEmail", v)
          }
          error={erros.assessoriaEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!carregando}
          clearable
        />

        <CampoAcesso
          label="CNPJ"
          placeholder="00.000.000/0000-00"
          value={dados.cnpj}
          onChangeText={(v) => alterar("cnpj", v)}
          error={erros.cnpj}
          keyboardType="numeric"
          editable={!carregando}
          clearable
        />

        <CampoAcesso
          label="Telefone da assessoria"
          placeholder="DDD + número"
          value={dados.telefone}
          onChangeText={(v) => alterar("telefone", v)}
          error={erros.telefone}
          keyboardType="phone-pad"
          editable={!carregando}
          clearable
        />
      </SecaoAcesso>

      <SecaoAcesso
        titulo="Seu perfil"
        descricao="Dados do assessor responsável."
        icone="person-outline"
      >
        <CampoAcesso
          label="Seu nome *"
          placeholder="Nome completo"
          value={dados.assessorNome}
          onChangeText={(v) => alterar("assessorNome", v)}
          error={erros.assessorNome}
          autoCapitalize="words"
          editable={!carregando}
          clearable
        />

        <CampoAcesso
          label="Seu e-mail *"
          placeholder="voce@exemplo.com.br"
          value={dados.assessorEmail}
          onChangeText={(v) =>
            alterar("assessorEmail", v)
          }
          error={erros.assessorEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!carregando}
          clearable
        />

        <CampoAcesso
          label="Seu telefone"
          placeholder="DDD + número"
          value={dados.assessorTelefone}
          onChangeText={(v) =>
            alterar("assessorTelefone", v)
          }
          error={erros.assessorTelefone}
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

      <Button
        title="CRIAR ASSESSORIA"
        icon="add-outline"
        size="large"
        loading={carregando}
        onPress={() => void cadastrar()}
      />
    </AcessoLayout>
  );
}