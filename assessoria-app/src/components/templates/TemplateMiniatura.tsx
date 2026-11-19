import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";

import ReleaseBlocosPrevia from "@/components/releases/ReleaseBlocosPrevia";
import type { BlocoTemplateRelease } from "@/services/api/release";

const LARGURA_PAGINA = 560;
const ALTURA_MINIATURA = 180;
const MARGEM = 10;

interface Props {
  blocos: BlocoTemplateRelease[];
}

function TemplateMiniatura({ blocos }: Props) {
  const [largura, setLargura] = useState(0);
  const [alturaPagina, setAlturaPagina] = useState(0);

  const pronto =
    largura > MARGEM * 2 &&
    alturaPagina > 0;

  const escala = pronto
    ? Math.min(
        (largura - MARGEM * 2) / LARGURA_PAGINA,
        (ALTURA_MINIATURA - MARGEM * 2) / alturaPagina,
        1
      )
    : 1;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.quadro}
      onLayout={({ nativeEvent }) => {
        setLargura(nativeEvent.layout.width);
      }}
    >
      <View
        collapsable={false}
        onLayout={({ nativeEvent }) => {
          setAlturaPagina(nativeEvent.layout.height);
        }}
        style={[
          styles.pagina,
          {
            opacity: pronto ? 1 : 0,
            left: pronto
              ? (largura - LARGURA_PAGINA * escala) / 2
              : 0,
            top: pronto
              ? (
                  ALTURA_MINIATURA -
                  alturaPagina * escala
                ) / 2
              : 0,
            transform: [{ scale: escala }],
          },
        ]}
      >
        <ReleaseBlocosPrevia blocos={blocos} />
      </View>
    </View>
  );
}

export default memo(TemplateMiniatura);

const styles = StyleSheet.create({
  quadro: {
    width: "100%",
    height: ALTURA_MINIATURA,
    overflow: "hidden",
  },
  pagina: {
    position: "absolute",
    width: LARGURA_PAGINA,
    transformOrigin: "top left",
  },
});