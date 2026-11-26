import { createContext, useContext, type ReactNode } from "react";

const ContextoEdicaoCompacta = createContext(false);

export function useEdicaoCompacta() {
  return useContext(ContextoEdicaoCompacta);
}

export default function EdicaoCompacta({
  ativa = true,
  children,
}: {
  ativa?: boolean;
  children: ReactNode;
}) {
  return (
    <ContextoEdicaoCompacta.Provider value={ativa}>
      {children}
    </ContextoEdicaoCompacta.Provider>
  );
}
