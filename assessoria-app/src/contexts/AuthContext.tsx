import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  clearSession,
  getToken,
  login as authLogin,
  logout as authLogout,
  me,
  registerAssessoria as authRegisterAssessoria,
  registerFuncionario as authRegisterFuncionario,
  validarConvite as authValidarConvite,
  criarConvite as authCriarConvite,
  CriarConviteResponse,
  listarConvites as authListarConvites,
  RegisterAssessoriaData,
  RegisterFuncionarioData,
  Usuario,
  LoginResponse,
  Convite,
  ListarConvitesResponse,
} from "../services/auth";

interface AuthContextData {
  usuario: Usuario | null;
  carregando: boolean;
  autenticado: boolean;
  login: (
  email: string,
  senha: string,
  perfilEsperado?: Usuario["perfil"]
) => Promise<void>;

  registerAssessoria: (
    dados: RegisterAssessoriaData
  ) => Promise<LoginResponse>;

  logout: () => Promise<void>;

  validarConvite: (
    codigo: string
  ) => Promise<Convite>;
  
  criarConvite: (
  emailDestino?: string
) => Promise<CriarConviteResponse>;

  listarConvites: (
  page?: number,
  limit?: number
) => Promise<ListarConvitesResponse>;

  
  registerFuncionario: (
    dados: RegisterFuncionarioData
  ) => Promise<LoginResponse>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarSessao() {
      try {
        const token = await getToken();

        if (!token) {
          return;
        }

        const usuarioAtual = await me();

        setUsuario(usuarioAtual);
      } catch (error) {
        console.error("Erro ao restaurar sessão:", error);

        await clearSession();
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    }

    carregarSessao();
  }, []);

  async function login(
    email: string,
    senha: string,
    perfilEsperado?: Usuario["perfil"]
  ): Promise<void> {
    const resposta = await authLogin(
      email,
      senha
    );

    if (!resposta.usuario) {
      throw new Error(
        "A API não retornou o usuário."
      );
    }

    if (
      perfilEsperado &&
      resposta.usuario.perfil !== perfilEsperado
    ) {
      await authLogout();

      throw new Error(
        "Esta conta não pertence a este tipo de acesso."
      );
    }

    setUsuario(resposta.usuario);
  }

  async function registerAssessoria(
    dados: RegisterAssessoriaData
  ): Promise<LoginResponse> {
    const resposta = await authRegisterAssessoria(dados);

    if (!resposta.usuario) {
      throw new Error("A API não retornou o usuário.");
    }

    setUsuario(resposta.usuario);

    return resposta;
  }

  async function logout(): Promise<void> {
    await authLogout();
    setUsuario(null);
  }

  async function validarConvite(
  codigo: string
): Promise<Convite> {
  return await authValidarConvite(codigo);
}

  async function criarConvite(
  emailDestino?: string
): Promise<CriarConviteResponse> {
  if (usuario?.perfil !== "ASSESSOR") {
    throw new Error(
      "Apenas assessores podem criar convites."
    );
  }
  return await authCriarConvite(emailDestino);
}

async function listarConvites(
  page = 1,
  limit = 20
): Promise<ListarConvitesResponse> {
  if (usuario?.perfil !== "ASSESSOR") {
    throw new Error(
      "Apenas assessores podem visualizar convites."
    );
  }

  return await authListarConvites(
    page,
    limit
  );
}

async function registerFuncionario(
  dados: RegisterFuncionarioData
): Promise<LoginResponse> {
  const resposta =
    await authRegisterFuncionario(dados);

  if (!resposta.usuario) {
    throw new Error(
      "A API não retornou o usuário."
    );
  }

  setUsuario(resposta.usuario);

  return resposta;
}

  return (
    <AuthContext.Provider
      value={{
        usuario,
        carregando,
        autenticado: usuario !== null,
        login,
        registerAssessoria,
        logout,
        validarConvite,
        registerFuncionario,
        criarConvite,
        listarConvites
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth deve ser usado dentro de um AuthProvider."
    );
  }

  return context;
}
