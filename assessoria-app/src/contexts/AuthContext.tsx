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
  listarFuncionarios as authListarFuncionarios,
  buscarFuncionario as authBuscarFuncionario,
  ListarFuncionariosParams,
  ListarFuncionariosResponse,
  Funcionario,
  listarTodasPermissoes as authListarTodasPermissoes,
  listarPermissoesFuncionario as authListarPermissoesFuncionario,
  atualizarPermissoesFuncionario as authAtualizarPermissoesFuncionario,
  listarMinhasPermissoes as authListarMinhasPermissoes,
  Permissao,
} from "@/services/api/auth";

interface AuthContextData {
  usuario: Usuario | null;
  permissoesUsuario: Permissao[];
  carregando: boolean;
  autenticado: boolean;
  login: (
  email: string,
  senha: string,
  perfilEsperado?: Usuario["perfil"]
) => Promise<void>;
  //cadastro assessoria e logout
  registerAssessoria: (
    dados: RegisterAssessoriaData
  ) => Promise<LoginResponse>;

  logout: () => Promise<void>;

  //sistema convites 
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

  // funcionarios e permissoes
  registerFuncionario: (
    dados: RegisterFuncionarioData
  ) => Promise<LoginResponse>;
  
  buscarFuncionario: (
  usuarioId: number
) => Promise<Funcionario>;
  listarFuncionarios: (
    params?: ListarFuncionariosParams
  ) => Promise<ListarFuncionariosResponse>;
  listarTodasPermissoes: () => Promise<Permissao[]>;

  listarPermissoesFuncionario: (
    usuarioId: number
  ) => Promise<Permissao[]>;

  atualizarPermissoesFuncionario: (
    usuarioId: number,
    permissoes: number[]
  ) => Promise<void>;

  temPermissao: (
    modulo: string,
    acao: string
  ) => boolean;
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

        if (usuarioAtual.perfil === "FUNCIONARIO") {
          const permissoes =
            await authListarMinhasPermissoes();

          setPermissoesUsuario(permissoes);
        } else {
          setPermissoesUsuario([]);
        }

        setUsuario(usuarioAtual);
      } catch (error) {
        console.error("Erro ao restaurar sessão:", error);

        await clearSession();
        setUsuario(null);
        setPermissoesUsuario([]);
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

    try {
      if (
        resposta.usuario.perfil ===
        "FUNCIONARIO"
      ) {
        const permissoes =
          await authListarMinhasPermissoes();

        setPermissoesUsuario(permissoes);
      } else {
        setPermissoesUsuario([]);
      }

      setUsuario(resposta.usuario);
    } catch (error) {
      await authLogout();

      setUsuario(null);
      setPermissoesUsuario([]);

      throw error;
    }
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
    setPermissoesUsuario([]);
  }

  async function validarConvite(
  codigo: string
): Promise<Convite> {
  return await authValidarConvite(codigo);
}

  async function criarConvite(
    emailDestino?: string
  ): Promise<CriarConviteResponse> {
    if (!temPermissao("CONVITES", "CRIAR")) {
      throw new Error(
        "Você não possui permissão para criar convites."
      );
    }

    return authCriarConvite(emailDestino);
  }

  async function listarConvites(
    page = 1,
    limit = 20
  ): Promise<ListarConvitesResponse> {
    if (!temPermissao("CONVITES", "VISUALIZAR")) {
      throw new Error(
        "Você não possui permissão para visualizar convites."
      );
    }

    return authListarConvites(page, limit);
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

  async function listarFuncionarios(
    params: ListarFuncionariosParams = {}
  ): Promise<ListarFuncionariosResponse> {
    if (!temPermissao("USUARIOS", "VISUALIZAR")) {
      throw new Error(
        "Você não possui permissão para visualizar funcionários."
      );
    }

    return authListarFuncionarios(params);
  }

  async function buscarFuncionario(
    usuarioId: number
  ): Promise<Funcionario> {
    if (!temPermissao("USUARIOS", "VISUALIZAR")) {
      throw new Error(
        "Você não possui permissão para visualizar funcionários."
      );
    }

    return authBuscarFuncionario(usuarioId);
  }

  async function listarTodasPermissoes(): Promise<Permissao[]> {
    if (
      !temPermissao(
        "USUARIOS",
        "GERENCIAR_PERMISSOES"
      )
    ) {
      throw new Error(
        "Você não possui permissão para gerenciar permissões."
      );
    }

    return authListarTodasPermissoes();
  }

  async function listarPermissoesFuncionario(
    usuarioId: number
  ): Promise<Permissao[]> {
    if (
      !temPermissao(
        "USUARIOS",
        "GERENCIAR_PERMISSOES"
      )
    ) {
      throw new Error(
        "Você não possui permissão para gerenciar permissões."
      );
    }

    return authListarPermissoesFuncionario(usuarioId);
  }

  async function atualizarPermissoesFuncionario(
    usuarioId: number,
    permissoes: number[]
  ): Promise<void> {
    if (
      !temPermissao(
        "USUARIOS",
        "GERENCIAR_PERMISSOES"
      )
    ) {
      throw new Error(
        "Você não possui permissão para gerenciar permissões."
      );
    }

    await authAtualizarPermissoesFuncionario(
      usuarioId,
      permissoes
    );
  }

  const [permissoesUsuario, setPermissoesUsuario] =
  useState<Permissao[]>([]);

  function temPermissao(
    modulo: string,
    acao: string
  ): boolean {
    if (!usuario) {
      return false;
    }

    if (usuario.perfil === "ASSESSOR") {
      return true;
    }

    return permissoesUsuario.some(
      (permissao) =>
        permissao.modulo === modulo &&
        permissao.acao === acao
    );
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        permissoesUsuario,
        carregando,
        autenticado: usuario !== null,

        login,
        registerAssessoria,
        logout,

        validarConvite,
        registerFuncionario,

        criarConvite,
        listarConvites,

        listarFuncionarios,
        buscarFuncionario,
        listarTodasPermissoes,
        listarPermissoesFuncionario,
        atualizarPermissoesFuncionario,

        temPermissao,
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
