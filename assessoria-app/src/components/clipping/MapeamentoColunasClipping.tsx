import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  CampoImportacaoClipping,
  EstruturaImportacaoClipping,
} from "@/services/api/clipping";

const DESTINOS: {
  campo: CampoImportacaoClipping;
  nome: string;
}[] = [
  { campo: "cliente", nome: "Cliente" },
  { campo: "ano_referencia", nome: "Ano de referência" },
  { campo: "data_publicacao", nome: "Data da publicação" },
  { campo: "mes_ano", nome: "Mês/ano da publicação" },
  { campo: "dia_mes", nome: "Dia ou dia/mês" },
  { campo: "categorias", nome: "Categorias" },
  { campo: "veiculo", nome: "Veículo" },
  { campo: "programa_secao", nome: "Programa/seção" },
  { campo: "pauta", nome: "Pauta" },
  { campo: "inicio", nome: "Início do trecho" },
  { campo: "fim", nome: "Fim do trecho" },
  { campo: "duracao", nome: "Duração total" },
  { campo: "tier", nome: "Tier" },
  { campo: "link", nome: "Link" },
  { campo: "observacoes", nome: "Observações" },
];

type Props = {
  estrutura: EstruturaImportacaoClipping;
  mapeamento: Array<CampoImportacaoClipping | null>;
  ignoradas: Set<number>;
  ocupado: boolean;
  onAlterarCampo: (
    indice: number,
    campo: CampoImportacaoClipping
  ) => void;
  onIgnorarColuna: (indice: number) => void;
  onAlterarCabecalho: (linha: number) => void;
  onDesfazerIgnorarColuna: (indice: number) => void;
};

function nomeDestino(campo: CampoImportacaoClipping) {
  return DESTINOS.find(
    (item) => item.campo === campo
  )?.nome ?? campo;
}

export default function MapeamentoColunasClipping({
  estrutura,
  mapeamento,
  ignoradas,
  ocupado,
  onAlterarCampo,
  onIgnorarColuna,
  onAlterarCabecalho,
  onDesfazerIgnorarColuna,
}: Props) {
  const { theme, mode } = useTheme();
  const corAcao = mode === "dark" ? "#B5C4E5" : "#283570";
  const fundoSelecionado = mode === "dark" ? "#5170FF" : "#5170FF";
  const fundoSuave = mode === "dark" ? "#1B2940" : "#F1F3F9";
  const bordaNeutra = mode === "dark" ? "#6B86FF" : "#6B86FF";
  const corAviso = mode === "dark" ? "#E2BD7E" : "#98671B";
  const corErro = mode === "dark" ? "#F0A5B2" : "#A42E4B";
  const corErro2 = mode === "dark" ? "#a13245" : "#c0677d";

  const [colunaAberta, setColunaAberta] =
    useState<number | null>(null);

  const [mostrarCabecalhos, setMostrarCabecalhos] =
    useState(false);

  const [mostrarTodas, setMostrarTodas] =
    useState(false);

  const associadas = estrutura.colunas.filter(
    (coluna) =>
      coluna.tem_dados &&
      mapeamento[coluna.indice] !== null
  ).length;

  const vazias = estrutura.colunas.filter(
    (coluna) => !coluna.tem_dados
  ).length;

  const pendentes = estrutura.colunas.filter(
    (coluna) =>
      coluna.tem_dados &&
      mapeamento[coluna.indice] === null &&
      !ignoradas.has(coluna.indice)
  );

  const ignoradasTotal = estrutura.colunas.filter(
    (coluna) => ignoradas.has(coluna.indice)
  ).length;

  const colunasVisiveis = mostrarTodas
  ? estrutura.colunas
  : estrutura.colunas.filter(
      (coluna) =>
        mapeamento[coluna.indice] === null ||
        !coluna.tem_dados
    );

  const linhaSugerida = estrutura.linhas_iniciais.find(
    (linha) =>
      linha.linha === estrutura.linha_sugerida
  );

  const linhaAtual = estrutura.linhas_iniciais.find(
    (linha) =>
      linha.linha === estrutura.linha_cabecalho
  );

  const leituraConfiavel =
    (linhaSugerida?.campos_reconhecidos ?? 0) >= 2;

  const linhasCandidatas = leituraConfiavel
    ? estrutura.linhas_iniciais.filter(
        (linha) =>
          linha.campos_reconhecidos > 0 ||
          linha.linha === estrutura.linha_cabecalho
      )
    : estrutura.linhas_iniciais;

  const linhaParecePublicacao =
    estrutura.linha_cabecalho !==
      estrutura.linha_sugerida &&
    (linhaSugerida?.campos_reconhecidos ?? 0) >= 2 &&
    (linhaAtual?.campos_reconhecidos ?? 0) === 0;

  const colunaSelecionada =
    colunaAberta === null
      ? null
      : estrutura.colunas[colunaAberta];

  return (
    <View style={styles.container}>
      <Text weight="Bold" style={styles.titulo}>
        2. Confira as colunas
      </Text>

      <Text
        style={[
          styles.ajuda,
          { color: theme.textoSub },
        ]}
      >
        O sistema associou as colunas reconhecidas do CSV.
        Confira as colunas que ainda precisam de decisão ou altere alguma associação.
      </Text>

      <View style={styles.leituraArquivo}>
        <Text weight="SemiBold">
          CSV lido: {estrutura.total_registros} publicações
          {" · "}
          {estrutura.colunas.length} colunas
        </Text>

        <Text
          style={[
            styles.ajuda,
            { color: theme.textoSub },
          ]}
        >
          Os nomes das colunas foram encontrados na linha{" "}
          {estrutura.linha_cabecalho}. As linhas seguintes
          são publicações e aparecerão na prévia.
        </Text>

        <Button
          title={mostrarCabecalhos ? "OCULTAR LEITURA" : "VER COMO O CSV FOI LIDO"}
          variant="outline"
          size="small"
          disabled={ocupado}
          onPress={() => setMostrarCabecalhos((atual) => !atual)}
          style={[styles.botaoAjuste, { borderColor: bordaNeutra }]}
        />

        {mostrarCabecalhos ? (
          <View style={styles.ajusteCabecalho}>
            <Text style={[styles.ajuda, { color: theme.textoSub }]}>
              O sistema usa uma linha para identificar nomes como Cliente,
              Data e Veículo. As linhas seguintes são publicações.
            </Text>

            {linhasCandidatas.length > 1 ? (
              linhasCandidatas.map((linha) => (
                <View key={linha.linha} style={styles.linhaCabecalho}>
                  <Button
                    title={`LINHA ${linha.linha}`}
                    variant={linha.linha === estrutura.linha_cabecalho ? "primary" : "outline"}
                    size="small"
                    disabled={ocupado}
                    onPress={() => {
                      if (linha.linha === estrutura.linha_cabecalho) return;
                      setMostrarCabecalhos(false);
                      onAlterarCabecalho(linha.linha);
                    }}
                    style={[
                      styles.botaoLinha,
                      {
                        borderColor: bordaNeutra,
                        backgroundColor: linha.linha === estrutura.linha_cabecalho
                          ? fundoSelecionado
                          : "transparent",
                      },
                    ]}
                  />
                  <Text numberOfLines={2} style={[styles.amostraLinha, { color: theme.textoSub }]}>
                    {linha.valores.filter((valor) => valor !== "").slice(0, 3).join(" · ") || "Linha vazia"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.ajuda, { color: theme.textoSub }]}>
                Neste arquivo, a linha {estrutura.linha_cabecalho} contém os nomes das colunas.
                As outras linhas examinadas são publicações e aparecerão na prévia.
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {linhaParecePublicacao ? (
        <View
          style={[
            styles.resumo,
            { borderColor: corAviso },
          ]}
        >
          <Text weight="SemiBold">
            Esta linha parece ser uma publicação
          </Text>

          <Text style={[styles.aviso, { color: corAviso }]}>
            A linha {estrutura.linha_sugerida} parece
            conter os nomes das colunas. Corrija a
            leitura antes de abrir a prévia.
          </Text>

          <Button
            title={`USAR LINHA ${estrutura.linha_sugerida}`}
            disabled={ocupado}
            onPress={() =>
              onAlterarCabecalho(
                estrutura.linha_sugerida
              )
            }
            style={[styles.botao, { backgroundColor: fundoSelecionado, borderColor: corAcao }]}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.painelResumo,
              {
                borderLeftColor: corAcao,
                backgroundColor: theme.background,
              },
            ]}
          >
            <Text
              weight="Bold"
              style={[
                styles.rotuloResumo,
                { color: corAcao },
              ]}
            >
              RESUMO DAS ASSOCIAÇÕES
            </Text>
            <Text weight="SemiBold">
              {associadas} pronta(s)
              {" · "}
              {pendentes.length} para revisar
              {" · "}
              {vazias} vazia(s)
              {" · "}
              {ignoradasTotal} ignorada(s)
            </Text>

            <Text
              style={[
                styles.ajuda,
                { color: theme.textoSub },
              ]}
            >
              {pendentes.length > 0
                ? "Escolha uma informação ou indique que a coluna não será importada."
                : "As colunas com dados já têm uma decisão. Você pode abrir a prévia."}
            </Text>

            <Button
              title={
                mostrarTodas
                  ? "VOLTAR À VISÃO RESUMIDA"
                  : "VER TODAS AS COLUNAS"
              }
              variant="outline"
              size="small"
              disabled={ocupado}
              onPress={() =>
                setMostrarTodas((atual) => !atual)
              }
              style={[styles.botao, { borderColor: bordaNeutra }]}
            />
          </View>

          {colunasVisiveis.length > 0 ? (
            <Text
              weight="SemiBold"
              style={styles.tituloListaColunas}
            >
              {mostrarTodas
                ? "Colunas do CSV"
                : "Colunas para conferir"}
            </Text>
          ) : null}

          {colunasVisiveis.map((coluna) => {
            const campo =
              mapeamento[coluna.indice];

            const ignorada =
              ignoradas.has(coluna.indice);

            const vazia = !coluna.tem_dados;

            const pendente =
              !vazia &&
              campo === null &&
              !ignorada;

            const corEstado =
              vazia || ignorada
                ? corErro
                : pendente
                  ? corAviso
                  : theme.textoTerciaria;

            const iconeEstado =
              vazia || ignorada
                ? "remove-circle-outline"
                : pendente
                  ? "alert-circle-outline"
                  : "checkmark-circle";

            const descricaoEstado = ignorada
              ? "Dados dessa coluna não serão importados"
              : vazia
                ? campo !== null
                  ? `${nomeDestino(campo)} (sem valores no CSV)`
                  : "Nenhum campo escolhido; coluna vazia"
                : campo !== null
                  ? `Será cadastrada em: ${nomeDestino(campo)}`
                  : "Será cadastrada em: Não escolhido";
                  
                  
            return (
              <View
                key={coluna.indice}
                style={[
                  styles.coluna,
                  {
                    borderColor: corEstado,
                    backgroundColor:
                      vazia || ignorada
                        ? `${corErro}12`
                        : campo !== null
                          ? fundoSuave
                          : theme.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rotuloOrigem,
                    { color: theme.textoSub },
                  ]}
                >
                  COLUNA NO CSV
                </Text>

                <Text weight="SemiBold">
                  {coluna.indice + 1}.{" "}
                  {coluna.original}
                </Text>

                <View style={styles.estado}>
                  <Ionicons
                    name={iconeEstado}
                    size={17}
                    color={corEstado}
                  />

                  <Text
                    style={[
                      styles.estadoTexto,
                      { color: corEstado },
                    ]}
                  >
                    {descricaoEstado}
                  </Text>
                </View>

                {pendente &&
                coluna.exemplos.length > 0 ? (
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.amostra,
                      { color: theme.textoSub },
                    ]}
                  >
                    Exemplos do CSV:{" "}
                    {coluna.exemplos
                      .slice(0, 2)
                      .join(" · ")}
                  </Text>
                ) : null}

                <Button
                  title={
                    ignorada
                      ? "REVER DECISÃO"
                      : vazia
                        ? campo !== null
                          ? "ALTERAR CAMPO"
                          : "REVISAR COLUNA VAZIA"
                        : campo !== null
                          ? "ALTERAR CAMPO"
                          : "ESCOLHER CAMPO"
                  }
                  variant={
                    campo !== null && !vazia
                      ? "primary"
                      : "outline"
                  }
                  size="small"
                  disabled={ocupado}
                  onPress={() =>
                    setColunaAberta(coluna.indice)
                  }
                  style={[
                    styles.botao,
                    vazia || ignorada
                      ? { borderColor: corErro }
                      : campo !== null
                        ? { backgroundColor: fundoSelecionado, borderColor: corAcao }
                        : { borderColor: bordaNeutra },
                      ignorada && { backgroundColor: `${corErro2}`, borderColor: corErro2}
                  ]}
                />
              </View>
            );
          })}
        </>
      )}

      <Modal
        visible={colunaAberta !== null}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setColunaAberta(null)
        }
      >
        <View style={styles.fundoModal}>
          <View
            style={[
              styles.modal,
              {
                backgroundColor:
                  theme.background,
                borderColor: bordaNeutra,
              },
            ]}
          >
            <View
              style={[
                styles.modalCabecalho,
                { borderBottomColor: bordaNeutra },
              ]}
            >
              <Text weight="Bold" style={styles.titulo}>
                Associar essa coluna do CSV
              </Text>

            <Text
              style={[
                styles.ajuda,
                { color: theme.textoSub },
              ]}
            >
              Coluna do arquivo:{" "}
              {colunaSelecionada?.original}
            </Text>

            {colunaSelecionada?.exemplos.length ? (
              <Text
                numberOfLines={2}
                style={[
                  styles.ajuda,
                  { color: theme.textoSub },
                ]}
              >
                Alguns valores encontrados:{" "}
                {colunaSelecionada.exemplos
                  .slice(0, 2)
                  .join(" · ")}
              </Text>
            ) : null}

            <Text
              style={[
                styles.ajuda,
                { color: theme.textoSub },
              ]}
            >
              Escolha onde esses valores entrarão
              no clipping. Se escolher uma informação
              já usada, a outra coluna voltará para
              revisão.
            </Text>
            </View>

            <ScrollView
              style={styles.opcoes}
              showsVerticalScrollIndicator
              contentContainerStyle={
                styles.opcoesConteudo
              }
            >
              {DESTINOS.map(({ campo, nome }) => {
                const selecionado =
                  colunaAberta !== null &&
                  mapeamento[colunaAberta] ===
                    campo;

                const outraColuna =
                  mapeamento.findIndex(
                    (valor, indice) =>
                      valor === campo &&
                      indice !== colunaAberta
                  );

                return (
                  <Button
                    key={campo}
                    title={
                      selecionado
                        ? `${nome.toUpperCase()} · TOQUE PARA DESFAZER`
                        : outraColuna >= 0
                          ? `${nome.toUpperCase()} · COLUNA ${outraColuna + 1}`
                          : nome.toUpperCase()
                    }
                    variant={
                      selecionado
                        ? "primary"
                        : "outline"
                    }
                    onPress={() => {
                      if (
                        colunaAberta !== null
                      ) {
                        onAlterarCampo(
                          colunaAberta,
                          campo
                        );
                      }

                      setColunaAberta(null);
                    }}
                    style={[
                      styles.opcao,
                      outraColuna >= 0 && !selecionado
                        ? {
                            borderColor: corAviso,
                            backgroundColor: `${corAviso}18`,
                          }
                        : selecionado
                          ? { borderColor: corAcao, backgroundColor: fundoSelecionado }
                          : { borderColor: bordaNeutra },
                    ]}
                  />
                );
              })}

            </ScrollView>

            <View
              style={[
                styles.modalRodape,
                {
                  borderTopColor: bordaNeutra,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.ajuda,
                  { color: theme.textoSub },
                ]}
              >
                {colunaSelecionada?.tem_dados
                  ? "Se ignorar, os valores desta coluna não entrarão nos clippings."
                  : "Esta coluna não tem valores no CSV. Você pode marcá-la como ignorada."}
              </Text>

              <Button
                title={
                  colunaAberta !== null &&
                  ignoradas.has(colunaAberta)
                    ? "DESFAZER NÃO IMPORTAR"
                    : colunaSelecionada?.tem_dados
                      ? "NÃO IMPORTAR ESTA COLUNA"
                      : "IGNORAR COLUNA VAZIA"
                }
                variant="outline"
                onPress={() => {
                  if (colunaAberta === null) return;

                  if (ignoradas.has(colunaAberta)) {
                    onDesfazerIgnorarColuna(colunaAberta);
                  } else {
                    onIgnorarColuna(colunaAberta);
                  }

                  setColunaAberta(null);
                }}
                style={{
                  marginTop: 10,
                  borderColor: corErro,
                }}
              />
            <Button
              title="FECHAR"
              variant="outline"
              onPress={() =>
                setColunaAberta(null)
              }
              style={[styles.fechar, { borderColor: bordaNeutra }]}
            />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  titulo: {
    fontSize: 19,
    lineHeight: 26,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  leituraArquivo: {
    marginTop: 14,
  },
  resumo: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  painelResumo: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },

  rotuloResumo: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  tituloListaColunas: {
    marginTop: 20,
    marginBottom: 2,
    fontSize: 15,
  },
  botaoAjuste: {
    width: "auto",
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  ajusteCabecalho: {
    marginTop: 8,
  },
  linhaCabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  botaoLinha: {
    width: 100,
    minHeight: 38,
  },
  amostraLinha: {
    flex: 1,
    fontSize: 11,
  },
  coluna: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginTop: 10,
  },
  rotuloOrigem: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  estado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  estadoTexto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  amostra: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  botao: {
    marginTop: 12,
  },
  aviso: {

    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  fundoModal: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    width: "100%",
    maxHeight: "85%",
    borderWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  modalCabecalho: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  opcoes: {
    marginTop: 0,
    flexShrink: 1,
  },
  opcoesConteudo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalRodape: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  opcao: {
    marginBottom: 8,
    borderWidth: 1,
  },
  fechar: {
    marginTop: 10,
  },
});