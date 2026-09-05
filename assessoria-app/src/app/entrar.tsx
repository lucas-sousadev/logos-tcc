import {
  StyleSheet,
  TouchableOpacity,
  View,
  Image
} from "react-native";

import { useRouter } from "expo-router";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";

import { Gradients } from "@/constants/colors";
import { useTheme } from "@/contexts/ThemeContext";

import Text from "@/components/ui/Text";
import BackButton from "@/components/ui/BackButton";
import Button from "@/components/ui/Button";

export default function Entrar() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<1 | 2>(1);

  const { theme, mode, toggleTheme} = useTheme();

  return (
    <View
      style={[styles.container, {backgroundColor: theme.background}]}
    >
        <Image
          source={
            mode === "light"
              ? require("@/assets/images/background-logos-white.png")
              : require("@/assets/images/background-logos-dark.png")
          }
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      {etapa === 1 ? (
        <View style={styles.container1}>
          <View style={styles.topContent}>
            <Text
              weight="Regular"
              style={[styles.textoBemVindo,{color: theme.texto}]}
            >
              <Text
                weight="Bold"
                style={{color: theme.textoTerciaria}}
              >
                LOGOS,
              </Text>{" "}
              seu gerenciador de assessoria de imprensa
            </Text>
          </View>

          <Button
            title="CONTINUAR"
            variant="primary"
            style={styles.buttonInicial}
            onPress={() => setEtapa(2)}
          />
        </View>
      ) : (
        <View style={styles.container2}>
          <BackButton
            onPress={() => setEtapa(1)}
          />

          <Button
            title="SOU ASSESSOR"
            style={styles.button}
            onPress={() =>
              router.push("/login-assessor")
            }
          />

          <Button
            title="SOU FUNCIONÁRIO"
            style={styles.button}
            onPress={() =>
              router.push("/login-funcionario")
            }
          />

          <Button
            title="TENHO UM CONVITE"
            variant="outline"
            style={styles.buttonConvite}
            onPress={() =>
              router.push("/cadastro-funcionario")
            }
          />

          <Text style={styles.createText}>
            Ainda não possui uma assessoria?
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/cadastro")}
            activeOpacity={0.7}
          >
            <Text
              weight="SemiBold"
              style={[
                styles.assessoriaText,
                {
                  color: theme.textoTerciaria,
                },
              ]}
            >
              Clique aqui para criar uma!
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  container1: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 35,
    paddingTop: 50,
    paddingBottom: 40,
  },
  backgroundImage: {
  ...StyleSheet.absoluteFill,
  width: "100%",
  height: "100%",
},
  topContent: {
    alignItems: "center",
  },

  textoBemVindo: {
    fontSize: 40,
    lineHeight: 44,
    textAlign: "left",
  },

  buttonInicial: {
    width: "100%",
  },

  container2: {
    flex: 1,
    justifyContent: "center",

    paddingHorizontal: 25,
  },

  button: {
    width: "100%",

    marginBottom: 20,
  },

  buttonConvite: {
    width: "100%",
    marginBottom: 30,
  },

  createText: {
    textAlign: "center",
    fontSize: 15,
  },

  assessoriaText: {
    textAlign: "center",
    marginTop: 5,
    fontSize: 15,
  },
});