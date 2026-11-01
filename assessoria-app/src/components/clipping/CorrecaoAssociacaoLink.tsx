import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { AssociacaoEnderecoExistente } from "@/services/api/clipping";

interface Props {
  associacao: AssociacaoEnderecoExistente;
  destinoNome: string;
  podeEditar: boolean;
  enderecoCompativel: boolean;
  confirmando: boolean;
  pendente: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onConfirmar: () => void;
  onDesfazer: () => void;
}

export default function CorrecaoAssociacaoLink({
  associacao,
  destinoNome,
  podeEditar,
  enderecoCompativel,
  confirmando,
  pendente,
  onEditar,
  onCancelar,
  onConfirmar,
  onDesfazer,
}: Props) {
  const { theme } = useTheme();
  const endereco = associacao.host + associacao.caminho_prefixo;

  return (
    <View style={styles.conteudo}>
      {!confirmando ? (
        <Text style={[styles.texto, { color: theme.textoSub }]}>
          {pendente
            ? "Correção preparada. Aplique os dados e salve o clipping para concluir."
            : `Este endereço está associado a ${associacao.veiculo_nome}. Trocar o veículo deste clipping mantém essa associação.`}
        </Text>
      ) : null}

      {confirmando ? (
        <View
          style={styles.confirmacao}
          accessibilityLiveRegion="polite"
        >
          <Text weight="Bold" style={styles.titulo}>
            Corrigir associação?
          </Text>
          <Text weight="SemiBold" style={styles.texto}>
            {endereco}
          </Text>
          <Text style={[styles.texto, { color: theme.textoSub }]}>
            De: {associacao.veiculo_nome}{"\n"}
            Para: {destinoNome}
          </Text>
          <Text style={[styles.texto, { color: theme.textoSub }]}>
            {associacao.caminho_prefixo
              ? "A mudança vale para esta seção e suas subseções."
              : "A mudança vale para o site inteiro."}
            {associacao.incluir_subdominios
              ? " Inclui também os subdomínios cadastrados nessa associação."
              : ""}
            {"\n"}Os clippings já salvos mantêm seus veículos.
          </Text>

          <View style={styles.acoes}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onCancelar}
              style={[styles.botao, { borderColor: theme.borda }]}
            >
              <Text weight="SemiBold" style={styles.rotulo}>
                CANCELAR
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onConfirmar}
              style={[
                styles.botao,
                {
                  borderColor: theme.borda,
                  backgroundColor: theme.backgroundContainer,
                },
              ]}
            >
              <Text
                weight="Bold"
                style={[styles.rotulo, { color: theme.textoContainer }]}
              >
                CONFIRMAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : podeEditar && enderecoCompativel ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={pendente ? onDesfazer : onEditar}
          style={styles.editar}
        >
          <Ionicons
            name={pendente ? "arrow-undo-outline" : "create-outline"}
            size={16}
            color={theme.textoTerciaria}
          />
          <Text
            weight="SemiBold"
            style={[styles.rotulo, { color: theme.textoTerciaria }]}
          >
            {pendente ? "DESFAZER" : "CORRIGIR ASSOCIAÇÃO"}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.texto, { color: theme.textoSub }]}>
          {!podeEditar
            ? "É preciso ter permissão para editar veículos para corrigir essa associação."
            : "O link redirecionou para outro domínio. Corrija este endereço pelo cadastro do veículo."}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: 8,
    marginTop: 9,
  },
  texto: {
    fontSize: 11,
    lineHeight: 17,
  },
  titulo: {
    fontSize: 13,
    lineHeight: 19,
  },
  confirmacao: {
    gap: 10,
  },
  acoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  botao: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
  },
  editar: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    gap: 5,
  },
});
