import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  BlocoTemplateRelease,
  DadosEnvioRelease,
  DestinatarioRelease,
} from "@/services/api/release";

import ReleaseBlocosPrevia from "./ReleaseBlocosPrevia";
import ReleaseDestinatariosCampo from "./ReleaseDestinatariosCampo";
import type { EtapaRelease } from "./ReleaseEtapas";

interface Props {
  titulo: string;
  clienteNome: string | null;
  templateNome: string;
  dadosEnvio: DadosEnvioRelease;
  blocos: BlocoTemplateRelease[];
  selecionados: readonly DestinatarioRelease[];
  disabled?: boolean;
  podeSelecionarDestinatarios: boolean;
  onEditar: (etapa: EtapaRelease) => void;
  onVerDestinatarios: () => void;
}

function Secao({
  titulo,
  acao,
  disabled,
  onEditar,
  children,
}: {
  titulo: string;
  acao: string;
  disabled: boolean;
  onEditar: () => void;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.secao}>
      <View style={styles.cabecalho}>
        <Text accessibilityRole="header" weight="Bold" style={styles.titulo}>
          {titulo}
        </Text>
        <Button
          title={acao}
          icon="create-outline"
          size="small"
          variant="outline"
          style={[styles.editar, { borderColor: theme.borda + "55" }]}
          disabled={disabled}
          onPress={onEditar}
        />
      </View>
      {children}
    </View>
  );
}

function CampoResumo({
  rotulo,
  valor,
  vazio = "A definir",
}: {
  rotulo: string;
  valor: string | null;
  vazio?: string;
}) {
  const { theme } = useTheme();
  const texto = valor?.trim();

  return (
    <View style={styles.campo}>
      <Text style={[styles.rotulo, { color: theme.textoSub }]}>{rotulo}</Text>
      <Text
        weight={texto ? "SemiBold" : "Regular"}
        style={[styles.valor, { color: texto ? theme.texto : theme.textoSub }]}
      >
        {texto || vazio}
      </Text>
    </View>
  );
}

export default function ReleaseRevisaoEtapa({
  titulo,
  clienteNome,
  templateNome,
  dadosEnvio,
  blocos,
  selecionados,
  disabled = false,
  podeSelecionarDestinatarios,
  onEditar,
  onVerDestinatarios,
}: Props) {
  const { theme } = useTheme();
  const painel = [
    styles.painel,
    { borderColor: theme.borda + "55", backgroundColor: theme.backgroundSecundario },
  ];

  return (
    <View style={styles.container}>
      <Secao
        titulo="Prévia do release"
        acao="EDITAR CONTEÚDO"
        disabled={disabled}
        onEditar={() => onEditar("CONTEUDO")}
      >
        <Text style={[styles.rotulo, { color: theme.textoSub }]}>
          {templateNome}
        </Text>
        <ReleaseBlocosPrevia blocos={blocos} />
      </Secao>

      <Secao
        titulo="Dados do e-mail"
        acao="EDITAR E-MAIL"
        disabled={disabled}
        onEditar={() => onEditar("ENVIO")}
      >
        <View style={painel}>
          <CampoResumo rotulo="Assunto" valor={dadosEnvio.assunto} />
          <CampoResumo
            rotulo="Primeira linha"
            valor={dadosEnvio.primeira_linha}
            vazio="Sem primeira linha"
          />
          <CampoResumo rotulo="Nome do remetente" valor={dadosEnvio.nome_remetente} />
          <CampoResumo rotulo="Endereço remetente" valor="Padrão do LOGOS" />
          <CampoResumo rotulo="Responder para" valor={dadosEnvio.responder_para} />
        </View>
      </Secao>

      <Secao
        titulo="Destino"
        acao="EDITAR DESTINO"
        disabled={disabled}
        onEditar={() => onEditar("DESTINO")}
      >
        <View style={painel}>
          <CampoResumo rotulo="Título interno" valor={titulo} />
          <CampoResumo rotulo="Cliente" valor={clienteNome} />
        </View>

        <ReleaseDestinatariosCampo
          selecionados={selecionados}
          disabled={disabled || !podeSelecionarDestinatarios}
          onPress={onVerDestinatarios}
        />
      </Secao>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    gap: 18,
  },
  secao: {
    gap: 8,
  },
  cabecalho: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  titulo: {
    fontSize: 15,
  },
  editar: {
    width: "auto",
    maxWidth: "100%",
  },
  painel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  campo: {
    gap: 2,
  },
  rotulo: {
    fontSize: 12,
  },
  valor: {
    fontSize: 13,
    lineHeight: 19,
  },
});
