import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import Text from "@/components/ui/Text";
import ReleaseBlocosPrevia from "@/components/releases/ReleaseBlocosPrevia";

import { useTheme } from "@/contexts/ThemeContext";
import {
  listarTemplatesRelease,
  type TemplateRelease,
} from "@/services/api/release";

type Origem = "TODOS" | "LOGOS" | "ASSESSORIA";

interface Props {
  selecionado: TemplateRelease | null;
  disabled?: boolean;
  onSelecionar: (template: TemplateRelease) => void;
  onEditar: (template: TemplateRelease) => void;
}

function mesmoTemplate(
  a: TemplateRelease | null,
  b: TemplateRelease
): boolean {
  return (
    a?.id === b.id &&
    a?.codigo === b.codigo &&
    a?.assinatura === b.assinatura
  );
}

export default function ReleaseTemplateEtapa({
  selecionado,
  disabled = false,
  onSelecionar,
  onEditar,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [origem, setOrigem] = useState<Origem>("TODOS");
  const [pagina, setPagina] = useState(1);
  const [templates, setTemplates] = useState<TemplateRelease[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [previa, setPrevia] = useState<TemplateRelease | null>(null);

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setErro("");

    async function carregar() {
      try {
        const resposta = await listarTemplatesRelease({
          page: pagina,
          busca: buscaAplicada,
          origem,
        });

        if (!ativo) return;

        setTemplates(resposta.templates);
        setTotal(resposta.pagination.total);
      } catch (error) {
        if (!ativo) return;

        setTemplates([]);
        setTotal(0);
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os templates."
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [pagina, buscaAplicada, origem, tentativa]);

  function buscar(texto: string) {
    setBusca(texto);
    setBuscaAplicada(texto.trim());
    setPagina(1);
    setTentativa((valor) => valor + 1);
  }

  return (
    <View style={styles.container}>
      <SearchBar
        value={busca}
        onChangeText={setBusca}
        onSearch={() => buscar(busca)}
        onClear={() => buscar("")}
        placeholder="Buscar template..."
      />

      <View style={styles.origens}>
        {(
          [
            ["TODOS", "Todos"],
            ["LOGOS", "Padrões"],
            ["ASSESSORIA", "Criados"],
          ] as const
        ).map(([valor, nome]) => (
          <TouchableOpacity
            key={valor}
            accessibilityRole="radio"
            accessibilityState={{ checked: origem === valor }}
            onPress={() => {
              setOrigem(valor);
              setPagina(1);
            }}
            style={[
              styles.origem,
              {
                borderColor: theme.borda,
                backgroundColor:
                  origem === valor
                    ? theme.backgroundContainer
                    : theme.background,
              },
            ]}
          >
            <Text
              weight="SemiBold"
              style={{
                fontSize: 12,
                textAlign: "center",
                color:
                  origem === valor
                    ? theme.textoContainer
                    : theme.texto,
              }}
            >
              {nome}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selecionado ? (
        <Text style={{ color: theme.textoTerciaria }}>
          Modelo selecionado — {selecionado.nome}
        </Text>
      ) : (
        <Text style={{ color: theme.textoSub }}>
          Escolha a estrutura para escrever a matéria.
        </Text>
      )}

      {carregando ? (
        <ActivityIndicator color={theme.textoTerciaria} />
      ) : null}

      {erro ? (
        <View style={styles.container}>
          <Text style={{ color: theme.erro }}>{erro}</Text>

          <Button
            title="TENTAR NOVAMENTE"
            size="small"
            onPress={() => setTentativa((valor) => valor + 1)}
          />
        </View>
      ) : null}

      {!carregando && !erro && templates.length === 0 ? (
        <Text>Nenhum template encontrado.</Text>
      ) : null}

      {!carregando && !erro
        ? templates.map((template) => {
            const escolhido = mesmoTemplate(
              selecionado,
              template
            );

            return (
              <View
                key={template.codigo || String(template.id)}
                style={[
                  styles.card,
                  {
                    borderColor: escolhido
                      ? theme.primaria
                      : theme.borda + "70",
                    backgroundColor: escolhido
                      ? theme.primaria + "0C"
                      : theme.background,
                  },
                ]}
              >
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: escolhido,
                    disabled: disabled || !template.disponivel,
                  }}
                  disabled={disabled || !template.disponivel}
                  onPress={() => onSelecionar(template)}
                  style={styles.escolha}
                >
                  <View
                    style={[
                      styles.miniatura,
                      { borderColor: theme.borda + "55" },
                    ]}
                  >
                    {template.blocos.slice(0, 5).map((bloco) => (
                      <View
                        key={bloco.id}
                        style={{
                          height:
                            bloco.tipo === "imagem"
                              ? 22
                              : bloco.tipo === "titulo"
                                ? 6
                                : 4,
                          backgroundColor:
                            theme.textoTerciaria +
                            (bloco.tipo === "titulo" ? "80" : "25"),
                          borderRadius: 2,
                        }}
                      />
                    ))}
                  </View>

                  <View style={styles.info}>
                    <Text weight="Bold">{template.nome}</Text>

                    <Text
                      style={{
                        color: theme.textoSub,
                        fontSize: 12,
                      }}
                    >
                      {template.origem === "LOGOS"
                        ? "Padrão do LOGOS"
                        : "Template da assessoria"}
                    </Text>

                    {!template.disponivel ? (
                      <Text style={{ color: theme.erro }}>
                        Este template precisa ser revisado.
                      </Text>
                    ) : null}
                  </View>

                  <Ionicons
                    name={
                      escolhido
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={23}
                    color={theme.textoTerciaria}
                  />
                </TouchableOpacity>

                <Button
                  title="VER PRÉVIA"
                  size="small"
                  variant="outline"
                  disabled={!template.disponivel}
                  onPress={() => setPrevia(template)}
                />
              </View>
            );
          })
        : null}

      {!carregando && !erro ? (
        <PaginacaoLista
          pagina={pagina}
          limite={20}
          total={total}
          onChange={setPagina}
        />
      ) : null}

      <Modal
        visible={previa !== null}
        animationType="slide"
        onRequestClose={() => setPrevia(null)}
      >
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.background,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Header
            title="Prévia do template"
            showBackButton
            showSettings={false}
            onBackPress={() => setPrevia(null)}
          />

          <ScrollView
            contentContainerStyle={styles.corpoPrevia}
          >
            <Text weight="Bold">{previa?.nome}</Text>

            <Text
              style={{
                color: theme.textoSub,
                fontSize: 12,
              }}
            >
              Prévia da estrutura e dos textos iniciais.
            </Text>

            <ReleaseBlocosPrevia
                blocos={previa?.blocos ?? []}
            />
          </ScrollView>

          <View style={styles.rodape}>
            <Button
                title="USAR E EDITAR CONTEÚDO"
                disabled={disabled || !previa?.disponivel}
                onPress={() => {
                if (
                    !previa ||
                    disabled ||
                    !previa.disponivel
                ) {
                    return;
                }

                const modelo = previa;

                setPrevia(null);
                onEditar(modelo);
                }}
            />

            <Button
                title="APENAS SELECIONAR"
                variant="outline"
                disabled={disabled || !previa?.disponivel}
                onPress={() => {
                if (
                    !previa ||
                    disabled ||
                    !previa.disponivel
                ) {
                    return;
                }

                onSelecionar(previa);
                setPrevia(null);
                }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  origens: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -12
  },

  origem: {
    flex: 1,
    minWidth: 80,
    minHeight: 44,
    padding: 8,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  escolha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 80,
  },
  miniatura: {
    width: 64,
    minHeight: 80,
    borderWidth: 1,
    padding: 8,
    gap: 5,
    borderRadius: 5,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  modal: {
    flex: 1,
  },
  corpoPrevia: {
    padding: 20,
    gap: 10,
  },
  paginaPrevia: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 14,
  },
  imagem: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  botaoPrevia: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  rodape: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
},
});