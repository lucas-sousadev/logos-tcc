import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import {
  buscarRelatorio,
  type RelatorioDetalhado,
  type SlideRelatorio,
} from "@/services/api/relatorio";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

export default function DetalheRelatorio() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const [page, setPage] = useState(1);
  const [relatorio, setRelatorio] =
    useState<RelatorioDetalhado | null>(null);
  const [slides, setSlides] = useState<SlideRelatorio[]>([]);
  const [temProxima, setTemProxima] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!Number.isSafeInteger(id) || id < 1) {
        setErro("Relatório inválido.");
        return;
      }

      let ativo = true;

      async function carregar() {
        setCarregando(true);
        setErro("");

        try {
          const resposta = await buscarRelatorio(id, page);

          if (!ativo) return;

          setRelatorio(resposta.relatorio);
          setSlides(resposta.slides);
          setTemProxima(resposta.pagination.has_next);
        } catch (e) {
          if (ativo) {
            setErro(
              e instanceof Error
                ? e.message
                : "Não foi possível abrir o relatório."
            );
          }
        } finally {
          if (ativo) setCarregando(false);
        }
      }

      carregar();

      return () => {
        ativo = false;
      };
    }, [id, page])
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Relatório" showBackButton />

      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingBottom: 24,
          gap: 12,
        }}
      >
        {relatorio ? (
          <View style={{ gap: 5 }}>
            <Text weight="Bold" style={{ fontSize: 18 }}>
              {relatorio.titulo}
            </Text>

            <Text style={{ color: theme.textoSub }}>
              {relatorio.cliente_nome} ·{" "}
              {dataISOParaBR(relatorio.periodo_inicio)} a{" "}
              {dataISOParaBR(relatorio.periodo_fim)}
            </Text>

            <Text style={{ color: theme.textoSub }}>
              {relatorio.total_materias} matéria(s) · Inclusão automática{" "}
              {relatorio.inclusao_automatica ? "ativa" : "pausada"}
            </Text>

            {relatorio.novos_pendentes > 0 ? (
              <Text
                weight="SemiBold"
                style={{ color: theme.aviso }}
              >
                {relatorio.novos_pendentes} slide(s) novo(s) para revisar
              </Text>
            ) : null}
          </View>
        ) : null}

        {carregando ? (
          <ActivityIndicator color={theme.textoTerciaria} />
        ) : null}

        {erro ? (
          <Text style={{ color: theme.erro }}>{erro}</Text>
        ) : null}

        {slides.map((slide) => (
          <View
            key={slide.id}
            style={{
              borderWidth: 1,
              borderColor: theme.borda,
              borderRadius: 12,
              padding: 13,
              gap: 5,
            }}
          >
            <Text weight="Bold">
              {slide.ordem}.{" "}
              {slide.tipo === "CLIPPING"
                ? slide.dados_json?.clipping?.pauta ||
                  "Matéria sem pauta"
                : slide.titulo || slide.tipo}
            </Text>

            {slide.tipo === "CLIPPING" ? (
              <>
                <Text style={{ color: theme.textoSub }}>
                  {slide.dados_json?.veiculo?.nome ||
                    "Sem veículo"}
                  {" · "}
                  {dataISOParaBR(
                    slide.dados_json?.clipping
                      ?.data_publicacao ?? null
                  ) || "Sem data"}
                </Text>

                <Text style={{ color: theme.textoSub }}>
                  {slide.imagem_anexo_id
                    ? "Imagem selecionada"
                    : "Sem imagem selecionada"}
                </Text>
              </>
            ) : null}

            {slide.revisao_pendente ? (
              <Text
                weight="SemiBold"
                style={{ color: theme.aviso }}
              >
                NOVO · revisar este slide
              </Text>
            ) : null}
          </View>
        ))}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            title="ANTERIOR"
            variant="outline"
            size="small"
            disabled={page === 1 || carregando}
            onPress={() => setPage((atual) => atual - 1)}
            style={{ flex: 1 }}
          />
          <Button
            title="PRÓXIMA"
            variant="outline"
            size="small"
            disabled={!temProxima || carregando}
            onPress={() => setPage((atual) => atual + 1)}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}