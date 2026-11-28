import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import SearchBar from "@/components/ui/SearchBar";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ReleaseBlocosPrevia from "@/components/releases/ReleaseBlocosPrevia";
import TemplateFormulario from "@/components/templates/TemplateFormulario";
import TemplateMiniatura from "@/components/templates/TemplateMiniatura";
import ContadorLista from "@/components/ui/ContadorLista";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { TemplateRelease } from "@/services/api/release";
import {
  listarTemplates,
  removerTemplate,
  type OrigemTemplate,
} from "@/services/api/template";

const LIMITE_PAGINA = 20;
const LIMITE_BUSCA = 150;

const FILTROS: {
  valor: OrigemTemplate;
  nome: string;
}[] = [
  { valor: "TODOS", nome: "Todos" },
  { valor: "LOGOS", nome: "Padrões" },
  { valor: "ASSESSORIA", nome: "Da assessoria" },
];

export default function Templates() {
  const { usuario } = useAuth();

  return (
    <CatalogoTemplates
      key={usuario ? usuario.assessoria_id + "-" + usuario.id : "sem-conta"}
    />
  );
}

function CatalogoTemplates() {
  const params = useLocalSearchParams<{ criar?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();
  const { width } = useWindowDimensions();

  const podeVer = temPermissao("TEMPLATES", "VISUALIZAR");
  const podeCriar = temPermissao("TEMPLATES", "CRIAR");
  const podeEditar = temPermissao("TEMPLATES", "EDITAR");
  const podeExcluir = temPermissao("TEMPLATES", "EXCLUIR");

  const trava = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [formulario, setFormulario] = useState<{
    modelo: TemplateRelease | null;
    editar: boolean;
  } | null>(() =>
    params.criar === "1" && podeCriar ? { modelo: null, editar: false } : null
  );

  const [digitado, setDigitado] = useState("");
  const [consulta, setConsulta] = useState<{
    page: number;
    busca: string;
    origem: OrigemTemplate;
  }>({ page: 1, busca: "", origem: "TODOS" });
  const { page: pagina, busca, origem } = consulta;
  const [total, setTotal] = useState(0);

  const [templates, setTemplates] = useState<TemplateRelease[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [previa, setPrevia] = useState<TemplateRelease | null>(null);
  const [remover, setRemover] = useState<TemplateRelease | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [erroRemocao, setErroRemocao] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (params.criar !== "1") return;
    router.setParams({ criar: undefined });
  }, [params.criar, router]);

  useEffect(() => {
    const texto = digitado.trim();

    if (texto === busca) return;

    const timer = setTimeout(() => {
      setConsulta((atual) => ({ ...atual, busca: texto, page: 1 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [digitado, busca]);

  useFocusEffect(
    useCallback(() => {
      if (formulario) return;

      if (!podeVer) {
        setTemplates([]);
        setTotal(0);
        setCarregando(false);
        return;
      }

      let ativa = true;
      setCarregando(true);
      setErro("");

      listarTemplates(consulta)
        .then((dados) => {
          if (!ativa) return;

          const ultima = Math.max(
            1,
            Math.ceil(dados.pagination.total / LIMITE_PAGINA)
          );

          if (consulta.page > ultima) {
            setConsulta((atual) => ({ ...atual, page: ultima }));
            return;
          }

          setTemplates(dados.templates);
          setTotal(dados.pagination.total);
        })
        .catch((falha) => {
          if (!ativa) return;

          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível carregar os templates."
          );
        })
        .finally(() => {
          if (ativa) setCarregando(false);
        });

      return () => {
        ativa = false;
      };
    }, [consulta, podeVer, formulario])
  );

  function alterarBusca(valor: string) {
    setDigitado(Array.from(valor).slice(0, LIMITE_BUSCA).join(""));
  }

  function aplicarBusca() {
    setConsulta((atual) => ({ ...atual, busca: digitado.trim(), page: 1 }));
  }

  function limparBusca() {
    setDigitado("");
    setConsulta((atual) => ({ ...atual, busca: "", page: 1 }));
  }

  function recarregar() {
    setConsulta((atual) => ({ ...atual }));
  }

  function mudarPagina(page: number) {
    if (carregando || removendo || page === pagina) return;
    setConsulta((atual) => ({ ...atual, page }));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function pedirRemocao(modelo: TemplateRelease) {
    if (!podeExcluir || modelo.origem !== "ASSESSORIA" || trava.current) {
      return;
    }

    setErroRemocao("");
    setRemover(modelo);
  }

  function fecharRemocao() {
    if (trava.current) return;

    setRemover(null);
    setErroRemocao("");
  }

  function abrir(modelo: TemplateRelease | null = null, editar = false) {
    setPrevia(null);
    setErro("");
    setFormulario({ modelo, editar });
  }

  async function excluir() {
    if (!remover?.id || trava.current || !podeExcluir) {
      return;
    }

    trava.current = true;
    setRemovendo(true);
    setErroRemocao("");

    try {
      await removerTemplate(remover.id);

      setRemover(null);
      recarregar();
      setSucesso(
        "Template removido. Os releases já criados continuam com seu conteúdo."
      );
    } catch (falha) {
      setErroRemocao(
        falha instanceof Error ? falha.message : "Não foi possível remover."
      );
    } finally {
      trava.current = false;
      setRemovendo(false);
    }
  }

  if (formulario) {
    return (
      <TemplateFormulario
        modelo={formulario.modelo}
        editar={formulario.editar}
        onClose={() => setFormulario(null)}
        onSaved={() => {
          setFormulario(null);
          recarregar();
          setSucesso("Template salvo e disponível na criação de releases.");
        }}
      />
    );
  }

  return (
    <View style={[styles.tela, { backgroundColor: theme.background }]}>
      <Header title="Templates" showBackButton />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.corpo}>
          <View style={styles.bibliotecaTopo}>
            <View
              style={[
                styles.bibliotecaIcone,
                { backgroundColor: theme.primaria + "12" },
              ]}
            >
              <Ionicons
                name="albums-outline"
                size={21}
                color={theme.textoTerciaria}
              />
            </View>

            <View style={styles.bibliotecaTexto}>
              <Text weight="Bold" style={styles.bibliotecaTitulo}>
                Biblioteca
              </Text>

              <Text
                style={[styles.bibliotecaLegenda, { color: theme.textoSub }]}
              >
                Modelos de release
              </Text>
            </View>

            {podeCriar ? (
              <Button
                title="NOVO"
                icon="add-outline"
                size="small"
                style={styles.novoTemplate}
                onPress={() => abrir()}
              />
            ) : null}
          </View>

          {!podeVer ? (
            <Text style={{ color: theme.textoSub }}>
              Você não possui permissão para consultar o catálogo.
            </Text>
          ) : (
            <>
              <View
                style={[
                  styles.filtrosPainel,
                  {
                    backgroundColor: theme.backgroundSecundario,
                    borderColor: theme.borda + "35",
                  },
                ]}
              >
                <SearchBar
                  value={digitado}
                  onChangeText={alterarBusca}
                  placeholder="Buscar template..."
                  onSearch={aplicarBusca}
                  onClear={limparBusca}
                  containerStyle={{ marginBottom: 0 }}
                />

                <View
                  accessibilityRole="tablist"
                  style={[
                    styles.abas,
                    { backgroundColor: theme.primaria + "09" },
                  ]}
                >
                  {FILTROS.map((filtro) => {
                    const ativo = origem === filtro.valor;

                    return (
                      <TouchableOpacity
                        key={filtro.valor}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: ativo }}
                        activeOpacity={0.75}
                        onPress={() => {
                          setConsulta((atual) => ({
                            ...atual,
                            origem: filtro.valor,
                            page: 1,
                          }));
                        }}
                        style={[
                          styles.aba,
                          {
                            backgroundColor: ativo
                              ? theme.background
                              : "transparent",
                            borderColor: ativo
                              ? theme.primaria + "35"
                              : "transparent",
                          },
                        ]}
                      >
                        <Text
                          weight={ativo ? "Bold" : "Medium"}
                          style={[
                            styles.abaTexto,
                            {
                              color: ativo
                                ? theme.textoTerciaria
                                : theme.textoSub,
                            },
                          ]}
                        >
                          {filtro.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {carregando ? (
                <ActivityIndicator color={theme.primaria} />
              ) : erro ? (
                <View style={styles.grupo}>
                  <Text style={{ color: theme.erro }}>{erro}</Text>

                  <Button
                    title="TENTAR NOVAMENTE"
                    variant="outline"
                    onPress={recarregar}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.resultadosTopo}>
                    <Text weight="SemiBold" style={{ fontSize: 14 }}>
                      Modelos
                    </Text>

                    <ContadorLista>
                      {total} {total === 1 ? "encontrado" : "encontrados"}
                    </ContadorLista>
                  </View>

                  {!templates.length ? (
                    <Text>Nenhum template encontrado.</Text>
                  ) : null}

                  <View style={styles.grade}>
                    {templates.map((modelo) => (
                      <View
                        key={modelo.id ?? modelo.codigo}
                        style={[
                          styles.card,
                          {
                            borderColor: theme.borda,
                            width: width >= 620 ? "48.5%" : "100%",
                          },
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={!modelo.disponivel}
                          accessibilityRole="button"
                          accessibilityLabel={"Ver prévia de " + modelo.nome}
                          onPress={() => setPrevia(modelo)}
                          style={[
                            styles.miniatura,
                            {
                              backgroundColor: theme.primaria + "08",
                            },
                          ]}
                        >
                          <TemplateMiniatura blocos={modelo.blocos} />
                        </TouchableOpacity>

                        <View style={styles.grupo}>
                          <Text weight="Bold" numberOfLines={2}>
                            {modelo.nome}
                          </Text>

                          <Text
                            style={{
                              color: theme.textoSub,
                              fontSize: 12,
                            }}
                          >
                            {modelo.origem === "LOGOS"
                              ? "Padrão do LOGOS"
                              : "Da assessoria"}
                          </Text>

                          {!modelo.disponivel ? (
                            <Text style={{ color: theme.erro }}>
                              Revise os blocos deste modelo.
                            </Text>
                          ) : null}

                          <Button
                            title="VER PRÉVIA"
                            icon="eye-outline"
                            size="small"
                            variant="outline"
                            disabled={!modelo.disponivel}
                            onPress={() => setPrevia(modelo)}
                          />

                          {podeCriar && modelo.disponivel ? (
                            <Button
                              title="CRIAR CÓPIA"
                              icon="copy-outline"
                              size="small"
                              variant="outline"
                              onPress={() => abrir(modelo)}
                            />
                          ) : null}

                          {modelo.origem === "ASSESSORIA" &&
                          (podeEditar || podeExcluir) ? (
                            <View style={styles.linha}>
                              {podeEditar ? (
                                <Button
                                  title="EDITAR"
                                  icon="create-outline"
                                  size="small"
                                  style={styles.flex}
                                  onPress={() => abrir(modelo, true)}
                                />
                              ) : null}

                              {podeExcluir ? (
                                <Button
                                  title="REMOVER"
                                  variant="danger"
                                  size="small"
                                  style={styles.flex}
                                  onPress={() => pedirRemocao(modelo)}
                                />
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>

                  <PaginacaoLista
                    pagina={pagina}
                    limite={LIMITE_PAGINA}
                    total={total}
                    disabled={carregando || removendo}
                    onChange={mudarPagina}
                  />
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={previa !== null}
        animationType="slide"
        onRequestClose={() => setPrevia(null)}
      >
        <View style={[styles.tela, { backgroundColor: theme.background }]}>
          <Header
            title="Prévia do template"
            showBackButton
            showSettings={false}
            onBackPress={() => setPrevia(null)}
          />

          <ScrollView contentContainerStyle={styles.conteudo}>
            <View style={styles.previa}>
              <Text weight="Bold">{previa?.nome}</Text>

              {previa ? <ReleaseBlocosPrevia blocos={previa.blocos} /> : null}
            </View>
          </ScrollView>

          <View style={styles.rodape}>
            <Button
              title="FECHAR"
              variant="outline"
              style={styles.flex}
              onPress={() => setPrevia(null)}
            />

            {podeCriar && previa ? (
              <Button
                title="CRIAR CÓPIA"
                icon="copy-outline"
                style={styles.flex}
                onPress={() => abrir(previa)}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <FeedbackAlert
        visible={remover !== null}
        variant={erroRemocao ? "error" : "warning"}
        title={erroRemocao ? "Não foi possível remover" : "Remover template?"}
        message={
          erroRemocao ||
          'O modelo "' +
            (remover?.nome ?? "") +
            '" sairá do catálogo. Os releases já criados serão preservados.'
        }
        primaryLabel={erroRemocao ? "TENTAR NOVAMENTE" : "REMOVER"}
        secondaryLabel="CANCELAR"
        primaryDanger
        loading={removendo}
        onClose={fecharRemocao}
        onSecondary={fecharRemocao}
        onPrimary={() => void excluir()}
      />

      <FeedbackAlert
        visible={Boolean(sucesso)}
        variant="success"
        title="Tudo certo"
        message={sucesso}
        onClose={() => setSucesso("")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  conteudo: {
    padding: 16,
    paddingBottom: 30,
  },
  corpo: {
    gap: 12,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  bibliotecaTopo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  bibliotecaIcone: {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  bibliotecaTexto: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  bibliotecaTitulo: {
    fontSize: 17,
    lineHeight: 22,
  },
  bibliotecaLegenda: {
    fontSize: 11,
    lineHeight: 16,
  },
  novoTemplate: {
    width: "auto",
    flexShrink: 0,
    minHeight: 40,
    paddingHorizontal: 13,
  },
  filtrosPainel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  abas: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 11,
    gap: 3,
  },
  aba: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  abaTexto: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  resultadosTopo: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  contador: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  linha: {
    flexDirection: "row",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  grupo: {
    gap: 8,
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    gap: 12,
  },
  miniatura: {
    borderRadius: 9,
    overflow: "hidden",
  },
  previa: {
    gap: 16,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  rodape: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 28,
  },
});