import { useCallback, useState } from "react";
import {
  BackHandler,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import AcessoLayout, {
  OpcaoAcesso,
  SecaoAcesso,
} from "@/components/auth/AcessoLayout";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";

const RECURSOS = [
  {
    icone: "people-outline",
    titulo: "Clientes e mailing",
    descricao: "Organize sua base de relacionamento.",
  },
  {
    icone: "paper-plane-outline",
    titulo: "Templates e releases",
    descricao: "Prepare o conteúdo e acompanhe os envios.",
  },
  {
    icone: "bar-chart-outline",
    titulo: "Clippings e relatórios",
    descricao: "Reúna as publicações e apresente os resultados.",
  },
] as const;

export default function Entrar() {
  const router = useRouter();
  const { theme } = useTheme();

  const [etapa, setEtapa] = useState<1 | 2>(1);

  useFocusEffect(
    useCallback(() => {
      if (etapa !== 2) return;

      const evento = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setEtapa(1);
          return true;
        }
      );

      return () => evento.remove();
    }, [etapa])
  );

  return (
    <AcessoLayout
      titulo={
        etapa === 1
          ? "Sua assessoria, mais conectada."
          : "Como você quer entrar?"
      }
      descricao={
        etapa === 1
          ? "Organize sua rotina e acompanhe o trabalho da sua equipe em um só lugar."
          : "Escolha seu perfil para acessar o LOGOS ou criar sua conta."
      }
      rodape={
        etapa === 1 ? (
          <Button
            title="CONTINUAR"
            icon="arrow-forward-outline"
            size="large"
            onPress={() => setEtapa(2)}
          />
        ) : undefined
      }
      onBack={
        etapa === 2
          ? () => setEtapa(1)
          : undefined
      }
    >
      {etapa === 1 ? (
        <View style={styles.apresentacao}>

          {RECURSOS.map((recurso) => (
            <View
              key={recurso.titulo}
              style={styles.recurso}
            >
              <View
                style={[
                  styles.icone,
                  {
                    backgroundColor:
                      theme.primaria + "0D",
                  },
                ]}
              >
                <Ionicons
                  name={recurso.icone}
                  size={22}
                  color={theme.textoTerciaria}
                />
              </View>

              <View style={styles.textos}>
                <Text
                  weight="SemiBold"
                  style={styles.titulo}
                >
                  {recurso.titulo}
                </Text>

                <Text
                  style={[
                    styles.descricao,
                    { color: theme.textoSub },
                  ]}
                >
                  {recurso.descricao}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <>
          <OpcaoAcesso
            titulo="Sou assessor"
            descricao="Acesse a gestão da sua assessoria."
            icone="business-outline"
            onPress={() =>
              router.push("/login-assessor")
            }
          />

          <OpcaoAcesso
            titulo="Sou colaborador"
            descricao="Entre na conta vinculada à sua equipe."
            icone="people-outline"
            onPress={() =>
              router.push("/login-funcionario")
            }
          />

          <OpcaoAcesso
            titulo="Tenho um convite"
            descricao="Use seu código para criar uma conta de colaborador."
            icone="mail-open-outline"
            onPress={() =>
              router.push("/cadastro-funcionario")
            }
          />

          <SecaoAcesso
            titulo="Sua assessoria ainda não está aqui?"
            icone="add-circle-outline"
          >
            <Text
              style={{
                color: theme.textoSub,
                fontSize: 12,
                lineHeight: 19,
              }}
            >
              Crie a assessoria e cadastre seu perfil
              de assessor para começar.
            </Text>

            <Button
              title="CRIAR ASSESSORIA"
              variant="outline"
              icon="add-outline"
              onPress={() =>
                router.push("/cadastro")
              }
            />
          </SecaoAcesso>
        </>
      )}
    </AcessoLayout>
  );
}

const styles = StyleSheet.create({
  apresentacao: {
    flexGrow: 1,
    gap: 24,
  },
  legenda: {
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1,
  },
  recurso: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  icone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 18,
  },
});