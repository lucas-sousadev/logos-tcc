import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useEffect, useState } from "react";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { type ErrosClipping, obterAnoDaPublicacao, validarFormularioClipping,} from "@/utils/validarClipping";
import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import VeiculoSelector, {
  SelecaoVeiculo,
} from "@/components/forms/VeiculoSelector";
import ClippingContexto from "@/components/clipping/ClippingContexto";
import TierSelector from "@/components/forms/TierSelector";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Tier } from "@/constants/tier";

import {
  type DadosClipping,
  criarClipping,
  listarPautas,
} from "@/services/api/clipping"; 

const CATEGORIAS_SUGERIDAS = [
  "Site",
  "TV",
  "Rádio",
  "Jornal",
  "Revista",
  "Podcast",
  "Redes sociais",
];

function primeiroParametro(
  valor: string | string[] | undefined
): string {
  return Array.isArray(valor)
    ? valor[0] ?? ""
    : valor ?? "";
}

export default function NovoClipping() {
  const params = useLocalSearchParams<{
    ano?: string | string[];
    clienteId?: string | string[];
    clienteNome?: string | string[];
  }>();

  const anoParametro = primeiroParametro(params.ano);
  const clienteParametro = primeiroParametro(params.clienteId);
  const nomeParametro = primeiroParametro(params.clienteNome);

  const numeroCliente = Number(clienteParametro);

  const clienteInicial =
    Number.isSafeInteger(numeroCliente) && numeroCliente > 0
      ? numeroCliente
      : null;

  const anoInicial = anoParametro
    ? Number(anoParametro)
    : new Date().getFullYear();

  return (
    <FormularioNovoClipping
      key={JSON.stringify([anoParametro, clienteParametro])}
      anoInicial={anoInicial}
      clienteInicial={clienteInicial}
      nomeClienteInicial={nomeParametro.trim()}
    />
  );
}

function FormularioNovoClipping({
  anoInicial,
  clienteInicial,
  nomeClienteInicial,
}: {
  anoInicial: number;
  clienteInicial: number | null;
  nomeClienteInicial: string;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [anoReferencia, setAnoReferencia] = useState(anoInicial);

  const [clienteId, setClienteId] = useState<number | null>(
    clienteInicial
  );

  const [clienteNome, setClienteNome] = useState(
    clienteInicial !== null ? nomeClienteInicial : ""
  );

  const [dataPublicacao, setDataPublicacao] = useState("");

  const anoDaData = obterAnoDaPublicacao(dataPublicacao);
  const ano = anoDaData ?? anoReferencia;
  const [pauta, setPauta] = useState("");
  const [programaSecao, setProgramaSecao] = useState("");
  const [categoriasTexto, setCategoriasTexto] = useState("");
  const [link, setLink] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [inicioSegundos, setInicioSegundos] = useState("");
  const [fimSegundos, setFimSegundos] = useState("");

  const [veiculo, setVeiculo] =
    useState<SelecaoVeiculo>({
      id: null,
      nome: "",
    });

  const [tier, setTier] = useState<Tier | null>(null);

  const [pautasSugeridas, setPautasSugeridas] =
    useState<string[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<ErrosClipping>({});
  const [erroGeral, setErroGeral] = useState("");


  useEffect(() => {
    if (!clienteId || pauta.trim().length < 2) {
        return;
    }

    let cancelado = false;

    const atraso = setTimeout(async () => {
        try {
        const resposta = await listarPautas(
            clienteId,
            pauta
        );

        if (!cancelado) {
            setPautasSugeridas(resposta.pautas);
        }
        } catch {
        if (!cancelado) {
            setPautasSugeridas([]);
        }
        }
    }, 300);

    return () => {
        cancelado = true;
        clearTimeout(atraso);
    };
    }, [clienteId, pauta]);

  function adicionarCategoria(categoria: string) {
    const atual = categoriasTexto.trim();

    if (!atual) {
      setCategoriasTexto(categoria);
      return;
    }

    const existentes = atual
      .split(",")
      .map((item) => item.trim().toLocaleLowerCase());

    if (
      existentes.includes(
        categoria.toLocaleLowerCase()
      )
    ) {
      return;
    }

    setCategoriasTexto(`${atual}, ${categoria}`);
  }

  function converterSegundos(
    valor: string,
    nomeCampo: string
  ): number | null {
    if (!valor.trim()) {
      return null;
    }

    const numero = Number(valor);

    if (
      !Number.isInteger(numero) ||
      numero < 0
    ) {
      throw new Error(
        `${nomeCampo} deve ser um número inteiro maior ou igual a zero.`
      );
    }

    return numero;
  }

  function limparErro(
    campo: keyof ErrosClipping
  ) {
    setErros((atual) => ({
      ...atual,
      [campo]: undefined,
    }));

    setErroGeral("");
  }

  function exibirErroDaApi(
    mensagem: string
  ) {
    const texto = mensagem.toLocaleLowerCase();

    let campo: keyof ErrosClipping | null = null;

    if (texto.includes("cliente")) {
      campo = "cliente";
    } else if (
      texto.includes("ano de referência") ||
      texto.includes("ano de referencia") ||
      texto.startsWith("ano ")
    ) {
      campo = "anoReferencia";
    } else if (texto.includes("data")) {
      campo = "dataPublicacao";
    } else if (texto.includes("categoria")) {
      campo = "categorias";
    } else if (
      texto.includes("programa") ||
      texto.includes("seção") ||
      texto.includes("secao")
    ) {
      campo = "programaSecao";
    } else if (texto.includes("pauta")) {
      campo = "pauta";
    } else if (texto.includes("veículo")) {
      campo = "veiculo";
    } else if (texto.includes("tier")) {
      campo = "tier";
    } else if (
      texto.includes("início") ||
      texto.includes("inicio")
    ) {
      campo = "inicioSegundos";
    } else if (texto.includes("fim")) {
      campo = "fimSegundos";
    } else if (texto.includes("link")) {
      campo = "link";
    } else if (texto.includes("observa")) {
      campo = "observacoes";
    }

    if (campo) {
      setErros({
        [campo]: mensagem,
      });
      return;
    }

    setErroGeral(mensagem);
  }

  function limparCamposParaOutro() {
    setPauta("");
    setProgramaSecao("");
    setCategoriasTexto("");
    setLink("");
    setObservacoes("");
    setInicioSegundos("");
    setFimSegundos("");
    setVeiculo({
      id: null,
      nome: "",
    });
    setTier(null);
    setPautasSugeridas([]);
  }

  async function salvar(
    adicionarOutro: boolean
  ) {
    const errosValidacao =
      validarFormularioClipping({
        clienteId,
        anoReferencia: ano,
        dataPublicacao,
        categorias: categoriasTexto,
        programaSecao,
        pauta,
        veiculoId: veiculo.id,
        veiculoNome: veiculo.nome,
        tier,
        inicioSegundos,
        fimSegundos,
        link,
        observacoes,
      });

    setErros(errosValidacao);
    setErroGeral("");

    if (Object.keys(errosValidacao).length > 0) {
      return;
    }

    const inicio = inicioSegundos.trim()
      ? Number(inicioSegundos)
      : null;

    const fim = fimSegundos.trim()
      ? Number(fimSegundos)
      : null;

    const categorias = categoriasTexto
      .split(",")
      .map((categoria) => categoria.trim())
      .filter(Boolean);

    const dados: DadosClipping = {
      cliente_id: clienteId as number,
      ano_referencia: ano,
      data_publicacao:
        dataPublicacao.trim() || null,
      veiculo_id: veiculo.id,
      categorias,
      programa_secao:
        programaSecao.trim() || null,
      pauta: pauta.trim() || null,
      link: link.trim() || null,
      observacoes:
        observacoes.trim() || null,
      inicio_segundos: inicio,
      fim_segundos: fim,
    };

    if (tier !== null) {
      dados.tier = tier;
    }

    try {
      setSalvando(true);

      const clipping = await criarClipping(dados);
      
      setAnoReferencia(clipping.ano_referencia);
      setClienteNome(clipping.cliente_nome);

      if (adicionarOutro) {
        limparCamposParaOutro();

        Alert.alert(
          "Clipping salvo",
          "Você pode cadastrar outra publicação para o mesmo cliente e data."
        );

        return;
      }

      router.replace({
        pathname: "/clipping/[id]" as never,
        params: {
          id: String(clipping.id),
        },
      });
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o clipping.";

      exibirErroDaApi(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  if (!temPermissao("CLIPPING", "CRIAR")) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Header
          title="Novo clipping"
          showBackButton
        />

        <View style={styles.permissionBox}>
          <Ionicons
            name="lock-closed-outline"
            size={36}
            color={theme.primaria}
          />

          <Text
            weight="SemiBold"
            style={styles.permissionTitle}
          >
            Acesso restrito
          </Text>

          <Text
            style={[
              styles.permissionText,
              { color: theme.textoSub },
            ]}
          >
            Você não possui permissão para criar clippings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Header
        title="Novo clipping"
        showBackButton
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ClippingContexto
          clienteId={clienteId}
          clienteNome={clienteNome}
          ano={ano}
          anoPelaData={anoDaData !== null}
          erroCliente={erros.cliente}
          erroAno={erros.anoReferencia}
          disabled={salvando}
          onCliente={(cliente) => {
            if (cliente.id !== clienteId) {
              setPautasSugeridas([]);
            }

            setClienteId(cliente.id);
            setClienteNome(cliente.nome);
            limparErro("cliente");
          }}
          onAno={(novoAno) => {
            setAnoReferencia(novoAno);
            limparErro("anoReferencia");
          }}
        />

        <Text weight="Bold" style={styles.sectionTitle}>
          DADOS DA PUBLICAÇÃO
        </Text>

        <Input
          label="DATA DE PUBLICAÇÃO"
          value={dataPublicacao}
          onChangeText={(texto) => {
            setDataPublicacao(texto);

            const novoAno = obterAnoDaPublicacao(texto);

            if (novoAno !== null) {
              setAnoReferencia(novoAno);
              limparErro("anoReferencia");
            }

            limparErro("dataPublicacao");
          }}
          editable={!salvando}
          placeholder="AAAA-MM-DD"
          keyboardType="numbers-and-punctuation"
          error={erros.dataPublicacao}
        />

        <Input
          label="PAUTA"
          value={pauta}
          onChangeText={(texto) => {
            setPauta(texto);

            if (texto.trim().length < 2) {
              setPautasSugeridas([]);
            }

            limparErro("pauta");
          }}
          error={erros.pauta}
          placeholder="Assunto ou título da matéria"
          autoCapitalize="sentences"
        />

        {pautasSugeridas.length > 0 ? (
          <View
            style={[
              styles.suggestions,
              { borderColor: theme.borda },
            ]}
          >
            {pautasSugeridas.map((sugestao) => (
              <TouchableOpacity
                key={sugestao}
                onPress={() => {
                  setPauta(sugestao);
                  setPautasSugeridas([]);
                }}
                style={styles.suggestion}
              >
                <Ionicons
                  name="return-down-forward-outline"
                  size={16}
                  color={theme.primaria}
                />

                <Text
                  style={[
                    styles.suggestionText,
                    { color: theme.texto },
                  ]}
                >
                  {sugestao}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Input
          label="PROGRAMA / SEÇÃO"
          value={programaSecao}
          onChangeText={(texto) => {
            setProgramaSecao(texto);
            limparErro("programaSecao");
          }}
          placeholder="Ex.: Jornal da manhã"
          error={erros.programaSecao}
        />



        <Input
          label="CATEGORIAS"
          value={categoriasTexto}
          onChangeText={(texto) => {
            setCategoriasTexto(texto);
            limparErro("categorias");
          }}
          placeholder="Separe as categorias por vírgula"
          error={erros.categorias}
        />

        <View style={styles.chips}>
          {CATEGORIAS_SUGERIDAS.map((categoria) => (
            <TouchableOpacity
              key={categoria}
              onPress={() =>
                adicionarCategoria(categoria)
              }
              style={[
                styles.chip,
                { borderColor: theme.borda },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: theme.texto },
                ]}
              >
                + {categoria}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <VeiculoSelector
          value={veiculo}
          onChange={(selecao) => {
            setVeiculo(selecao);
            limparErro("veiculo");
          }}
          error={erros.veiculo}
        />

        <TierSelector
          value={tier}
          onChange={setTier}
        />
        {erros.tier ? (
          <Text style={styles.fieldError}>
            {erros.tier}
          </Text>
        ) : null}

        <View style={styles.row}>
          <Input
            label="INÍCIO (SEG.)"
            value={inicioSegundos}
            onChangeText={(texto) => {
              setInicioSegundos(texto);
              limparErro("inicioSegundos");
            }}
            placeholder="0"
            keyboardType="numeric"
            containerStyle={styles.half}
            error={erros.inicioSegundos}
          />

          <Input
            label="FIM (SEG.)"
            value={fimSegundos}
            onChangeText={(texto) => {
              setFimSegundos(texto);
              limparErro("fimSegundos");
            }}
            placeholder="0"
            keyboardType="numeric"
            containerStyle={styles.half}
            error={erros.fimSegundos}
          />
        </View>

        <Input
          label="LINK"
          value={link}
          onChangeText={(texto) => {
            setLink(texto);
            limparErro("link");
          }}
          placeholder="https://..."
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={erros.link}
        />

        <Input
          label="OBSERVAÇÕES"
          value={observacoes}
          onChangeText={(texto) => {
            setObservacoes(texto);
            limparErro("observacoes");
          }}
          placeholder="Informações adicionais"
          multiline
          textAlignVertical="top"
          style={styles.textArea}
          error={erros.observacoes}
        />  
        {erroGeral ? (
          <Text style={styles.generalError}>
            {erroGeral}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="CANCELAR"
            variant="outline"
            onPress={() => router.back()}
            style={styles.actionButton}
          />

          <Button
            title="SALVAR"
            loading={salvando}
            onPress={() => void salvar(false)}
            style={styles.actionButton}
          />
        </View>

        <Button
          title="SALVAR E ADICIONAR OUTRO"
          variant="outline"
          loading={salvando}
          onPress={() => void salvar(true)}
          style={styles.addAnotherButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 13,
    marginTop: 4,
  },

  fieldLabel: {
    fontSize: 12,
    marginBottom: 8,
  },

  suggestions: {
    borderWidth: 1.5,
    borderRadius: 13,
    marginTop: -12,
    marginBottom: 18,
    overflow: "hidden",
  },

  suggestion: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  suggestionText: {
    flex: 1,
    fontSize: 12,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: -10,
    marginBottom: 20,
  },

  chip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  chipText: {
    fontSize: 11,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  half: {
    flex: 1,
  },

  textArea: {
    height: 105,
    paddingTop: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  actionButton: {
    flex: 1,
  },

  addAnotherButton: {
    marginTop: 10,
  },

  permissionBox: {
    margin: 20,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 25,
    alignItems: "center",
  },

  permissionTitle: {
    fontSize: 16,
    marginTop: 12,
  },

  permissionText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },

  fieldError: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: -12,
    marginBottom: 14,
  },

  generalError: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
});