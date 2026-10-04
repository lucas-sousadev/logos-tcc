<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;
use Logos\AssessoriaApi\Models\Veiculo;

class ClippingImportacaoService
{
    private static function podeCriarClientes(int $usuarioId): bool
    {
        $usuario = AuthContext::get();

        return $usuario !== null
            && (int) $usuario->sub === $usuarioId
            && PermissaoService::usuarioTemPermissao(
                $usuarioId,
                (string) $usuario->perfil,
                'CLIENTES',
                'CRIAR'
            );
    }

    private static function podeCriarVeiculos(int $usuarioId): bool
    {
        $usuario = AuthContext::get();

        return $usuario !== null
            && (int) $usuario->sub === $usuarioId
            && PermissaoService::usuarioTemPermissao(
                $usuarioId,
                (string) $usuario->perfil,
                'VEICULOS',
                'CRIAR'
            );
    }

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

    private static function resolucoesClientes(
        mixed $json,
        int $assessoriaId
    ): array {
        if (!is_string($json)) {
            throw new \InvalidArgumentException('As associações de clientes são inválidas.');
        }

        try {
            $lista = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new \InvalidArgumentException('As associações de clientes são inválidas.');
        }

        if (!is_array($lista) || !array_is_list($lista) || count($lista) > 1000) {
            throw new \InvalidArgumentException('As associações de clientes são inválidas.');
        }

        $resultado = [];

        foreach ($lista as $item) {
            if (
                !is_array($item)
                || !is_string($item['nome'] ?? null)
                || trim($item['nome']) === ''
                || !array_key_exists('cliente_id', $item)
            ) {
                throw new \InvalidArgumentException('Informe o nome do CSV e o cliente escolhido.');
            }

            $chave = self::nome($item['nome']);

            if (array_key_exists($chave, $resultado)) {
                throw new \InvalidArgumentException('Há associações repetidas para o mesmo cliente.');
            }

            $id = $item['cliente_id'] === null
                ? null
                : ClippingImportacaoCsv::inteiro($item['cliente_id'], 'Cliente');

            if ($id !== null && !Cliente::buscarPorId($id, $assessoriaId)) {
                throw new \InvalidArgumentException('Selecione um cliente da sua assessoria.');
            }

            $resultado[$chave] = $id;
        }

        return $resultado;
    }

    private static function converter(
        array $originais,
        ?int $clienteId,
        int $anoContexto,
        array &$avisos,
        array &$avisosLink
    ): array {
        [$data, $ano] = ClippingImportacaoData::interpretar(
            $originais,
            $anoContexto,
            $avisos
        );

        if ($ano !== $anoContexto) {
            $avisos[] =
                "Esse clipping será organizado no ano {$ano}.";
        }

        $link = trim((string) ($originais['link'] ?? ''));

        if ($link !== '') {
            $esquema = strtolower(
                (string) parse_url($link, PHP_URL_SCHEME)
            );

            if (
                mb_strlen($link, 'UTF-8') > 2048
                || filter_var($link, FILTER_VALIDATE_URL) === false
                || !in_array($esquema, ['http', 'https'], true)
            ) {
                $avisosLink[] = [
                    'tipo' => 'invalido',
                    'mensagem' => 'O link do CSV é inválido e será ignorado. Os demais dados desta publicação poderão ser importados.',
                ];

                $link = '';
            }
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
            'link' => $link === '' ? null : $link,
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
        $clienteId = isset($entrada['cliente_id']) && $entrada['cliente_id'] !== ''
            ? ClippingImportacaoCsv::inteiro($entrada['cliente_id'], 'Cliente')
            : null;

        $ano = ClippingImportacaoCsv::inteiro(
            $entrada['ano_referencia'] ?? null,
            'Ano',
            1000,
            9999
        );

        $cliente = $clienteId === null
            ? null
            : Cliente::buscarPorId($clienteId, $assessoriaId);

        if ($clienteId !== null && !$cliente) {
            throw new \OutOfBoundsException(
                'Cliente não encontrado.'
            );
        }

        $mapeamentoManual = null;

        if (array_key_exists('mapeamento', $entrada)) {
            try {
                $mapeamentoManual = json_decode(
                    (string) $entrada['mapeamento'],
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );
            } catch (\JsonException) {
                throw new \InvalidArgumentException(
                    'O mapeamento de colunas é inválido.'
                );
            }

            if (
                !is_array($mapeamentoManual)
                || !array_is_list($mapeamentoManual)
            ) {
                throw new \InvalidArgumentException(
                    'O mapeamento de colunas é inválido.'
                );
            }
        }

        $linhaCabecalho = null;

        if (
            isset($entrada['linha_cabecalho'])
            && $entrada['linha_cabecalho'] !== ''
        ) {
            $linhaCabecalho = ClippingImportacaoCsv::inteiro(
                $entrada['linha_cabecalho'],
                'Linha do cabeçalho',
                1,
                20
            );
        }

        $csv = ClippingImportacaoCsv::ler(
            $upload,
            $mapeamentoManual,
            $linhaCabecalho
        );

        $resolucoes = self::resolucoes(
            $entrada['veiculos'] ?? '[]',
            $assessoriaId
        );

        $resolucoesClientes = self::resolucoesClientes(
            $entrada['clientes'] ?? '[]',
            $assessoriaId
        );

        $pdo = Connection::get();

        $buscarClientes = $pdo->prepare(
            'SELECT id, nome FROM clientes WHERE assessoria_id = :assessoria_id'
        );
        $buscarClientes->execute(['assessoria_id' => $assessoriaId]);
        $clientesPorNome = [];
        $clientesPorId = [];

        foreach ($buscarClientes->fetchAll(\PDO::FETCH_ASSOC) as $cadastrado) {
            $clientesPorNome[self::nome($cadastrado['nome'])][] = $cadastrado;
            $clientesPorId[(int) $cadastrado['id']] = $cadastrado['nome'];
        }

        $buscarVeiculo = $pdo->prepare(
            'SELECT id
             FROM veiculos
             WHERE assessoria_id = :assessoria_id
               AND LOWER(TRIM(nome)) = :nome
             LIMIT 2'
        );

        $buscarLink = $pdo->prepare(
            'SELECT id, ano_referencia, arquivado_em
            FROM clippings
            WHERE assessoria_id = :assessoria_id
            AND cliente_id = :cliente_id
            AND BINARY TRIM(link) = BINARY :link
            ORDER BY id DESC
            LIMIT 1'
        );

        $cacheVeiculos = [];
        $cacheLinks = [];
        $linksArquivo = [];
        $pendentes = [];
        $clientesPendentes = [];
        $clientesAmbiguos = [];
        $clientesExistentes = [];
        $linhas = [];

        $podeCriarVeiculos = self::podeCriarVeiculos($usuarioId);
        $podeCriarClientes = self::podeCriarClientes($usuarioId);

        foreach ($csv['registros'] as $registro) {
            $originais = $registro['originais'];

            $linha = [
                'registro' => $registro['registro'],
                'originais' => $originais,
                'dados' => null,
                'cliente_nome' => null,
                'cliente_para_criar' => null,
                'veiculo_nome' => null,
                'erros' => [],
                'avisos' => [],
                'veiculo_para_criar' => null,
                'avisos_link' => [],
            ];

            try {
                if ($registro['erro'] !== null) {
                    throw new \InvalidArgumentException(
                        $registro['erro']
                    );
                }

                $nomeCliente = trim((string) ($originais['cliente'] ?? ''));
                $clienteLinhaId = null;

                if ($nomeCliente === '') {
                    if ($cliente === null) {
                        throw new \InvalidArgumentException(
                            'Informe o cliente nesta linha ou importe pela tela de um cliente.'
                        );
                    }

                    $nomeCliente = $cliente['nome'];
                    $clienteLinhaId = (int) $cliente['id'];
                } else {
                    $nomeCliente = trim(preg_replace('/\s+/u', ' ', $nomeCliente) ?? $nomeCliente);

                    if (mb_strlen($nomeCliente, 'UTF-8') > 150) {
                        throw new \InvalidArgumentException(
                            'O nome do cliente deve possuir no máximo 150 caracteres.'
                        );
                    }

                    $chaveCliente = self::nome($nomeCliente);
                    $encontrados = $clientesPorNome[$chaveCliente] ?? [];

                    if ($encontrados !== []) {
                        $clientesExistentes[$chaveCliente] = $nomeCliente;
                    }

                    if (array_key_exists($chaveCliente, $resolucoesClientes)) {
                        $clienteLinhaId = $resolucoesClientes[$chaveCliente];

                        if ($clienteLinhaId === null && count($encontrados) > 0) {
                            throw new \InvalidArgumentException(
                                "O cliente '{$nomeCliente}' já existe. Associe-o ao cadastro."
                            );
                        }
                    } elseif (count($encontrados) === 1) {
                        $clienteLinhaId = (int) $encontrados[0]['id'];
                    } elseif (count($encontrados) > 1) {
                        $clientesPendentes[$chaveCliente] = $nomeCliente;
                        $clientesAmbiguos[$chaveCliente] = $nomeCliente;
                        throw new \InvalidArgumentException(
                            "Há mais de um cliente chamado '{$nomeCliente}'. Escolha o cadastro na revisão."
                        );
                    }

                    if ($clienteLinhaId === null) {
                        $clientesPendentes[$chaveCliente] = $nomeCliente;

                        if (!$podeCriarClientes) {
                            throw new \InvalidArgumentException(
                                "O cliente '{$nomeCliente}' não existe. Associe-o antes de importar; você não tem permissão para criá-lo."
                            );
                        }

                        $linha['cliente_para_criar'] = $nomeCliente;
                        $linha['avisos'][] =
                            "Cliente '{$nomeCliente}' será criado ao confirmar a importação.";
                    }
                }

                $linha['cliente_nome'] = $clienteLinhaId !== null
                    ? ($clientesPorId[$clienteLinhaId] ?? $nomeCliente)
                    : $nomeCliente;

                $nomeVeiculo = $originais['veiculo'] ?? '';
                $linha['veiculo_nome'] =
                    $nomeVeiculo !== '' ? $nomeVeiculo : null;

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

                            if ($podeCriarVeiculos) {
                                $linha['veiculo_para_criar'] = $nomeVeiculo;
                                $linha['avisos'][] =
                                    "Veículo '{$nomeVeiculo}' será criado ao confirmar a importação.";
                            } else {
                                $linha['avisos'][] =
                                    "Veículo '{$nomeVeiculo}' não existe. O clipping será importado com o vínculo pendente e o nome informado será preservado.";
                            }
                        }
                    }
                }

                $dados = self::converter(
                    $originais,
                    $clienteLinhaId,
                    $ano,
                    $linha['avisos'],
                    $linha['avisos_link']
                );

                $dados['veiculo_id'] = $veiculoId;
                $dados['veiculo_nome_informado'] =
                    $veiculoId === null && $nomeVeiculo !== ''
                        ? $nomeVeiculo
                        : null;

                $campos = ClippingService::prepararImportacao(
                    $assessoriaId,
                    $dados,
                    $clienteLinhaId === null
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
                    $chaveLink = ($clienteLinhaId === null
                        ? 'nome:' . self::nome($nomeCliente)
                        : 'id:' . $clienteLinhaId) . "\0" . $link;
                    $linksArquivo[$chaveLink] =
                        ($linksArquivo[$chaveLink] ?? 0) + 1;

                    if ($clienteLinhaId !== null && !array_key_exists($chaveLink, $cacheLinks)) {
                        $buscarLink->execute([
                            'assessoria_id' => $assessoriaId,
                            'cliente_id' => $clienteLinhaId,
                            'link' => $link,
                        ]);

                        $cacheLinks[$chaveLink] =
                            $buscarLink->fetch(\PDO::FETCH_ASSOC) ?: null;
                    }

                    $existente = $cacheLinks[$chaveLink] ?? null;

                    if ($existente !== null) {
                        $mensagem = 'Link já cadastrado no clipping #'
                            . (int) $existente['id']
                            . ' (ano '
                            . (int) $existente['ano_referencia']
                            . ')';

                        if ($existente['arquivado_em'] !== null) {
                            $mensagem .= ', arquivado';
                        }

                        $linha['avisos_link'][] = [
                            'tipo' => 'cadastrado',
                            'mensagem' => $mensagem . '.',
                        ];
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
            $chaveLink = $link === null ? null : (
                $linha['dados']['cliente_id'] === null
                    ? 'nome:' . self::nome($linha['cliente_nome'] ?? '')
                    : 'id:' . $linha['dados']['cliente_id']
            ) . "\0" . $link;

            if (
                $chaveLink !== null
                && ($linksArquivo[$chaveLink] ?? 0) > 1
            ) {
                $linha['avisos_link'][] = [
                    'tipo' => 'no_csv',
                    'mensagem' => 'O mesmo link aparece em mais de uma linha deste CSV para este cliente.',
                ];
            }
        }

        unset($linha);

        $previa = [
            'cliente_id' => $clienteId,
            'cliente_nome' => $cliente['nome'] ?? null,
            'ano_referencia' => $ano,
            'colunas' => $csv['colunas'],
            'ignoradas' => $csv['ignoradas'],
            'pode_criar_veiculos' => $podeCriarVeiculos,
            'pode_criar_clientes' => $podeCriarClientes,
            'clientes_pendentes' => array_values($clientesPendentes),
            'clientes_ambiguos' => array_values($clientesAmbiguos),
            'clientes_existentes' => array_values($clientesExistentes),
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
                    fn(array $item) =>
                        $item['erros'] === []
                        && $item['dados'] !== null
                        && (
                            $item['avisos'] !== []
                            || $item['avisos_link'] !== []
                        )
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
            $clientesResolvidos = [];
            $clientesCriados = [];
            $veiculosResolvidos = [];
            $veiculosCriados = [];
            $vinculosPendentes = 0;

            foreach ($previa['linhas'] as $linha) {
                $porNumero[$linha['registro']] = $linha;
            }

            // valida a seleção inteira antes de gravar
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
            
            
            $podeCriarVeiculos = self::podeCriarVeiculos($usuarioId);
            $podeCriarClientes = self::podeCriarClientes($usuarioId);

            foreach ($numeros as $numero) {
                if (
                    !empty($porNumero[$numero]['veiculo_para_criar'])
                    && !$podeCriarVeiculos
                ) {
                    throw new \DomainException(
                        'Sua permissão para criar veículos mudou. Analise o CSV novamente para importar esses clippings com vínculo pendente.'
                    );
                }

                if (
                    !empty($porNumero[$numero]['cliente_para_criar'])
                    && !$podeCriarClientes
                ) {
                    throw new \DomainException(
                        'Sua permissão para criar clientes mudou. Atualize a prévia antes de importar.'
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
                        'cliente_nome' => $linha['cliente_nome'] ?? $linha['originais']['cliente'] ?? null,
                        'status' => 'ignorado',
                        'clipping_id' => null,
                        'message' => 'Registro não selecionado.',
                    ];

                    continue;
                }

                $pdo->exec('SAVEPOINT clipping_importacao_linha');

                try {
                    // valida novamente cliente, veículo e todos os campos
                    // tier e duração apresentados na prévia são preservados
                    $dadosLinha = $linha['dados'];
                    $clienteParaCriar = $linha['cliente_para_criar'] ?? null;
                    $clienteCriadoNestaLinha = null;
                    $chaveCliente = null;

                    if (is_string($clienteParaCriar) && trim($clienteParaCriar) !== '') {
                        $nomeNormalizado = trim(
                            preg_replace('/\s+/u', ' ', $clienteParaCriar)
                            ?? $clienteParaCriar
                        );
                        $chaveCliente = self::nome($nomeNormalizado);

                        if (isset($clientesResolvidos[$chaveCliente])) {
                            $dadosLinha['cliente_id'] = $clientesResolvidos[$chaveCliente];
                        } else {
                            $buscarExistente = $pdo->prepare(
                                'SELECT id, nome FROM clientes
                                 WHERE assessoria_id = :assessoria_id
                                   AND LOWER(TRIM(nome)) = :nome
                                 LIMIT 2'
                            );
                            $buscarExistente->execute([
                                'assessoria_id' => $assessoriaId,
                                'nome' => $chaveCliente,
                            ]);
                            $existentes = $buscarExistente->fetchAll(\PDO::FETCH_ASSOC);

                            if (count($existentes) > 1) {
                                throw new \InvalidArgumentException(
                                    "Há mais de um cliente chamado '{$nomeNormalizado}'. Atualize a prévia."
                                );
                            }

                            if (count($existentes) === 1) {
                                $dadosLinha['cliente_id'] = (int) $existentes[0]['id'];
                            } else {
                                $criado = ClienteService::criar(
                                    $assessoriaId,
                                    ['nome' => $nomeNormalizado]
                                );
                                $dadosLinha['cliente_id'] = (int) $criado['id'];
                                $clienteCriadoNestaLinha = [
                                    'id' => (int) $criado['id'],
                                    'nome' => $criado['nome'],
                                ];
                            }
                        }
                    }

                    $nomeParaCriar = $linha['veiculo_para_criar'] ?? null;
                    $veiculoCriadoNestaLinha = null;
                    $chaveVeiculo = null;

                    if (
                        is_string($nomeParaCriar)
                        && trim($nomeParaCriar) !== ''
                    ) {
                        $nomeNormalizado = VeiculoService::normalizarNome(
                            preg_replace(
                                '/\s+/u',
                                ' ',
                                trim($nomeParaCriar)
                            ) ?? trim($nomeParaCriar)
                        );

                        $chaveVeiculo = self::nome($nomeNormalizado);

                        if (isset($veiculosResolvidos[$chaveVeiculo])) {
                            $dadosLinha['veiculo_id'] =
                                $veiculosResolvidos[$chaveVeiculo];
                        } else {
                            $existente = Veiculo::buscarPorNome(
                                $nomeNormalizado,
                                $assessoriaId
                            );

                            if ($existente) {
                                $dadosLinha['veiculo_id'] =
                                    (int) $existente['id'];
                            } else {
                                try {
                                    $dadosLinha['veiculo_id'] = Veiculo::criar(
                                        $assessoriaId,
                                        $nomeNormalizado,
                                        null,
                                        null,
                                        null,
                                        true
                                    );

                                    $veiculoCriadoNestaLinha = [
                                        'id' => (int) $dadosLinha['veiculo_id'],
                                        'nome' => $nomeNormalizado,
                                    ];
                                } catch (\PDOException $e) {
                                    if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                                        throw $e;
                                    }

                                    $existente = Veiculo::buscarPorNome(
                                        $nomeNormalizado,
                                        $assessoriaId
                                    );

                                    if (!$existente) {
                                        throw $e;
                                    }

                                    $dadosLinha['veiculo_id'] =
                                        (int) $existente['id'];
                                }
                            }
                        }
                    }

                    $clipping = ClippingService::criar(
                        $assessoriaId,
                        $usuarioId,
                        $dadosLinha
                    );

                    if ($chaveCliente !== null) {
                        $clientesResolvidos[$chaveCliente] =
                            (int) $dadosLinha['cliente_id'];
                    }

                    if ($clienteCriadoNestaLinha !== null) {
                        $clientesCriados[$chaveCliente] = $clienteCriadoNestaLinha;
                    }

                    // Só guardar no controle após o clipping também ter sido salvo.
                    // Se a linha falhar, o SAVEPOINT desfaz o veículo recém-criado.
                    if ($chaveVeiculo !== null) {
                        $veiculosResolvidos[$chaveVeiculo] =
                            (int) $dadosLinha['veiculo_id'];
                    }

                    if ($veiculoCriadoNestaLinha !== null) {
                        $veiculosCriados[$chaveVeiculo] =
                            $veiculoCriadoNestaLinha;
                    }

                    if (
                        $clipping['veiculo_id'] === null
                        && $clipping['veiculo_nome_informado'] !== null
                    ) {
                        $vinculosPendentes++;
                    }

                    $importados++;

                    $resultados[] = [
                        'registro' => $numero,
                        'cliente_nome' => $linha['cliente_nome'],
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
                        'cliente_nome' => $linha['cliente_nome'] ?? $linha['originais']['cliente'] ?? null,
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
                    'veiculos_criados' => count($veiculosCriados),
                    'clientes_criados' => count($clientesCriados),
                    'vinculos_pendentes' => $vinculosPendentes,
                ],
                'veiculos_criados' => array_values($veiculosCriados),
                'clientes_criados' => array_values($clientesCriados),
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