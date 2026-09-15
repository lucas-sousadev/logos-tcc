import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ClippingNovosContextData {
  novos: ReadonlySet<number>;
  marcarNovo: (id: number) => void;
  marcarVisualizado: (id: number) => void;
}

const ClippingNovosContext =
  createContext<ClippingNovosContextData | null>(null);

export function ClippingNovosProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [novos, setNovos] = useState<Set<number>>(
    () => new Set()
  );

  const marcarNovo = useCallback((id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) return;

    setNovos((atuais) => {
      if (atuais.has(id)) return atuais;

      const proximos = new Set(atuais);
      proximos.add(id);

      return proximos;
    });
  }, []);

  const marcarVisualizado = useCallback((id: number) => {
    setNovos((atuais) => {
      if (!atuais.has(id)) return atuais;

      const proximos = new Set(atuais);
      proximos.delete(id);

      return proximos;
    });
  }, []);

  const valor = useMemo(
    () => ({
      novos,
      marcarNovo,
      marcarVisualizado,
    }),
    [novos, marcarNovo, marcarVisualizado]
  );

  return (
    <ClippingNovosContext.Provider value={valor}>
      {children}
    </ClippingNovosContext.Provider>
  );
}

export function useClippingNovos() {
  const contexto = useContext(ClippingNovosContext);

  if (!contexto) {
    throw new Error(
      "useClippingNovos deve ser usado dentro de ClippingNovosProvider."
    );  
  }

  return contexto;
}