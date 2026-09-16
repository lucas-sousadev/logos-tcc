import { useState } from "react";
import {
  Platform,
  TouchableOpacity,
  View,
} from "react-native";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import FiltroModalBase from "@/components/ui/Filtros/FiltroModalBase";
import ClippingDataInput from "@/components/clipping/ClippingDataInput";
import VeiculoSelector from "@/components/forms/VeiculoSelector";
import TierSelector from "@/components/forms/TierSelector";

import { useTheme } from "@/contexts/ThemeContext";
import type { Tier } from "@/constants/tier";
import type { FiltrosConsultaClipping } from "@/services/api/clipping";
import {
  dataBRParaISO,
  tempoParaSegundos,
  segundosParaTempo,
} from "@/utils/clippingFormatacao";

type Presenca = "todos" | "sim" | "nao";

export interface FiltrosClippings {
  data: "todas" | "periodo" | "sem";
  dataInicio: string;
  dataFim: string;
  veiculo: {
    id: number | null;
    nome: string;
  };
  programaSecao: string;
  categoria: string;
  filtrarTier: boolean;
  tier: Tier | null;
  duracaoMin: string;
  duracaoMax: string;
  link: Presenca;
  imagemRelatorio: Presenca;
  ordenacao: "recentes" | "antigos" | "veiculo" | "tier";
}

export function novosFiltrosClippings(): FiltrosClippings {
  return {
    data: "todas",
    dataInicio: "",
    dataFim: "",
    veiculo: { id: null, nome: "" },
    programaSecao: "",
    categoria: "",
    filtrarTier: false,
    tier: null,
    duracaoMin: "",
    duracaoMax: "",
    link: "todos",
    imagemRelatorio: "todos",
    ordenacao: "recentes",
  };
}

function presencaParaBooleano(valor: Presenca) {
  return valor === "todos" ? undefined : valor === "sim";
}

export function converterFiltrosClipping(
  filtros: FiltrosClippings
): FiltrosConsultaClipping {
  return {
    veiculo_id: filtros.veiculo.id ?? undefined,
    veiculo_nome:
      filtros.veiculo.id === null
        ? filtros.veiculo.nome.trim() || undefined
        : undefined,

    programa_secao:
      filtros.programaSecao.trim() || undefined,

    categoria: filtros.categoria.trim() || undefined,

    tier:
      filtros.filtrarTier && filtros.tier !== null
        ? filtros.tier
        : undefined,

    sem_tier:
      filtros.filtrarTier && filtros.tier === null
        ? true
        : undefined,

    data_inicio:
      filtros.data === "periodo"
        ? dataBRParaISO(filtros.dataInicio) ?? undefined
        : undefined,

    data_fim:
      filtros.data === "periodo"
        ? dataBRParaISO(filtros.dataFim) ?? undefined
        : undefined,

    sem_data: filtros.data === "sem" ? true : undefined,

    duracao_min:
      tempoParaSegundos(filtros.duracaoMin) ?? undefined,

    duracao_max:
      tempoParaSegundos(filtros.duracaoMax) ?? undefined,

    tem_link: presencaParaBooleano(filtros.link),

    tem_imagem_relatorio:
      presencaParaBooleano(filtros.imagemRelatorio),

    ordem:
      filtros.ordenacao === "veiculo"
        ? "veiculo"
        : filtros.ordenacao === "tier"
          ? "tier"
          : "data",

    direcao:
      filtros.ordenacao === "recentes" ? "DESC" : "ASC",
  };
}

export function possuiFiltrosClipping(
  filtros: FiltrosClippings
) {
  return (
    JSON.stringify(converterFiltrosClipping(filtros)) !==
    JSON.stringify(
      converterFiltrosClipping(novosFiltrosClippings())
    )
  );
}

const CATEGORIAS = [
  "Site",
  "TV",
  "Rádio",
  "Jornal",
  "Revista",
  "Podcast",
  "Redes sociais",
];

interface Props {
  ano: number;
  clienteNome: string;
  filtros: FiltrosClippings;
  onClose: () => void;
  onApply: (filtros: FiltrosClippings) => void;
}

export default function ClippingFilterModal({
  ano,
  clienteNome,
  filtros,
  onClose,
  onApply,
}: Props) {
  const { theme } = useTheme();

  const [atual, setAtual] = useState(filtros);
  const [erros, setErros] = useState<
    Partial<Record<keyof FiltrosClippings, string>>
  >({});

  function alterar<K extends keyof FiltrosClippings>(
    campo: K,
    valor: FiltrosClippings[K]
  ) {
    setAtual((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));

    setErros((anterior) => ({
      ...anterior,
      [campo]: undefined,
    }));
  }

  function aplicar() {
    const novosErros: typeof erros = {};

    if (atual.data === "periodo") {
      const inicio = dataBRParaISO(atual.dataInicio);
      const fim = dataBRParaISO(atual.dataFim);

      if (atual.dataInicio.trim() && !inicio) {
        novosErros.dataInicio = "Informe uma data válida.";
      }

      if (atual.dataFim.trim() && !fim) {
        novosErros.dataFim = "Informe uma data válida.";
      }

      if (!atual.dataInicio.trim() && !atual.dataFim.trim()) {
        novosErros.dataInicio = "Informe pelo menos uma data.";
      }

      if (inicio && fim && inicio > fim) {
        novosErros.dataFim =
          "A data final não pode ser anterior à inicial.";
      }
    }

    const minimo = tempoParaSegundos(atual.duracaoMin);
    const maximo = tempoParaSegundos(atual.duracaoMax);

    if (atual.duracaoMin.trim() && minimo === null) {
      novosErros.duracaoMin = "Use mm:ss ou hh:mm:ss.";
    }

    if (atual.duracaoMax.trim() && maximo === null) {
      novosErros.duracaoMax = "Use mm:ss ou hh:mm:ss.";
    }

    if (
      minimo !== null &&
      maximo !== null &&
      minimo > maximo
    ) {
      novosErros.duracaoMax =
        "O máximo não pode ser menor que o mínimo.";
    }

    if (Array.from(atual.veiculo.nome.trim()).length > 150) {
      novosErros.veiculo = "Use no máximo 150 caracteres.";
    }

    if (Array.from(atual.programaSecao.trim()).length > 150) {
      novosErros.programaSecao =
        "Use no máximo 150 caracteres.";
    }

    if (Array.from(atual.categoria.trim()).length > 80) {
      novosErros.categoria = "Use no máximo 80 caracteres.";
    }

    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) return;

    onApply({
      ...atual,
      veiculo: {
        ...atual.veiculo,
        nome: atual.veiculo.nome.trim(),
      },
      programaSecao: atual.programaSecao.trim(),
      categoria: atual.categoria.trim(),
      duracaoMin: minimo === null ? "" : segundosParaTempo(minimo),
      duracaoMax: maximo === null ? "" : segundosParaTempo(maximo),
    });
  }

  const sugestoes = CATEGORIAS.filter((categoria) =>
    categoria
      .toLocaleLowerCase()
      .includes(atual.categoria.trim().toLocaleLowerCase())
  );

  return (
    <FiltroModalBase
      visible
      subtitle={`${ano} • ${clienteNome}`}
      onClose={onClose}
      onClear={() => {
        setAtual(novosFiltrosClippings());
        setErros({});
      }}
      onApply={aplicar}
    >
      <Grupo
        titulo="DATA DA PUBLICAÇÃO"
        opcoes={[
          {
            texto: "Todas",
            selecionado: atual.data === "todas",
            onPress: () => alterar("data", "todas"),
          },
          {
            texto: "Período",
            selecionado: atual.data === "periodo",
            onPress: () => alterar("data", "periodo"),
          },
          {
            texto: "Sem data",
            selecionado: atual.data === "sem",
            onPress: () => alterar("data", "sem"),
          },
        ]}
      />

      {atual.data === "periodo" ? (
        <>
          <ClippingDataInput
            label="DATA INICIAL"
            anoReferencia={ano}
            value={atual.dataInicio}
            error={erros.dataInicio}
            onChangeText={(texto) => alterar("dataInicio", texto)}
          />

          <ClippingDataInput
            label="DATA FINAL"
            anoReferencia={ano}
            value={atual.dataFim}
            error={erros.dataFim}
            onChangeText={(texto) => alterar("dataFim", texto)}
          />

          <Ajuda>
            Deixe um limite vazio para consultar somente a partir
            da data inicial ou até a data final. O ano da tela
            continua sendo respeitado.
          </Ajuda>
        </>
      ) : null}

      <Grupo
        titulo="ORDENAÇÃO"
        opcoes={[
          ["recentes", "Mais recentes"],
          ["antigos", "Mais antigos"],
          ["veiculo", "Veículo A–Z"],
          ["tier", "Tier 1 → 3"],
        ].map(([valor, texto]) => ({
          texto,
          selecionado: atual.ordenacao === valor,
          onPress: () =>
            alterar(
              "ordenacao",
              valor as FiltrosClippings["ordenacao"]
            ),
        }))}
      />
      <VeiculoSelector
        value={atual.veiculo}
        onChange={(veiculo) => alterar("veiculo", veiculo)}
        error={erros.veiculo}
        criacaoAoSalvar={false}
        modoFiltro
      />

      <Input
        label="PROGRAMA / SEÇÃO"
        value={atual.programaSecao}
        onChangeText={(texto) => alterar("programaSecao", texto)}
        placeholder="Nome ou parte do nome"
        error={erros.programaSecao}
        clearable
      />

      <Input
        label="CATEGORIA"
        value={atual.categoria}
        onChangeText={(texto) => alterar("categoria", texto)}
        placeholder="Digite ou escolha uma sugestão"
        error={erros.categoria}
        clearable
      />

      {sugestoes.length > 0 ? (
        <Grupo
          opcoes={sugestoes.map((categoria) => ({
            texto: categoria,
            selecionado:
              atual.categoria.toLocaleLowerCase() ===
              categoria.toLocaleLowerCase(),
            onPress: () => alterar("categoria", categoria),
          }))}
        />
      ) : null}

      <Grupo
        titulo="TIER"
        opcoes={[
          {
            texto: "Todos",
            selecionado: !atual.filtrarTier,
            onPress: () => alterar("filtrarTier", false),
          },
          {
            texto: "Escolher Tier",
            selecionado: atual.filtrarTier,
            onPress: () => alterar("filtrarTier", true),
          },
        ]}
      />

      {atual.filtrarTier ? (
        <TierSelector
          value={atual.tier}
          onChange={(tier) => alterar("tier", tier)}
        />
      ) : null}

      <Input
        label="DURAÇÃO MÍNIMA"
        value={atual.duracaoMin}
        onChangeText={(texto) => alterar("duracaoMin", texto)}
        placeholder="Ex.: 01:00"
        error={erros.duracaoMin}
        keyboardType={
          Platform.OS === "ios"
            ? "numbers-and-punctuation"
            : "default"
        }
        autoCapitalize="none"
        autoCorrect={false}
        clearable
      />

      <Input
        label="DURAÇÃO MÁXIMA"
        value={atual.duracaoMax}
        onChangeText={(texto) => alterar("duracaoMax", texto)}
        placeholder="Ex.: 05:00"
        error={erros.duracaoMax}
        keyboardType={
          Platform.OS === "ios"
            ? "numbers-and-punctuation"
            : "default"
        }
        autoCapitalize="none"
        autoCorrect={false}
        clearable
      />

      <Ajuda>
        Registros sem duração ficam fora caso esse filtro esteja ativado.
      </Ajuda>

      <Grupo
        titulo="LINK DA PUBLICAÇÃO"
        opcoes={[
          ["todos", "Todos"],
          ["sim", "Com link"],
          ["nao", "Sem link"],
        ].map(([valor, texto]) => ({
          texto,
          selecionado: atual.link === valor,
          onPress: () => alterar("link", valor as Presenca),
        }))}
      />

      <Grupo
        titulo="IMAGEM PARA RELATÓRIO"
        opcoes={[
          ["todos", "Todos"],
          ["sim", "Selecionada"],
          ["nao", "Não selecionada"],
        ].map(([valor, texto]) => ({
          texto,
          selecionado: atual.imagemRelatorio === valor,
          onPress: () =>
            alterar("imagemRelatorio", valor as Presenca),
        }))}
      />

      {Object.keys(erros).length > 0 ? (
        <Text
          accessibilityRole="alert"
          style={{ color: "#DC2626", fontSize: 12 }}
        >
          Revise os campos destacados antes de aplicar.
        </Text>
      ) : null}
    </FiltroModalBase>
  );
}

function Grupo({
  titulo,
  opcoes,
}: {
  titulo?: string;
  opcoes: {
    texto: string;
    selecionado: boolean;
    onPress: () => void;
  }[];
}) {
  const { theme } = useTheme();

  return (
    <View style={{ marginBottom: 20 }}>
      {titulo ? (
        <Text
          weight="SemiBold"
          style={{ fontSize: 12, marginBottom: 9 }}
        >
          {titulo}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {opcoes.map((opcao) => (
          <TouchableOpacity
            key={opcao.texto}
            accessibilityRole="button"
            accessibilityState={{ selected: opcao.selecionado }}
            onPress={opcao.onPress}
            style={{
              minHeight: 44,
              borderWidth: 1,
              borderRadius: 11,
              paddingHorizontal: 12,
              paddingVertical: 10,
              justifyContent: "center",
              borderColor: theme.borda,
              backgroundColor: opcao.selecionado
                ? theme.backgroundContainer
                : theme.background,
            }}
          >
            <Text
              weight="Medium"
              style={{
                fontSize: 12,
                color: opcao.selecionado
                  ? theme.textoContainer
                  : theme.texto,
              }}
            >
              {opcao.texto}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Ajuda({ children }: { children: string }) {
  const { theme } = useTheme();

  return (
    <Text
      style={{
        fontSize: 11,
        lineHeight: 17,
        color: theme.textoSub,
        marginBottom: 20,
      }}
    >
      {children}
    </Text>
  );
}