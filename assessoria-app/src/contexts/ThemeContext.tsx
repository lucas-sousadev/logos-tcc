import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { LightTheme, DarkTheme } from "@/constants/themes";

type ThemeMode = "light" | "dark";

interface ThemeContextData {
  theme: typeof LightTheme;
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextData | undefined>(
  undefined
);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = "@logos_theme";

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [carregandoTema, setCarregandoTema] = useState(true);

  // Carrega o tema salvo
  useEffect(() => {
    async function carregarTema() {
      try {
        const temaSalvo = await AsyncStorage.getItem(
          THEME_STORAGE_KEY
        );

        if (temaSalvo === "light" || temaSalvo === "dark") {
          setMode(temaSalvo);
        }
      } catch (error) {
        console.log("Erro ao carregar tema:", error);
      } finally {
        setCarregandoTema(false);
      }
    }

    carregarTema();
  }, []);

  // Salva sempre que o tema mudar
  useEffect(() => {
    if (!carregandoTema) {
      AsyncStorage.setItem(
        THEME_STORAGE_KEY,
        mode
      ).catch((error) => {
        console.log("Erro ao salvar tema:", error);
      });
    }
  }, [mode, carregandoTema]);

  const toggleTheme = () => {
    setMode((current) =>
      current === "light" ? "dark" : "light"
    );
  };

  const theme =
    mode === "light"
      ? LightTheme
      : DarkTheme;

  if (carregandoTema) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme deve ser usado dentro de um ThemeProvider"
    );
  }

  return context;
}