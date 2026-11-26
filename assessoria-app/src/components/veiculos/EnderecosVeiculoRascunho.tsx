import { useState } from "react";
import {
  Keyboard,
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
import type { NovoEnderecoVeiculo } from "@/services/api/veiculo";

interface Props {
  value: NovoEnderecoVeiculo[];
  onChange: (enderecos: NovoEnderecoVeiculo[]) => void;
  disabled?: boolean;
  error?: string;
}

function urlDoEndereco(endereco: NovoEnderecoVeiculo): string {
  const host = endereco.host.trim();
  const prefixo = /^https?:\/\//i.test(host) ? "" : "https://";
  return prefixo + host + (endereco.caminho_prefixo.trim() || "/");
}

export default function EnderecosVeiculoRascunho({
  value,
  onChange,
  disabled = false,
  error,
}: Props) {
  const { theme } = useTheme();
  const [editando, setEditando] = useState<number | null>(null);
  const [erroAbertura, setErroAbertura] = useState("");

  function alterar(indice: number, campos: Partial<NovoEnderecoVeiculo>) {
    if (disabled) return;
    onChange(
      value.map((endereco, atual) =>
        atual === indice ? { ...endereco, ...campos } : endereco
      )
    );
  }

  function adicionar() {
    if (disabled || value.length >= 20) return;
    onChange([
      ...value,
      { host: "", caminho_prefixo: "", incluir_subdominios: false },
    ]);
    setEditando(value.length);
  }

  function remover(indice: number) {
    if (disabled) return;
    onChange(value.filter((_, atual) => atual !== indice));
    setEditando(null);
  }

  async function abrirSite(endereco: NovoEnderecoVeiculo) {
    setErroAbertura("");
    try {
      await Linking.openURL(encodeURI(urlDoEndereco(endereco)));
    } catch {
      setErroAbertura("Não foi possível abrir este site.");
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.borda + "40",
          backgroundColor: theme.backgroundSecundario,
        },
      ]}
    >
      <View style={styles.cabecalho}>
        <View
          style={[
            styles.iconeCabecalho,
            { backgroundColor: theme.primaria + "0D" },
          ]}
        >
          <Ionicons
            name="globe-outline"
            size={20}
            color={theme.textoTerciaria}
          />
        </View>
        <View style={styles.textosCabecalho}>
          <Text weight="SemiBold" style={styles.titulo}>
            Endereços do site
          </Text>
          <Text style={[styles.ajuda, { color: theme.textoSub }]}>
            As mudanças serão salvas junto com o veículo.
          </Text>
        </View>
        <View
          style={[styles.contador, { backgroundColor: theme.primaria + "0B" }]}
        >
          <Text
            weight="SemiBold"
            style={[styles.contadorTexto, { color: theme.textoTerciaria }]}
          >
            {value.length}/20
          </Text>
        </View>
      </View>

      {!value.length ? (
        <Text style={[styles.ajuda, { color: theme.textoSub }]}>
          Adicione os sites usados para reconhecer este veículo.
        </Text>
      ) : null}
      {value.map((endereco, indice) => {
        const aberto = editando === indice;
        return (
          <View
            key={endereco.id ?? "novo-" + indice}
            style={[
              styles.registro,
              {
                borderColor: theme.borda + "30",
                backgroundColor: theme.primaria + "03",
              },
            ]}
          >
            <View style={styles.linha}>
              <View style={styles.identidade}>
                <Text
                  weight="SemiBold"
                  numberOfLines={1}
                  style={styles.endereco}
                >
                  {endereco.host.trim()
                    ? urlDoEndereco(endereco)
                    : "Novo endereço"}
                </Text>
                <Text style={[styles.numero, { color: theme.textoSub }]}>
                  Endereço {indice + 1}
                </Text>
              </View>
              <View style={styles.acoes}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    aberto ? "Fechar edição do endereço" : "Editar endereço"
                  }
                  aria-expanded={aberto}
                  disabled={disabled}
                  onPress={() => setEditando(aberto ? null : indice)}
                  hitSlop={4}
                  style={[
                    styles.acao,
                    { backgroundColor: theme.primaria + "0A" },
                  ]}
                >
                  <Ionicons
                    name={aberto ? "chevron-up-outline" : "create-outline"}
                    size={17}
                    color={theme.textoTerciaria}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Remover endereço"
                  disabled={disabled}
                  onPress={() => remover(indice)}
                  hitSlop={4}
                  style={[styles.acao, { backgroundColor: theme.erro + "0A" }]}
                >
                  <Ionicons name="trash-outline" size={17} color={theme.erro} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="link"
                  accessibilityLabel="Abrir site"
                  disabled={disabled || !endereco.host.trim()}
                  onPress={() => void abrirSite(endereco)}
                  hitSlop={4}
                  style={[
                    styles.acao,
                    {
                      backgroundColor: theme.primaria + "0A",
                      opacity: endereco.host.trim() ? 1 : 0.4,
                    },
                  ]}
                >
                  <Ionicons
                    name="open-outline"
                    size={17}
                    color={theme.textoTerciaria}
                  />
                </TouchableOpacity>
              </View>
            </View>
            {aberto ? (
              <View
                style={[styles.campos, { borderTopColor: theme.borda + "20" }]}
              >
                <Input
                  label="Domínio"
                  accessibilityLabel="Domínio do endereço"
                  value={endereco.host}
                  onChangeText={(host) => alterar(indice, { host })}
                  placeholder="Ex.: nomesite.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!disabled}
                  containerStyle={styles.campo}
                />
                <Input
                  label="Seção do site (opcional)"
                  accessibilityLabel="Seção do site"
                  value={endereco.caminho_prefixo}
                  onChangeText={(caminho_prefixo) =>
                    alterar(indice, { caminho_prefixo })
                  }
                  placeholder="Ex.: /agro"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!disabled}
                  containerStyle={styles.campo}
                />
                <View
                  style={[
                    styles.opcao,
                    {
                      borderColor: theme.borda + "25",
                      backgroundColor: theme.backgroundSecundario,
                    },
                  ]}
                >
                  <Text weight="Medium" style={styles.opcaoTexto}>
                    Incluir subdomínios
                  </Text>
                  <Switch
                    accessibilityLabel="Incluir subdomínios"
                    value={endereco.incluir_subdominios}
                    onValueChange={(incluir_subdominios) =>
                      alterar(indice, { incluir_subdominios })
                    }
                    disabled={disabled}
                    trackColor={{
                      false: theme.borda + "40",
                      true: theme.primaria,
                    }}
                    thumbColor={theme.branco}
                  />
                </View>
                <Button
                  title="CONCLUIR"
                  icon="checkmark-outline"
                  variant="outline"
                  size="small"
                  disabled={disabled}
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditando(null);
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      <Button
        title="ADICIONAR ENDEREÇO"
        icon="add-outline"
        variant="outline"
        size="small"
        disabled={disabled || value.length >= 20}
        onPress={adicionar}
      />
      {error || erroAbertura ? (
        <Text
          accessibilityRole="alert"
          style={[styles.erro, { color: theme.erro }]}
        >
          {error || erroAbertura}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  iconeCabecalho: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textosCabecalho: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  ajuda: {
    fontSize: 11,
    lineHeight: 17,
  },
  contador: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexShrink: 0,
  },
  contadorTexto: {
    fontSize: 10,
    lineHeight: 15,
  },
  registro: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identidade: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  endereco: {
    fontSize: 12,
    lineHeight: 18,
  },
  numero: {
    fontSize: 10,
    lineHeight: 15,
  },
  acoes: {
    flexDirection: "row",
    gap: 5,
  },
  acao: {
    width: 30,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  campos: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 12,
  },
  campo: {
    marginBottom: 0,
  },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  opcaoTexto: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 18,
  },
  erro: {
    fontSize: 11,
    lineHeight: 17,
  },
});
