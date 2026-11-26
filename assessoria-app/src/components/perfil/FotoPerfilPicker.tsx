import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import AvatarUsuario from "@/components/perfil/AvatarUsuario";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { getDocumentAsync } from "@/services/seletorArquivos";
import type { ArquivoUpload } from "@/services/arquivoUpload";
import type { Usuario } from "@/services/api/auth";
import { obterUrlFotoPerfil } from "@/services/api/perfil";

export default function FotoPerfilPicker({
  usuario,
  foto,
  removida,
  disabled,
  onSelect,
  onRemove,
  onBusy,
}: {
  usuario: Usuario;
  foto: ArquivoUpload | null;
  removida: boolean;
  disabled: boolean;
  onSelect: (foto: ArquivoUpload) => void;
  onRemove: () => void;
  onBusy: (ocupada: boolean) => void;
}) {
  const { theme } = useTheme();
  const [erro, setErro] = useState("");
  const [selecionando, setSelecionando] = useState(false);
  const selecaoEmCurso = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const uri =
    foto?.uri ?? (removida ? null : obterUrlFotoPerfil(usuario.foto_path));

  async function selecionar() {
    if (disabled || selecaoEmCurso.current) return;
    selecaoEmCurso.current = true;
    setSelecionando(true);
    onBusy(true);
    try {
      const resultado = await getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        multiple: false,
      });
      if (!montado.current || resultado.canceled) return;
      const arquivo = resultado.assets[0];
      if (
        !arquivo ||
        (arquivo.size !== undefined &&
          (arquivo.size <= 0 || arquivo.size > 2 * 1024 * 1024))
      ) {
        throw new Error("Selecione uma imagem de até 2 MB.");
      }
      onSelect({
        uri: arquivo.uri,
        nome: arquivo.name,
        mimeType: arquivo.mimeType,
        file: arquivo.file,
      });
      setErro("");
    } catch (falha) {
      if (!montado.current) return;
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível selecionar a foto."
      );
    } finally {
      selecaoEmCurso.current = false;
      if (montado.current) {
        setSelecionando(false);
        onBusy(false);
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.resumo}>
        <AvatarUsuario usuario={usuario} uri={uri} tamanho={64} />
        <View style={styles.textos}>
          <Text weight="SemiBold" style={styles.titulo}>
            Foto de perfil
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.descricao, { color: theme.textoSub }]}
          >
            {foto?.nome ||
              (removida
                ? "Foto será removida ao salvar"
                : "JPG, PNG ou WEBP · até 2 MB")}
          </Text>
        </View>
      </View>
      <View style={styles.acoes}>
        <Button
          title={uri ? "TROCAR" : "ESCOLHER"}
          icon="camera-outline"
          variant="outline"
          disabled={disabled}
          loading={selecionando}
          onPress={() => void selecionar()}
          style={styles.botao}
        />
        {uri ? (
          <Button
            title="REMOVER"
            variant="danger"
            disabled={disabled || selecionando}
            onPress={() => {
              setErro("");
              onRemove();
            }}
            style={styles.botao}
          />
        ) : null}
      </View>
      {erro ? (
        <Text style={[styles.erro, { color: theme.erro }]}>{erro}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  resumo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  descricao: {
    fontSize: 11,
    lineHeight: 18,
  },
  acoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  botao: {
    flex: 1,
    minWidth: 100,
    width: "auto",
  },
  erro: {
    fontSize: 12,
    lineHeight: 18,
  },
});
