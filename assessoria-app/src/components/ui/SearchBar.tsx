import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/contexts/ThemeContext";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  filterActive?: boolean;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = "Pesquisar...",
  onFilterPress,
  filterActive = false,
}: SearchBarProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.search,
          {
            backgroundColor: theme.surface,
            borderColor: theme.borda,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={21}
          color={theme.textoSub}
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textoSub}
          autoCapitalize="none"
          style={[
            styles.input,
            {
              color: theme.textoInput,
            },
          ]}
        />

        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText("")}
          >
            <Ionicons
              name="close-circle"
              size={19}
              color={theme.textoSub}
            />
          </TouchableOpacity>
        )}
      </View>

      {onFilterPress && (
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor:
                filterActive
                  ? theme.backgroundContainer
                  : theme.background,
              borderColor: theme.borda,
            },
          ]}
          onPress={onFilterPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={
              filterActive
                ? theme.textoContainer
                : theme.texto
            }
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },

  search: {
    flex: 1,
    height: 50,

    borderWidth: 1.5,
    borderRadius: 14,

    paddingHorizontal: 14,

    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,

    fontSize: 14,
    marginLeft: 9,
    paddingVertical: 0,
  },

  filterButton: {
    width: 50,
    height: 50,

    borderRadius: 14,
    borderWidth: 1.5,

    justifyContent: "center",
    alignItems: "center",
  },
});