import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { rotuloTier, type Tier } from "@/constants/tier";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { validarNomeVeiculo } from "@/utils/validarVeiculo";
import {
  listarVeiculos,
  obterUrlLogoVeiculo,
  type Veiculo,
} from "@/services/api/veiculo";

export interface SelecaoVeiculo {
  id: number | null;
  nome: string;
  tier?: Tier | null;
  descricao?: string | null;
  alcance?: string | null;
  logo_path?: string | null;
  ativo?: number;
}

interface VeiculoSelectorProps {
  value: SelecaoVeiculo;
  onChange: (selecao: SelecaoVeiculo) => void;
  showChanged?: boolean;
  error?: string;
  disabled?: boolean;
  mostrarResumo?: boolean;
  criacaoAoSalvar?: boolean;
  onCadastrar?: (nome: string) => void;
}

interface ResultadoBusca {
  chave: string;
  veiculos: Veiculo[];
  temMais: boolean;
  erro: string;
}

export default function VeiculoSelector({
  value,
  onChange,
  showChanged = false,
  error,
  disabled = false,
  mostrarResumo = false,
  criacaoAoSalvar = true,
  onCadastrar,
}: VeiculoSelectorProps) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [resultado, setResultado] =
    useState<ResultadoBusca | null>(null);

  const [tentativa, setTentativa] = useState(0);
  const [resumoAberto, setResumoAberto] = useState(false);

  const termo = value.nome.trim();
  const erroNome = validarNomeVeiculo(value.nome);

  const podeConsultar = temPermissao("VEICULOS", "VISUALIZAR");
  const podeCriar = temPermissao("VEICULOS", "CRIAR");

  const semSelecao = value.id === null;
  const temTermo = termo.length > 0;

  const deveBuscar =
    semSelecao &&
    temTermo &&
    !erroNome &&
    podeConsultar &&
    !disabled;

  const chave = JSON.stringify([termo, tentativa]);

  const resultadoAtual =
    resultado?.chave === chave ? resultado : null;

  const carregando = deveBuscar && resultadoAtual === null;

  const correspondenciaExata =
    resultadoAtual?.veiculos.some(
      (item) =>
        item.nome.trim().toLowerCase() === termo.toLowerCase()
    ) ?? false;

  const podeOferecerCadastro =
    semSelecao &&
    temTermo &&
    !erroNome &&
    !disabled &&
    !criacaoAoSalvar &&
    podeCriar &&
    Boolean(onCadastrar) &&
    (
      !podeConsultar ||
      (
        resultadoAtual !== null &&
        !resultadoAtual.erro &&
        !correspondenciaExata
      )
    );

  const logo = obterUrlLogoVeiculo(value.logo_path);

  useEffect(() => {
    if (!deveBuscar) return;

    let ativo = true;

    const atraso = setTimeout(async () => {
      try {
        const resposta = await listarVeiculos({
          busca: termo,
          limit: 8,
        });

        if (!ativo) return;

        setResultado({
          chave,
          veiculos: resposta.veiculos,
          temMais: resposta.pagination.has_next,
          erro: "",
        });
      } catch (error) {
        if (!ativo) return;

        setResultado({
          chave,
          veiculos: [],
          temMais: false,
          erro:
            error instanceof Error
              ? error.message
              : "Não foi possível buscar os veículos.",
        });
      }
    }, 250);

    return () => {
      ativo = false;
      clearTimeout(atraso);
    };
  }, [deveBuscar, termo, chave]);

  function selecionar(item: Veiculo) {
    if (disabled) return;

    setResumoAberto(false);
    onChange(item);
  }

  return (
    <View style={styles.container}>
      <Input
        label="VEÍCULO"
        value={value.nome}
        onChangeText={(nome) => {
          if (disabled) return;

          setResumoAberto(false);
          onChange({ id: null, nome });
        }}
        placeholder="Buscar pelo nome do veículo"
        autoCapitalize="words"
        autoCorrect={false}
        editable={!disabled}
        clearable={!disabled}
        showChanged={showChanged}
        error={error || erroNome || undefined}
        containerStyle={styles.input}
      />

      {!semSelecao ? (
        <View
          style={[
            styles.caixa,
            { borderColor: theme.borda },
          ]}
        >
          <View style={styles.linha}>
            {mostrarResumo && logo ? (
              <Image
                source={{ uri: logo }}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Logo do veículo"
              />
            ) : (
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={theme.primaria}
              />
            )}

            <View style={styles.informacoes}>
              <Text weight="SemiBold" style={styles.nome}>
                Veículo selecionado
              </Text>

              {mostrarResumo ? (
                <Text
                  style={[
                    styles.ajuda,
                    { color: theme.textoSub },
                  ]}
                >
                  {rotuloTier(value.tier ?? null)}
                  {value.ativo === 0 ? " • Inativo" : ""}
                </Text>
              ) : null}
            </View>
          </View>

          {mostrarResumo ? (
            <>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{
                  expanded: resumoAberto,
                  disabled,
                }}
                disabled={disabled}
                onPress={() =>
                  setResumoAberto((atual) => !atual)
                }
                style={styles.atalho}
              >
                <Text
                  style={[
                    styles.ajuda,
                    { color: theme.textoTerciaria },
                  ]}
                >
                  {resumoAberto
                    ? "Recolher descrição e alcance"
                    : "Ver descrição e alcance"}
                </Text>

                <Ionicons
                  name={
                    resumoAberto
                      ? "chevron-up"
                      : "chevron-down"
                  }
                  size={16}
                  color={theme.textoTerciaria}
                />
              </TouchableOpacity>

              {resumoAberto ? (
                <View style={styles.dados}>
                  <Text weight="SemiBold" style={styles.nome}>
                    Descrição
                  </Text>

                  <Text
                    selectable
                    style={[
                      styles.ajuda,
                      { color: theme.textoSub },
                    ]}
                  >
                    {value.descricao?.trim() ||
                      "Descrição não informada."}
                  </Text>

                  <Text weight="SemiBold" style={styles.nome}>
                    Alcance
                  </Text>

                  <Text
                    selectable
                    style={[
                      styles.ajuda,
                      { color: theme.textoSub },
                    ]}
                  >
                    {value.alcance?.trim() ||
                      "Alcance não informado."}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {semSelecao && temTermo && !podeConsultar ? (
        <Text style={[styles.ajuda, { color: theme.textoSub }]}>
          Você não possui permissão para consultar veículos.
        </Text>
      ) : null}

      {deveBuscar ? (
        <View
          style={[
            styles.resultados,
            { borderColor: theme.borda },
          ]}
        >
          {carregando ? (
            <View style={styles.carregamento}>
              <ActivityIndicator color={theme.primaria} />
              <Text
                style={[styles.ajuda, { color: theme.textoSub }]}
              >
                Buscando veículos...
              </Text>
            </View>
          ) : resultadoAtual?.erro ? (
            <View style={styles.caixaErro}>
              <Text style={styles.erro}>
                {resultadoAtual.erro}
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={() =>
                  setTentativa((atual) => atual + 1)
                }
                style={styles.atalho}
              >
                <Text
                  weight="SemiBold"
                  style={{
                    color: theme.textoTerciaria,
                    fontSize: 12,
                  }}
                >
                  Tentar novamente
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {resultadoAtual?.veiculos.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar ${item.nome}`}
                  disabled={disabled}
                  onPress={() => selecionar(item)}
                  style={styles.resultado}
                >
                  <Ionicons
                    name="newspaper-outline"
                    size={20}
                    color={theme.primaria}
                  />

                  <View style={styles.informacoes}>
                    <Text
                      weight="SemiBold"
                      style={styles.nome}
                    >
                      {item.nome}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.ajuda,
                        { color: theme.textoSub },
                      ]}
                    >
                      {rotuloTier(item.tier)}
                      {item.ativo === 0 ? " • Inativo" : ""}
                      {item.alcance ? ` • ${item.alcance}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {resultadoAtual?.veiculos.length === 0 ? (
                <Text
                  style={[
                    styles.vazio,
                    { color: theme.textoSub },
                  ]}
                >
                  Nenhum veículo encontrado.
                </Text>
              ) : null}

              {resultadoAtual?.temMais ? (
                <Text
                  style={[
                    styles.vazio,
                    { color: theme.textoSub },
                  ]}
                >
                  Há mais resultados. Digite um nome mais específico.
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {podeOferecerCadastro ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.8}
          onPress={() => onCadastrar?.(termo)}
          style={[
            styles.cadastrar,
            { borderColor: theme.borda },
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={21}
            color={theme.textoTerciaria}
          />

          <Text
            weight="SemiBold"
            style={[
              styles.nome,
              { color: theme.textoTerciaria, flex: 1 },
            ]}
          >
            Cadastrar “{termo}”
          </Text>
        </TouchableOpacity>
      ) : null}

      {semSelecao && temTermo && !erroNome ? (
        <Text style={[styles.ajuda, { color: theme.textoSub }]}>
          {criacaoAoSalvar
            ? "O nome digitado será usado ao salvar."
            : podeCriar
              ? "Selecione um resultado ou cadastre o veículo antes de salvar o clipping."
              : "Selecione um resultado. Para deixar o veículo pendente, limpe este campo."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    gap: 8,
  },
  input: {
    marginBottom: 0,
  },
  caixa: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  informacoes: {
    flex: 1,
    gap: 3,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  nome: {
    fontSize: 13,
    lineHeight: 19,
  },
  ajuda: {
    fontSize: 12,
    lineHeight: 18,
  },
  atalho: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dados: {
    gap: 6,
  },
  resultados: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  carregamento: {
    minHeight: 52,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultado: {
    minHeight: 56,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vazio: {
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  cadastrar: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  caixaErro: {
    padding: 12,
  },
  erro: {
    color: "#EF4444",
    fontSize: 12,
    lineHeight: 18,
  },
});