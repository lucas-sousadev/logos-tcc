import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  modulosDisponiveis,
  normalizarAtalhos,
  type AtalhosBarra,
  type ModuloNavegacao,
} from "@/constants/modulosNavegacao";
import {
  lerPreferenciasNavegacao,
  salvarPreferenciasNavegacao,
} from "@/services/preferenciasNavegacao";

interface NavegacaoContextData {
  conta: string | null;
  atalhos: AtalhosBarra;
  disponiveis: ModuloNavegacao[];
  pronto: boolean;
  erro: string;
  salvar: (atalhos: AtalhosBarra) => Promise<void>;
  recarregar: () => void;
}

const NavegacaoContext = createContext<NavegacaoContextData | undefined>(
  undefined
);

export function NavegacaoProvider({ children }: { children: ReactNode }) {
  const { usuario, temPermissao } = useAuth();
  const conta = usuario ? usuario.assessoria_id + ":" + usuario.id : null;
  const [registro, setRegistro] = useState<{
    conta: string | null;
    tentativa: number;
    valor: unknown;
    pronto: boolean;
    erro: string;
  }>({ conta: null, tentativa: 0, valor: null, pronto: false, erro: "" });
  const [tentativa, setTentativa] = useState(0);
  const revisao = useRef({ valor: 0 });
  const disponiveis = modulosDisponiveis(temPermissao);
  const atual = registro.conta === conta && registro.tentativa === tentativa;
  const pronto = atual && registro.pronto && conta !== null;
  const atalhos = normalizarAtalhos(atual ? registro.valor : null, disponiveis);

  useEffect(() => {
    let ativo = true;
    const controle = revisao.current;
    const leitura = ++controle.valor;
    if (!conta) return;

    lerPreferenciasNavegacao(conta)
      .then((valor) => {
        if (!ativo || controle.valor !== leitura) return;
        setRegistro({
          conta,
          tentativa,
          valor,
          pronto: true,
          erro: "",
        });
      })
      .catch(() => {
        if (!ativo || controle.valor !== leitura) return;
        setRegistro({
          conta,
          tentativa,
          valor: null,
          pronto: true,
          erro: "Não foi possível carregar seus atalhos. Tente novamente ou escolha uma nova configuração.",
        });
      });
    return () => {
      ativo = false;
      controle.valor++;
    };
  }, [conta, tentativa]);

  async function salvar(escolha: AtalhosBarra) {
    if (!conta || !pronto)
      throw new Error("Aguarde o carregamento dos seus atalhos.");
    const normalizado = normalizarAtalhos(escolha, disponiveis);
    if (JSON.stringify(normalizado) !== JSON.stringify(escolha)) {
      throw new Error(
        "Escolha atalhos disponíveis e diferentes para cada vaga."
      );
    }

    const controle = revisao.current;
    const gravacao = ++controle.valor;
    try {
      await salvarPreferenciasNavegacao(conta, normalizado);
    } catch {
      throw new Error(
        "Não foi possível salvar os atalhos neste dispositivo. Tente novamente."
      );
    }
    if (controle.valor !== gravacao) return;
    setRegistro((anterior) =>
      anterior.conta === conta && anterior.tentativa === tentativa
        ? { conta, tentativa, valor: normalizado, pronto: true, erro: "" }
        : anterior
    );
  }

  return (
    <NavegacaoContext.Provider
      value={{
        conta,
        atalhos,
        disponiveis,
        pronto,
        erro: atual ? registro.erro : "",
        salvar,
        recarregar: () => setTentativa((valor) => valor + 1),
      }}
    >
      {children}
    </NavegacaoContext.Provider>
  );
}

export function useNavegacao() {
  const contexto = useContext(NavegacaoContext);
  if (!contexto)
    throw new Error("useNavegacao deve estar dentro de NavegacaoProvider.");
  return contexto;
}
