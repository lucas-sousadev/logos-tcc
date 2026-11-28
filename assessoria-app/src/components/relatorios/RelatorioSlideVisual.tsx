import { useEffect, useState } from "react";
import { Image, useWindowDimensions, View } from "react-native";

import ClippingImagemPreview from "@/components/clipping/ClippingImagePreview";
import Text from "@/components/ui/Text";
import type { SlideRelatorio } from "@/services/api/relatorio";
import { obterUrlLogoVeiculo } from "@/services/api/veiculo";
import {
  calcularLayoutLinkSlide,
  calcularLayoutDadosSlide,
  normalizarEscalaImagemSlide,
  LIMITE_DESCRICAO_SLIDE,
  limitarDescricaoSlide,
} from "@/utils/relatorioSlideLayout";
import { dataISOParaBR } from "@/utils/clippingFormatacao";

interface Props {
  slide: SlideRelatorio;
  imagemUri?: string | null;
  logoUri?: string | null;
}

const LARGURA_SLIDE = 960;
const ALTURA_SLIDE = 540;

export default function RelatorioSlideVisual({
  slide,
  imagemUri,
  logoUri,
}: Props) {
  const { width: larguraJanela } = useWindowDimensions();
  const [larguraArea, setLarguraArea] = useState<number | null>(null);

  const larguraVisivel = Math.min(
    LARGURA_SLIDE,
    Math.max(1, larguraArea ?? larguraJanela - 32)
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
  const descricao = limitarDescricaoSlide(veiculo?.descricao);
  const descricaoAbreviada =
    Array.from(veiculo?.descricao?.replace(/\s+/gu, " ").trim() ?? "").length >
    LIMITE_DESCRICAO_SLIDE;
  const alcance = veiculo?.alcance?.trim();
  const data = dataISOParaBR(clipping?.data_publicacao ?? null);
  const link = slide.link?.trim();
  const layoutLink = calcularLayoutLinkSlide(link);
  const endpointImagem = slide.imagem_midia_id
    ? `/relatorios/${slide.relatorio_id}/midias/${slide.imagem_midia_id}`
    : slide.clipping_id && slide.imagem_anexo_id
      ? `/clippings/${slide.clipping_id}/anexos/${slide.imagem_anexo_id}/arquivo`
      : null;

  const camposDados = calcularLayoutDadosSlide(
    nomeVeiculo,
    descricao,
    alcance,
    Boolean(data)
  );
  const escalaImagem =
    normalizarEscalaImagemSlide(slide.dados_json?.imagem?.escala) / 100;
  const excedeuSlide = camposDados.some((campo) => campo.abreviado);

  return (
    <View
      onLayout={({ nativeEvent }) => {
        const largura = nativeEvent.layout.width;
        if (largura <= 0) return;
        setLarguraArea((atual) =>
          atual !== null && Math.abs(atual - largura) < 1 ? atual : largura
        );
      }}
      style={{ width: "100%", minWidth: 0, alignItems: "center", gap: 7 }}
    >
      <View
        style={{
          width: larguraVisivel,
          height: ALTURA_SLIDE * escala,
          overflow: "hidden",
          backgroundColor: "#FFFFFF",
          borderColor: "#D7DEEA",
          borderWidth: 1,
          marginBottom: 3,
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

          {camposDados.map((campo) => (
            <View
              key={campo.rotulo}
              style={{
                position: "absolute",
                left: 42,
                top: campo.topo,
                width: 350,
                height: campo.altura,
                overflow: "hidden",
              }}
            >
              {campo.linhas.map((linha, indice) => (
                <Text
                  key={indice}
                  numberOfLines={1}
                  style={{ color: "#172033", fontSize: 16, lineHeight: 22 }}
                >
                  {indice === 0 ? (
                    <>
                      <Text weight="ExtraBold" style={{ fontSize: 16 }}>
                        {campo.rotulo}:{" "}
                      </Text>
                      {linha.slice(campo.rotulo.length + 2)}
                    </>
                  ) : (
                    linha
                  )}
                </Text>
              ))}
            </View>
          ))}

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
              top: layoutLink.topoImagem,
              width: 480,
              height: layoutLink.alturaImagem,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {imagemUri ? (
              <Image
                source={{ uri: imagemUri }}
                resizeMode="contain"
                style={{
                  width: 480 * escalaImagem,
                  height: layoutLink.alturaImagem * escalaImagem,
                }}
              />
            ) : endpointImagem ? (
              <ClippingImagemPreview
                endpoint={endpointImagem}
                nome={`Imagem do slide ${slide.ordem}`}
                resizeMode="contain"
                style={{
                  width: 480 * escalaImagem,
                  height: layoutLink.alturaImagem * escalaImagem,
                  borderRadius: 0,
                }}
              />
            ) : (
              <View
                style={{
                  width: 480,
                  height: layoutLink.alturaImagem,
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
                top: layoutLink.topoLink,
                width: 480,
                height: layoutLink.alturaLink,
                overflow: "hidden",
                justifyContent: "flex-end",
              }}
            >
              <Text
                numberOfLines={5}
                style={{
                  color: "#008C95",
                  fontSize: 15,
                  lineHeight: 20,
                }}
              >
                {layoutLink.texto}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {descricaoAbreviada ? (
        <Text style={{ width: larguraVisivel, color: "#A45B00", fontSize: 12 }}>
          Descrição abreviada no slide. Edite o texto para usar até 200
          caracteres.
        </Text>
      ) : null}

      {layoutLink.abreviado ? (
        <Text style={{ width: larguraVisivel, color: "#526073", fontSize: 12 }}>
          Link abreviado no slide. O endereço completo será mantido no PPTX.
        </Text>
      ) : null}

      {excedeuSlide ? (
        <Text
          style={{
            width: larguraVisivel,
            color: "#A45B00",
            fontSize: 12,
          }}
        >
          Textos extensos foram abreviados para caber no slide. Revise antes de
          exportar.
        </Text>
      ) : null}
    </View>
  );
}
