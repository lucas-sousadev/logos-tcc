import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/layout/Header";
import AvatarUsuario from "@/components/perfil/AvatarUsuario";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import {
  InformacoesCadastro,
  ResumoCadastro,
} from "@/components/ui/DetalhesCadastro";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { buscarFuncionario, type Funcionario } from "@/services/api/auth";

export default function FuncionarioDetalhes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuth();
  return (
    <Detalhes
      key={[usuario?.assessoria_id, usuario?.id, id].join(":")}
      id={Number(id)}
    />
  );
}

function Detalhes({ id }: { id: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { temPermissao, carregando: carregandoAuth } = useAuth();
  const podeVisualizar = temPermissao("USUARIOS", "VISUALIZAR");
  const podeGerenciar = temPermissao("USUARIOS", "GERENCIAR_PERMISSOES");
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [consultando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [consultaConcluida, setConsultaConcluida] = useState(-1);
  const carregando = consultando || consultaConcluida !== tentativa;

  useFocusEffect(
    useCallback(() => {
      if (carregandoAuth || !podeVisualizar) return;
      const controller = new AbortController();
      let ativo = true;
      const timer = setTimeout(() => controller.abort(), 15000);

      async function carregar() {
        setCarregando(true);
        setFuncionario(null);
        setErro("");
        try {
          if (!Number.isSafeInteger(id) || id <= 0) {
            throw new Error("Funcionário não encontrado.");
          }
          const dados = await buscarFuncionario(id, controller.signal);
          if (ativo) setFuncionario(dados);
        } catch (error) {
          if (ativo) {
            setErro(
              controller.signal.aborted
                ? "A consulta demorou mais que o esperado. Tente novamente."
                : error instanceof Error
                  ? error.message
                  : "Não foi possível carregar o funcionário."
            );
          }
        } finally {
          clearTimeout(timer);
          if (ativo) {
            setCarregando(false);
            setConsultaConcluida(tentativa);
          }
        }
      }

      void carregar();
      return () => {
        ativo = false;
        clearTimeout(timer);
        controller.abort();
      };
    }, [carregandoAuth, podeVisualizar, id, tentativa])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Funcionário" showBackButton />
      {carregandoAuth || (podeVisualizar && carregando) ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primaria} />
        </View>
      ) : !podeVisualizar ? (
        <View style={styles.center}>
          <Text weight="Bold">Acesso restrito</Text>
          <Text style={[styles.mensagem, { color: theme.textoSub }]}>
            Você não tem permissão para visualizar funcionários.
          </Text>
        </View>
      ) : !funcionario ? (
        <View style={styles.center}>
          <Text style={[styles.mensagem, { color: theme.textoSub }]}>
            {erro}
          </Text>
          <Button
            title="TENTAR NOVAMENTE"
            variant="outline"
            onPress={() => setTentativa((atual) => atual + 1)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: 24 + insets.bottom,
              paddingLeft: 16 + insets.left,
              paddingRight: 16 + insets.right,
            },
          ]}
        >
          <ResumoCadastro
            nome={funcionario.nome}
            categoria="FUNCIONÁRIO"
            ativo={Number(funcionario.ativo) === 1}
            avatar={<AvatarUsuario usuario={funcionario} tamanho={48} />}
          />
          <InformacoesCadastro
            grupos={[
              {
                id: "contato",
                titulo: "Contato",
                campos: [
                  {
                    id: "email",
                    icone: "mail-outline",
                    rotulo: "E-mail",
                    valor: funcionario.email,
                  },
                  {
                    id: "telefone",
                    icone: "call-outline",
                    rotulo: "Telefone",
                    valor: funcionario.telefone || "Não informado",
                  },
                ],
              },
              {
                id: "profissional",
                titulo: "Perfil profissional",
                campos: [
                  {
                    id: "cargo",
                    icone: "briefcase-outline",
                    rotulo: "Cargo / função",
                    valor: funcionario.cargo || "Não informado",
                  },
                  {
                    id: "localizacao",
                    icone: "location-outline",
                    rotulo: "Localização",
                    valor:
                      [funcionario.cidade, funcionario.uf]
                        .filter(Boolean)
                        .join(" · ") || "Não informada",
                  },
                ],
              },
              {
                id: "conta",
                titulo: "Conta",
                campos: [
                  {
                    id: "perfil",
                    icone: "person-outline",
                    rotulo: "Tipo de acesso",
                    valor: "Funcionário",
                  },
                  {
                    id: "verificacao",
                    icone: "shield-checkmark-outline",
                    rotulo: "E-mail",
                    valor:
                      Number(funcionario.email_verificado) === 1
                        ? "Verificado"
                        : "Verificação pendente",
                  },
                  {
                    id: "cadastro",
                    icone: "calendar-outline",
                    rotulo: "Cadastro",
                    valor: formatarData(funcionario.created_at),
                  },
                  {
                    id: "login",
                    icone: "time-outline",
                    rotulo: "Último acesso",
                    valor: formatarData(funcionario.ultimo_login),
                  },
                ],
              },
            ]}
          />
          {podeGerenciar && (
            <Button
              title="GERENCIAR PERMISSÕES"
              icon="shield-checkmark-outline"
              onPress={() =>
                router.push({
                  pathname: "/funcionarios/[id]/permissoes",
                  params: { id: String(funcionario.id) },
                })
              }
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function formatarData(valor: string | null) {
  if (!valor) return "Não informado";
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return partes ? [partes[3], partes[2], partes[1]].join("/") : "Não informado";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingTop: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  mensagem: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
  },
});