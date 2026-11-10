import { useState, type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pencil } from "lucide-react-native";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { BlocoTemplateRelease } from "@/services/api/release";

export type CampoBlocoPrevia =
  | "texto"
  | "url"
  | "legenda";

interface Props {
  blocos: BlocoTemplateRelease[];
  disabled?: boolean;
  onEditar?: (
    id: string,
    campo: CampoBlocoPrevia
  ) => void;
}

function LinhaEditavel({
  children,
  label,
  disabled,
  onEditar,
}: {
  children: ReactNode;
  label: string;
  disabled: boolean;
  onEditar?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.linha}>
      <View style={styles.conteudo}>
        {children}
      </View>

      {onEditar ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onEditar}
          style={[
            styles.lapis,
            {
              opacity: disabled ? 0.4 : 1,
              backgroundColor: theme.primaria + "0D",
              borderColor: theme.primaria + "25",
            },
          ]}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Pencil
            size={18}
            strokeWidth={2.2}
            color={theme.primaria}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function BlocoPrevia({
  bloco,
  disabled,
  onEditar,
}: {
  bloco: BlocoTemplateRelease;
  disabled: boolean;
  onEditar?: (
    id: string,
    campo: CampoBlocoPrevia
  ) => void;
}) {
  const { theme } = useTheme();
  const [urlComErro, setUrlComErro] = useState("");

  const url = bloco.url ?? "";

  function acao(campo: CampoBlocoPrevia) {
    return onEditar
      ? () => onEditar(bloco.id, campo)
      : undefined;
  }

  if (bloco.tipo === "divisor") {
    return (
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.borda + "55",
        }}
      />
    );
  }

  if (bloco.tipo === "espacamento") {
    return <View style={{ height: 12 }} />;
  }

  if (bloco.tipo === "imagem") {
    return (
      <View style={styles.imagem}>
        <LinhaEditavel
          label="Editar imagem"
          disabled={disabled}
          onEditar={acao("url")}
        >
          {/^https?:\/\/[^\s]+$/i.test(url) &&
          urlComErro !== url ? (
            <Image
              source={{ uri: url }}
              style={styles.foto}
              resizeMode="contain"
              accessibilityLabel={
                bloco.texto || "Imagem da matéria"
              }
              onError={() => setUrlComErro(url)}
            />
          ) : (
            <View
              style={[
                styles.placeholder,
                {
                  backgroundColor:
                    theme.primaria + "15",
                },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={32}
                color={theme.textoSub}
              />

              <Text style={{ color: theme.textoSub }}>
                {url
                  ? "Imagem indisponível"
                  : bloco.texto || "Adicionar imagem"}
              </Text>
            </View>
          )}
        </LinhaEditavel>

        {bloco.legenda ? (
          <LinhaEditavel
            label="Editar legenda"
            disabled={disabled}
            onEditar={acao("legenda")}
          >
            <Text
              style={{
                color: theme.textoSub,
                fontSize: 12,
              }}
            >
              {bloco.legenda}
            </Text>
          </LinhaEditavel>
        ) : null}
      </View>
    );
  }

  if (
    bloco.tipo === "botao" ||
    bloco.tipo === "arquivo"
  ) {
    return (
      <LinhaEditavel
        label="Editar texto do link"
        disabled={disabled}
        onEditar={acao("texto")}
      >
        <View
          style={[
            styles.link,
            {
              borderColor: theme.borda,
              backgroundColor: theme.primaria + "15",
            },
          ]}
        >
          <Text weight="SemiBold">
            {bloco.texto ||
              (bloco.tipo === "arquivo"
                ? "Arquivo para download"
                : "Botão com link")}
          </Text>
        </View>
      </LinhaEditavel>
    );
  }

  return (
    <LinhaEditavel
      label={"Editar " + bloco.tipo.replace("_", " ")}
      disabled={disabled}
      onEditar={acao("texto")}
    >
      <Text
        weight={
          bloco.tipo === "titulo" ? "Bold" : "Regular"
        }
        style={{
          fontSize: bloco.tipo === "titulo" ? 22 : 14,
          lineHeight: bloco.tipo === "titulo" ? 29 : 22,
          color:
            bloco.tipo === "linha_fina"
              ? theme.textoSub
              : theme.texto,
        }}
      >
        {bloco.texto || " "}
      </Text>
    </LinhaEditavel>
  );
}

export default function ReleaseBlocosPrevia({
  blocos,
  disabled = false,
  onEditar,
}: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.pagina,
        {
          borderColor: theme.borda,
          backgroundColor: theme.backgroundSecundario,
        },
      ]}
    >
      {blocos.length === 0 ? (
        <Text>O conteúdo ainda está vazio.</Text>
      ) : null}

      {blocos.map((bloco) => (
        <BlocoPrevia
          key={bloco.id}
          bloco={bloco}
          disabled={disabled}
          onEditar={onEditar}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    gap: 14,
  },
  linha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  conteudo: {
    flex: 1,
    minWidth: 0,
  },
  lapis: {
  width: 32,
  height: 32,
  borderWidth: 1,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
},
  imagem: {
    gap: 6,
  },
  foto: {
    width: "100%",
    height: 180,
  },
  placeholder: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  link: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
});