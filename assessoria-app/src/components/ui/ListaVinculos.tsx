import { useCallback, useRef, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import Button from "@/components/ui/Button";
import ContadorLista from "@/components/ui/ContadorLista";
import PaginacaoLista from "@/components/ui/PaginacaoLista";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { useListaPaginada } from "@/hooks/useListaPaginada";

interface Props<T extends { id: number }> {
  chave: string;
  titulo: string;
  descricao: string;
  vazio: string;
  disabled?: boolean;
  consultar: (
    pagina: number,
    limite: number,
    signal: AbortSignal
  ) => Promise<{ itens: T[]; total: number }>;
  renderItem: (item: T) => ReactNode;
}

export default function ListaVinculos<T extends { id: number }>({
  chave,
  titulo,
  descricao,
  vazio,
  disabled = false,
  consultar,
  renderItem,
}: Props<T>) {
  const { theme } = useTheme();
  const consultaAtiva = useRef<AbortController | null>(null);

  const consultarPagina = useCallback(
    async (pagina: number, limite: number) => {
      consultaAtiva.current?.abort();
      const controller = new AbortController();
      consultaAtiva.current = controller;
      const prazo = setTimeout(() => controller.abort(), 20_000);

      try {
        return await consultar(pagina, limite, controller.signal);
      } catch (erro) {
        if (controller.signal.aborted) {
          throw new Error(
            "A consulta demorou mais que o esperado. Tente novamente."
          );
        }
        throw erro;
      } finally {
        clearTimeout(prazo);
        if (consultaAtiva.current === controller) {
          consultaAtiva.current = null;
        }
      }
    },
    [consultar]
  );

  const lista = useListaPaginada({
    chave,
    consultar: consultarPagina,
    limite: 5,
  });

  useFocusEffect(useCallback(() => () => consultaAtiva.current?.abort(), []));

  return (
    <View style={[styles.secao, { borderTopColor: theme.borda + "25" }]}>
      <View style={styles.cabecalho}>
        <View style={styles.info}>
          <Text weight="SemiBold" style={styles.titulo}>
            {titulo}
          </Text>
          <Text style={[styles.descricao, { color: theme.textoSub }]}>
            {descricao}
          </Text>
        </View>
        {!lista.erro && (!lista.carregando || lista.itens.length > 0) ? (
          <ContadorLista>{lista.total}</ContadorLista>
        ) : null}
      </View>

      {lista.erro ? (
        <View style={[styles.mensagem, { borderColor: theme.borda + "35" }]}>
          <Text style={[styles.textoMensagem, { color: theme.erro }]}>
            {lista.erro}
          </Text>
          <Button
            title="TENTAR NOVAMENTE"
            size="small"
            variant="outline"
            disabled={disabled || lista.carregando}
            onPress={() => void lista.carregarPagina()}
          />
        </View>
      ) : lista.carregando && lista.itens.length === 0 ? (
        <ActivityIndicator
          color={theme.textoTerciaria}
          style={styles.carregamento}
        />
      ) : lista.total === 0 ? (
        <View style={[styles.mensagem, { borderColor: theme.borda + "35" }]}>
          <Text style={[styles.textoMensagem, { color: theme.textoSub }]}>
            {vazio}
          </Text>
        </View>
      ) : (
        <>
          <View pointerEvents={disabled || lista.carregando ? "none" : "auto"}>
            {lista.itens.map((item) => (
              <View key={item.id}>{renderItem(item)}</View>
            ))}
          </View>
          <PaginacaoLista
            pagina={lista.pagina}
            limite={lista.limite}
            total={lista.total}
            disabled={disabled || lista.carregando}
            onChange={(pagina) => void lista.carregarPagina(pagina)}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  titulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  mensagem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  textoMensagem: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  carregamento: {
    marginVertical: 24,
  },
});
