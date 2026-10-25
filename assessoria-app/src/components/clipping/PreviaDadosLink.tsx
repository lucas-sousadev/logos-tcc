import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import VeiculoSelector, {
  type SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type { ExtracaoLink } from "@/services/api/clipping";
import {
  dataISOParaBR,
  segundosParaTempo,
} from "@/utils/clippingFormatacao";

type Modo = "tudo" | "vazios";
type VeiculoEncontrado = NonNullable<
  ExtracaoLink["veiculo_sugerido"]
>;

interface Props {
  dados: ExtracaoLink | null;
  visible: boolean;
  onFechar: () => void;
  onAplicar: (modo: Modo) => void;
  onSelecionarVeiculo: (veiculo: VeiculoEncontrado) => void;
  onDesfazerVeiculo: () => void;
  onCadastroRapido: (
    nome: string,
    endereco: ExtracaoLink["endereco_sugerido"]
  ) => void;
  podeCriarVeiculo: boolean;
}

export default function PreviaDadosLink({
  dados,
  visible,
  onFechar,
  onAplicar,
  onSelecionarVeiculo,
  onDesfazerVeiculo,
  onCadastroRapido,
  podeCriarVeiculo,
}: Props) {
  const { theme } = useTheme();
  const [buscaVeiculo, setBuscaVeiculo] =
    useState<SelecaoVeiculo>({ id: null, nome: "" });

  useEffect(() => {
    setBuscaVeiculo({ id: null, nome: "" });
  }, [visible, dados?.url_consultada]);

  if (!dados || !visible) return null;

  const pautaLonga =
    dados.pauta !== null &&
    Array.from(dados.pauta).length > 250;

  const temDadosAplicaveis =
    (Boolean(dados.pauta) && !pautaLonga) ||
    Boolean(dados.data_publicacao) ||
    dados.duracao_segundos !== null ||
    dados.veiculo_sugerido !== null;

  const temMetadados =
    Boolean(dados.data_publicacao) ||
    dados.duracao_segundos !== null;

  const linkInstagram =
    /^https?:\/\/(?:www\.|m\.)?instagram\.com(?:[\/:?#]|$)/i.test(
      dados.url_consultada
    );
  const avisoMetadados = linkInstagram
    ? dados.data_publicacao === null
      ? "Não foi possível identificar automaticamente a data da publicação."
      : null
    : dados.aviso_metadados;

  const enderecoAssociado =
    dados.endereco_sugerido.host +
    dados.endereco_sugerido.caminho_prefixo;

  function selecionarVeiculo(veiculo: VeiculoEncontrado) {
    setBuscaVeiculo({ id: null, nome: "" });
    onSelecionarVeiculo(veiculo);
  }

  function escolherNaBusca(selecionado: SelecaoVeiculo) {
    if (selecionado.id === null) {
      setBuscaVeiculo(selecionado);
      return;
    }

    selecionarVeiculo({
      id: selecionado.id,
      nome: selecionado.nome,
      descricao: selecionado.descricao ?? null,
      alcance: selecionado.alcance ?? null,
      logo_path: selecionado.logo_path ?? null,
      tier: selecionado.tier ?? null,
      ativo: selecionado.ativo ?? 1,
    });
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sombra}
      >
        <View
          style={[
            styles.caixa,
            {
              backgroundColor: theme.background,
              borderColor: theme.borda,
            },
          ]}
        >
          <View
            style={[
              styles.cabecalho,
              { borderBottomColor: theme.borda },
            ]}
          >
            <View style={styles.cabecalhoTexto}>
              <Text weight="Bold" style={styles.titulo}>
                Dados encontrados
              </Text>
              <Text
                style={[
                  styles.subtitulo,
                  { color: theme.textoSub },
                ]}
              >
                Confira os dados antes de preencher o clipping.
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar dados encontrados"
              onPress={onFechar}
              style={styles.fechar}
            >
              <Ionicons
                name="close"
                size={23}
                color={theme.texto}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.lista}
            contentContainerStyle={styles.conteudo}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.tituloSecao}>
              <Ionicons
                name="document-text-outline"
                size={19}
                color={theme.textoTerciaria}
              />
              <Text weight="Medium" style={styles.nomeSecao}>
                Publicação
              </Text>
            </View>

            <View
              style={[
                styles.cartao,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda,
                },
              ]}
            >
              {dados.pauta ? (
                <View style={styles.campoPauta}>
                  <Rotulo>PAUTA</Rotulo>
                  <Text
                    selectable
                    style={styles.valorPauta}
                  >
                    {dados.pauta}
                  </Text>
                </View>
              ) : null}

              {pautaLonga ? (
                <View style={styles.avisoLinha}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={17}
                    color={theme.aviso}
                  />
                  <Text
                    style={[
                      styles.textoAviso,
                      { color: theme.aviso },
                    ]}
                  >
                    A pauta passou de 250 caracteres. Ela não
                    será inserida automaticamente.
                  </Text>
                </View>
              ) : null}

              {temMetadados ? (
                <View
                  style={[
                    styles.metadados,
                    dados.pauta
                      ? {
                          borderTopWidth: 1,
                          borderTopColor: theme.borda,
                        }
                      : null,
                  ]}
                >
                  {dados.data_publicacao ? (
                    <View style={styles.metadado}>
                      <View style={styles.metadadoTexto}>
                        <Rotulo>DATA</Rotulo>
                        <Text weight="SemiBold">
                          {dataISOParaBR(
                            dados.data_publicacao
                          )}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {dados.duracao_segundos !== null ? (
                    <View style={styles.metadado}>
                      <View style={styles.metadadoTexto}>
                        <Rotulo>DURAÇÃO</Rotulo>
                        <Text weight="SemiBold">
                          {segundosParaTempo(
                            dados.duracao_segundos
                          )}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {dados.duracao_segundos !== null ? (
                <Text
                  style={[
                    styles.notaDuracao,
                    { color: theme.textoSub },
                  ]}
                >
                  O trecho será preenchido do início ao fim
                  do vídeo.
                </Text>
              ) : null}

              {avisoMetadados ? (
                <View style={styles.avisoLinha}>
                  <Ionicons
                    name="information-circle-outline"
                    size={17}
                    color={theme.aviso}
                  />
                  <Text
                    style={[
                      styles.textoAviso,
                      { color: theme.aviso },
                    ]}
                  >
                    {avisoMetadados}
                  </Text>
                </View>
              ) : null}

              {!dados.pauta && !temMetadados ? (
                <Text
                  style={[
                    styles.textoAuxiliar,
                    { color: theme.textoSub },
                  ]}
                >
                  Não foram encontrados dados da publicação.
                </Text>
              ) : null}
            </View>

            <View style={[styles.tituloSecao, styles.espacoSecao]}>
              <Ionicons
                name="newspaper-outline"
                size={19}
                color={theme.textoTerciaria}
              />
              <Text weight="Medium" style={styles.nomeSecao}>
                Veículo
              </Text>
            </View>

            <View
              style={[
                styles.cartao,
                {
                  backgroundColor: theme.backgroundSecundario,
                  borderColor: theme.borda,
                },
              ]}
            >
              {dados.portal_confiavel ? (
                <View style={styles.origem}>
                  <Rotulo>IDENTIFICADO NO LINK</Rotulo>
                  <Text
                    weight="SemiBold"
                    style={styles.nomeOrigem}
                  >
                    {dados.nome_portal}
                  </Text>
                </View>
              ) : (
                <View style={styles.avisoLinha}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={theme.aviso}
                  />
                  <Text
                    style={[
                      styles.textoAviso,
                      { color: theme.aviso },
                    ]}
                  >
                    Não foi possível confirmar o veículo.
                    Escolha um cadastrado ou crie um novo.
                  </Text>
                </View>
              )}

              {dados.veiculo_sugerido ? (
                <View
                  style={[
                    styles.veiculoSelecionado,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.alteracao,
                    },
                  ]}
                >
                  <View style={styles.linhaSelecionado}>
                    <Ionicons
                      name="checkmark-circle"
                      size={19}
                      color={theme.alteracao}
                    />
                    <Text
                      weight="SemiBold"
                      style={[
                        styles.selecionadoRotulo,
                        { color: theme.alteracao },
                      ]}
                    >
                      VEÍCULO SELECIONADO
                    </Text>

                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Trocar veículo selecionado"
                      onPress={() => {
                        setBuscaVeiculo({
                          id: null,
                          nome: "",
                        });
                        onDesfazerVeiculo();
                      }}
                      style={styles.trocar}
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={15}
                        color={theme.textoTerciaria}
                      />
                      <Text
                        weight="SemiBold"
                        style={{
                          color: theme.textoTerciaria,
                          fontSize: 11,
                        }}
                      >
                        TROCAR
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    weight="Bold"
                    style={styles.nomeSelecionado}
                  >
                    {dados.veiculo_sugerido.nome}
                  </Text>

                  {dados.endereco_associado_veiculo_id ===
                    dados.veiculo_sugerido.id ? (
                      <Text
                        style={[
                          styles.avisoAssociacao,
                          { color: theme.alteracao },
                        ]}
                      >
                        O endereço {enderecoAssociado} já foi associado
                        a este veículo no cadastro.
                      </Text>
                    ) : dados.associar_endereco_ao_salvar ? (
                      <Text
                        style={[
                          styles.avisoAssociacao,
                          { color: theme.textoSub },
                        ]}
                      >
                        Ao salvar o clipping, o endereço{" "}
                        {enderecoAssociado} será associado
                        a este veículo.
                      </Text>
                    ) : dados.endereco_associado_veiculo_id ? (
                      <Text
                        style={[
                          styles.avisoAssociacao,
                          { color: theme.aviso },
                        ]}
                      >
                        Este endereço já foi salvo no veículo
                        recém-cadastrado. Trocar o veículo do clipping
                        não altera aquele cadastro.
                      </Text>
                    ) : null}
                </View>
              ) : (
                <>
                  {dados.veiculo_ambiguo ? (
                    <View style={styles.avisoLinha}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={17}
                        color={theme.aviso}
                      />
                      <Text
                        style={[
                          styles.textoAviso,
                          { color: theme.aviso },
                        ]}
                      >
                        Há mais de um veículo possível.
                        Selecione o correto.
                      </Text>
                    </View>
                  ) : null}

                  {dados.sugestoes_veiculos.length > 0 ? (
                    <View style={styles.sugestoes}>
                      <Rotulo>
                        VEÍCULOS CADASTRADOS SEMELHANTES
                      </Rotulo>

                      {dados.sugestoes_veiculos.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${item.nome}`}
                          onPress={() =>
                            selecionarVeiculo(item)
                          }
                          style={[
                            styles.sugestao,
                            {
                              backgroundColor: theme.background,
                              borderColor: theme.borda,
                            },
                          ]}
                        >
                          <Text
                            weight="SemiBold"
                            style={styles.nomeSugestao}
                          >
                            {item.nome}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={17}
                            color={theme.textoTerciaria}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.semSugestao,
                        { color: theme.textoSub },
                      ]}
                    >
                      Nenhum veículo cadastrado foi sugerido.
                    </Text>
                  )}

                  {dados.sugestoes_veiculos.length > 0 ? (
                    <View style={styles.divisor}>
                      <View
                        style={[
                          styles.linhaDivisor,
                          { backgroundColor: theme.borda },
                        ]}
                      />
                      <Text
                        weight="Medium"
                        style={[
                          styles.textoDivisor,
                          { color: theme.textoSub },
                        ]}
                      >
                        OU BUSQUE OUTRO 
                      </Text>
                      <View
                        style={[
                          styles.linhaDivisor,
                          { backgroundColor: theme.borda },
                        ]}
                      />
                    </View>
                  ) : null}

                  <View style={styles.busca}>
                    <VeiculoSelector
                      value={buscaVeiculo}
                      modoImportacao
                      onChange={escolherNaBusca}
                    />
                  </View>

                  {podeCriarVeiculo ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Cadastrar novo veículo"
                      onPress={() =>
                        onCadastroRapido(
                          dados.portal_confiavel
                            ? dados.nome_portal
                            : "",
                          dados.endereco_sugerido
                        )
                      }
                      style={styles.cadastrar}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color={theme.textoTerciaria}
                      />
                      <Text
                        weight="SemiBold"
                        style={{
                          color: theme.textoTerciaria,
                          fontSize: 12,
                        }}
                      >
                        Cadastrar novo veículo
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>

            {!temDadosAplicaveis ? (
              <View style={styles.semDados}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={theme.textoSub}
                />
                <Text
                  style={[
                    styles.textoAuxiliar,
                    { color: theme.textoSub },
                  ]}
                >
                  Escolha um veículo ou preencha os dados
                  manualmente no clipping.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {temDadosAplicaveis ? (
            <View
              style={[
                styles.rodape,
                { borderTopColor: theme.borda },
              ]}
            >
              <Text
                weight="SemiBold"
                style={styles.tituloRodape}
              >
                Como deseja preencher?
              </Text>

              <View style={styles.acoes}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Inserir tudo e substituir os campos preenchidos"
                  onPress={() => onAplicar("tudo")}
                  style={[
                    styles.acao,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                    },
                  ]}
                >
                  <Text
                    weight="Bold"
                    style={{
                      color: theme.textoContainer,
                      fontSize: 12,
                    }}
                  >
                    INSERIR TUDO
                  </Text>
                  <Text
                    style={[
                      styles.descricaoAcao,
                      { color: theme.textoContainer },
                    ]}
                  >
                    Substitui os campos atuais
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Preencher somente os campos vazios"
                  onPress={() => onAplicar("vazios")}
                  style={[
                    styles.acao,
                    styles.acaoSecundaria,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.borda,
                    },
                  ]}
                >
                  <Text
                    weight="Bold"
                    style={{
                      color: theme.texto,
                      fontSize: 12,
                    }}
                  >
                    SÓ VAZIOS
                  </Text>
                  <Text
                    style={[
                      styles.descricaoAcao,
                      { color: theme.textoSub },
                    ]}
                  >
                    Preserva o que já existe
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Rotulo({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <Text
      weight="Bold"
      style={[
        styles.rotulo,
        { color: theme.textoSub },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  sombra: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0009",
    padding: 16,
  },
  caixa: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 15,
  },
  cabecalhoTexto: {
    flex: 1,
    paddingRight: 8,
  },
  titulo: {
    fontSize: 18,
    lineHeight: 24,
  },
  subtitulo: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  fechar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  lista: {
    flexShrink: 1,
    minHeight: 0,
  },
  conteudo: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },
  tituloSecao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  espacoSecao: {
    marginTop: 20,
  },
  nomeSecao: {
    fontSize: 14,
  },
  cartao: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  campoPauta: {
    marginBottom: 2,
  },
  rotulo: {
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 4,
  },
  valorPauta: {
    fontSize: 14,
    lineHeight: 21,
  },
  metadados: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 12,
    marginTop: 12,
  },
  metadado: {
    flexBasis: "42%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  metadadoTexto: {
    flex: 1,
  },
  notaDuracao: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  avisoLinha: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 10,
  },
  textoAviso: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },
  origem: {
    marginBottom: 13,
  },
  nomeOrigem: {
    fontSize: 14,
    lineHeight: 20,
  },
  veiculoSelecionado: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  linhaSelecionado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selecionadoRotulo: {
    flex: 1,
    fontSize: 10,
  },
  trocar: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nomeSelecionado: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  avisoAssociacao: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },
  sugestoes: {
    gap: 7,
  },
  sugestao: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  nomeSugestao: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 9,
  },
  semSugestao: {
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
  },
  divisor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 13,
  },
  linhaDivisor: {
    flex: 1,
    height: 1,
  },
  textoDivisor: {
    fontSize: 10,
  },
  busca: {
    marginBottom: -8,
  },
  cadastrar: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  semDados: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
  },
  textoAuxiliar: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },
  rodape: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 17,
  },
  tituloRodape: {
    fontSize: 12,
    marginBottom: 10,
  },
  acoes: {
    flexDirection: "row",
    gap: 8,
  },
  acao: {
    flex: 1,
    minHeight: 66,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 9,
  },
  acaoSecundaria: {
    borderWidth: 1.5,
  },
  descricaoAcao: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 4,
  },
});
