import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "@/constants/api";

const TOKEN_KEY = "logos_token";
const REFRESH_TOKEN_KEY = "logos_refresh_token";

let refreshPromise: Promise<string> | null = null;
// interfaces

export interface Usuario {
  id: number;
  assessoria_id: number;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: "ASSESSOR" | "FUNCIONARIO";
  email_verificado: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  refresh_token?: string;
  usuario?: Usuario;
}

// STORAGE

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveRefreshToken(
  refreshToken: string
): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      refreshToken
    );

    return;
  }

  await SecureStore.setItemAsync(
    REFRESH_TOKEN_KEY,
    refreshToken
  );
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  return SecureStore.getItemAsync(
    REFRESH_TOKEN_KEY
  );
}

export async function removeRefreshToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(
      REFRESH_TOKEN_KEY
    );

    return;
  }

  await SecureStore.deleteItemAsync(
    REFRESH_TOKEN_KEY
  );
}

export async function clearSession(): Promise<void> {
  await removeToken();
  await removeRefreshToken();
}

// REFRESH TOKEN

export async function refreshAccessToken(): Promise<string> {
  /*
 Se já existe uma renovação acontecendo, reutiliza a mesma Promise.
   
    Isso evita duas requisições /refresh simultâneas,
    o que é importante porque nosso backend faz
    rotação do refresh token.
   */
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        throw new Error(
          "Refresh token não encontrado."
        );
      }

      const response = await fetch(
        `${API_URL}/api/auth/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        }
      );

      const responseText = await response.text();

      let data: LoginResponse;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          "A API retornou uma resposta inválida ao renovar a sessão."
        );
      }

      if (
        !response.ok ||
        !data.success ||
        !data.token ||
        !data.refresh_token
      ) {
        throw new Error(
          data.message ||
          "Não foi possível renovar a sessão."
        );
      }

      /*
       * Salva os DOIS novos tokens.
       *
       * O backend revogou o refresh token anterior
       * e criou um novo.
       */
      await saveToken(data.token);
      await saveRefreshToken(
        data.refresh_token
      );

      return data.token;
    } catch (error) {
      /*
       * Se o refresh falhar, a sessão não pode mais
       * ser considerada válida.
       */
      await clearSession();

      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// requisiçoes autenticadas

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = await getToken();

  if (!token) {
    throw new Error("Usuário não autenticado.");
  }

  const headers = new Headers(
    options.headers || {}
  );

  headers.set(
    "Authorization",
    `Bearer ${token}`
  );

  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  token = await refreshAccessToken();

  const retryHeaders = new Headers(
    options.headers || {}
  );

  retryHeaders.set(
    "Authorization",
    `Bearer ${token}`
  );

  response = await fetch(url, {
    ...options,
    headers: retryHeaders,
  });

  return response;
}
// LOGIN

export async function login(
  email: string,
  senha: string
): Promise<LoginResponse> {
  const response = await fetch(
    `${API_URL}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
        senha,
      }),
    }
  );

  const responseText = await response.text();

  let data: LoginResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Não foi possível realizar o login."
    );
  }

  if (
    !data.token ||
    !data.refresh_token ||
    !data.usuario
  ) {
    throw new Error(
      "A API não retornou os dados completos de autenticação."
    );
  }

  await saveToken(data.token);
  await saveRefreshToken(
    data.refresh_token
  );

  return data;
}

// LOGOUT

export async function logout(): Promise<void> {
  const refreshToken =
    await getRefreshToken();

  try {
    if (refreshToken) {
      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        }
      );
    }
  } finally {
    
      // Mesmo se a API estiver indisponível, remove a sessão local.
    await clearSession();
  }
}


export async function me(): Promise<Usuario> {
  const response = await authenticatedFetch(
    `${API_URL}/api/auth/me`,
    {
      method: "GET",
    }
  );

  const responseText =
    await response.text();

  let data: {
    success: boolean;
    usuario?: Usuario;
    message?: string;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.usuario
  ) {
    throw new Error(
      data.message ||
      "Não foi possível validar a sessão."
    );
  }

  return data.usuario;
}


// cadastro de assessoriA

export interface RegisterAssessoriaData {
  assessoria_nome: string;
  assessoria_email: string;
  cnpj: string;
  telefone: string;
  assessor_nome: string;
  assessor_email: string;
  assessor_telefone: string;
  senha: string;
}

export async function registerAssessoria(
  dados: RegisterAssessoriaData
): Promise<LoginResponse> {
  const response = await fetch(
    `${API_URL}/api/auth/register-assessoria`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    }
  );

  const responseText =
    await response.text();

  let data: LoginResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Não foi possível criar a assessoria."
    );
  }

  if (
    !data.token ||
    !data.refresh_token ||
    !data.usuario
  ) {
    throw new Error(
      "A API não retornou os dados completos de autenticação."
    );
  }

  await saveToken(data.token);
  await saveRefreshToken(
    data.refresh_token
  );

  return data;
}

// cadastro de funcionarios 

export interface RegisterFuncionarioData {
  codigo: string;
  nome: string;
  email: string;
  telefone: string;
  senha: string;
}

export async function registerFuncionario(
  dados: RegisterFuncionarioData
): Promise<LoginResponse> {
  const response = await fetch(
    `${API_URL}/api/auth/register-funcionario`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    }
  );

  const responseText = await response.text();

  let data: LoginResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Não foi possível cadastrar o funcionário."
    );
  }

  if (
    !data.token ||
    !data.refresh_token ||
    !data.usuario
  ) {
    throw new Error(
      "A API não retornou os dados completos de autenticação."
    );
  }

  await saveToken(data.token);
  await saveRefreshToken(data.refresh_token);

  return data;
}

// sistema de convite

export interface Convite {
  id: number;
  assessoria_id: number;
  codigo: string;
  email_destino: string | null;
  expira_em: string;
}

export interface ValidarConviteResponse {
  success: boolean;
  message: string;
  convite?: Convite;
}

export async function validarConvite(
  codigo: string
): Promise<Convite> {
  const response = await fetch(
    `${API_URL}/api/convites/validar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo: codigo.trim().toUpperCase(),
      }),
    }
  );

  const responseText = await response.text();

  let data: ValidarConviteResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.convite
  ) {
    throw new Error(
      data.message ||
        "Não foi possível validar o convite."
    );
  }

  return data.convite;
}

export interface CriarConviteResponse {
  success: boolean;
  message: string;
  convite?: {
    id: number;
    codigo: string;
    email_destino: string | null;
    expira_em: string;
  };
}

export async function criarConvite(
  emailDestino?: string
): Promise<CriarConviteResponse> {
  const response = await authenticatedFetch(
    `${API_URL}/api/convites`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_destino: emailDestino?.trim() || null,
      }),
    }
  );

  const responseText = await response.text();

  let data: CriarConviteResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok || !data.success || !data.convite) {
    throw new Error(
      data.message || "Não foi possível criar o convite."
    );
  }

  return data;
}

export interface ConviteHistorico {
  id: number;
  codigo: string;
  email_destino: string | null;
  expira_em: string;
  utilizado_em: string | null;
  created_at: string;
  criado_por: string;
  utilizado_por: string | null;
  status: "ATIVO" | "UTILIZADO" | "EXPIRADO";
}

export interface ListarConvitesResponse {
  success: boolean;
  message?: string;
  convites?: ConviteHistorico[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
  };
}

export async function listarConvites(
  page = 1,
  limit = 20
): Promise<ListarConvitesResponse> {
  const response = await authenticatedFetch(
    `${API_URL}/api/convites?page=${page}&limit=${limit}`,
    {
      method: "GET",
    }
  );

  const responseText = await response.text();

  let data: ListarConvitesResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        "Não foi possível carregar os convites."
    );
  }

  return data;
}

// sistema de funcionarios e permissoes

export interface Funcionario {
  id: number;
  assessoria_id: number;
  nome: string;
  email: string;
  telefone: string | null;
  perfil: "FUNCIONARIO";
  ativo: boolean;
  email_verificado: boolean;
  ultimo_login: string | null;
  created_at: string;
}

export interface ListarFuncionariosResponse {
  success: boolean;
  message?: string;
  funcionarios?: Funcionario[];
}

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const response = await authenticatedFetch(
    `${API_URL}/api/funcionarios`,
    {
      method: "GET",
    }
  );

  const responseText = await response.text();

  let data: ListarFuncionariosResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.funcionarios
  ) {
    throw new Error(
      data.message ||
      "Não foi possível carregar os funcionários."
    );
  }

  return data.funcionarios;
}

export interface Permissao {
  id: number;
  modulo: string;
  acao: string;
  descricao: string | null;
}

export interface ListarPermissoesResponse {
  success: boolean;
  message?: string;
  permissoes?: Permissao[];
}

export interface ListarPermissoesFuncionarioResponse {
  success: boolean;
  message?: string;
  usuario_id?: number;
  permissoes?: Permissao[];
}

export async function listarTodasPermissoes(): Promise<Permissao[]> {
  const response = await authenticatedFetch(
    `${API_URL}/api/permissoes`,
    {
      method: "GET",
    }
  );

  const responseText = await response.text();

  let data: ListarPermissoesResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.permissoes
  ) {
    throw new Error(
      data.message ||
        "Não foi possível carregar as permissões."
    );
  }

  return data.permissoes;
}

export async function listarPermissoesFuncionario(
  usuarioId: number
): Promise<Permissao[]> {
  const response = await authenticatedFetch(
    `${API_URL}/api/funcionarios/permissoes?usuario_id=${usuarioId}`,
    {
      method: "GET",
    }
  );

  const responseText = await response.text();

  let data: ListarPermissoesFuncionarioResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (
    !response.ok ||
    !data.success ||
    !data.permissoes
  ) {
    throw new Error(
      data.message ||
        "Não foi possível carregar as permissões do funcionário."
    );
  }

  return data.permissoes;
}

export async function atualizarPermissoesFuncionario(
  usuarioId: number,
  permissoes: number[]
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_URL}/api/funcionarios/permissoes`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        permissoes,
      }),
    }
  );

  const responseText = await response.text();

  let data: {
    success: boolean;
    message?: string;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida."
    );
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
        "Não foi possível atualizar as permissões."
    );
  }
}