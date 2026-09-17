<?php

namespace Logos\AssessoriaApi\Services;

class ClippingImportacaoCsv
{
    private const ALIASES = [
        'cliente' => [
            'Cliente',
            'Nome do cliente',
            'Empresa',
            'Contratante',
        ],

        'ano_referencia' => [
            'Ano',
            'Ano de referência',
            'Ano referência',
            'Exercício',
        ],

        'data_publicacao' => [
            'Data',
            'Data da publicação',
            'Data de publicação',
            'Publicado em',
            'Data da matéria',
        ],

        'categorias' => [
            'Categoria',
            'Categorias',
            'Mídia',
            'Mídias',
            'Tipo de mídia',
        ],

        'veiculo' => [
            'Veículo',
            'Nome do veículo',
            'Veículo de comunicação',
            'Canal',
            'Emissora',
        ],

        'programa_secao' => [
            'Programa/Seção',
            'Programa',
            'Seção',
            'Editoria',
            'Coluna',
        ],

        'pauta' => [
            'Pauta',
            'Título',
            'Título da matéria',
            'Matéria',
            'Assunto',
        ],

        'inicio' => [
            'Início',
            'Início do trecho',
            'Tempo inicial',
            'Posição inicial',
        ],

        'fim' => [
            'Fim',
            'Final',
            'Fim do trecho',
            'Tempo final',
            'Posição final',
        ],

        'duracao' => [
            'Duração total',
            'Duração',
            'Duração do trecho',
            'Tempo total',
        ],

        'tier' => [
            'Tier',
            'Classificação Tier',
            'Nível Tier',
        ],

        'link' => [
            'Link',
            'URL',
            'Link da publicação',
            'Link da matéria',
            'Endereço da publicação',
        ],

        'observacoes' => [
            'Observações',
            'Observação',
            'Obs',
            'Notas',
            'Comentários',
        ],
    ];

    private static function cabecalho(string $valor): string
    {
        $valor = mb_strtolower(
            trim(str_replace("\xEF\xBB\xBF", '', $valor)),
            'UTF-8'
        );

        $valor = strtr($valor, [
            'á' => 'a',
            'à' => 'a',
            'â' => 'a',
            'ã' => 'a',
            'ä' => 'a',
            'é' => 'e',
            'è' => 'e',
            'ê' => 'e',
            'ë' => 'e',
            'í' => 'i',
            'ì' => 'i',
            'î' => 'i',
            'ï' => 'i',
            'ó' => 'o',
            'ò' => 'o',
            'ô' => 'o',
            'õ' => 'o',
            'ö' => 'o',
            'ú' => 'u',
            'ù' => 'u',
            'û' => 'u',
            'ü' => 'u',
            'ç' => 'c',
        ]);

        return trim(
            preg_replace('/[^a-z0-9]+/', ' ', $valor) ?? ''
        );
    }

    private static function valor(string $valor): string
    {
        // Desfaz um prefixo de proteção usado pelo exportador.
        if (
            str_starts_with($valor, "'")
            && preg_match(
                "/\A(?:[=+\-@'\t\r\n]|[\s\p{Z}]+[=+\-@'])/u",
                substr($valor, 1)
            ) === 1
        ) {
            $valor = substr($valor, 1);
        }

        return trim($valor);
    }

    public static function ler(mixed $upload): array
    {
        if (
            !is_array($upload)
            || !isset($upload['error'])
            || !is_int($upload['error'])
        ) {
            throw new \InvalidArgumentException(
                'Envie um arquivo CSV no campo arquivo.'
            );
        }

        if (
            in_array(
                $upload['error'],
                [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE],
                true
            )
        ) {
            throw new \LengthException(
                'O arquivo excede o tamanho permitido pelo servidor.'
            );
        }

        if ($upload['error'] !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException(
                'Não foi possível receber o arquivo CSV.'
            );
        }

        $nome = $upload['name'] ?? null;
        $caminho = $upload['tmp_name'] ?? null;

        if (
            !is_string($nome)
            || strtolower(pathinfo($nome, PATHINFO_EXTENSION)) !== 'csv'
            || !is_string($caminho)
            || !is_uploaded_file($caminho)
        ) {
            throw new \InvalidArgumentException(
                'Selecione um arquivo CSV válido.'
            );
        }

        $tamanho = filesize($caminho);

        if (
            $tamanho === false
            || $tamanho === 0
            || $tamanho > 5 * 1024 * 1024
        ) {
            throw new \LengthException(
                'Envie um CSV não vazio de até 5 MB.'
            );
        }

        $conteudo = file_get_contents($caminho);

        if ($conteudo === false) {
            throw new \RuntimeException(
                'Não foi possível ler o arquivo.'
            );
        }

        if (str_starts_with($conteudo, "\xFF\xFE")) {
            $conteudo = mb_convert_encoding(
                substr($conteudo, 2),
                'UTF-8',
                'UTF-16LE'
            );
        } elseif (str_starts_with($conteudo, "\xFE\xFF")) {
            $conteudo = mb_convert_encoding(
                substr($conteudo, 2),
                'UTF-8',
                'UTF-16BE'
            );
        } elseif (!mb_check_encoding($conteudo, 'UTF-8')) {
            $conteudo = mb_convert_encoding(
                $conteudo,
                'UTF-8',
                'Windows-1252'
            );
        }

        if (str_starts_with($conteudo, "\xEF\xBB\xBF")) {
            $conteudo = substr($conteudo, 3);
        }

        if (str_contains($conteudo, "\0")) {
            throw new \InvalidArgumentException(
                'O arquivo contém conteúdo incompatível com CSV.'
            );
        }

        $arquivo = fopen('php://temp', 'w+b');

        if ($arquivo === false) {
            throw new \RuntimeException(
                'Não foi possível processar o CSV.'
            );
        }

        try {
            if (fwrite($arquivo, $conteudo) !== strlen($conteudo)) {
                throw new \RuntimeException(
                    'Não foi possível preparar a leitura do CSV.'
                );
            }

            // Testa os delimitadores respeitando as aspas do CSV.
            $delimitador = ';';
            $maiorQuantidade = 0;

            foreach ([';', ',', "\t"] as $candidato) {
                rewind($arquivo);

                $teste = fgetcsv(
                    $arquivo,
                    0,
                    $candidato,
                    '"',
                    ''
                );

                $quantidade = is_array($teste)
                    ? count($teste)
                    : 0;

                if ($quantidade > $maiorQuantidade) {
                    $maiorQuantidade = $quantidade;
                    $delimitador = $candidato;
                }
            }

            rewind($arquivo);

            $cabecalhos = fgetcsv(
                $arquivo,
                0,
                $delimitador,
                '"',
                ''
            );

            if (!is_array($cabecalhos) || count($cabecalhos) > 100) {
                throw new \InvalidArgumentException(
                    'O cabeçalho do CSV é inválido.'
                );
            }

            $aliases = [];

            foreach (self::ALIASES as $campo => $nomes) {
                $aliases[self::cabecalho($campo)] = $campo;

                foreach ($nomes as $nomeAlternativo) {
                    $aliases[
                        self::cabecalho($nomeAlternativo)
                    ] = $campo;
                }
            }

            $mapeamento = [];
            $colunas = [];
            $ignoradas = [];

            foreach ($cabecalhos as $indice => $nomeColuna) {
                $nomeColuna = trim((string) $nomeColuna);

                if ($nomeColuna === '') {
                    throw new \InvalidArgumentException(
                        'Existe uma coluna sem nome no cabeçalho.'
                    );
                }

                $campo = $aliases[
                    self::cabecalho($nomeColuna)
                ] ?? null;

                $colunas[] = [
                    'original' => $nomeColuna,
                    'campo' => $campo,
                ];

                if ($campo === null) {
                    $ignoradas[] = $nomeColuna;
                    continue;
                }

                if (array_key_exists($campo, $mapeamento)) {
                    throw new \InvalidArgumentException(
                        "Mais de uma coluna corresponde a {$campo}. Mantenha apenas uma delas."
                    );
                }

                $mapeamento[$campo] = $indice;
            }

            if ($mapeamento === []) {
                throw new \InvalidArgumentException(
                    'Nenhuma coluna de clipping foi reconhecida.'
                );
            }

            $registros = [];
            $numero = 1;

            while (
                ($linha = fgetcsv(
                    $arquivo,
                    0,
                    $delimitador,
                    '"',
                    ''
                )) !== false
            ) {
                $numero++;

                $possuiConteudo = false;

                foreach ($linha as $valor) {
                    if (trim((string) $valor) !== '') {
                        $possuiConteudo = true;
                        break;
                    }
                }

                if (!$possuiConteudo) {
                    continue;
                }

                if (count($registros) >= 1000) {
                    throw new \LengthException(
                        'O CSV pode conter até 1.000 registros.'
                    );
                }

                $erro = count($linha) !== count($cabecalhos)
                    ? 'Quantidade de campos diferente do cabeçalho.'
                    : null;

                $dados = [];

                if ($erro === null) {
                    foreach ($mapeamento as $campo => $indice) {
                        $dados[$campo] = self::valor(
                            (string) ($linha[$indice] ?? '')
                        );
                    }
                }

                $registros[] = [
                    'registro' => $numero,
                    'originais' => $dados,
                    'erro' => $erro,
                ];
            }

            if ($registros === []) {
                throw new \InvalidArgumentException(
                    'O CSV não contém registros para importar.'
                );
            }

            return [
                'colunas' => $colunas,
                'ignoradas' => $ignoradas,
                'registros' => $registros,
            ];
        } finally {
            fclose($arquivo);
        }
    }

    public static function inteiro(
        mixed $valor,
        string $campo,
        int $minimo = 1,
        int $maximo = PHP_INT_MAX
    ): int {
        if (!is_int($valor) && !is_string($valor)) {
            throw new \InvalidArgumentException(
                "{$campo} inválido."
            );
        }

        $numero = filter_var(
            $valor,
            FILTER_VALIDATE_INT,
            [
                'options' => [
                    'min_range' => $minimo,
                    'max_range' => $maximo,
                ],
            ]
        );

        if ($numero === false) {
            throw new \InvalidArgumentException(
                "{$campo} inválido."
            );
        }

        return $numero;
    }

    public static function data(string $valor): ?string
    {
        if ($valor === '') {
            return null;
        }

        foreach (['Y-m-d', 'd/m/Y'] as $formato) {
            $data = \DateTimeImmutable::createFromFormat(
                '!' . $formato,
                $valor
            );

            if ($data !== false && $data->format($formato) === $valor) {
                return $data->format('Y-m-d');
            }
        }

        throw new \InvalidArgumentException(
            'Data inválida. Use DD/MM/AAAA ou AAAA-MM-DD.'
        );
    }

    public static function tempo(
        string $valor,
        string $campo
    ): ?int {
        if ($valor === '') {
            return null;
        }

        if (
            !preg_match(
                '/\A(\d{1,10}):([0-5]\d)(?::([0-5]\d))?\z/',
                $valor,
                $partes
            )
        ) {
            throw new \InvalidArgumentException(
                "{$campo}: use hh:mm:ss ou mm:ss."
            );
        }

        $segundos = isset($partes[3])
            ? (int) $partes[1] * 3600
                + (int) $partes[2] * 60
                + (int) $partes[3]
            : (int) $partes[1] * 60
                + (int) $partes[2];

        return self::inteiro(
            $segundos,
            $campo,
            0,
            4294967295
        );
    }

    public static function categorias(string $valor): array
    {
        if ($valor === '') {
            return [];
        }

        // Compatibilidade com CSVs antigos que utilizavam JSON.
        if (str_starts_with($valor, '[')) {
            try {
                $categorias = json_decode(
                    $valor,
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );
            } catch (\JsonException) {
                throw new \InvalidArgumentException(
                    'A lista de categorias é inválida.'
                );
            }

            if (!is_array($categorias) || !array_is_list($categorias)) {
                throw new \InvalidArgumentException(
                    'Categorias devem formar uma lista.'
                );
            }

            return $categorias;
        }

        return array_values(
            array_filter(
                array_map(
                    'trim',
                    preg_split('/[,|]/u', $valor) ?: []
                ),
                fn(string $item) => $item !== ''
            )
        );
    }
}