import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  adicionarEnderecoVeiculo,
  listarEnderecosVeiculo,
  removerEnderecoVeiculo,
  atualizarEnderecoVeiculo
} from "@/services/api/veiculo";
import type {
  EnderecoVeiculo,
  NovoEnderecoVeiculo
} from "@/services/api/veiculo";

interface Props {
  veiculoId: number;
  editavel: boolean;
}

export default function EnderecosVeiculo({
  veiculoId,
  editavel,
}: Props) {
  const { theme } = useTheme();

  const [enderecos, setEnderecos] = useState<
    EnderecoVeiculo[]
  >([]);
  const [host, setHost] = useState("");
  const [caminho, setCaminho] = useState("");
  const [incluirSubdominios, setIncluirSubdominios] =
    useState(false);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<
    number | null
  >(null);
  const [erro, setErro] = useState("");
  const [edicao, setEdicao] = useState<
    (NovoEnderecoVeiculo & { id: number }) | null
    >(null);
  const [salvandoEdicao, setSalvandoEdicao] =
    useState(false);

  const ocupado =
    salvando ||
    salvandoEdicao ||
    removendoId !== null;

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setErro("");

    listarEnderecosVeiculo(veiculoId)
      .then((lista) => {
        if (ativo) {
          setEnderecos(lista);
        }
      })
      .catch((falha) => {
        if (ativo) {
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível carregar os endereços."
          );
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [veiculoId]);

  async function adicionar() {
    if (salvando) return;
    if (!host.trim()) {
      setErro("Informe o domínio do site.");
      return;
    }

    setErro("");
    setSalvando(true);

    try {
      const novo = await adicionarEnderecoVeiculo(
        veiculoId,
        {
          host: host.trim(),
          caminho_prefixo: caminho.trim(),
          incluir_subdominios: incluirSubdominios,
        }
      );

      setEnderecos((anteriores) =>
        [...anteriores, novo].sort((a, b) =>
          `${a.host}${a.caminho_prefixo}`.localeCompare(
            `${b.host}${b.caminho_prefixo}`
          )
        )
      );

      setHost("");
      setCaminho("");
      setIncluirSubdominios(false);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível adicionar o endereço."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(enderecoId: number) {
    setErro("");
    setRemovendoId(enderecoId);

    try {
      await removerEnderecoVeiculo(
        veiculoId,
        enderecoId
      );

      setEnderecos((anteriores) =>
        anteriores.filter(
          (endereco) => endereco.id !== enderecoId
        )
      );
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível remover o endereço."
      );
    } finally {
      setRemovendoId(null);
    }
  }

  function iniciarEdicao(endereco: EnderecoVeiculo) {
    if (ocupado) return;

    if (edicao?.id === endereco.id) {
        setEdicao(null);
        setErro("");
        return;
    }

    if (edicao !== null) return;

    setEdicao({
        id: endereco.id,
        host: `${endereco.protocolo}://${endereco.host}`,
        caminho_prefixo: endereco.caminho_prefixo,
        incluir_subdominios:
        endereco.incluir_subdominios,
    });
    setErro("");
    }

    async function salvarEdicao() {
    if (!edicao || ocupado) return;

    if (!edicao.host.trim()) {
        setErro("Informe o domínio do site.");
        return;
    }

    setErro("");
    setSalvandoEdicao(true);

    try {
        const atualizado =
        await atualizarEnderecoVeiculo(
            veiculoId,
            edicao.id,
            {
            host: edicao.host.trim(),
            caminho_prefixo:
                edicao.caminho_prefixo.trim(),
            incluir_subdominios:
                edicao.incluir_subdominios,
            }
        );

        setEnderecos((anteriores) =>
        anteriores
            .map((endereco) =>
            endereco.id === atualizado.id
                ? atualizado
                : endereco
            )
            .sort((a, b) =>
            `${a.host}${a.caminho_prefixo}`.localeCompare(
                `${b.host}${b.caminho_prefixo}`
            )
            )
        );

        setEdicao(null);
    } catch (falha) {
        setErro(
        falha instanceof Error
            ? falha.message
            : "Não foi possível atualizar o endereço."
        );
    } finally {
        setSalvandoEdicao(false);
    }
    }

    async function abrirSite(
    endereco: EnderecoVeiculo
    ) {
    const url = encodeURI(
      `${endereco.protocolo}://${endereco.host}${
        endereco.caminho_prefixo || "/"
      }`
    );

    try {
        await Linking.openURL(url);
    } catch {
        setErro(
        "Não foi possível abrir o site deste veículo."
        );
    }
    }

  function confirmarRemocao(endereco: EnderecoVeiculo) {
    const identificacao =
      endereco.host + endereco.caminho_prefixo;

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Remover ${identificacao} deste veículo?`
        )
      ) {
        void remover(endereco.id);
      }

      return;
    }

    Alert.alert(
      "Remover endereço",
      `Remover ${identificacao} deste veículo?`,
      [
        { text: "CANCELAR", style: "cancel" },
        {
          text: "REMOVER",
          style: "destructive",
          onPress: () => {
            void remover(endereco.id);
          },
        },
      ]
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecundario,
          borderColor: theme.borda,
        },
      ]}
    >
      <Text weight="Bold" style={styles.titulo}>
        ENDEREÇOS DO SITE
      </Text>

      <Text
        style={[
          styles.descricao,
          { color: theme.textoSub },
        ]}
      >
        Usados para reconhecer o veículo. Se o site usar apenas HTTP, informe http:// antes do domínio.
      </Text>

      {carregando ? (
        <ActivityIndicator
          color={theme.primaria}
          style={styles.carregando}
        />
      ) : enderecos.length === 0 && !erro ? (
        <Text
          style={[
            styles.vazio,
            { color: theme.textoSub },
          ]}
        >
          Nenhum endereço associado.
        </Text>
      ) : (
        enderecos.map((endereco) => (
  <View
    key={endereco.id}
    style={[
      styles.registro,
      { borderTopColor: theme.borda },
    ]}
  >
    <View style={styles.linha}>
      <Ionicons
        name="globe-outline"
        size={19}
        color={theme.textoTerciaria}
        style={styles.icone}
      />

      <View style={styles.dadosEndereco}>
        <Text
          weight="SemiBold"
          style={{ color: theme.texto }}
          selectable
        >
          {endereco.protocolo}://{endereco.host}
          {endereco.caminho_prefixo}
        </Text>

        <Text
          style={[
            styles.detalhe,
            { color: theme.textoSub },
          ]}
        >
          {endereco.incluir_subdominios
            ? "Inclui subdomínios"
            : "Somente este domínio"}
        </Text>
      </View>

      <View style={styles.acoesEndereco}>
        {editavel ? (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Editar ${endereco.host}${endereco.caminho_prefixo}`}
              disabled={
                ocupado ||
                (edicao !== null &&
                  edicao.id !== endereco.id)
              }
              onPress={() =>
                iniciarEdicao(endereco)
              }
              style={styles.acaoIcone}
            >
              <Ionicons
                name="create-outline"
                size={19}
                color={theme.textoTerciaria}
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Remover ${endereco.host}${endereco.caminho_prefixo}`}
              disabled={ocupado || edicao !== null}
              onPress={() =>
                confirmarRemocao(endereco)
              }
              style={styles.acaoIcone}
            >
              {removendoId === endereco.id ? (
                <ActivityIndicator
                  size="small"
                  color={theme.erro}
                />
              ) : (
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={theme.erro}
                />
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel={`Abrir site ${endereco.host}${endereco.caminho_prefixo}`}
          onPress={() => {
            void abrirSite(endereco);
          }}
          style={styles.acaoIcone}
        >
          <Ionicons
            name="open-outline"
            size={19}
            color={theme.textoTerciaria}
          />
        </TouchableOpacity>
      </View>
    </View>

    {editavel && edicao?.id === endereco.id ? (
      <View
        style={[
          styles.formEdicao,
          { borderTopColor: theme.borda },
        ]}
      >
        <Input
          label="DOMÍNIO"
          value={edicao.host}
          onChangeText={(valor) => {
            setEdicao((atual) =>
              atual
                ? { ...atual, host: valor }
                : atual
            );
            setErro("");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!salvandoEdicao}
        />

        <Input
          label="SEÇÃO DO SITE (OPCIONAL)"
          value={edicao.caminho_prefixo}
          onChangeText={(valor) => {
            setEdicao((atual) =>
              atual
                ? {
                    ...atual,
                    caminho_prefixo: valor,
                  }
                : atual
            );
            setErro("");
          }}
          placeholder="Ex.: /agro"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!salvandoEdicao}
        />

        <View style={styles.opcao}>
          <View style={styles.opcaoTexto}>
            <Text weight="SemiBold">
              Incluir subdomínios
            </Text>
          </View>

          <Switch
            value={edicao.incluir_subdominios}
            onValueChange={(valor) =>
              setEdicao((atual) =>
                atual
                  ? {
                      ...atual,
                      incluir_subdominios: valor,
                    }
                  : atual
              )
            }
            disabled={salvandoEdicao}
            trackColor={{
              false: theme.surface,
              true: theme.primaria,
            }}
            thumbColor={theme.branco}
          />
        </View>

        {erro ? (
          <Text
            style={[
              styles.erro,
              { color: theme.erro },
            ]}
          >
            {erro}
          </Text>
        ) : null}

        <View style={styles.botoesEdicao}>
          <Button
            title="CANCELAR"
            variant="outline"
            size="small"
            disabled={salvandoEdicao}
            onPress={() => {
              setEdicao(null);
              setErro("");
            }}
            style={styles.botaoEdicao}
          />
          <Button
            title="SALVAR"
            size="small"
            loading={salvandoEdicao}
            onPress={() => void salvarEdicao()}
            style={styles.botaoEdicao}
          />
        </View>
      </View>
    ) : null}
  </View>
))
      )}

      {editavel && edicao === null ? (
        <View
          style={[
            styles.formulario,
            { borderTopColor: theme.borda },
          ]}
        >
          <Input
            label="DOMÍNIO"
            value={host}
            onChangeText={(valor) => {
              setHost(valor);
              setErro("");
            }}
            placeholder="Ex.: nomesite.com"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!salvando}
          />

          <Input
            label="SEÇÃO DO SITE (OPCIONAL)"
            value={caminho}
            onChangeText={(valor) => {
              setCaminho(valor);
              setErro("");
            }}
            placeholder="Ex.: /prisma/mundo-agro"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!salvando}
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
                Ex.: portal.exemplo.com também
                pertence a exemplo.com
              </Text>
            </View>

            <Switch
              value={incluirSubdominios}
              onValueChange={setIncluirSubdominios}
              disabled={salvando}
              trackColor={{
                false: theme.surface,
                true: theme.primaria,
              }}
              thumbColor={theme.branco}
            />
          </View>

          {erro ? (
            <Text
              style={[
                styles.erro,
                { color: theme.erro },
              ]}
            >
              {erro}
            </Text>
          ) : null}

          <Button
            title="ADICIONAR ENDEREÇO"
            size="small"
            onPress={adicionar}
            loading={salvando}
            disabled={carregando || removendoId !== null}
          />

          <Text
            style={[
              styles.aviso,
              { color: theme.textoSub },
            ]}
          >
            O endereço é salvo ao adicionar.
            Cancelar a edição dos outros campos
            não o remove.
          </Text>
        </View>
      ) : erro ? (
        <Text
          style={[
            styles.erro,
            { color: theme.erro },
          ]}
        >
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 14,
    marginBottom: 14,
  },
  titulo: {
    fontSize: 13,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  carregando: {
    marginVertical: 14,
  },
  vazio: {
    fontSize: 13,
    marginVertical: 8,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    },
registro: {
  borderTopWidth: 1,
  paddingVertical: 11,
},
acoesEndereco: {
  flexDirection: "row",
  alignItems: "center",
  marginLeft: 4,
},
acaoIcone: {
  width: 34,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
},
formEdicao: {
  borderTopWidth: 1,
  marginTop: 10,
  paddingTop: 14,
},
botoesEdicao: {
  flexDirection: "row",
  gap: 8,
},
botaoEdicao: {
  flex: 1,
},
  icone: {
    marginRight: 10,
  },
  dadosEndereco: {
    flex: 1,
    minWidth: 0,
  },
  detalhe: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  formulario: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
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
  erro: {
    fontSize: 12,
    marginBottom: 12,
  },
  aviso: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
});