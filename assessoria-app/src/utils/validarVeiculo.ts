export const MAX_NOME_VEICULO = 150;
export const MAX_DESCRICAO_VEICULO = 1000;
export const MAX_ALCANCE_VEICULO = 500;
export const MAX_LOGO_PATH_VEICULO = 500;

export type CampoVeiculo =
  | "nome"
  | "descricao"
  | "alcance"
  | "logo_path";

export type ErrosVeiculo = Partial<
  Record<CampoVeiculo, string>
>;

interface DadosVeiculoParaValidacao {
    nome: string;
    descricao: string;
    alcance: string;
    logo_path: string;
}

function quantidadeCaracteres(valor: string): number {
    return Array.from(valor).length;
}

    function excedeLimite(
    valor: string,
    limite: number
    ): boolean {
    return quantidadeCaracteres(valor.trim()) > limite;
}

    export function validarNomeVeiculo(
    nome: string
    ): string | null {
    const nomeFormatado = nome.trim();

    if (!nomeFormatado) {
        return null;
}

    if (excedeLimite(nomeFormatado, MAX_NOME_VEICULO)) {
        return `O nome do veículo deve possuir no máximo ${MAX_NOME_VEICULO} caracteres.`;
}

    return null;
}

    export function validarFormularioVeiculo(
    dados: DadosVeiculoParaValidacao
    ): ErrosVeiculo {
    const erros: ErrosVeiculo = {};

    if (!dados.nome.trim()) {
        erros.nome = "Informe o nome do veículo.";
} else {
        const erroNome = validarNomeVeiculo(dados.nome);

        if (erroNome) {
        erros.nome = erroNome;
        }
    }

    if (
        excedeLimite(
        dados.descricao,
        MAX_DESCRICAO_VEICULO
        )
    ) {
        erros.descricao =
        `A descrição deve possuir no máximo ` +
        `${MAX_DESCRICAO_VEICULO} caracteres.`;
    }

    if (
        excedeLimite(
        dados.alcance,
        MAX_ALCANCE_VEICULO
        )
    ) {
        erros.alcance =
        `O alcance deve possuir no máximo ` +
        `${MAX_ALCANCE_VEICULO} caracteres.`;
    }

    if (
        excedeLimite(
        dados.logo_path,
        MAX_LOGO_PATH_VEICULO
        )
    ) {
        erros.logo_path =
        `O logo ou caminho deve possuir no máximo ` +
        `${MAX_LOGO_PATH_VEICULO} caracteres.`;
    }

    return erros;
}