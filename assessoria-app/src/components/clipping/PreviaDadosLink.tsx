import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  ExtracaoLink,
} from "@/services/api/clipping";
import {
  dataISOParaBR,
  segundosParaTempo,
} from "@/utils/clippingFormatacao";

type Modo = "tudo" | "vazios";

interface Props {
  dados: ExtracaoLink | null;
  onFechar: () => void;
  onAplicar: (modo: Modo) => void;
  visible: boolean;
  onSelecionarVeiculo: (
    veiculo: NonNullable<
        ExtracaoLink["veiculo_sugerido"]
    >
  ) => void;
  onCadastroRapido: (
    nome: string,
    host: string
  ) => void;
  podeCriarVeiculo: boolean;
  onDesfazerVeiculo: () => void;
}

export default function PreviaDadosLink({
  dados,
  onFechar,
  onAplicar,
  onSelecionarVeiculo,
  onDesfazerVeiculo,
  onCadastroRapido,
  podeCriarVeiculo,
  visible,
}: Props) {
  const { theme } = useTheme();

  if (!dados || !visible) return null;

  const temCampos =
    Boolean(dados.pauta) ||
    Boolean(dados.data_publicacao) ||
    Boolean(dados.veiculo_sugerido) ||
    dados.duracao_segundos !== null;

  const pautaLonga =
    dados.pauta !== null &&
    Array.from(dados.pauta).length > 250;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <View style={styles.sombra}>
        <View
          style={[
            styles.caixa,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          <View style={styles.cabecalho}>
            <View style={styles.cabecalhoTexto}>
              <Text weight="Bold" style={styles.titulo}>
                Dados encontrados
              </Text>
              <Text
                style={[
                  styles.introducao,
                  { color: theme.textoSub },
                ]}
              >
                Confira o que foi identificado antes de preencher o clipping.
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar dados encontrados"
              onPress={onFechar}
              style={styles.fechar}
            >
              <Ionicons name="close" size={22} color={theme.texto} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.lista}
            showsVerticalScrollIndicator={false}
          >
            {dados.pauta ? (
              <Linha
                titulo="PAUTA"
                valor={dados.pauta}
              />
            ) : null}

            {pautaLonga ? (
              <Text style={{ color: theme.aviso }}>
                A pauta ultrapassa 250 caracteres.
                Ela não será inserida automaticamente;
                ajuste o título manualmente.
              </Text>
            ) : null}

            {dados.data_publicacao ? (
              <Linha
                titulo="DATA DE PUBLICAÇÃO"
                valor={dataISOParaBR(
                  dados.data_publicacao
                )}
              />
            ) : null}

            <Linha
                titulo="PORTAL IDENTIFICADO"
                valor={dados.nome_portal}
                />

                <View
                  style={[
                    styles.secaoVeiculo,
                    { borderColor: theme.borda },
                  ]}
                >
                  {dados.veiculo_sugerido ? (
                    <>
                      <View style={styles.cabecalhoVeiculo}>
                        <Text
                          weight="Bold"
                          style={[
                            styles.rotulo,
                            { color: theme.textoSub },
                          ]}
                        >
                          VEÍCULO SELECIONADO
                        </Text>

                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Trocar veículo selecionado"
                          onPress={onDesfazerVeiculo}
                          style={styles.trocarVeiculo}
                        >
                          <Ionicons
                            name="arrow-undo-outline"
                            size={15}
                            color={theme.textoSecundaria}
                          />
                          <Text
                            weight="SemiBold"
                            style={{ color: theme.textoSecundaria }}
                          >
                            TROCAR
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text weight="SemiBold">
                        {dados.veiculo_sugerido.nome}
                      </Text>

                      {dados.associar_endereco_ao_salvar ? (
                        <Text
                          style={[
                            styles.avisoAssociacao,
                            { color: theme.textoSub },
                          ]}
                        >
                          Se este veículo for aplicado, o domínio{" "}
                          {dados.endereco_sugerido.host} será associado
                          quando você salvar o clipping.
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {dados.sugestoes_veiculos.length > 0 ? (
                        <>
                          <Text
                            weight="Bold"
                            style={[
                              styles.rotulo,
                              { color: theme.textoSub },
                            ]}
                          >
                            VEÍCULOS JÁ CADASTRADOS
                          </Text>

                          {dados.sugestoes_veiculos.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              accessibilityRole="button"
                              onPress={() => onSelecionarVeiculo(item)}
                              style={[
                                styles.sugestao,
                                { borderColor: theme.borda },
                              ]}
                            >
                              <Text style={styles.nomeSugestao}>
                                {item.nome}
                              </Text>
                              <Ionicons
                                name="chevron-forward"
                                size={17}
                                color={theme.textoSecundaria}
                              />
                            </TouchableOpacity>
                          ))}
                        </>
                      ) : (
                        <Text
                          style={[
                            styles.semVeiculo,
                            { color: theme.textoSub },
                          ]}
                        >
                          Nenhum veículo cadastrado foi identificado.
                        </Text>
                      )}

                      {dados.veiculo_ambiguo ? (
                        <Text style={{ color: theme.aviso }}>
                          Mais de um veículo corresponde ao endereço.
                          Escolha o correto.
                        </Text>
                      ) : null}

                      {podeCriarVeiculo ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() =>
                            onCadastroRapido(
                              dados.nome_portal,
                              dados.endereco_sugerido.host
                            )
                          }
                          style={styles.cadastrarVeiculo}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={18}
                            color={theme.textoSecundaria}
                          />
                          <Text
                            weight="SemiBold"
                            style={{ color: theme.textoSecundaria }}
                          >
                            Cadastrar novo veículo
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  )}
                </View>

            {dados.veiculo_ambiguo ? (
              <Text style={{ color: theme.aviso }}>
                Mais de um veículo corresponde a
                este endereço. Selecione o veículo
                manualmente.
              </Text>
            ) : null}

            {dados.duracao_segundos !== null ? (
              <Linha
                titulo="DURAÇÃO DO VÍDEO"
                valor={segundosParaTempo(
                  dados.duracao_segundos
                )}
              />
            ) : null}

            {dados.duracao_segundos !== null ? (
              <Text
                style={[
                  styles.nota,
                  { color: theme.textoSub },
                ]}
              >
                Ao inserir a duração, o trecho será
                definido do início ao fim do vídeo.
              </Text>
            ) : null}

            {!temCampos ? (
              <Text style={{ color: theme.textoSub }}>
                A página abriu, mas não publicou
                dados suficientes para preencher
                esses campos.
              </Text>
            ) : null}
          </ScrollView>

          {temCampos ? (
            <View style={styles.acoes}>
              <Button
                title="INSERIR TUDO"
                onPress={() => onAplicar("tudo")}
                style={styles.botaoAcao}
              />
              <Button
                title="SÓ VAZIOS"
                variant="outline"
                onPress={() => onAplicar("vazios")}
                style={styles.botaoAcao}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Linha({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.linha}>
      <Text
        weight="Bold"
        style={[
          styles.rotulo,
          { color: theme.textoSub },
        ]}
      >
        {titulo}
      </Text>
      <Text style={{ color: theme.texto }}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sombra: {
    flex: 1,
    backgroundColor: "#0009",
    justifyContent: "center",
    padding: 18,
  },
  caixa: {
    maxHeight: "88%",
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  titulo: {
    fontSize: 18,
  },
  introducao: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  fechar: {
    width: 32,
    height: 32,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lista: {
    flexGrow: 0,
    marginBottom: 12,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cabecalhoTexto: {
    flex: 1,
  },
  secaoVeiculo: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 2,
    marginBottom: 16,
  },
  cabecalhoVeiculo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  trocarVeiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  avisoAssociacao: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  sugestao: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  nomeSugestao: {
    flex: 1,
    paddingVertical: 10,
  },
  semVeiculo: {
    fontSize: 12,
    lineHeight: 18,
  },
  cadastrarVeiculo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 14,
    paddingVertical: 7,
  },
  acoes: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  botaoAcao: {
    flex: 1,
    width: "auto",
    minHeight: 48,
    paddingHorizontal: 6,
  },
  linha: {
    marginBottom: 14,
  },
  rotulo: {
    fontSize: 11,
    marginBottom: 4,
  },
  nota: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  botao: {
    marginTop: 8,
  },
});