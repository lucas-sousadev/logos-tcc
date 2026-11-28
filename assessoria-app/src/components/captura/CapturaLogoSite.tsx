import { useState } from "react";
import CapturaPaginaModal from "@/components/captura/CapturaPaginaModal";
import CapturaSiteBotao from "@/components/captura/CapturaSiteBotao";
import type { ArquivoLogo } from "@/components/forms/LogoPicker";

interface Props {
  linkInicial?: string;
  disabled?: boolean;
  onSelect: (arquivo: ArquivoLogo) => void;
}

export default function CapturaLogoSite({
  linkInicial,
  disabled,
  onSelect,
}: Props) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <CapturaSiteBotao
        linkInicial={linkInicial}
        disabled={disabled}
        onCapturar={setLink}
      />
      {link ? (
        <CapturaPaginaModal
          visivel
          link={link}
          origem="veiculo"
          onFechar={() => setLink(null)}
          onConfirmar={(imagem) => {
            if (
              imagem.tamanhoBytes === null ||
              imagem.tamanhoBytes > 2 * 1024 * 1024
            ) {
              throw new Error(
                "O logo deve possuir até 2 MB. Selecione uma área menor."
              );
            }
            onSelect({ ...imagem, geradoPelaCaptura: true });
            setLink(null);
          }}
        />
      ) : null}
    </>
  );
}
