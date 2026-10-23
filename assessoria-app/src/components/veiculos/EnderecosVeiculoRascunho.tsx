import { useState } from "react";
import {
  Linking,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  NovoEnderecoVeiculo,
} from "@/services/api/veiculo";

interface Props {
  value: NovoEnderecoVeiculo[];
  onChange: (enderecos: NovoEnderecoVeiculo[]) => void;
  disabled?: boolean;
  error?: string;
}

function urlDoEndereco(
  endereco: NovoEnderecoVeiculo
): string {
  const host = endereco.host.trim();
  const prefixo = /^https?:\/\//i.test(host)
    ? ""
    : "https://";

  return `${prefixo}${host}${
    endereco.caminho_prefixo.trim() || "/"
  }`;
}

export default function EnderecosVeiculoRascunho({
  value,
  onChange,
  disabled = false,
  error,
}: Props) {
  const { theme } = useTheme();
  const [editando, setEditando] =
    useState<number | null>(null);
  const [erroAbertura, setErroAbertura] = useState("");

  function alterar(
    indice: number,
    campos: Partial<NovoEnderecoVeiculo>
  ) {
    onChange(
      value.map((endereco, atual) =>
        atual === indice
          ? { ...endereco, ...campos }
          : endereco
      )
    );
  }

  function adicionar() {
    if (disabled || value.length >= 20) return;

    onChange([
      ...value,
      {
        host: "",
        caminho_prefixo: "",
        incluir_subdominios: false,
      },
    ]);
    setEditando(value.length);
  }

  function remover(indice: number) {
    if (disabled) return;

    onChange(
      value.filter((_, atual) => atual !== indice)
    );
    setEditando(null);
  }

  async function abrirSite(
    endereco: NovoEnderecoVeiculo
  ) {
    setErroAbertura("");

    try {
      await Linking.openURL(
        encodeURI(urlDoEndereco(endereco))
      );
    } catch {
      setErroAbertura(
        "Não foi possível abrir este site."
      );
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.borda,
          backgroundColor:
            theme.backgroundSecundario,
        },
      ]}
    >
      <Text weight="Bold" style={styles.titulo}>
        ENDEREÇOS DO SITE
      </Text>

      <Text
        style={[
          styles.ajuda,
          { color: theme.textoSub },
        ]}
      >
        As alterações serão gravadas ao salvar
        o veículo. Cancelar descarta todas elas.
      </Text>

      {value.map((endereco, indice) => (
        <View
          key={endereco.id ?? `novo-${indice}`}
          style={[
            styles.registro,
            { borderTopColor: theme.borda },
          ]}
        >
          <View style={styles.linha}>
            <Ionicons
              name="globe-outline"
              size={19}
              color={theme.textoTerciaria}
              style={styles.globo}
            />

            <Text
              weight="SemiBold"
              style={[
                styles.endereco,
                { color: theme.texto },
              ]}
              selectable
            >
              {endereco.host.trim()
                ? urlDoEndereco(endereco)
                : "Novo endereço"}
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Editar endereço"
              disabled={disabled}
              onPress={() =>
                setEditando(
                  editando === indice ? null : indice
                )
              }
              style={styles.acao}
            >
              <Ionicons
                name="create-outline"
                size={19}
                color={theme.textoTerciaria}
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remover endereço"
              disabled={disabled}
              onPress={() => remover(indice)}
              style={styles.acao}
            >
              <Ionicons
                name="trash-outline"
                size={19}
                color={theme.erro}
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="Abrir site"
              disabled={
                disabled || !endereco.host.trim()
              }
              onPress={() => {
                void abrirSite(endereco);
              }}
              style={styles.acao}
            >
              <Ionicons
                name="open-outline"
                size={19}
                color={theme.textoTerciaria}
              />
            </TouchableOpacity>
          </View>

          {editando === indice ? (
            <View style={styles.campos}>
              <Input
                label="DOMÍNIO"
                value={endereco.host}
                onChangeText={(host) =>
                  alterar(indice, { host })
                }
                placeholder="Ex.: nomesite.com"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!disabled}
              />

              <Input
                label="SEÇÃO DO SITE (OPCIONAL)"
                value={endereco.caminho_prefixo}
                onChangeText={(caminho_prefixo) =>
                  alterar(indice, {
                    caminho_prefixo,
                  })
                }
                placeholder="Ex.: /agro"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!disabled}
              />

              <View style={styles.opcao}>
                <Text
                  weight="SemiBold"
                  style={styles.opcaoTexto}
                >
                  Incluir subdomínios
                </Text>

                <Switch
                  value={
                    endereco.incluir_subdominios
                  }
                  onValueChange={(
                    incluir_subdominios
                  ) =>
                    alterar(indice, {
                      incluir_subdominios,
                    })
                  }
                  disabled={disabled}
                  trackColor={{
                    false: theme.surface,
                    true: theme.primaria,
                  }}
                  thumbColor={theme.branco}
                />
              </View>

              <Button
                title="CONCLUIR"
                variant="outline"
                size="small"
                disabled={disabled}
                onPress={() => setEditando(null)}
              />
            </View>
          ) : null}
        </View>
      ))}

      {value.length < 20 ? (
        <Button
          title="ADICIONAR ENDEREÇO"
          variant="outline"
          size="small"
          disabled={disabled}
          onPress={adicionar}
        />
      ) : null}

      {error || erroAbertura ? (
        <Text
          style={[
            styles.erro,
            { color: theme.erro },
          ]}
        >
          {error || erroAbertura}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 14,
    marginBottom: 14,
  },
  titulo: {
    fontSize: 13,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 10,
  },
  registro: {
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
  },
  globo: {
    marginRight: 8,
  },
  endereco: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
  },
  acao: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  campos: {
    paddingTop: 12,
  },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  opcaoTexto: {
    flex: 1,
  },
  erro: {
    fontSize: 12,
    marginTop: 10,
  },
});