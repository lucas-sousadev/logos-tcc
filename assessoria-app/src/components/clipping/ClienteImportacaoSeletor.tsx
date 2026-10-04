import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  TouchableOpacity,
  View,
} from "react-native";

import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";
import { useTheme } from "@/contexts/ThemeContext";
import { listarClientes, type Cliente } from "@/services/api/cliente";

type Props = {
  nomeNoCsv: string;
  disabled?: boolean;
  onSelect: (cliente: { id: number; nome: string }) => void;
};

export default function ClienteImportacaoSelector({
  nomeNoCsv,
  disabled = false,
  onSelect,
}: Props) {
  const { theme, mode } = useTheme();
  const [busca, setBusca] = useState(nomeNoCsv);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const termo = busca.trim();
    setClientes([]);

    if (termo.length < 2) {
      setCarregando(false);
      setErro("");
      return;
    }

    setCarregando(true);
    let cancelado = false;
    const temporizador = setTimeout(async () => {
      setCarregando(true);
      setErro("");

      try {
        const resposta = await listarClientes({ busca: termo, limit: 20 });

        if (!cancelado) {
          setClientes(resposta.clientes);
        }
      } catch {
        if (!cancelado) {
          setErro("Não foi possível procurar clientes.");
          setClientes([]);
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [busca]);

  return (
    <View style={{ marginTop: 12 }}>
      <Input
        label="PROCURAR CLIENTE CADASTRADO"
        value={busca}
        onChangeText={setBusca}
        editable={!disabled}
        placeholder="Digite ao menos duas letras"
      />

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 12 }} color={theme.texto} />
      ) : null}

      {erro ? (
        <Text style={{ color: mode === "dark" ? "#F0A5B2" : "#A42E4B" }}>
          {erro}
        </Text>
      ) : null}

      {!carregando && busca.trim().length >= 2 && clientes.length === 0 && !erro ? (
        <Text style={{ color: theme.textoSub, marginTop: 10 }}>
          Nenhum cliente encontrado. Tente outro nome.
        </Text>
      ) : null}

      {clientes.map((cliente) => (
        <TouchableOpacity
          key={cliente.id}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelect({ id: cliente.id, nome: cliente.nome })}
          style={{
            borderWidth: 1,
            borderColor: theme.borda,
            borderRadius: 10,
            padding: 12,
            marginTop: 8,
          }}
        >
          <Text weight="SemiBold">{cliente.nome}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}