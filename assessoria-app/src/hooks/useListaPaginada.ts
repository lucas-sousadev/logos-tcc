import {
  useCallback,
  useRef,
  useState,
} from "react";
import { useFocusEffect } from "expo-router";

interface Pagina<T> {
  itens: T[];
  total: number;
}

interface Opcoes<T> {
  chave: string;
  consultar: (
    pagina: number,
    limite: number
  ) => Promise<Pagina<T>>;
  limite?: number;
  habilitado?: boolean;
}

interface Estado<T> extends Pagina<T> {
  chave: string;
  pagina: number;
  carregando: boolean;
  erro: string;
}

export function useListaPaginada<T>({
  chave,
  consultar,
  limite = 50,
  habilitado = true,
}: Opcoes<T>) {
  const ativo = useRef(false);
  const requisicao = useRef(0);
  const chaveAtiva = useRef(chave);

  const ultimaConsulta = useRef({
    chave,
    pagina: 1,
  });

  const [estado, setEstado] = useState<Estado<T>>({
    chave,
    pagina: 1,
    itens: [],
    total: 0,
    carregando: true,
    erro: "",
  });

  const carregarPagina = useCallback(
    async (destino?: number): Promise<void> => {
      if (
        !ativo.current ||
        !habilitado ||
        chaveAtiva.current !== chave
      ) {
        return;
      }

      let pagina =
        destino ??
        (ultimaConsulta.current.chave === chave
          ? ultimaConsulta.current.pagina
          : 1);

      if (
        !Number.isSafeInteger(pagina) ||
        pagina < 1
      ) {
        return;
      }

      const numero = ++requisicao.current;

      setEstado((anterior) => ({
        chave,
        pagina:
          anterior.chave === chave
            ? anterior.pagina
            : 1,
        itens:
          anterior.chave === chave
            ? anterior.itens
            : [],
        total:
          anterior.chave === chave
            ? anterior.total
            : 0,
        carregando: true,
        erro: "",
      }));

      try {
        let resposta = await consultar(
          pagina,
          limite
        );

        if (
          !ativo.current ||
          chaveAtiva.current !== chave ||
          numero !== requisicao.current
        ) {
          return;
        }

        let ultimaPagina = Math.max(
          1,
          Math.ceil(resposta.total / limite)
        );

        while (pagina > ultimaPagina) {
          pagina = ultimaPagina;

          resposta = await consultar(
            pagina,
            limite
          );

          if (
            !ativo.current ||
            chaveAtiva.current !== chave ||
            numero !== requisicao.current
          ) {
            return;
          }

          ultimaPagina = Math.max(
            1,
            Math.ceil(resposta.total / limite)
          );
        }

        ultimaConsulta.current = {
          chave,
          pagina,
        };

        setEstado({
          chave,
          pagina,
          itens: resposta.itens,
          total: resposta.total,
          carregando: false,
          erro: "",
        });
      } catch (error) {
        if (
          !ativo.current ||
          chaveAtiva.current !== chave ||
          numero !== requisicao.current
        ) {
          return;
        }

        setEstado((anterior) => ({
          ...anterior,
          carregando: false,
          erro:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar esta lista.",
        }));
      }
    },
    [chave, consultar, limite, habilitado]
  );

  useFocusEffect(
    useCallback(() => {
      ativo.current = habilitado;
      chaveAtiva.current = chave;

      if (ultimaConsulta.current.chave !== chave) {
        ultimaConsulta.current = {
          chave,
          pagina: 1,
        };
      }

      if (habilitado) {
        void carregarPagina();
      } else {
        setEstado({
          chave,
          pagina: 1,
          itens: [],
          total: 0,
          carregando: false,
          erro: "",
        });
      }

      return () => {
        ativo.current = false;
        requisicao.current += 1;
      };
    }, [carregarPagina, chave, habilitado])
  );

  const atual =
    habilitado && estado.chave === chave
      ? estado
      : null;

  return {
    itens: atual?.itens ?? [],
    total: atual?.total ?? 0,
    pagina: atual?.pagina ?? 1,
    carregando: habilitado
      ? atual?.carregando ?? true
      : false,
    erro: atual?.erro ?? "",
    limite,
    carregarPagina,
  };
}