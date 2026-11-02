import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Text from "@/components/ui/Text";
import type { SelecaoVeiculo } from "@/components/forms/VeiculoSelector";
import { rotuloTier } from "@/constants/tier";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  listarEnderecosVeiculo,
  obterUrlLogoVeiculo,
  type EnderecoVeiculo,
} from "@/services/api/veiculo";

interface Props {
  veiculo: SelecaoVeiculo;
  disabled?: boolean;
}

interface ResultadoEnderecos {
  chave: string;
  enderecos: EnderecoVeiculo[];
  erro: string;
}

function alcanceEndereco(endereco: EnderecoVeiculo): string {
  const host = endereco.host.replace(/^www\./, "");
  const canal = host === "youtube.com" && endereco.caminho_prefixo;

  const alcance = canal
    ? "Canal do YouTube"
    : endereco.caminho_prefixo
      ? "Esta seção e suas subseções"
      : "Site inteiro";

  return endereco.incluir_subdominios
    ? `${alcance} · Inclui subdomínios`
    : alcance;
}

export default function VeiculoResumo({
  veiculo,
  disabled = false,
}: Props) {
  const { theme } = useTheme();
  const { temPermissao } = useAuth();

  const [aberto, setAberto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] =
    useState<ResultadoEnderecos | null>(null);
  const [erroAbertura, setErroAbertura] = useState("");
  const [falhaLogo, setFalhaLogo] = useState(false);

  const podeConsultar = temPermissao("VEICULOS", "VISUALIZAR");
  const logo = obterUrlLogoVeiculo(veiculo.logo_path);
  const chave = JSON.stringify([veiculo.id, tentativa]);

  const atual = resultado?.chave === chave ? resultado : null;
  const carregando =
    podeConsultar && tentativa > 0 && atual === null;

  useEffect(() => {
    setFalhaLogo(false);
  }, [logo]);

  useEffect(() => {
    if (
      veiculo.id === null ||
      tentativa === 0 ||
      !podeConsultar
    ) {
      return;
    }

    let ativo = true;

    // consulta na primeira abertura e mantém o resultado ao recolher os detalhes
    listarEnderecosVeiculo(veiculo.id)
      .then((enderecos) => {
        if (ativo) {
          setResultado({ chave, enderecos, erro: "" });
        }
      })
      .catch((falha) => {
        if (!ativo) return;

        setResultado({
          chave,
          enderecos: [],
          erro:
            falha instanceof Error
              ? falha.message
              : "Não foi possível carregar os endereços.",
        });
      });

    return () => {
      ativo = false;
    };
  }, [veiculo.id, tentativa, podeConsultar, chave]);

  function alternarDetalhes() {
    if (disabled) return;

    setAberto(!aberto);

    if (!aberto && tentativa === 0) {
      setTentativa(1);
    }
  }

  async function abrirEndereco(endereco: EnderecoVeiculo) {
    setErroAbertura("");

    const protocolo =
      endereco.protocolo === "http" ? "http" : "https";

    const url =
      `${protocolo}://${endereco.host}` +
      (endereco.caminho_prefixo || "/");

    try {
      await Linking.openURL(url);
    } catch {
      setErroAbertura("Não foi possível abrir este endereço.");
    }
  }

  if (veiculo.id === null) return null;

  return (
    <View style={[styles.cartao, { borderColor: theme.borda }]}>
      <View style={styles.cabecalho}>
        {logo && !falhaLogo ? (
          <Image
            source={{ uri: logo }}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={`Logo de ${veiculo.nome}`}
            onError={() => setFalhaLogo(true)}
          />
        ) : (
          <View
            style={[
              styles.marca,
              { backgroundColor: theme.textoTerciaria + "12" },
            ]}
          >
            <Ionicons
              name="newspaper-outline"
              size={22}
              color={theme.textoTerciaria}
            />
          </View>
        )}

        <View style={styles.informacoes}>
          <Text weight="SemiBold" style={styles.nome}>
            {veiculo.nome}
          </Text>

          <Text
            style={[
              styles.texto,
              { color: theme.textoSub },
            ]}
          >
            {rotuloTier(veiculo.tier ?? null)}
            {veiculo.ativo === 0 ? " · Inativo" : ""}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          aberto
            ? "Recolher detalhes do veículo"
            : "Ver detalhes do veículo"
        }
        accessibilityState={{ expanded: aberto, disabled }}
        disabled={disabled}
        onPress={alternarDetalhes}
        hitSlop={{ top: 4, bottom: 4 }}
        style={styles.atalho}
      >
        <Text
          style={[
            styles.texto,
            { color: theme.textoTerciaria },
          ]}
        >
          {aberto ? "Recolher detalhes" : "Ver detalhes"}
        </Text>

        <Ionicons
          name={aberto ? "chevron-up" : "chevron-down"}
          size={15}
          color={theme.textoTerciaria}
        />
      </TouchableOpacity>

      {aberto ? (
        <View
          style={[
            styles.detalhes,
            { borderTopColor: theme.borda + "40" },
          ]}
        >
          <View style={styles.secao}>
            <Text weight="SemiBold" style={styles.rotulo}>
              Descrição
            </Text>

            <Text
              selectable
              style={[
                styles.texto,
                { color: theme.textoSub },
              ]}
            >
              {veiculo.descricao?.trim() ||
                "Descrição não informada."}
            </Text>
          </View>

          <View style={styles.secao}>
            <Text weight="SemiBold" style={styles.rotulo}>
              Alcance
            </Text>

            <Text
              selectable
              style={[
                styles.texto,
                { color: theme.textoSub },
              ]}
            >
              {veiculo.alcance?.trim() ||
                "Alcance não informado."}
            </Text>
          </View>

          <View style={[styles.secao]}>
            <View style={styles.linhaEnderecos}>
              <Text
                weight="SemiBold"
                style={[
                  styles.rotulo,
                  styles.tituloEnderecos,
                ]}
              >
                Endereços associados
              </Text>

              {podeConsultar ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Atualizar endereços associados"
                  disabled={disabled || carregando}
                  onPress={() => {
                    setErroAbertura("");
                    setTentativa((valor) => valor + 1);
                  }}
                  hitSlop={8}
                  style={[
                    styles.iconeAcao,
                    styles.atualizarEnderecos,
                  ]}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={17}
                    color={
                      carregando
                        ? theme.textoSub
                        : theme.textoTerciaria
                    }
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {!podeConsultar ? (
              <Text
                style={[
                  styles.texto,
                  { color: theme.textoSub },
                ]}
              >
                Você não possui permissão para consultar os
                endereços deste veículo.
              </Text>
            ) : carregando ? (
              <View
                style={styles.carregamento}
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator
                  size="small"
                  color={theme.textoTerciaria}
                />

                <Text
                  style={[
                    styles.texto,
                    { color: theme.textoSub },
                  ]}
                >
                  Carregando endereços...
                </Text>
              </View>
            ) : atual?.erro ? (
              <Text
                accessibilityRole="alert"
                style={[
                  styles.texto,
                  { color: theme.erro },
                ]}
              >
                {atual.erro} Toque na seta circular para tentar
                novamente.
              </Text>
            ) : atual?.enderecos.length ? (
              atual.enderecos.map((endereco) => (
                <View
                  key={endereco.id}
                  style={styles.endereco}
                >
                  <Ionicons
                    name="globe-outline"
                    size={17}
                    color={theme.textoTerciaria}
                  />

                  <View style={styles.informacoes}>
                    <Text selectable style={styles.texto}>
                      {endereco.host}
                      {endereco.caminho_prefixo}
                    </Text>

                    <Text
                      style={[
                        styles.nota,
                        { color: theme.textoSub },
                      ]}
                    >
                      {alcanceEndereco(endereco)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      `Abrir ${endereco.host}` +
                      endereco.caminho_prefixo
                    }
                    disabled={disabled}
                    onPress={() => void abrirEndereco(endereco)}
                    hitSlop={4}
                    style={styles.iconeAcao}
                  >
                    <Ionicons
                      name="open-outline"
                      size={17}
                      color={theme.textoTerciaria}
                    />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text
                style={[
                  styles.texto,
                  { color: theme.textoSub },
                ]}
              >
                Este veículo ainda não tem endereços associados.
              </Text>
            )}

            {erroAbertura ? (
              <Text
                accessibilityRole="alert"
                style={[
                  styles.texto,
                  { color: theme.erro },
                ]}
              >
                {erroAbertura}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    paddingBottom: 8,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  marca: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  informacoes: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nome: {
    fontSize: 13,
    lineHeight: 19,
  },
  texto: {
    fontSize: 12,
    lineHeight: 18,
  },
  nota: {
    fontSize: 10,
    lineHeight: 15,
  },
  atualizarEnderecos: {
    width: 24,
    height: 16,
  },
  atalho: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
    marginTop: 6,
  },
  detalhes: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  secao: {
    gap: 4,
  },
  rotulo: {
    fontSize: 12,
  },
  linhaEnderecos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tituloEnderecos: {
    flex: 1,
  },
  iconeAcao: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  carregamento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  endereco: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
});