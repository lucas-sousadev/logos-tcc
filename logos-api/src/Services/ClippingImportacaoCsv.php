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

        'mes_ano' => [
            'Mês',
            'Mes',
            'Mês/ano',
            'Mes/ano',
            'Período',
            'Competência',
        ],

        'dia_mes' => [
            'Dia',
            'Dia/mês',
            'Dia/mes',
            'Dia da publicação',
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
            'Tempo Inicio',
        ],

        'fim' => [
            'Fim',
            'Final',
            'Fim do trecho',
            'Tempo final',
            'Posição final',
            'Tempo Fim',
        ],

        'duracao' => [
            'Duração total',
            'Duração',
            'Duração do trecho',
            'Tempo total',
            'Tempo Veiculação',
        ],

        'tier' => [
            'Tier',
            'Classificação Tier',
            'Nível Tier',
            'Tyer',
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

    private static function desembrulharLinhasCsv(
        string $conteudo
    ): string {
        $linhas = preg_split('/\r\n|\n|\r/', $conteudo);

        if (!is_array($linhas)) {
            return $conteudo;
        }

        $naoVazias = array_values(array_filter(
            $linhas,
            fn(string $linha) => trim($linha) !== ''
        ));

        if (count($naoVazias) < 2) {
            return $conteudo;
        }

        $nomesConhecidos = [];

        foreach (self::ALIASES as $campo => $nomes) {
            $nomesConhecidos[self::cabecalho($campo)] =
                $campo;

            foreach ($nomes as $nome) {
                $nomesConhecidos[self::cabecalho($nome)] =
                    $campo;
            }
        }

        $encontrouCabecalhoInterno = false;

        foreach (array_slice($naoVazias, 0, 10) as $linha) {
            if (
                preg_match(
                    '/\A"(?:[^"]|"")*"\z/u',
                    $linha
                ) !== 1
            ) {
                continue;
            }

            $interior = str_replace(
                '""',
                '"',
                substr($linha, 1, -1)
            );

            foreach ([';', ',', "\t"] as $separador) {
                $colunas = str_getcsv(
                    $interior,
                    $separador,
                    '"',
                    ''
                );

                if (count($colunas) < 3) {
                    continue;
                }

                $camposReconhecidos = [];

                foreach ($colunas as $nome) {
                    $campo = $nomesConhecidos[
                        self::cabecalho((string) $nome)
                    ] ?? null;

                    if ($campo !== null) {
                        $camposReconhecidos[$campo] = true;
                    }
                }

                if (count($camposReconhecidos) >= 2) {
                    $encontrouCabecalhoInterno = true;
                    break 2;
                }
            }
        }

        if (!$encontrouCabecalhoInterno) {
            return $conteudo;
        }

        $normalizadas = [];

        foreach ($linhas as $linha) {
            if (
                preg_match(
                    '/\A"(?:[^"]|"")*"\z/u',
                    $linha
                ) === 1
            ) {
                $normalizadas[] = str_replace(
                    '""',
                    '"',
                    substr($linha, 1, -1)
                );
            } else {
                $normalizadas[] = $linha;
            }
        }

        return implode("\n", $normalizadas);
    }

    public static function ler(
        mixed $upload,
        ?array $mapeamentoManual = null,
        ?int $linhaCabecalhoManual = null,
        bool $somenteColunas = false
    ): array {
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

        $conteudo = self::desembrulharLinhasCsv(
            $conteudo
        );

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

            // Monta os nomes conhecidos antes de procurar o cabeçalho.
            $aliases = [];

            foreach (self::ALIASES as $campo => $nomes) {
                $aliases[self::cabecalho($campo)] = $campo;

                foreach ($nomes as $nomeAlternativo) {
                    $aliases[self::cabecalho($nomeAlternativo)] = $campo;
                }
            }

            $melhor = null;

            foreach ([';', ',', "\t"] as $candidato) {
                rewind($arquivo);

                for ($numeroLinha = 1; $numeroLinha <= 20; $numeroLinha++) {
                    $campos = fgetcsv(
                        $arquivo,
                        0,
                        $candidato,
                        '"',
                        ''
                    );

                    if ($campos === false) {
                        break;
                    }

                    $nomesReconhecidos = [];

                    foreach ($campos as $nome) {
                        $campo = $aliases[
                            self::cabecalho((string) $nome)
                        ] ?? null;

                        if ($campo !== null) {
                            $nomesReconhecidos[$campo] = true;
                        }
                    }

                    $quantidadeReconhecida = count($nomesReconhecidos);

                    // Prioriza colunas reconhecidas; usa a largura apenas
                    // para desempatar candidatos parecidos.
                    $pontuacao =
                        $quantidadeReconhecida * 1000
                        + min(count($campos), 100) * 10
                        - $numeroLinha;

                    if (
                        $melhor === null
                        || $pontuacao > $melhor['pontuacao']
                    ) {
                        $melhor = [
                            'delimitador' => $candidato,
                            'linha' => $numeroLinha,
                            'reconhecidas' => $quantidadeReconhecida,
                            'pontuacao' => $pontuacao,
                        ];
                    }
                }
            }

            if (
                $melhor === null
                || (
                    $melhor['reconhecidas'] === 0
                    && !$somenteColunas
                    && $mapeamentoManual === null
                )
            ) {
                throw new \InvalidArgumentException(
                    'Não foi possível identificar o cabeçalho do CSV.'
                );
            }

            $delimitador = $melhor['delimitador'];
            $linhaCabecalho = $melhor['linha'];

            if ($linhaCabecalhoManual !== null) {
                if ($linhaCabecalhoManual < 1 || $linhaCabecalhoManual > 20) {
                    throw new \InvalidArgumentException(
                        'Escolha uma linha de cabeçalho entre 1 e 20.'
                    );
                }

                $linhaCabecalho = $linhaCabecalhoManual;
            }

            rewind($arquivo);

            for ($i = 1; $i < $linhaCabecalho; $i++) {
                fgetcsv($arquivo, 0, $delimitador, '"', '');
            }

            $cabecalhos = fgetcsv(
                $arquivo,
                0,
                $delimitador,
                '"',
                ''
            );

            if (
                !is_array($cabecalhos)
                || count($cabecalhos) === 0
                || count($cabecalhos) > 100
            ) {
                throw new \InvalidArgumentException(
                    'O cabeçalho do CSV é inválido.'
                );
            }

            $inicioDados = ftell($arquivo);

            if ($inicioDados === false) {
                throw new \RuntimeException(
                    'Não foi possível localizar os dados do CSV.'
                );
            }

            $totalColunas = count($cabecalhos);
            $exemplos = array_fill(0, $totalColunas, []);
            $temDados = array_fill(0, $totalColunas, false);
            $totalRegistros = 0;

            // Lê somente para descobrir exemplos e colunas com conteúdo.
            // Depois voltamos à posição inicial para a leitura normal.
            while (
                ($linhaExemplo = fgetcsv(
                    $arquivo,
                    0,
                    $delimitador,
                    '"',
                    ''
                )) !== false
            ) {
                $possuiConteudo = false;

                foreach ($linhaExemplo as $valor) {
                    if (trim((string) $valor) !== '') {
                        $possuiConteudo = true;
                        break;
                    }
                }

                if (!$possuiConteudo) {
                    continue;
                }

                $totalRegistros++;

                if ($totalRegistros > 1000) {
                    throw new \LengthException(
                        'O CSV pode conter até 1.000 registros.'
                    );
                }

                foreach ($cabecalhos as $indice => $_) {
                    $valor = self::valor(
                        (string) ($linhaExemplo[$indice] ?? '')
                    );

                    if ($valor === '') {
                        continue;
                    }

                    $temDados[$indice] = true;

                    if (
                        count($exemplos[$indice]) < 3
                        && !in_array($valor, $exemplos[$indice], true)
                    ) {
                        $exemplos[$indice][] = $valor;
                    }
                }
            }

            if ($totalRegistros === 0) {
                throw new \InvalidArgumentException(
                    'O CSV não contém registros para importar.'
                );
            }

            // Mostra as primeiras linhas para que o usuário possa corrigir
            // a escolha automática do cabeçalho.
            rewind($arquivo);
            $linhasIniciais = [];

            for ($numeroInicial = 1; $numeroInicial <= 10; $numeroInicial++) {
                $linhaInicial = fgetcsv(
                    $arquivo,
                    0,
                    $delimitador,
                    '"',
                    ''
                );

                if ($linhaInicial === false) {
                    break;
                }

                $camposReconhecidos = [];

                foreach ($linhaInicial as $nomeInicial) {
                    $campoInicial = $aliases[
                        self::cabecalho((string) $nomeInicial)
                    ] ?? null;

                    if ($campoInicial !== null) {
                        $camposReconhecidos[$campoInicial] = true;
                    }
                }

                $linhasIniciais[] = [
                    'linha' => $numeroInicial,
                    'campos_reconhecidos' => count($camposReconhecidos),
                    'valores' => array_map(
                        fn($valor) => trim((string) $valor),
                        $linhaInicial
                    ),
                ];
            }

            if (fseek($arquivo, $inicioDados) !== 0) {
                throw new \RuntimeException(
                    'Não foi possível continuar a leitura do CSV.'
                );
            }

            $automatico = [];
            $camposAutomaticosUsados = [];

            foreach ($cabecalhos as $indice => $nomeColuna) {
                $campo = $aliases[
                    self::cabecalho((string) $nomeColuna)
                ] ?? null;

                // Quando duas colunas sugerem o mesmo destino, somente
                // a primeira recebe associação automática.
                if (
                    $campo !== null
                    && isset($camposAutomaticosUsados[$campo])
                ) {
                    $campo = null;
                }

                if ($campo !== null) {
                    $camposAutomaticosUsados[$campo] = true;
                }

                $automatico[$indice] = $campo;
            }

            $escolhas = $automatico;

            if ($mapeamentoManual !== null) {
                if (
                    !array_is_list($mapeamentoManual)
                    || count($mapeamentoManual) !== $totalColunas
                ) {
                    throw new \InvalidArgumentException(
                        'O mapeamento deve informar um destino ou null para cada coluna do CSV.'
                    );
                }

                $escolhas = $mapeamentoManual;
            }

            $mapeamento = [];
            $colunas = [];
            $ignoradas = [];
            $colunasSemNome = [];
            $destinosUsados = [];

            foreach ($cabecalhos as $indice => $nomeColuna) {
                $nome = trim((string) $nomeColuna);
                $campo = $escolhas[$indice];

                if (
                    $campo !== null
                    && (
                        !is_string($campo)
                        || !array_key_exists($campo, self::ALIASES)
                    )
                ) {
                    throw new \InvalidArgumentException(
                        'O destino escolhido para a coluna '
                        . ($indice + 1)
                        . ' é inválido.'
                    );
                }

                if ($campo !== null) {
                    if (isset($destinosUsados[$campo])) {
                        throw new \InvalidArgumentException(
                            "O campo {$campo} foi associado a mais de uma coluna."
                        );
                    }

                    $destinosUsados[$campo] = true;
                    $mapeamento[$campo] = $indice;
                }

                $rotulo = $nome !== ''
                    ? $nome
                    : 'Coluna ' . ($indice + 1) . ' sem nome';

                $colunas[] = [
                    'indice' => $indice,
                    'original' => $rotulo,
                    'campo' => $campo,
                    'tem_dados' => $temDados[$indice],
                    'exemplos' => $exemplos[$indice],
                ];

                if ($campo === null && $temDados[$indice]) {
                    $ignoradas[] = $rotulo;
                }

                // Antes da revisão manual, uma coluna sem nome que contém
                // dados precisa ser apresentada como erro nas linhas afetadas.
                // Depois que a tela enviar o mapeamento completo, null passa
                // a ser uma escolha explícita de ignorar.
                if (
                    $nome === ''
                    && $mapeamentoManual === null
                    && $temDados[$indice]
                ) {
                    $colunasSemNome[] = $indice;
                }
            }

            $estrutura = [
                'linha_cabecalho' => $linhaCabecalho,
                'delimitador' => $delimitador === "\t"
                    ? 'TAB'
                    : $delimitador,
                'total_registros' => $totalRegistros,
                'linhas_iniciais' => $linhasIniciais,
                'colunas' => $colunas,
                'ignoradas' => $ignoradas,
                'linha_sugerida' => (int) $melhor['linha'],
            ];

            if ($somenteColunas) {
                return $estrutura;
            }

            if ($mapeamento === []) {
                throw new \InvalidArgumentException(
                    'Associe pelo menos uma coluna antes de analisar o CSV.'
                );
            }

            $registros = [];
            $numero = $linhaCabecalho;

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

                $erro = null;
                $totalColunas = count($cabecalhos);

                // Algumas exportações omitem células vazias no final.
                if (count($linha) < $totalColunas) {
                    $linha = array_pad($linha, $totalColunas, '');
                }

                if (count($linha) > $totalColunas) {
                    $excedentes = array_slice($linha, $totalColunas);

                    $temConteudoExcedente = array_filter(
                        $excedentes,
                        fn($valor) => trim((string) $valor) !== ''
                    ) !== [];

                    if ($temConteudoExcedente) {
                        $erro = 'Quantidade de campos diferente do cabeçalho.';
                    } else {
                        $linha = array_slice($linha, 0, $totalColunas);
                    }
                }

                if ($erro === null) {
                    foreach ($colunasSemNome as $indice) {
                        if (trim((string) ($linha[$indice] ?? '')) !== '') {
                            $erro =
                                'A coluna ' . ($indice + 1)
                                . ' não tem nome, mas contém dados. '
                                . 'Ela deverá ser associada ou ignorada explicitamente.';
                            break;
                        }
                    }
                }

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
                ...$estrutura,
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