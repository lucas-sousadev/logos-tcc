import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import VeiculoSelector, {
  type SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";
import Text from "@/components/ui/Text";
import Input from "@/components/ui/Input";
import CorrecaoAssociacaoLink from "@/components/clipping/CorrecaoAssociacaoLink";
import {
  normalizarSecaoAssociacao,
  validarSecaoAssociacao,
} from "@/utils/associacaoEnderecoLink";
import { useTheme } from "@/contexts/ThemeContext";
import type { ExtracaoLink } from "@/services/api/clipping";
import {
  dataISOParaBR,
  segundosParaTempo,
} from "@/utils/clippingFormatacao";

type Modo = "tudo" | "vazios";
type EscopoAssociacao = NonNullable<ExtracaoLink["escopo_associacao"]>;
type VeiculoEncontrado = NonNullable<
  ExtracaoLink["veiculo_sugerido"]
>;

const NOMES_CAMPOS_TEMPO = {
  pauta: "pauta",
  data_publicacao: "data da publicação",
  duracao_segundos: "duração do vídeo",
  nome_portal: "identificação do veículo",
};

interface Props {
  dados: ExtracaoLink | null;
  visible: boolean;
  onFechar: () => void;
  onAplicar: (modo: Modo) => void;
  onSelecionarVeiculo: (veiculo: VeiculoEncontrado) => void;
  onDesfazerVeiculo: () => void;
  onCadastroRapido: (
    nome: string,
    endereco: ExtracaoLink["endereco_sugerido"] | null
  ) => void;
  podeCriarVeiculo: boolean;
  podeAssociarEndereco: boolean;
  veiculoAtualPreenchido: boolean;
  onConfigurarAssociacao: (
    escopo: EscopoAssociacao,
    caminho: string
  ) => void;
  onConfigurarTransferencia: (confirmada: boolean) => void;
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
  podeAssociarEndereco,
  veiculoAtualPreenchido,
  onConfigurarAssociacao,
  onConfigurarTransferencia,
}: Props) {
  const { theme } = useTheme();
  const [buscaVeiculo, setBuscaVeiculo] =
    useState<SelecaoVeiculo>({ id: null, nome: "" });
  const [confirmandoTransferencia, setConfirmandoTransferencia] =
    useState(false);

  useEffect(() => {
    setBuscaVeiculo({ id: null, nome: "" });
  }, [visible, dados?.url_consultada]);

  useEffect(() => {
    setConfirmandoTransferencia(false);
  }, [visible, dados?.url_consultada, dados?.veiculo_sugerido?.id]);

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

  const temDadosEncontrados =
    Boolean(dados.pauta) ||
    temMetadados ||
    dados.portal_confiavel ||
    dados.veiculo_sugerido !== null;
    
  const linkInstagram =
    /^https?:\/\/(?:www\.|m\.)?instagram\.com(?:[\/:?#]|$)/i.test(
      dados.url_consultada
    );
  const avisoTempo = dados.aviso_tempo;

  const camposSemIdentificacao = avisoTempo?.campos_nao_identificados
    .map((campo) => NOMES_CAMPOS_TEMPO[campo])
    .join(", ");

  const tituloAvisoTempo =
    avisoTempo?.tipo === "prazo_total"
      ? `A busca atingiu o limite de ${avisoTempo.limite_total_segundos} segundos`
      : "Uma consulta atingiu o limite de espera";

  const avisoMetadados = avisoTempo
    ? null
    : linkInstagram
      ? dados.data_publicacao === null
        ? "Não foi possível identificar automaticamente a data da publicação."
        : null
      : dados.aviso_metadados;

  const enderecoAssociado =
    dados.endereco_sugerido.host +
    dados.endereco_sugerido.caminho_prefixo;

  const plataforma = ["youtube.com", "youtu.be", "instagram.com"].includes(
    dados.endereco_sugerido.host.toLowerCase().replace(/^(www|m)\./, "")
  );

  const podeConfigurarAssociacao =
    dados.endereco_associavel &&
    dados.endereco_associado_veiculo_id == null &&
    !plataforma &&
    (podeAssociarEndereco || (podeCriarVeiculo && !dados.veiculo_sugerido));

  const escopo =
    dados.escopo_associacao ??
    (dados.endereco_sugerido.caminho_prefixo ? "secao" : "site");

  const erroSecao =
    podeConfigurarAssociacao && escopo === "secao"
      ? validarSecaoAssociacao(
          dados.endereco_sugerido.caminho_prefixo,
          dados.url_consultada
        )
      : null;

  const bloquearAplicacao = Boolean(
    confirmandoTransferencia ||
    (
      dados.veiculo_sugerido &&
      dados.associar_endereco_ao_salvar &&
      erroSecao
    )
  );

  const transferenciaPendente = Boolean(dados.transferir_endereco_ao_salvar);
  const bloquearSoVazios =
    confirmandoTransferencia ||
    (bloquearAplicacao && !veiculoAtualPreenchido) ||
    (transferenciaPendente && veiculoAtualPreenchido);

  const caminhoSecao = normalizarSecaoAssociacao(
    dados.endereco_sugerido.caminho_prefixo
  );

  const enderecoParaCadastro =
    escopo === "nenhum" || dados.endereco_associado_veiculo_id != null
      ? null
      : {
          ...dados.endereco_sugerido,
          caminho_prefixo: caminhoSecao,
        };

  const descricaoAssociacao = escopo === "site"
    ? `Reconhece links de qualquer seção de ${dados.endereco_sugerido.host}.`
    : `Reconhece apenas ${dados.endereco_sugerido.host}${caminhoSecao} e suas subseções.`;

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
            {avisoTempo ? (
              <View
                style={[
                  styles.caixaAvisoTempo,
                  { borderColor: theme.aviso },
                ]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Ionicons
                  name="timer-outline"
                  size={20}
                  color={theme.aviso}
                />
                <View style={styles.conteudoAvisoTempo}>
                  <Text
                    weight="SemiBold"
                    style={[
                      styles.tituloAvisoTempo,
                      { color: theme.aviso },
                    ]}
                  >
                    {tituloAvisoTempo}
                  </Text>
                  <Text style={styles.textoAvisoTempo}>
                    {temDadosEncontrados
                      ? "Os dados encontrados continuam disponíveis. Confira antes de aplicar."
                      : "Não foi possível identificar dados no link. Tente novamente ou preencha os campos manualmente."}
                  </Text>
                  {camposSemIdentificacao ? (
                    <Text style={styles.textoAvisoTempo}>
                      Sem identificação: {camposSemIdentificacao}.
                      Complete manualmente o que for necessário.
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

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

              {podeConfigurarAssociacao ? (
                <View
                  style={[
                    styles.associacao,
                    { borderTopColor: theme.borda },
                  ]}
                >
                  <View style={styles.linhaAssociacao}>
                    <Text weight="SemiBold" style={styles.tituloAssociacao}>
                      Reconhecer próximos links
                    </Text>
                    <Switch
                      accessibilityLabel="Salvar endereço para reconhecer próximos links"
                      value={escopo !== "nenhum"}
                      onValueChange={(lembrar) => {
                        onConfigurarAssociacao(
                          lembrar
                            ? dados.endereco_sugerido.caminho_prefixo
                              ? "secao"
                              : "site"
                            : "nenhum",
                          dados.endereco_sugerido.caminho_prefixo
                        );
                      }}
                      trackColor={{ false: theme.borda, true: theme.primaria }}
                      thumbColor={theme.branco}
                    />
                  </View>

                  {escopo !== "nenhum" ? (
                    <>
                      <View style={styles.opcoesAssociacao}>
                        {(["site", "secao"] as const).map((opcao) => (
                          <TouchableOpacity
                            key={opcao}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: escopo === opcao }}
                            onPress={() =>
                              onConfigurarAssociacao(
                                opcao,
                                dados.endereco_sugerido.caminho_prefixo
                              )
                            }
                            style={styles.opcaoAssociacao}
                          >
                            <Ionicons
                              name={
                                escopo === opcao
                                  ? "radio-button-on"
                                  : "radio-button-off"
                              }
                              size={18}
                              color={
                                escopo === opcao
                                  ? theme.primaria
                                  : theme.textoSub
                              }
                            />
                            <Text style={styles.textoOpcaoAssociacao}>
                              {opcao === "site" ? "Site inteiro" : "Uma seção"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {escopo === "secao" ? (
                        <Input
                          label="SEÇÃO DO SITE"
                          placeholder="Ex.: /agro"
                          value={dados.endereco_sugerido.caminho_prefixo}
                          onChangeText={(caminho) =>
                            onConfigurarAssociacao("secao", caminho)
                          }
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={300}
                          error={erroSecao ?? undefined}
                        />
                      ) : null}

                      <Text
                        style={[
                          styles.descricaoAssociacao,
                          { color: theme.textoSub },
                        ]}
                      >
                        {descricaoAssociacao}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={[
                        styles.descricaoAssociacao,
                        { color: theme.textoSub },
                      ]}
                    >
                      A escolha será usada apenas neste clipping.
                    </Text>
                  )}
                </View>
              ) : null}

              {dados.veiculo_sugerido ? (
                <View style={styles.veiculoSelecionado}>
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
                  ) : dados.endereco_associado ? (
                    <CorrecaoAssociacaoLink
                      associacao={dados.endereco_associado}
                      destinoNome={dados.veiculo_sugerido.nome}
                      podeEditar={podeAssociarEndereco}
                      enderecoCompativel={dados.endereco_associavel}
                      confirmando={confirmandoTransferencia}
                      pendente={transferenciaPendente}
                      onEditar={() => setConfirmandoTransferencia(true)}
                      onCancelar={() => setConfirmandoTransferencia(false)}
                      onConfirmar={() => {
                        setConfirmandoTransferencia(false);
                        onConfigurarTransferencia(true);
                      }}
                      onDesfazer={() => onConfigurarTransferencia(false)}
                    />
                  ) : dados.associar_endereco_ao_salvar ? (
                    <Text
                      style={[
                        styles.avisoAssociacao,
                        { color: theme.textoSub },
                      ]}
                    >
                      Se este veículo for aplicado, o endereço{" "}
                      {enderecoAssociado} será associado a ele
                      quando você salvar o clipping.
                    </Text>
                  ) : dados.endereco_associado_veiculo_id ? (
                    <Text
                      style={[
                        styles.avisoAssociacao,
                        { color: theme.aviso },
                      ]}
                    >
                      Este endereço já pertence a outro veículo.
                      Trocar o veículo deste clipping não altera
                      aquela associação.
                      {podeAssociarEndereco
                        ? " Busque os dados do link novamente para carregar a associação atual e poder corrigi-la."
                        : ""}
                    </Text>
                  ) : dados.escopo_associacao === "nenhum" ? (
                      <Text
                        style={[
                          styles.avisoAssociacao,
                          { color: theme.textoSub },
                        ]}
                      >
                      Este veículo será usado apenas neste clipping.
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
                      disabled={Boolean(erroSecao)}
                      onPress={() => {
                        if (erroSecao) return;

                        onCadastroRapido(
                          dados.portal_confiavel
                            ? dados.nome_portal
                            : "",
                          enderecoParaCadastro
                        );
                      }}
                      style={[
                        styles.cadastrar,
                        { opacity: erroSecao ? 0.5 : 1 },
                      ]}
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
                  disabled={bloquearAplicacao}
                  onPress={() => onAplicar("tudo")}
                  style={[
                    styles.acao,
                    {
                      backgroundColor:
                        theme.backgroundContainer,
                      opacity: bloquearAplicacao ? 0.5 : 1,
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
                  disabled={bloquearSoVazios}
                  onPress={() => onAplicar("vazios")}
                  style={[
                    styles.acao,
                    styles.acaoSecundaria,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.borda,
                      opacity: bloquearSoVazios ? 0.5 : 1,
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
              {transferenciaPendente && veiculoAtualPreenchido ? (
                <Text
                  style={[
                    styles.avisoAssociacao,
                    { color: theme.aviso },
                  ]}
                >
                  Use INSERIR TUDO para aplicar o veículo e a correção.
                  SÓ VAZIOS preserva o veículo já preenchido.
                </Text>
              ) : null}
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
  caixaAvisoTempo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  conteudoAvisoTempo: {
    flex: 1,
    gap: 6,
  },
  tituloAvisoTempo: {
    fontSize: 12,
    lineHeight: 18,
  },
  textoAvisoTempo: {
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
    gap: 4,
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
  associacao: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 14,
    gap: 10,
  },
  linhaAssociacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tituloAssociacao: {
    flex: 1,
    fontSize: 12,
  },
  opcoesAssociacao: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  opcaoAssociacao: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    gap: 6,
  },
  textoOpcaoAssociacao: {
    fontSize: 12,
  },
  descricaoAssociacao: {
    fontSize: 11,
    lineHeight: 17,
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