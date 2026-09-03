import React from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Search, SlidersHorizontal } from "lucide-react-native";

import Input from "@/components/ui/Input";
import { useTheme } from "@/contexts/ThemeContext";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearch?: () => void;
  onFilterPress?: () => void;
  filterActive?: boolean;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChangeText,
  onSearch,
  onFilterPress,
  filterActive = false,
  placeholder = "Pesquisar...",
}: SearchBarProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          containerStyle={styles.inputContainer}
          style={styles.input}
        />

        <TouchableOpacity
          onPress={onSearch}
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.backgroundContainer,
            },
          ]}
          activeOpacity={0.8}
        >
          <Search
            size={20}
            color={theme.textoContainer}
          />
        </TouchableOpacity>
      </View>

      {onFilterPress && (
        <TouchableOpacity
          onPress={onFilterPress}
          style={[
            styles.filterButton,
            {
              borderColor: filterActive
                ? theme.primaria
                : theme.borda,
              backgroundColor: filterActive
                ? theme.backgroundContainer
                : theme.background,
            },
          ]}
          activeOpacity={0.8}
        >
          <SlidersHorizontal
            size={20}
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
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  searchContainer: {
    flex: 1,
    position: "relative",
  },

  inputContainer: {
    marginBottom: 0,
  },

  input: {
    paddingRight: 50,
  },

  iconButton: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});