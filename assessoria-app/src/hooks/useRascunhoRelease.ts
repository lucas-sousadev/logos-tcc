import {
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";

import type { DetalheRelease } from "@/services/api/release";
import { buscarRelease, ErroApiRelease } from "@/services/api/release";
import type { ReleasePendente } from "@/services/releasePendente";
import { SessaoRascunhoRelease } from "@/services/rascunhoRelease";

export function useRascunhoRelease({
  conta,
  identidade,
  valor,
  base = null,
  habilitado,
  ocupado = false,
  iniciar = true,
  temAlteracoes = true,
  podeMailing = true,
  onRecuperar,
}: {
  conta: string | null;
  identidade: string;
  valor: ReleasePendente;
  base?: DetalheRelease | null;
  habilitado: boolean;
  ocupado?: boolean;
  iniciar?: boolean;
  temAlteracoes?: boolean;
  podeMailing?: boolean;
  onRecuperar: (
    valor: ReleasePendente
  ) => void;
}) {
  const focada = useIsFocused();

  const sessao =
    useRef<SessaoRascunhoRelease | null>(null);

  const inicial = useRef({ valor, base });
  const recuperar = useRef(onRecuperar);

  const [estado, setEstado] = useState({
    chave: "",
    pronto: false,
    mensagem: "",
    erro: false,
    conflito: false,
    remotoAusente: false,
    idRemoto: base?.id ?? null,
  });

  const [tentativa, setTentativa] = useState(0);
  const [liberado, setLiberado] = useState(iniciar);
  const texto = JSON.stringify(valor);
  const chaveAtual = JSON.stringify([conta, identidade, tentativa]);
  const pronto = estado.pronto && estado.chave === chaveAtual;

  // A liberação inicial é permanente; salvar ou confirmar um envio apenas pausa a sessão.
  if (iniciar && !liberado) setLiberado(true);

  useEffect(() => {
    recuperar.current = onRecuperar;
    inicial.current = { valor, base };
  });

  useEffect(() => {
    if (!conta || !liberado) return;

    let ativa = true;

    const instancia = new SessaoRascunhoRelease(
      conta,
      identidade,
      inicial.current.valor,
      inicial.current.base,
      (mensagem, erro = false) => {
        if (!ativa) return;

        setEstado((atual) => ({
          ...atual,
          chave: chaveAtual,
          conflito: instancia.emConflito,
          remotoAusente: instancia.remotoAusente,
          idRemoto: instancia.idRemoto,
          mensagem,
          erro,
        }));
      }
    );

    sessao.current = instancia;

    instancia
      .iniciar()
      .then((salvo) => {
        if (!ativa) return;

        if (salvo) {
          recuperar.current(salvo);
        }

        setEstado((atual) => ({
          ...atual,
          chave: chaveAtual,
          conflito: instancia.emConflito,
          remotoAusente: instancia.remotoAusente,
          idRemoto: instancia.idRemoto,
          pronto: true,
        }));
      })
      .catch((erro: unknown) => {
        if (!ativa) return;

        setEstado({
          chave: chaveAtual,
          pronto: false,
          erro: true,
          conflito: false,
          remotoAusente: false,
          idRemoto: null,
          mensagem:
            erro instanceof Error
              ? erro.message
              : "Não foi possível recuperar o rascunho.",
        });
      });

    return () => {
      ativa = false;
      instancia.dispose();

      if (sessao.current === instancia) {
        sessao.current = null;
      }
    };
  }, [conta, identidade, tentativa, liberado, chaveAtual]);

  useEffect(() => {
    const instancia = sessao.current;

    if (
      !instancia ||
      !instancia.pronta ||
      !pronto ||
      !habilitado
    ) {
      return;
    }

    void instancia
      .registrar(
        JSON.parse(texto) as ReleasePendente,
        temAlteracoes
      )
      .catch(() => {});
  }, [texto, pronto, habilitado, temAlteracoes]);

  useEffect(() => {
    const instancia = sessao.current;
    if (!instancia) return;

    instancia.permitida =
      pronto &&
      instancia.pronta &&
      habilitado &&
      !ocupado &&
      focada;

    if (!instancia.permitida) return;

    const sincronizar = () => {
      void instancia
        .sincronizar()
        .catch(() => {});
    };

    const timer = setTimeout(
      sincronizar,
      2000
    );

    const intervalo = setInterval(
      sincronizar,
      15000
    );

    const app = AppState.addEventListener(
      "change",
      (status) => {
        if (status === "active") {
          sincronizar();
        }
      }
    );
    if (typeof window !== "undefined") window.addEventListener("online", sincronizar);

    return () => {
      clearTimeout(timer);
      clearInterval(intervalo);
      app.remove();
      if (typeof window !== "undefined") window.removeEventListener("online", sincronizar);

      instancia.permitida = false;
    };
  }, [
    texto,
    pronto,
    habilitado,
    ocupado,
    focada,
  ]);

  function atual() {
    if (
      !pronto ||
      !sessao.current?.pronta
    ) {
      throw new Error(
        "A recuperação do rascunho ainda não terminou."
      );
    }

    return sessao.current;
  }

  return {
    ...estado,
    pronto,

    tentarRecuperar: () => {
      setEstado({
        chave: "",
        pronto: false,
        mensagem: "",
        erro: false,
        conflito: false,
        remotoAusente: false,
        idRemoto: null,
      });

      setTentativa((numero) => numero + 1);
    },

    guardarLocal: () =>
      atual().registrar(valor),

    confirmar: () =>
      atual().confirmar(valor),

    concluir: () =>
      atual().concluir(),

    recarregarDoServidor: async () => {
      const instancia = atual();
      if (!instancia.idRemoto) throw new Error("Abra o release na listagem para conferir a versão salva.");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const release = await buscarRelease(instancia.idRemoto, controller.signal);
        const valor = await instancia.usarServidor(release, podeMailing);
        recuperar.current(valor);
        return true;
      } catch (erro) {
        if (erro instanceof ErroApiRelease && erro.status === 404) {
          await instancia.marcarRemotoAusente();
          return false;
        }
        throw erro;
      } finally { clearTimeout(timer); }
    },

    recuperarComoNovo: async () => {
      const copia = await atual().recuperarComoNovo();
      if (identidade === "novo") recuperar.current(copia);
    },
  };
}
