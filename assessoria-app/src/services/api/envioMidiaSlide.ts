import type { ArquivoMidiaSlide } from "./relatorio";

type TipoMidia = "imagem" | "logo";
type EnviarMidia = (
  tipo: TipoMidia,
  arquivo: ArquivoMidiaSlide
) => Promise<number>;

export function criarEnvioMidiaSlide(
  enviar: EnviarMidia,
  agora = Date.now
): EnviarMidia {
  type Envio = { promessa: Promise<number>; ate: number };
  const envios = {
    imagem: new WeakMap<ArquivoMidiaSlide, Envio>(),
    logo: new WeakMap<ArquivoMidiaSlide, Envio>(),
  };

  return (tipo, arquivo) => {
    const anteriores = envios[tipo];
    const anterior = anteriores.get(arquivo);

    if (anterior && anterior.ate > agora()) return anterior.promessa;

    // mantém o envio pronto se só o salvamento do slide precisar de outra tentativa
    const envio = Promise.resolve()
      .then(() => enviar(tipo, arquivo))
      .catch((erro) => {
        if (anteriores.get(arquivo)?.promessa === envio) {
          anteriores.delete(arquivo);
        }
        throw erro;
      });

    anteriores.set(arquivo, { promessa: envio, ate: agora() + 1_800_000 });
    return envio;
  };
}
