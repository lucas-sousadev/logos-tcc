import { useRef, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FeedbackAlert from "@/components/forms/FeedbackAlert";
import ReleaseBlocosPrevia, {
  type CampoBlocoPrevia,
} from "@/components/releases/ReleaseBlocosPrevia";
import ReleaseAdicionarBlocoModal from "@/components/releases/ReleaseAdicionarBlocoModal";
import ReleaseImagemCampo from "@/components/releases/ReleaseImagemCampo";

import { useTheme } from "@/contexts/ThemeContext";
import type { BlocoTemplateRelease } from "@/services/api/release";

const ROTULOS: Record<
  BlocoTemplateRelease["tipo"],
  string
> = {
  titulo: "Título",
  linha_fina: "Linha fina",
  texto: "Texto",
  imagem: "Imagem / logo",
  contato: "Contato de imprensa",
  divisor: "Divisor",
  espacamento: "Espaçamento",
  botao: "Botão com link",
  arquivo: "Arquivo",
};

interface Props {
  blocos: BlocoTemplateRelease[];
  nomeTemplate: string;
  disabled?: boolean;
  onChange: (
    alterar: (
      atuais: BlocoTemplateRelease[]
    ) => BlocoTemplateRelease[]
  ) => void;
  onMostrarCampo: (campo: TextInput) => void;
  imagemOcupada: boolean;
  onImagemOcupadaChange: (ocupado: boolean) => void;
}

export default function ReleaseConteudoEditor({
  blocos,
  nomeTemplate,
  disabled = false,
  onChange,
  onMostrarCampo,
  imagemOcupada,
  onImagemOcupadaChange,
}: Props) {
  const { theme } = useTheme();

  const [modo, setModo] = useState<
    "EDITAR" | "PREVIA"
  >("EDITAR");
  const [mostrarLapis, setMostrarLapis] = useState(true);
  
  const [aberto, setAberto] = useState<string | null>(
    null
  );
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, setRemovendo] = useState<
    string | null
  >(null);

  const textoRef = useRef<TextInput>(null);
  const urlRef = useRef<TextInput>(null);
  const legendaRef = useRef<TextInput>(null);

  const focoPendente = useRef<{
    id: string;
    campo: CampoBlocoPrevia;
  } | null>(null);

  function abrirCampo(
    id: string,
    campo: CampoBlocoPrevia
  ) {
    if (
      disabled ||
      !blocos.some((bloco) => bloco.id === id)
    ) {
      return;
    }

    focoPendente.current = { id, campo };

    setAberto(id);
    setModo("EDITAR");
    setAdicionando(false);
  }

  function revelarCampo(
    id: string,
    campo: CampoBlocoPrevia,
    input: TextInput | null
  ) {
    if (
      disabled ||
      !input ||
      focoPendente.current?.id !== id ||
      focoPendente.current.campo !== campo
    ) {
      return;
    }

    focoPendente.current = null;

    input.focus();
    onMostrarCampo(input);
  }

  function alterar(
    id: string,
    campos: Partial<BlocoTemplateRelease>
  ) {
    if (disabled) return;

    onChange((atuais) =>
      atuais.map((bloco) =>
        bloco.id === id
          ? { ...bloco, ...campos }
          : bloco
      )
    );
  }

  function mover(id: string, direcao: -1 | 1) {
    if (disabled) return;

    onChange((atuais) => {
      const indice = atuais.findIndex(
        (bloco) => bloco.id === id
      );

      const destino = indice + direcao;

      if (
        indice < 0 ||
        destino < 0 ||
        destino >= atuais.length
      ) {
        return atuais;
      }

      const novos = [...atuais];

      [novos[indice], novos[destino]] = [
        novos[destino],
        novos[indice],
      ];

      return novos;
    });
  }

  function adicionar(
    tipo: BlocoTemplateRelease["tipo"]
  ) {
    if (disabled || blocos.length >= 100) return;

    const novo: BlocoTemplateRelease = {
      id: Crypto.randomUUID(),
      tipo,
      ...(tipo === "divisor" || tipo === "espacamento"
        ? {}
        : { texto: "" }),
      ...(["imagem", "botao", "arquivo"].includes(tipo)
        ? { url: "" }
        : {}),
    };

    onChange((atuais) =>
      atuais.length >= 100
        ? atuais
        : [...atuais, novo]
    );

    setAberto(novo.id);
    setAdicionando(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.linha}>
        {(["EDITAR", "PREVIA"] as const).map(
          (valor) => (
            <TouchableOpacity
              key={valor}
              accessibilityRole="tab"
              accessibilityState={{
                selected: modo === valor,
              }}
              onPress={() => {
                focoPendente.current = null;
                setModo(valor);
              }}
              style={[
                styles.aba,
                {
                  borderColor: theme.borda,
                  backgroundColor:
                    modo === valor
                      ? theme.backgroundContainer
                      : theme.background,
                },
              ]}
              disabled={imagemOcupada}
            >
              <Text
                weight="SemiBold"
                style={{
                  fontSize: 13,
                  color:
                    modo === valor
                      ? theme.textoContainer
                      : theme.texto,
                }}
              >
                {valor === "EDITAR"
                  ? "Editar blocos"
                  : "Prévia"}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <Text
        style={{
          color: theme.textoSub,
          fontSize: 13,
        }}
      >
        Template: {nomeTemplate}
      </Text>

      {modo === "PREVIA" ? (
        <>
          <Button
            title={mostrarLapis ? "OCULTAR LÁPIS" : "MOSTRAR LÁPIS"}
            icon={mostrarLapis ? "eye-off-outline" : "eye-outline"}
            variant="outline"
            size="small"
            style={styles.botaoPrevia}
            onPress={() => setMostrarLapis((valor) => !valor)}
          />
          <ReleaseBlocosPrevia
            blocos={blocos}
            disabled={disabled}
            onEditar={mostrarLapis ? abrirCampo : undefined}
          />
        </>
      ) : (
        <>
          {blocos.length === 0 ? (
            <Text>Adicione o primeiro bloco.</Text>
          ) : null}

          {blocos.map((bloco, indice) => {
            const expandido = aberto === bloco.id;

            const temTexto = ![
              "divisor",
              "espacamento",
            ].includes(bloco.tipo);

            const temUrl = [
              "imagem",
              "botao",
              "arquivo",
            ].includes(bloco.tipo);

            const multiline = [
              "titulo",
              "linha_fina",
              "texto",
              "contato",
            ].includes(bloco.tipo);

            return (
              <View
                key={bloco.id}
                style={[
                  styles.card,
                  {
                    borderColor: theme.borda,
                    backgroundColor: theme.backgroundSecundario,
                  },
                ]}
              >
                <View style={styles.linha}>
                  <TouchableOpacity
                    style={styles.resumo}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{
                      expanded: expandido,
                      disabled,
                    }}
                    accessibilityLabel={
                      "Editar bloco " +
                      (indice + 1) +
                      ": " +
                      ROTULOS[bloco.tipo]
                    }
                    onPress={() =>
                      setAberto(
                        expandido ? null : bloco.id
                      )
                    }
                  >
                    <Text weight="SemiBold">
                      {ROTULOS[bloco.tipo]}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.textoSub,
                        fontSize: 12,
                      }}
                    >
                      {bloco.texto ||
                        (temTexto
                          ? "Toque para editar"
                          : "Bloco de separação")}
                    </Text>
                  </TouchableOpacity>

                  {([-1, 1] as const).map(
                    (direcao) => {
                      const indisponivel =
                        disabled ||
                        (direcao === -1
                          ? indice === 0
                          : indice ===
                            blocos.length - 1);

                      return (
                        <TouchableOpacity
                          key={direcao}
                          style={styles.seta}
                          disabled={indisponivel}
                          accessibilityRole="button"
                          accessibilityLabel={
                            direcao === -1
                              ? "Mover bloco para cima"
                              : "Mover bloco para baixo"
                          }
                          accessibilityState={{
                            disabled: indisponivel,
                          }}
                          onPress={() =>
                            mover(bloco.id, direcao)
                          }
                        >
                          <Ionicons
                            name={
                              direcao === -1
                                ? "arrow-up"
                                : "arrow-down"
                            }
                            size={20}
                            color={
                              theme.textoTerciaria
                            }
                            style={{
                              opacity: indisponivel
                                ? 0.3
                                : 1,
                            }}
                          />
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                {expandido ? (
                  <View
                    style={[
                      styles.campos,
                      {
                        borderTopColor:
                          theme.borda + "55",
                      },
                    ]}
                  >
                    {temTexto ? (
                      <Input
                        label={
                          bloco.tipo === "imagem"
                            ? "DESCRIÇÃO DA IMAGEM"
                            : ROTULOS[
                                bloco.tipo
                              ].toUpperCase()
                        }
                        value={bloco.texto ?? ""}
                        onChangeText={(texto) =>
                          alterar(bloco.id, {
                            texto,
                          })
                        }
                        editable={!disabled}
                        multiline={multiline}
                        maxLength={50000}
                        containerStyle={styles.campo}
                        style={
                          multiline
                            ? styles.multiline
                            : undefined
                        }
                        placeholder="Escreva aqui..."
                        inputRef={textoRef}
                        onLayout={() =>
                          revelarCampo(
                            bloco.id,
                            "texto",
                            textoRef.current
                          )
                        }
                        clearable
                      />
                    ) : (
                      <Text
                        style={{
                          color: theme.textoSub,
                        }}
                      >
                        Este bloco organiza a
                        separação entre os conteúdos.
                      </Text>
                    )}

                    {bloco.tipo === "imagem" ? (
                      <ReleaseImagemCampo
                        url={bloco.url ?? ""}
                        disabled={disabled || imagemOcupada}
                        inputRef={urlRef}
                        onInputLayout={() => revelarCampo(bloco.id, "url", urlRef.current)}
                        onChange={(url) => alterar(bloco.id, { url })}
                        onOcupadoChange={onImagemOcupadaChange}
                      />
                    ) : temUrl ? (
                      <Input
                        label="LINK DE DESTINO"
                        value={bloco.url ?? ""}
                        onChangeText={(url) =>
                          alterar(bloco.id, {
                            url: url.trim(),
                          })
                        }
                        editable={!disabled}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        maxLength={2048}
                        containerStyle={styles.campo}
                        placeholder="https://..."
                        inputRef={urlRef}
                        onLayout={() =>
                          revelarCampo(
                            bloco.id,
                            "url",
                            urlRef.current
                          )
                        }
                        clearable
                      />
                    ) : null}

                    {bloco.tipo === "imagem" ? (
                      <Input
                        label="LEGENDA"
                        value={bloco.legenda ?? ""}
                        onChangeText={(legenda) =>
                          alterar(bloco.id, {
                            legenda,
                          })
                        }
                        editable={!disabled}
                        multiline
                        maxLength={1000}
                        containerStyle={styles.campo}
                        style={styles.legenda}
                        inputRef={legendaRef}
                        onLayout={() =>
                          revelarCampo(
                            bloco.id,
                            "legenda",
                            legendaRef.current
                          )
                        }
                        clearable
                      />
                    ) : null}

                    <View style={styles.linha}>
                      <Button
                        title="REMOVER"
                        variant="danger"
                        size="small"
                        style={styles.acao}
                        disabled={disabled}
                        onPress={() => setRemovendo(bloco.id)}
                      />

                      <Button
                        title="CONCLUIR"
                        icon="checkmark-outline"
                        size="small"
                        style={styles.acao}
                        disabled={disabled}
                        onPress={() => setAberto(null)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Adicionar bloco"
            accessibilityState={{
              disabled: disabled || blocos.length >= 100,
              expanded: adicionando,
            }}
            disabled={disabled || blocos.length >= 100}
            onPress={() => setAdicionando(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[
              styles.adicionar,
              {
                backgroundColor: theme.primaria,
                borderColor: theme.primaria,
                opacity:
                  disabled || blocos.length >= 100
                    ? 0.5
                    : 1,
              },
            ]}
          >
            <Ionicons
              name="add-outline"
              size={16}
              color={theme.branco}
            />

            <Text
              weight="Bold"
              style={{
                color: theme.branco,
                fontSize: 11,
              }}
            >
              ADICIONAR BLOCO
            </Text>
          </TouchableOpacity>

          {adicionando ? (
            <ReleaseAdicionarBlocoModal
              disabled={disabled || blocos.length >= 100}
              onClose={() => setAdicionando(false)}
              onAdicionar={adicionar}
            />
          ) : null}

          <Text
            style={{
              color: theme.textoSub,
              fontSize: 12,
            }}
          >
            {blocos.length} de 100 blocos
          </Text>
        </>
      )}

      <FeedbackAlert
        visible={removendo !== null}
        variant="warning"
        title="Remover bloco?"
        message="O conteúdo deste bloco será removido do release."
        primaryLabel="REMOVER"
        secondaryLabel="CANCELAR"
        primaryDanger
        onClose={() => setRemovendo(null)}
        onSecondary={() => setRemovendo(null)}
        onPrimary={() => {
          if (disabled || !removendo) return;

          const id = removendo;

          onChange((atuais) =>
            atuais.filter(
              (bloco) => bloco.id !== id
            )
          );

          if (aberto === id) setAberto(null);

          setRemovendo(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aba: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  resumo: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    gap: 4,
  },
  seta: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  campos: {
    borderTopWidth: 1,
    padding: 10,
    gap: 10,
  },
  campo: {
    marginBottom: 0,
  },
  multiline: {
    height: 140,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  legenda: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  acao: {
    flex: 1,
    width: "auto",
    paddingHorizontal: 8,
  },
  adicionar: {
  minHeight: 35,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 10,
},
botaoPrevia: {
  width: "auto",
},
});