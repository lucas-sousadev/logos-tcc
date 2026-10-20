import { useEffect, useState } from "react";
import { Image, useWindowDimensions, View } from "react-native";

import ClippingImagemPreview from "@/components/clipping/ClippingImagePreview";
import Text from "@/components/ui/Text";
import type { SlideRelatorio } from "@/services/api/relatorio";
import { obterUrlLogoVeiculo } from "@/services/api/veiculo";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

interface Props {
  slide: SlideRelatorio;
  imagemUri?: string | null;
  logoUri?: string | null;
}

const LARGURA_SLIDE = 960;
const ALTURA_SLIDE = 540;

export default function RelatorioSlideVisual({ slide, imagemUri, logoUri }: Props) {
  const { width: larguraJanela } = useWindowDimensions();
  const [alturaEsquerda, setAlturaEsquerda] = useState(0);
  const [alturaDireita, setAlturaDireita] = useState(0);
  const [alturaDados, setAlturaDados] = useState(0);
  const [alturaLink, setAlturaLink] = useState(0);

  const larguraVisivel = Math.min(
    LARGURA_SLIDE,
    Math.max(280, larguraJanela - 32)
  );
  const escala = larguraVisivel / LARGURA_SLIDE;

  const clipping = slide.dados_json?.clipping;
  const veiculo = slide.dados_json?.veiculo;
  
  const endpointLogo = slide.logo_midia_id
    ? `/relatorios/${slide.relatorio_id}/midias/${slide.logo_midia_id}`
    : null;

  const logoVeiculo = endpointLogo
    ? null
    : obterUrlLogoVeiculo(veiculo?.logo_path);
  const [tamanhoLogo, setTamanhoLogo] = useState({
    width: 90,
    height: 90,
  });

  useEffect(() => {
    if (!logoVeiculo) return;

    let ativo = true;

    Image.getSize(
      logoVeiculo,
      (largura, altura) => {
        if (!ativo || largura <= 0 || altura <= 0) return;

        const escala = Math.min(300 / largura, 90 / altura, 1);
        setTamanhoLogo({
          width: Math.round(largura * escala),
          height: Math.round(altura * escala),
        });
      },
      () => {
        if (ativo) setTamanhoLogo({ width: 90, height: 90 });
      }
    );

    return () => {
      ativo = false;
    };
  }, [logoVeiculo]);
  const nomeVeiculo = veiculo?.nome?.trim() || "Veículo não informado";
  const descricao = veiculo?.descricao?.trim();
  const alcance = veiculo?.alcance?.trim();
  const data = dataISOParaBR(clipping?.data_publicacao ?? null);
  const link = slide.link?.trim();
  const endpointImagem = slide.imagem_midia_id
    ? `/relatorios/${slide.relatorio_id}/midias/${slide.imagem_midia_id}`
    : slide.clipping_id && slide.imagem_anexo_id
      ? `/clippings/${slide.clipping_id}/anexos/${slide.imagem_anexo_id}/arquivo`
      : null;

  const limiteDados = data ? 310 : 355;
  const excedeuSlide =
    alturaDados > limiteDados + 2 ||
    alturaLink > 60 + 2;

  return (
    <View style={{ alignItems: "center", gap: 7 }}>
      <View
        style={{
          width: larguraVisivel,
          height: ALTURA_SLIDE * escala,
          overflow: "hidden",
          backgroundColor: "#FFFFFF",
          borderColor: "#D7DEEA",
          borderWidth: 1,
          marginBottom: 3
        }}
      >
        <View
          style={{
            width: LARGURA_SLIDE,
            height: ALTURA_SLIDE,
            backgroundColor: "#FFFFFF",
            transform: [{ scale: escala }],
            transformOrigin: "top left",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 42,
              top: 40,
              width: 300,
              height: 90,
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                resizeMode="contain"
                style={{ width: 300, height: 90 }}
              />
            ) : endpointLogo ? (
              <ClippingImagemPreview
                endpoint={endpointLogo}
                nome={`Logo do veículo do slide ${slide.ordem}`}
                resizeMode="contain"
                onDimensions={(largura, altura) => {
                  const escala = Math.min(300 / largura, 90 / altura, 1);
                  const width = Math.max(1, Math.round(largura * escala));
                  const height = Math.max(1, Math.round(altura * escala));

                  setTamanhoLogo((atual) =>
                    atual.width === width && atual.height === height
                      ? atual
                      : { width, height }
                  );
                }}
                style={{
                  width: tamanhoLogo.width,
                  height: tamanhoLogo.height,
                  borderRadius: 0,
                  backgroundColor: "transparent",
                }}
              />
            ) : logoVeiculo ? (
              <Image
                source={{ uri: logoVeiculo }}
                resizeMode="contain"
                style={{
                  width: tamanhoLogo.width,
                  height: tamanhoLogo.height,
                }}
              />
            ) : null}
          </View>

          <View
            style={{
              position: "absolute",
              left: 42,
              top: 145,
              width: 350,
              height: limiteDados,
              justifyContent: "flex-end",
            }}
          >
            <View
              onLayout={({ nativeEvent }) => {
                const altura = nativeEvent.layout.height;
                setAlturaDados((atual) =>
                  Math.abs(atual - altura) > 1 ? altura : atual
                );
              }}
              style={{ gap: 8 }}
            >
              <Text
                style={{
                  color: "#172033",
                  fontSize: 16,
                  lineHeight: 22,
                }}
              >
                <Text
                  weight="ExtraBold"
                  style={{ color: "#172033", fontSize: 18 }}
                >
                  Veículo:{" "}
                </Text>
                {nomeVeiculo}
              </Text>

              {descricao ? (
                <Text
                  style={{
                    color: "#172033",
                    fontSize: 16,
                    lineHeight: 22,
                  }}
                >
                  <Text
                    weight="ExtraBold"
                    style={{ color: "#172033", fontSize: 18 }}
                  >
                    Descrição:{" "}
                  </Text>
                  {descricao}
                </Text>
              ) : null}

              {alcance ? (
                <Text
                  style={{
                    color: "#172033",
                    fontSize: 16,
                    lineHeight: 22,
                  }}
                >
                  <Text
                    weight="ExtraBold"
                    style={{ color: "#172033", fontSize: 18 }}
                  >
                    Alcance:{" "}
                  </Text>
                  {alcance}
                </Text>
              ) : null}
            </View>
          </View>

          {data ? (
            <View
              style={{
                position: "absolute",
                left: 42,
                top: 430,
                width: 350,
                height: 60,
                justifyContent: "flex-end",
              }}
            >
              <Text
                style={{
                  color: "#526073",
                  fontSize: 15,
                  lineHeight: 20,
                }}
              >
                {data}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              position: "absolute",
              left: 430,
              top: 155,
              width: 480,
              height: 275,
            }}
          >
            {imagemUri ? (
              <Image
                source={{ uri: imagemUri }}
                resizeMode="contain"
                style={{ width: 480, height: 275 }}
              />
            ) : endpointImagem ? (
              <ClippingImagemPreview
                endpoint={endpointImagem}
                nome={`Imagem do slide ${slide.ordem}`}
                resizeMode="contain"
                style={{ width: 480, height: 275, borderRadius: 0 }}
              />
            ) : (
              <View
                style={{
                  width: 480,
                  height: 275,
                  borderWidth: 1,
                  borderColor: "#D7DEEA",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#697587", fontSize: 16 }}>
                  Sem imagem para o slide
                </Text>
              </View>
            )}
          </View>

          {link ? (
            <View
              style={{
                position: "absolute",
                left: 430,
                top: 430,
                width: 480,
                height: 60,
                justifyContent: "flex-end",
              }}
            >
              <Text
                onLayout={({ nativeEvent }) => {
                  const altura = nativeEvent.layout.height;
                  setAlturaLink((atual) =>
                    Math.abs(atual - altura) > 1 ? altura : atual
                  );
                }}
                style={{
                  color: "#008C95",
                  fontSize: 15,
                  lineHeight: 20,
                }}
              >
                {link}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {excedeuSlide ? (
        <Text
          style={{
            width: larguraVisivel,
            color: "#A45B00",
            fontSize: 12,
          }}
        >
          O conteúdo não cabe no slide 16:9. Revise os textos deste slide
          antes de exportar.
        </Text>
      ) : null}
    </View>
  );
}
