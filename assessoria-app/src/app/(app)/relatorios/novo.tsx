import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import ClippingDataInput from "@/components/clipping/ClippingDataInput";
import ClippingContexto from "@/components/clipping/ClippingContexto";

import { useTheme } from "@/contexts/ThemeContext";

import {
  criarRelatorio,
  listarMateriasRelatorio,
  type MateriaRelatorio,
  type PaginacaoRelatorio,
} from "@/services/api/relatorio";
import {
  dataBRParaISO,
  dataISOParaBR,
} from "@/utils/clippingFormatacao";

type TipoLista = "periodo" | "sem_data";

export default function NovoRelatorio() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    clienteId?: string;
    clienteNome?: string;
  }>();

  const clienteInicialId = Number(params.clienteId);

  const [cliente, setCliente] = useState<{
    id: number;
    nome: string;
  } | null>(
    Number.isSafeInteger(clienteInicialId) && clienteInicialId > 0
      ? {
          id: clienteInicialId,
          nome: params.clienteNome ?? `Cliente #${clienteInicialId}`,
        }
      : null
  );

  const [titulo, setTitulo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [inclusaoAutomatica, setInclusaoAutomatica] = useState(true);

  const [periodo, setPeriodo] = useState<{
    inicio: string;
    fim: string;
  } | null>(null);

  const [tipo, setTipo] = useState<TipoLista>("periodo");
  const [page, setPage] = useState(1);
  const [buscaMateria, setBuscaMateria] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [materias, setMaterias] = useState<MateriaRelatorio[]>([]);
  const [resumo, setResumo] = useState({
    no_periodo: 0,
    sem_data: 0,
  });
  const [pagination, setPagination] =
    useState<PaginacaoRelatorio | null>(null);

  const [excluidos, setExcluidos] = useState<Set<number>>(
    () => new Set()
  );
  const [semDataIncluidos, setSemDataIncluidos] =
    useState<Set<number>>(() => new Set());

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const anoCalendario = new Date().getFullYear();

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setBuscaAplicada(buscaMateria.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [buscaMateria]);

  useEffect(() => {
    if (!periodo || !cliente) return;

    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        const resposta = await listarMateriasRelatorio({
          cliente_id: cliente!.id,
          periodo_inicio: periodo!.inicio,
          periodo_fim: periodo!.fim,
          tipo,
          page,
          limit: 20,
          busca: buscaAplicada,
        });

        if (!ativo) return;

        setMaterias(resposta.materias);
        setResumo(resposta.resumo);
        setPagination(resposta.pagination);
      } catch (e) {
        if (ativo) {
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar as matérias."
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
  }, [periodo, cliente, tipo, page, buscaAplicada]);

  const totalSelecionado = useMemo(
    () =>
      Math.max(0, resumo.no_periodo - excluidos.size) +
      semDataIncluidos.size,
    [resumo.no_periodo, excluidos, semDataIncluidos]
  );

  function verMaterias() {
    const inicio = dataBRParaISO(dataInicio);
    const fim = dataBRParaISO(dataFim);

    if (!cliente) {
      setErro("Escolha um cliente.");
      return;
    }

    if (!titulo.trim()) {
      setErro("Informe o título do relatório.");
      return;
    }

    if (!inicio || !fim) {
      setErro("Informe as duas datas do período.");
      return;
    }

    if (inicio > fim) {
      setErro("A data inicial não pode ser posterior à final.");
      return;
    }

    setErro("");
    setTipo("periodo");
    setPage(1);
    setBuscaMateria("");
    setBuscaAplicada("");
    setExcluidos(new Set());
    setSemDataIncluidos(new Set());
    setPeriodo({ inicio, fim });
  }

  function alternarMateria(id: number) {
    if (tipo === "periodo") {
      setExcluidos((atual) => {
        const proximo = new Set(atual);

        if (proximo.has(id)) proximo.delete(id);
        else proximo.add(id);

        return proximo;
      });

      return;
    }

    setSemDataIncluidos((atual) => {
      const proximo = new Set(atual);

      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);

      return proximo;
    });
  }

  async function salvar() {
    if (!cliente || !periodo || salvando || carregando) return;

    setSalvando(true);
    setErro("");

    try {
      const resposta = await criarRelatorio({
        cliente_id: cliente.id,
        titulo: titulo.trim(),
        periodo_inicio: periodo.inicio,
        periodo_fim: periodo.fim,
        inclusao_automatica: inclusaoAutomatica,
        ids_excluidos: [...excluidos],
        ids_sem_data_incluidos: [...semDataIncluidos],
      });

      router.replace({
        pathname: "/relatorios/[id]",
        params: { id: String(resposta.relatorio.id) },
      });
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível criar o relatório."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header
        title={periodo ? "Escolher matérias" : "Novo relatório"}
        showBackButton
        onBackPress={() => {
          if (periodo) {
            setPeriodo(null);
            setErro("");
          } else {
            router.back();
          }
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingBottom: 24,
          gap: 14,
        }}
      >
        {!periodo ? (
          <>
            <Text weight="Bold" style={{ fontSize: 18 }}>
              Dados do relatório
            </Text>

            <ClippingContexto
                apenasCliente
                clienteId={cliente?.id ?? null}
                clienteNome={cliente?.nome ?? ""}
                ano={anoCalendario}
                anoPelaData={false}
                erroCliente={
                    erro === "Escolha um cliente." ? erro : undefined
                }
                onCliente={(selecionado) => {
                    setCliente({
                    id: selecionado.id,
                    nome: selecionado.nome,
                    });
                    setErro("");
                }}
                />

            <Input
              label="TÍTULO"
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ex.: Relatório de março"
              maxLength={200}
              clearable
            />

            <ClippingDataInput
              label="INÍCIO DO PERÍODO"
              value={dataInicio}
              anoReferencia={anoCalendario}
              onChangeText={setDataInicio}
            />

            <ClippingDataInput
              label="FIM DO PERÍODO"
              value={dataFim}
              anoReferencia={anoCalendario}
              onChangeText={setDataFim}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: theme.borda,
                borderRadius: 12,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text weight="SemiBold">
                  Incluir novas matérias automaticamente
                </Text>
                <Text style={{ color: theme.textoSub }}>
                  Clippings futuros deste cliente, dentro do período,
                  entrarão como slides para revisão.
                </Text>
              </View>

              <Switch
                value={inclusaoAutomatica}
                onValueChange={setInclusaoAutomatica}
                trackColor={{
                  true: theme.borda,
                  false: theme.textoSub,
                }}
              />
            </View>

            <Button
              title="VER MATÉRIAS DO PERÍODO"
              onPress={verMaterias}
            />
          </>
        ) : (
          <>
            <View>
              <Text weight="Bold">{titulo.trim()}</Text>
              <Text style={{ color: theme.textoSub }}>
                {cliente?.nome} · {dataISOParaBR(periodo.inicio)} a{" "}
                {dataISOParaBR(periodo.fim)}
              </Text>
            </View>

            <Text style={{ color: theme.textoSub }}>
              As matérias com data começam selecionadas. As sem data
              precisam ser escolhidas manualmente. Sua seleção permanece
              ao trocar de página.
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title={`NO PERÍODO · ${resumo.no_periodo}`}
                variant={tipo === "periodo" ? "primary" : "outline"}
                size="small"
                onPress={() => {
                  setTipo("periodo");
                  setPage(1);
                }}
                style={{ flex: 1 }}
              />

              <Button
                title={`SEM DATA · ${resumo.sem_data}`}
                variant={tipo === "sem_data" ? "primary" : "outline"}
                size="small"
                onPress={() => {
                  setTipo("sem_data");
                  setPage(1);
                }}
                style={{ flex: 1 }}
              />
            </View>

            <Input
              label="BUSCAR NAS MATÉRIAS"
              value={buscaMateria}
              onChangeText={setBuscaMateria}
              placeholder="Pauta ou veículo"
              clearable
            />

            {carregando ? (
              <ActivityIndicator color={theme.textoTerciaria} />
            ) : null}

            {!carregando && materias.length === 0 ? (
              <Text style={{ color: theme.textoSub }}>
                Nenhuma matéria nesta consulta.
              </Text>
            ) : null}

            {materias.map((materia) => {
              const selecionada =
                tipo === "periodo"
                  ? !excluidos.has(materia.id)
                  : semDataIncluidos.has(materia.id);

              return (
                <Pressable
                  key={materia.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selecionada }}
                  onPress={() => alternarMateria(materia.id)}
                  style={{
                    padding: 13,
                    borderWidth: selecionada ? 2 : 1,
                    borderColor: selecionada
                      ? theme.borda
                      : theme.textoSub,
                    borderRadius: 12,
                    backgroundColor: selecionada
                      ? `${theme.borda}18`
                      : theme.background,
                    gap: 5,
                  }}
                >
                  <Text weight="SemiBold">
                    {selecionada ? "☑" : "☐"}{" "}
                    {materia.pauta || "Sem pauta"}
                  </Text>

                  <Text style={{ color: theme.textoSub }}>
                    {materia.data_publicacao
                      ? dataISOParaBR(materia.data_publicacao)
                      : `Sem data · ano de referência ${materia.ano_referencia}`}
                    {" · "}
                    {materia.veiculo_nome || "Sem veículo"}
                  </Text>

                  {materia.imagem_anexo_id === null ? (
                    <Text style={{ color: theme.aviso }}>
                      Sem imagem selecionada para o slide
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

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
                disabled={!pagination?.has_next || carregando}
                onPress={() => setPage((atual) => atual + 1)}
                style={{ flex: 1 }}
              />
            </View>

            <Text style={{ color: theme.textoSub }}>
              Página {page} · {pagination?.total ?? 0} resultado(s)
              nesta aba
            </Text>
          </>
        )}

        {erro ? (
          <Text style={{ color: theme.erro }}>{erro}</Text>
        ) : null}
      </ScrollView>

      {periodo ? (
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: theme.borda,
            backgroundColor: theme.background,
            gap: 8,
          }}
        >
          <Text style={{ textAlign: "center" }}>
            {totalSelecionado} matéria(s) selecionada(s)
          </Text>

          <Button
            title="CRIAR RELATÓRIO"
            loading={salvando}
            disabled={carregando}
            onPress={salvar}
          />
        </View>
      ) : null}
    </View>
  );
}