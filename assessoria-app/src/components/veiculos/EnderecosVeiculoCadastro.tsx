import {
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
}

export function prepararEnderecosCadastro(
  linhas: NovoEnderecoVeiculo[]
): NovoEnderecoVeiculo[] {
  const resultado: NovoEnderecoVeiculo[] = [];

  for (const linha of linhas) {
    const host = linha.host.trim();
    const caminho = linha.caminho_prefixo.trim();

    if (
      !host &&
      (caminho || linha.incluir_subdominios)
    ) {
      throw new Error(
        "Informe o domínio do endereço preenchido."
      );
    }

    if (!host && linha.id !== undefined) {
      throw new Error(
        "Informe o domínio ou use REMOVER para excluir o endereço."
      );
    }
    if (!host) continue;

    resultado.push({
      ...(linha.id !== undefined ? { id: linha.id } : {}),
      host,
      caminho_prefixo: caminho,
      incluir_subdominios: linha.incluir_subdominios,
    });
  }

  if (resultado.length > 20) {
    throw new Error(
      "Cadastre no máximo 20 endereços."
    );
  }

  return resultado;
}

export default function EnderecosVeiculoCadastro({
  value,
  onChange,
  disabled = false,
}: Props) {
  const { theme } = useTheme();

  function alterar(
    indice: number,
    alteracao: Partial<NovoEnderecoVeiculo>
  ) {
    onChange(
      value.map((endereco, atual) =>
        atual === indice
          ? { ...endereco, ...alteracao }
          : endereco
      )
    );
  }

  function adicionarLinha() {
    onChange([
      ...value,
      {
        host: "",
        caminho_prefixo: "",
        incluir_subdominios: false,
      },
    ]);
  }

  function removerLinha(indice: number) {
    onChange(
      value.filter((_, atual) => atual !== indice)
    );
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
        ENDEREÇOS DO SITE (opcional)
      </Text>

      <Text
        style={[
          styles.ajuda,
          { color: theme.textoSub },
        ]}
      >
        Ajuda a reconhecer este veículo.
        Se o site usar apenas HTTP, informe http:// antes do domínio.
      </Text>

      {value.map((endereco, indice) => (
        <View
          key={indice}
          style={
            indice > 0
              ? [
                  styles.linhaAdicional,
                  { borderTopColor: theme.borda },
                ]
              : undefined
          }
        >
          {value.length > 1 ? (
            <View style={styles.cabecalhoLinha}>
              <Text
                weight="SemiBold"
                style={{ color: theme.textoSub }}
              >
                ENDEREÇO {indice + 1}
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remover endereço ${
                  indice + 1
                }`}
                disabled={disabled}
                onPress={() => removerLinha(indice)}
                style={styles.remover}
              >
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={theme.erro}
                />
              </TouchableOpacity>
            </View>
          ) : null}

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
            <View style={styles.opcaoTexto}>
              <Text weight="SemiBold">
                Incluir subdomínios
              </Text>
              <Text
                style={[
                  styles.detalhe,
                  { color: theme.textoSub },
                ]}
              >
                Ex.: portal.exemplo.com para
                exemplo.com
              </Text>
            </View>

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
        </View>
      ))}

      {value.length < 20 ? (
        <Button
          title="ADICIONAR ENDEREÇO"
          variant="outline"
          size="small"
          onPress={adicionarLinha}
          disabled={disabled}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 14,
    marginBottom: 18,
  },
  titulo: {
    fontSize: 13,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 14,
  },
  linhaAdicional: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
  },
  cabecalhoLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  remover: {
    padding: 8,
  },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  opcaoTexto: {
    flex: 1,
    marginRight: 12,
  },
  detalhe: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});