<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;
use Logos\AssessoriaApi\Models\Veiculo;

class ClippingImportacaoService
{
    private static function nome(string $valor): string
    {
        return mb_strtolower(
            trim(preg_replace('/\s+/u', ' ', $valor) ?? ''),
            'UTF-8'
        );
    }

    private static function json(mixed $valor): string
    {
        return json_encode(
            $valor,
            JSON_UNESCAPED_UNICODE
                | JSON_UNESCAPED_SLASHES
                | JSON_THROW_ON_ERROR
        );
    }

    private static function resolucoes(
        mixed $json,
        int $assessoriaId
    ): array {
        if (!is_string($json)) {
            throw new \InvalidArgumentException(
                'As associações de veículos são inválidas.'
            );
        }

        try {
            $lista = json_decode(
                $json,
                true,
                512,
                JSON_THROW_ON_ERROR
            );
        } catch (\JsonException) {
            throw new \InvalidArgumentException(
                'As associações de veículos são inválidas.'
            );
        }

        if (
            !is_array($lista)
            || !array_is_list($lista)
            || count($lista) > 1000
        ) {
            throw new \InvalidArgumentException(
                'As associações de veículos são inválidas.'
            );
        }

        $resultado = [];

        foreach ($lista as $item) {
            if (
                !is_array($item)
                || !is_string($item['nome'] ?? null)
                || trim($item['nome']) === ''
                || !array_key_exists('veiculo_id', $item)
            ) {
                throw new \InvalidArgumentException(
                    'Informe o nome original e o veículo escolhido.'
                );
            }

            $chave = self::nome($item['nome']);

            if (array_key_exists($chave, $resultado)) {
                throw new \InvalidArgumentException(
                    'Há associações repetidas para o mesmo nome de veículo.'
                );
            }

            if ($item['veiculo_id'] === null) {
                // Escolha explícita de deixar o vínculo pendente.
                $resultado[$chave] = null;
                continue;
            }

            $id = ClippingImportacaoCsv::inteiro(
                $item['veiculo_id'],
                'Veículo'
            );

            if (!Veiculo::buscarPorId($id, $assessoriaId)) {
                throw new \InvalidArgumentException(
                    'Selecione um veículo da sua assessoria.'
                );
            }

            $resultado[$chave] = $id;
        }

        return $resultado;
    }

    private static function converter(
        array $originais,
        int $clienteId,
        string $clienteNome,
        int $anoContexto,
        array &$avisos
    ): array {
        $clienteArquivo = $originais['cliente'] ?? '';

        if (
            $clienteArquivo !== ''
            && self::nome($clienteArquivo) !== self::nome($clienteNome)
        ) {
            throw new \InvalidArgumentException(
                "O cliente do arquivo é '{$clienteArquivo}', diferente do cliente desta importação."
            );
        }

        $data = ClippingImportacaoCsv::data(
            $originais['data_publicacao'] ?? ''
        );

        $anoArquivo = $originais['ano_referencia'] ?? '';

        $ano = $anoArquivo === ''
            ? $anoContexto
            : ClippingImportacaoCsv::inteiro(
                $anoArquivo,
                'Ano',
                1000,
                9999
            );

        if ($data !== null) {
            $anoDaData = (int) substr($data, 0, 4);

            if ($anoArquivo !== '' && $ano !== $anoDaData) {
                $avisos[] =
                    "O ano informado foi substituído por {$anoDaData}, conforme a data da publicação.";
            }

            $ano = $anoDaData;
        }

        if ($ano !== $anoContexto) {
            $avisos[] =
                "Esta publicação será organizada no ano {$ano}.";
        }

        $dados = [
            'cliente_id' => $clienteId,
            'ano_referencia' => $ano,
            'data_publicacao' => $data,
            'categorias' => ClippingImportacaoCsv::categorias(
                $originais['categorias'] ?? ''
            ),
            'programa_secao' => $originais['programa_secao'] ?? null,
            'pauta' => $originais['pauta'] ?? null,
            'inicio_segundos' => ClippingImportacaoCsv::tempo(
                $originais['inicio'] ?? '',
                'Início'
            ),
            'fim_segundos' => ClippingImportacaoCsv::tempo(
                $originais['fim'] ?? '',
                'Fim'
            ),
            'duracao_segundos' => ClippingImportacaoCsv::tempo(
                $originais['duracao'] ?? '',
                'Duração'
            ),
            'link' => $originais['link'] ?? null,
            'observacoes' => $originais['observacoes'] ?? null,
        ];

        // Coluna Tier vazia preserva a pendência.
        // Coluna ausente permite a regra normal do cadastro.
        if (array_key_exists('tier', $originais)) {
            $tier = trim($originais['tier']);

            if ($tier === '') {
                $dados['tier'] = null;
            } elseif (preg_match('/\A(?:tier\s*)?([123])\z/i', $tier, $m)) {
                $dados['tier'] = (int) $m[1];
            } else {
                throw new \InvalidArgumentException(
                    'Tier deve ser 1, 2, 3 ou ficar vazio.'
                );
            }
        }

        return $dados;
    }

    public static function previa(
        int $assessoriaId,
        int $usuarioId,
        mixed $upload,
        array $entrada
    ): array {
        $clienteId = ClippingImportacaoCsv::inteiro(
            $entrada['cliente_id'] ?? null,
            'Cliente'
        );

        $ano = ClippingImportacaoCsv::inteiro(
            $entrada['ano_referencia'] ?? null,
            'Ano',
            1000,
            9999
        );

        $cliente = Cliente::buscarPorId(
            $clienteId,
            $assessoriaId
        );

        if (!$cliente) {
            throw new \OutOfBoundsException(
                'Cliente não encontrado.'
            );
        }

        $csv = ClippingImportacaoCsv::ler($upload);

        $resolucoes = self::resolucoes(
            $entrada['veiculos'] ?? '[]',
            $assessoriaId
        );

        $pdo = Connection::get();

        $buscarVeiculo = $pdo->prepare(
            'SELECT id
             FROM veiculos
             WHERE assessoria_id = :assessoria_id
               AND LOWER(TRIM(nome)) = :nome
             LIMIT 2'
        );

        $buscarLink = $pdo->prepare(
            'SELECT id
             FROM clippings
             WHERE assessoria_id = :assessoria_id
               AND cliente_id = :cliente_id
               AND BINARY TRIM(link) = BINARY :link
             LIMIT 1'
        );

        $cacheVeiculos = [];
        $cacheLinks = [];
        $linksArquivo = [];
        $pendentes = [];
        $linhas = [];

        foreach ($csv['registros'] as $registro) {
            $originais = $registro['originais'];

            $linha = [
                'registro' => $registro['registro'],
                'originais' => $originais,
                'dados' => null,
                'veiculo_nome' => null,
                'erros' => [],
                'avisos' => [],
            ];

            try {
                if ($registro['erro'] !== null) {
                    throw new \InvalidArgumentException(
                        $registro['erro']
                    );
                }

                $nomeVeiculo = $originais['veiculo'] ?? '';
                $veiculoId = null;

                if ($nomeVeiculo !== '') {
                    $chave = self::nome($nomeVeiculo);

                    if (array_key_exists($chave, $resolucoes)) {
                        $veiculoId = $resolucoes[$chave];

                        if ($veiculoId === null) {
                            $linha['avisos'][] =
                                "Veículo '{$nomeVeiculo}' ficará pendente por escolha do usuário.";
                        }
                    } else {
                        if (!array_key_exists($chave, $cacheVeiculos)) {
                            $buscarVeiculo->execute([
                                'assessoria_id' => $assessoriaId,
                                'nome' => $chave,
                            ]);

                            $encontrados = $buscarVeiculo->fetchAll(
                                \PDO::FETCH_COLUMN
                            );

                            $cacheVeiculos[$chave] =
                                count($encontrados) === 1
                                    ? (int) $encontrados[0]
                                    : null;
                        }

                        $veiculoId = $cacheVeiculos[$chave];

                        if ($veiculoId === null) {
                            $pendentes[$nomeVeiculo] = true;

                            throw new \InvalidArgumentException(
                                "Associe o veículo '{$nomeVeiculo}' ou escolha deixá-lo pendente."
                            );
                        }
                    }
                }

                $dados = self::converter(
                    $originais,
                    $clienteId,
                    $cliente['nome'],
                    $ano,
                    $linha['avisos']
                );

                $dados['veiculo_id'] = $veiculoId;

                $campos = ClippingService::prepararImportacao(
                    $assessoriaId,
                    $dados
                );

                if (
                    !array_key_exists('tier', $originais)
                    && $campos['tier'] !== null
                ) {
                    $linha['avisos'][] =
                        "Tier {$campos['tier']} preenchido pelo cadastro do veículo.";
                }

                if ($veiculoId !== null) {
                    $veiculo = Veiculo::buscarPorId(
                        $veiculoId,
                        $assessoriaId
                    );

                    $linha['veiculo_nome'] = $veiculo['nome'] ?? null;
                }

                $link = $campos['link'];

                if ($link !== null) {
                    $linksArquivo[$link] =
                        ($linksArquivo[$link] ?? 0) + 1;

                    if (!array_key_exists($link, $cacheLinks)) {
                        $buscarLink->execute([
                            'assessoria_id' => $assessoriaId,
                            'cliente_id' => $clienteId,
                            'link' => $link,
                        ]);

                        $cacheLinks[$link] =
                            $buscarLink->fetchColumn() !== false;
                    }

                    if ($cacheLinks[$link]) {
                        $linha['avisos'][] =
                            'Já existe clipping deste cliente com o mesmo link. A importação continua permitida.';
                    }
                }

                $linha['dados'] = $campos;
            } catch (\InvalidArgumentException $e) {
                $linha['erros'][] = $e->getMessage();
            }

            $linhas[] = $linha;
        }

        foreach ($linhas as &$linha) {
            $link = $linha['dados']['link'] ?? null;

            if (
                $link !== null
                && ($linksArquivo[$link] ?? 0) > 1
            ) {
                $linha['avisos'][] =
                    'O mesmo link aparece mais de uma vez neste arquivo para este cliente. Todas as ocorrências podem ser importadas.';
            }
        }

        unset($linha);

        $previa = [
            'cliente_id' => $clienteId,
            'cliente_nome' => $cliente['nome'],
            'ano_referencia' => $ano,
            'colunas' => $csv['colunas'],
            'ignoradas' => $csv['ignoradas'],
            'veiculos_pendentes' => array_keys($pendentes),
            'linhas' => $linhas,
            'resumo' => [
                'total' => count($linhas),
                'validos' => count(array_filter(
                    $linhas,
                    fn(array $item) => $item['erros'] === []
                )),
                'com_avisos' => count(array_filter(
                    $linhas,
                    fn(array $item) => $item['avisos'] !== []
                )),
            ],
        ];

        // Remove somente prévias vencidas ainda não confirmadas.
        $limpar = $pdo->prepare(
            'DELETE FROM clipping_importacoes
             WHERE assessoria_id = :assessoria_id
               AND expira_em < CURRENT_TIMESTAMP
               AND resultado IS NULL'
        );

        $limpar->execute([
            'assessoria_id' => $assessoriaId,
        ]);

        $token = bin2hex(random_bytes(32));

        $salvar = $pdo->prepare(
            'INSERT INTO clipping_importacoes (
                token,
                assessoria_id,
                usuario_id,
                previa,
                expira_em
             ) VALUES (
                :token,
                :assessoria_id,
                :usuario_id,
                :previa,
                DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
             )'
        );

        $salvar->execute([
            'token' => $token,
            'assessoria_id' => $assessoriaId,
            'usuario_id' => $usuarioId,
            'previa' => self::json($previa),
        ]);

        return [
            'token' => $token,
            'validade_minutos' => 30,
            ...$previa,
        ];
    }

    public static function confirmar(
        int $assessoriaId,
        int $usuarioId,
        array $entrada
    ): array {
        $token = $entrada['token'] ?? null;
        $selecionados = $entrada['registros'] ?? null;

        if (
            !is_string($token)
            || !preg_match('/\A[a-f0-9]{64}\z/', $token)
        ) {
            throw new \InvalidArgumentException(
                'Identificação da prévia inválida.'
            );
        }

        if (
            !is_array($selecionados)
            || !array_is_list($selecionados)
            || count($selecionados) === 0
            || count($selecionados) > 1000
        ) {
            throw new \InvalidArgumentException(
                'Selecione os registros que deseja importar.'
            );
        }

        $numeros = [];

        foreach ($selecionados as $valor) {
            $numero = ClippingImportacaoCsv::inteiro(
                $valor,
                'Registro',
                2
            );

            if (in_array($numero, $numeros, true)) {
                throw new \InvalidArgumentException(
                    'Há registros repetidos na seleção.'
                );
            }

            $numeros[] = $numero;
        }

        sort($numeros);

        $pdo = Connection::get();
        $pdo->beginTransaction();

        try {
            $buscar = $pdo->prepare(
                'SELECT *,
                    (expira_em < CURRENT_TIMESTAMP) AS expirada
                 FROM clipping_importacoes
                 WHERE token = :token
                   AND assessoria_id = :assessoria_id
                   AND usuario_id = :usuario_id
                 FOR UPDATE'
            );

            $buscar->execute([
                'token' => $token,
                'assessoria_id' => $assessoriaId,
                'usuario_id' => $usuarioId,
            ]);

            $importacao = $buscar->fetch();

            if (!$importacao) {
                throw new \OutOfBoundsException(
                    'Prévia não encontrada.'
                );
            }

            if ($importacao['resultado'] !== null) {
                $resultado = json_decode(
                    $importacao['resultado'],
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );

                if ($resultado['registros_confirmados'] !== $numeros) {
                    throw new \DomainException(
                        'Esta prévia já foi confirmada com outra seleção. Gere uma nova prévia.'
                    );
                }

                $pdo->commit();

                return $resultado;
            }

            if ((int) $importacao['expirada'] === 1) {
                throw new \DomainException(
                    'A prévia expirou. Analise o arquivo novamente.'
                );
            }

            $previa = json_decode(
                $importacao['previa'],
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            $porNumero = [];

            foreach ($previa['linhas'] as $linha) {
                $porNumero[$linha['registro']] = $linha;
            }

            // Valida a seleção inteira antes de gravar.
            foreach ($numeros as $numero) {
                if (
                    !isset($porNumero[$numero])
                    || $porNumero[$numero]['erros'] !== []
                    || $porNumero[$numero]['dados'] === null
                ) {
                    throw new \InvalidArgumentException(
                        "O registro {$numero} não está disponível para importação."
                    );
                }
            }

            $resultados = [];
            $importados = 0;
            $falhas = 0;
            $ignorados = 0;

            foreach ($previa['linhas'] as $linha) {
                $numero = $linha['registro'];

                if (!in_array($numero, $numeros, true)) {
                    $ignorados++;

                    $resultados[] = [
                        'registro' => $numero,
                        'status' => 'ignorado',
                        'clipping_id' => null,
                        'message' => 'Registro não selecionado.',
                    ];

                    continue;
                }

                $pdo->exec('SAVEPOINT clipping_importacao_linha');

                try {
                    // Valida novamente cliente, veículo e todos os campos.
                    // Tier e duração apresentados na prévia são preservados.
                    $clipping = ClippingService::criar(
                        $assessoriaId,
                        $usuarioId,
                        $linha['dados']
                    );

                    $importados++;

                    $resultados[] = [
                        'registro' => $numero,
                        'status' => 'importado',
                        'clipping_id' => (int) $clipping['id'],
                        'message' => 'Clipping importado.',
                    ];
                } catch (
                    \InvalidArgumentException
                    | \DomainException
                    | \OutOfBoundsException $e
                ) {
                    $pdo->exec(
                        'ROLLBACK TO SAVEPOINT clipping_importacao_linha'
                    );

                    $falhas++;

                    $resultados[] = [
                        'registro' => $numero,
                        'status' => 'erro',
                        'clipping_id' => null,
                        'message' => $e->getMessage(),
                    ];
                }

                $pdo->exec(
                    'RELEASE SAVEPOINT clipping_importacao_linha'
                );
            }

            $resultado = [
                'message' => "{$importados} clipping(s) importado(s).",
                'registros_confirmados' => $numeros,
                'resumo' => [
                    'total' => count($previa['linhas']),
                    'importados' => $importados,
                    'erros' => $falhas,
                    'ignorados' => $ignorados,
                ],
                'resultados' => $resultados,
            ];

            $salvar = $pdo->prepare(
                'UPDATE clipping_importacoes
                 SET resultado = :resultado,
                     previa = :previa,
                     confirmado_em = CURRENT_TIMESTAMP
                 WHERE token = :token
                   AND assessoria_id = :assessoria_id
                   AND usuario_id = :usuario_id'
            );

            $salvar->execute([
                'resultado' => self::json($resultado),
                'previa' => self::json(['concluida' => true]),
                'token' => $token,
                'assessoria_id' => $assessoriaId,
                'usuario_id' => $usuarioId,
            ]);

            $pdo->commit();

            return $resultado;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }
}