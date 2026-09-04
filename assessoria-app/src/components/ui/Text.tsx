import {
  Text as RNText,
  TextProps as RNTextProps,
} from "react-native";

import { Fonts } from "@/constants/fonts";
import { useTheme } from "@/contexts/ThemeContext";

interface TextProps extends RNTextProps {
  weight?: "Regular" | "Medium" | "SemiBold" | "Bold" | "ExtraBold";
}

export default function Text({
  weight = "Regular",
  style,
  ...props
}: TextProps) {
  const fontFamily = {
    "Regular": Fonts.MontserratRegular,
    "Medium": Fonts.MontserratMedium,
    "SemiBold": Fonts.MontserratSemiBold,
    "Bold": Fonts.MontserratBold,
    "ExtraBold": Fonts.MontserratExtraBold,
  }[weight];
  
  const { theme } = useTheme();
  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily,
          color: theme.texto
        },
        style,
      ]}
    />
  );
}