<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;
use Logos\AssessoriaApi\Models\Clipping;
use Logos\AssessoriaApi\Models\Veiculo;
use InvalidArgumentException;
use OutOfBoundsException;

class ClippingService
{
    private const CAMPOS = [
        'cliente_id',
        'veiculo_id',
        'veiculo_nome_informado',
        'ano_referencia',
        'data_publicacao',
        'categorias',
        'programa_secao',
        'pauta',
        'tier',
        'inicio_segundos',
        'fim_segundos',
        'duracao_segundos',
        'link',
        'observacoes',
    ];

    private static function inteiro(
        mixed $valor,
        string $rotulo,
        int $minimo = 1,
        int $maximo = PHP_INT_MAX,
        bool $opcional = false
    ): ?int {
        if (is_string($valor)) {
            $valor = trim($valor);
        }

        if (
            $opcional
            && ($valor === null || $valor === '')
        ) {
            return null;
        }

        if (
            !is_int($valor)
            && !is_string($valor)
        ) {
            throw new InvalidArgumentException(
                "{$rotulo} inválido."
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
            throw new InvalidArgumentException(
                "{$rotulo} deve estar entre {$minimo} e {$maximo}."
            );
        }

        return $numero;
    }

    private static function texto(
        mixed $valor,
        string $rotulo,
        int $maximo
    ): ?string {
        if ($valor === null) {
            return null;
        }

        if (!is_string($valor)) {
            throw new InvalidArgumentException(
                "{$rotulo} deve ser um texto."
            );
        }

        $valor = trim($valor);

        if ($valor === '') {
            return null;
        }

        if (
            mb_strlen($valor, 'UTF-8') > $maximo
        ) {
            throw new InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $valor;
    }

    private static function data(
        mixed $valor,
        string $rotulo
    ): ?string {
        $texto = self::texto(
            $valor,
            $rotulo,
            10
        );

        if ($texto === null) {
            return null;
        }

        if (
            !preg_match(
                '/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D',
                $texto
            )
        ) {
            throw new InvalidArgumentException(
                "{$rotulo} deve usar o formato AAAA-MM-DD."
            );
        }

        $data = \DateTimeImmutable::createFromFormat(
            '!Y-m-d',
            $texto
        );

        if (
            !$data
            || $data->format('Y-m-d') !== $texto
            || (int) substr($texto, 0, 4) < 1000
        ) {
            throw new InvalidArgumentException(
                "{$rotulo} deve ser uma data válida no formato AAAA-MM-DD."
            );
        }

        return $texto;
    }

    private static function booleano(
        mixed $valor,
        string $rotulo
    ): ?bool {
        if ($valor === null || $valor === '') {
            return null;
        }

        return match ($valor) {
            true, 1, '1', 'true' => true,
            false, 0, '0', 'false' => false,

            default => throw new InvalidArgumentException(
                "{$rotulo} inválido."
            ),
        };
    }

    private static function categorias(
        mixed $valor
    ): ?array {
        if ($valor === null) {
            return null;
        }

        if (
            !is_array($valor)
            || !array_is_list($valor)
            || count($valor) > 20
        ) {
            throw new InvalidArgumentException(
                'Categorias devem ser uma lista com até 20 itens.'
            );
        }

        $resultado = [];
        $vistos = [];

        foreach ($valor as $item) {
            $texto = self::texto(
                $item,
                'Cada categoria',
                80
            );

            if ($texto === null) {
                continue;
            }

            $chave = mb_strtolower(
                $texto,
                'UTF-8'
            );

            if (!isset($vistos[$chave])) {
                $vistos[$chave] = true;
                $resultado[] = $texto;
            }
        }

        return $resultado ?: null;
    }

    private static function paginacao(
        array $dados
    ): array {
        $page = self::inteiro(
            $dados['page'] ?? 1,
            'Página',
            1,
            1000000
        );

        $limit = self::inteiro(
            $dados['limit'] ?? 50,
            'Limite',
            1,
            100
        );

        return [
            'page' => $page,
            'limit' => $limit,
            'offset' => ($page - 1) * $limit,
        ];
    }

    private static function respostaPaginada(
        string $chave,
        array $resultado,
        array $f
    ): array {
        return [
            $chave => $resultado[$chave],

            'pagination' => [
                'page' => $f['page'],
                'limit' => $f['limit'],
                'total' => $resultado['total'],

                'has_next' =>
                    $f['offset']
                        + count($resultado[$chave])
                        < $resultado['total'],
            ],
        ];
    }

    public static function listar(
        int $assessoriaId,
        array $dados
    ): array {
        $f = self::paginacao($dados);

        foreach (
            ['cliente_id', 'veiculo_id'] as $campo
        ) {
            $f[$campo] = self::inteiro(
                $dados[$campo] ?? null,
                $campo,
                1,
                PHP_INT_MAX,
                true
            );
        }

        $f['ano_referencia'] = self::inteiro(
            $dados['ano_referencia'] ?? null,
            'Ano',
            1000,
            9999,
            true
        );

        $f['tier'] = self::inteiro(
            $dados['tier'] ?? null,
            'Tier',
            1,
            3,
            true
        );

        $f['busca'] = self::texto(
            $dados['busca'] ?? null,
            'Busca',
            200
        );

        $f['categoria'] = self::texto(
            $dados['categoria'] ?? null,
            'Categoria',
            80
        );

        $f['data_inicio'] = self::data(
            $dados['data_inicio'] ?? null,
            'Data inicial'
        );

        $f['data_fim'] = self::data(
            $dados['data_fim'] ?? null,
            'Data final'
        );

        foreach (
            [
                'sem_data',
                'tem_link',
                'tem_imagem_relatorio',
            ] as $campo
        ) {
            $f[$campo] = self::booleano(
                $dados[$campo] ?? null,
                $campo
            );
        }

        if (
            $f['sem_data']
            && (
                $f['data_inicio'] !== null
                || $f['data_fim'] !== null
            )
        ) {
            throw new InvalidArgumentException(
                'Sem data não pode ser combinado com um período.'
            );
        }

        if (
            $f['data_inicio'] !== null
            && $f['data_fim'] !== null
            && $f['data_inicio'] > $f['data_fim']
        ) {
            throw new InvalidArgumentException(
                'A data inicial não pode ser posterior à final.'
            );
        }

        $f['veiculo_nome'] = self::texto(
            $dados['veiculo_nome'] ?? null,
            'Nome do veículo',
            150
        );

        $f['programa_secao'] = self::texto(
            $dados['programa_secao'] ?? null,
            'Programa/seção',
            150
        );

        $f['sem_tier'] = self::booleano(
            $dados['sem_tier'] ?? null,
            'Sem Tier'
        );

        if ($f['sem_tier'] && $f['tier'] !== null) {
            throw new InvalidArgumentException(
                'Selecione um Tier ou Sem Tier, não ambos.'
            );
        }

        foreach (['duracao_min', 'duracao_max'] as $campo) {
            $f[$campo] = self::inteiro(
                $dados[$campo] ?? null,
                'Duração',
                0,
                4294967295,
                true
            );
        }

        if (
            $f['duracao_min'] !== null
            && $f['duracao_max'] !== null
            && $f['duracao_min'] > $f['duracao_max']
        ) {
            throw new InvalidArgumentException(
                'A duração mínima não pode superar a máxima.'
            );
        } 

        $f['ordem'] = self::texto(
            $dados['ordem'] ?? 'data',
            'Ordenação',
            10
        );

        $f['direcao'] = strtoupper(
            self::texto(
                $dados['direcao'] ?? 'DESC',
                'Direção',
                4
            ) ?? ''
        );

        if (
            !in_array(
                $f['ordem'],
                ['data', 'veiculo', 'tier'],
                true
            )
            || !in_array(
                $f['direcao'],
                ['ASC', 'DESC'],
                true
            )
        ) {
            throw new InvalidArgumentException(
                'Ordenação inválida.'
            );
        }

        return self::respostaPaginada(
            'clippings',
            Clipping::listar($assessoriaId, $f),
            $f
        );
    }

    public static function buscar(
        mixed $id,
        int $assessoriaId
    ): array {
        $id = self::inteiro(
            $id,
            'ID do clipping'
        );

        $clipping = Clipping::buscarPorId(
            $id,
            $assessoriaId
        );

        if (!$clipping) {
            throw new OutOfBoundsException(
                'Clipping não encontrado.'
            );
        }

        return $clipping;
    }

    public static function anos(
        int $assessoriaId,
        array $filtros = []
    ): array {
        $clienteId = self::inteiro(
            $filtros['cliente_id'] ?? null,
            'Cliente',
            1,
            PHP_INT_MAX,
            true
        );

        $veiculoId = self::inteiro(
            $filtros['veiculo_id'] ?? null,
            'Veículo',
            1,
            PHP_INT_MAX,
            true
        );

        $anoAtual = (int) (
            new \DateTimeImmutable(
                'now',
                new \DateTimeZone('America/Sao_Paulo')
            )
        )->format('Y');

        $anos = Clipping::listarAnos(
            $assessoriaId,
            $clienteId,
            $veiculoId
        );

        $atual = [
            'ano_referencia' => $anoAtual,
            'total_clippings' => 0,
            'total_clientes' => 0,
        ];

        $outros = [];

        foreach ($anos as $ano) {
            $ano = [
                'ano_referencia' => (int) $ano['ano_referencia'],
                'total_clippings' => (int) $ano['total_clippings'],
                'total_clientes' => (int) $ano['total_clientes'],
            ];

            if ($ano['ano_referencia'] === $anoAtual) {
                $atual = $ano;
            } else {
                $outros[] = $ano;
            }
        }

        return [
            'anos' => [
                $atual,
                ...$outros,
            ],
        ];
    }

    public static function clientesPorAno(
        int $assessoriaId,
        mixed $ano,
        array $dados
    ): array {
        $ano = self::inteiro(
            $ano,
            'Ano',
            1000,
            9999
        );

        $f = self::paginacao($dados);

        $f['busca'] = self::texto(
            $dados['busca'] ?? null,
            'Busca',
            200
        );

        foreach (['estado', 'cidade', 'segmento'] as $campo) {
            $f[$campo] = self::texto(
                $dados[$campo] ?? null,
                $campo,
                150
            );
        }

        $f['ativo'] = self::booleano(
            $dados['ativo'] ?? null,
            'Status do cliente'
        );
        return [
            'ano_referencia' => $ano,

            ...self::respostaPaginada(
                'clientes',
                Clipping::clientesPorAno(
                    $assessoriaId,
                    $ano,
                    $f
                ),
                $f
            ),
        ];
    }

    public static function pautas(
        int $assessoriaId,
        array $dados
    ): array {
        $clienteId = self::inteiro(
            $dados['cliente_id'] ?? null,
            'Cliente'
        );

        if (
            !Cliente::buscarPorId(
                $clienteId,
                $assessoriaId
            )
        ) {
            throw new OutOfBoundsException(
                'Cliente não encontrado.'
            );
        }

        $busca = self::texto(
            $dados['busca'] ?? null,
            'Busca',
            200
        );

        $pautas = [];
        $vistos = [];

        foreach (
            Clipping::pautasRecentes(
                $assessoriaId,
                $clienteId,
                $busca
            ) as $pauta
        ) {
            $pauta = trim($pauta);

            $chave = mb_strtolower(
                $pauta,
                'UTF-8'
            );

            if (!isset($vistos[$chave])) {
                $vistos[$chave] = true;
                $pautas[] = $pauta;
            }

            if (count($pautas) === 8) {
                break;
            }
        }

        return [
            'pautas' => $pautas,
        ];
    }

    private static function validarDados(
        int $assessoriaId,
        array $dados,
        ?array $atual,
        bool $clienteEmCriacao = false
    ): array {
        if (
            array_diff(
                array_keys($dados),
                self::CAMPOS
            )
        ) {
            throw new InvalidArgumentException(
                'O cadastro contém campos não permitidos.'
            );
        }

        $base = [];

        foreach (self::CAMPOS as $campo) {
            $base[$campo] = $atual[$campo] ?? null;
        }

        $base = array_replace(
            $base,
            $dados
        );

        $clienteId = null;

        if (!$clienteEmCriacao) {
            $clienteId = self::inteiro(
                $base['cliente_id'],
                'Cliente'
            );

            if (!Cliente::buscarPorId($clienteId, $assessoriaId)) {
                throw new InvalidArgumentException(
                    'Selecione um cliente da sua assessoria.'
                );
            }
        }

        $veiculoId = self::inteiro(
            $base['veiculo_id'],
            'Veículo',
            1,
            PHP_INT_MAX,
            true
        );

        $veiculo = $veiculoId === null
            ? null
            : Veiculo::buscarPorId(
                $veiculoId,
                $assessoriaId
            );

        if ($veiculoId !== null && !$veiculo) {
            throw new InvalidArgumentException(
                'Selecione um veículo da sua assessoria.'
            );
        }

        $data = self::data(
            $base['data_publicacao'],
            'Data da publicação'
        );

        $ano = self::inteiro(
            $base['ano_referencia'],
            'Ano de referência',
            1000,
            9999,
            true
        );

        if ($data !== null) {
            $ano = (int) substr($data, 0, 4);
        }

        if ($ano === null) {
            throw new InvalidArgumentException(
                'Informe o ano de referência quando a data estiver pendente.'
            );
        }

        $tier = $base['tier'];

        $veiculoAnterior =
            isset($atual['veiculo_id'])
                ? (int) $atual['veiculo_id']
                : null;

        if (
            !array_key_exists('tier', $dados)
            && (
                $atual === null
                || $veiculoId !== $veiculoAnterior
            )
        ) {
            $tier = $veiculo['tier'] ?? null;
        }

        $inicio = self::inteiro(
            $base['inicio_segundos'],
            'Início',
            0,
            4294967295,
            true
        );

        $fim = self::inteiro(
            $base['fim_segundos'],
            'Fim',
            0,
            4294967295,
            true
        );

        if (
            $inicio !== null
            && $fim !== null
            && $fim <= $inicio
        ) {
            throw new InvalidArgumentException(
                'O fim do trecho deve ser maior que o início.'
            );
        }

        $duracao = self::inteiro(
            $base['duracao_segundos'],
            'Duração',
            0,
            4294967295,
            true
        );

        if ($inicio !== null && $fim !== null) {
            $duracaoCalculada = $fim - $inicio;

            if (
                array_key_exists('duracao_segundos', $dados)
                && $duracao !== null
                && $duracao !== $duracaoCalculada
            ) {
                throw new InvalidArgumentException(
                    'A duração informada não corresponde à diferença entre início e fim.'
                );
            }

            $duracao = $duracaoCalculada;
        }

        $link = self::texto(
            $base['link'],
            'Link',
            2048
        );

        if (
            $link !== null
            && (
                !filter_var(
                    $link,
                    FILTER_VALIDATE_URL
                )
                || !in_array(
                    strtolower(
                        (string) parse_url(
                            $link,
                            PHP_URL_SCHEME
                        )
                    ),
                    ['http', 'https'],
                    true
                )
            )
        ) {
            throw new InvalidArgumentException(
                'Informe um link completo com http:// ou https://.'
            );
        }

        $veiculoNomeInformado = self::texto(
            $base['veiculo_nome_informado'],
            'Nome informado do veículo',
            150
        );

        if ($veiculoId !== null) {
            // Um vínculo real substitui o nome provisório do CSV.
            $veiculoNomeInformado = null;
        } elseif (
            $atual !== null
            && $atual['veiculo_id'] !== null
            && !array_key_exists('veiculo_nome_informado', $dados)
        ) {
            // Ao remover um vínculo existente, não manter o nome
            // do veículo antigo como se tivesse vindo do CSV.
            $veiculoNomeInformado = null;
        }

        return [
            'cliente_id' => $clienteId,
            'veiculo_id' => $veiculoId,
            'veiculo_nome_informado' => $veiculoNomeInformado,
            'ano_referencia' => $ano,
            'data_publicacao' => $data,

            'categorias' => self::categorias(
                $base['categorias']
            ),

            'programa_secao' => self::texto(
                $base['programa_secao'],
                'Programa/seção',
                150
            ),

            'pauta' => self::texto(
                $base['pauta'],
                'Pauta',
                250
            ),

            'tier' => self::inteiro(
                $tier,
                'Tier',
                1,
                3,
                true
            ),

            'inicio_segundos' => $inicio,
            'fim_segundos' => $fim,

            'duracao_segundos' => $duracao,

            'link' => $link,

            'observacoes' => self::texto(
                $base['observacoes'],
                'Observações',
                1500
            ),
        ];
    }

    private static function transacao(
        callable $acao
    ): array {
        $pdo = Connection::get();

        $propria = !$pdo->inTransaction();

        if ($propria) {
            $pdo->beginTransaction();
        }

        try {
            $resultado = $acao();

            if ($propria) {
                $pdo->commit();
            }

            return $resultado;
        } catch (\Throwable $e) {
            if (
                $propria
                && $pdo->inTransaction()
            ) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function criar(
        int $assessoriaId,
        int $usuarioId,
        array $dados
    ): array {
        $associacao =
        $dados['associar_endereco_veiculo'] ?? null;

        unset($dados['associar_endereco_veiculo']);

        return self::transacao(
            function () use ($assessoriaId, $usuarioId, $dados, $associacao) {
                $campos = self::validarDados(
                    $assessoriaId,
                    $dados,
                    null
                );

                self::associarEnderecoDoClipping(
                    $assessoriaId,
                    $campos,
                    $associacao
                );

                $bloquearCliente = Connection::get()->prepare(
                    "
                        SELECT id
                        FROM clientes
                        WHERE id = :cliente_id
                        AND assessoria_id = :assessoria_id
                        LIMIT 1
                        FOR UPDATE
                    "
                );

                $bloquearCliente->execute([
                    'cliente_id' => $campos['cliente_id'],
                    'assessoria_id' => $assessoriaId,
                ]);

                if (!$bloquearCliente->fetchColumn()) {
                    throw new OutOfBoundsException(
                        'Cliente não encontrado.'
                    );
                }

                $id = Clipping::criar(
                    $assessoriaId,
                    $usuarioId,
                    $campos
                );

                RelatorioService::sincronizarNovoClipping(
                    $assessoriaId,
                    $id
                );

                return self::buscar(
                    $id,
                    $assessoriaId
                );
            }
        );
    }

    public static function atualizar(
        mixed $id,
        int $assessoriaId,
        array $dados
    ): array {
        $id = self::inteiro(
            $id,
            'ID do clipping'
        );
        $associacao =
        $dados['associar_endereco_veiculo'] ?? null;

        unset($dados['associar_endereco_veiculo']);

        return self::transacao(
            function () use (
                $id,
                $assessoriaId,
                $dados,
                $associacao
            ) {
                $atual = Clipping::buscarPorId(
                    $id,
                    $assessoriaId,
                    true
                );

                if (!$atual) {
                    throw new OutOfBoundsException(
                        'Clipping não encontrado.'
                    );
                }

                if (
                    $atual['arquivado_em'] !== null
                ) {
                    throw new \DomainException(
                        'Restaure o clipping antes de editá-lo.'
                    );
                }

                $campos = self::validarDados(
                    $assessoriaId,
                    $dados,
                    $atual
                );

                self::associarEnderecoDoClipping(
                    $assessoriaId,
                    $campos,
                    $associacao
                );

                Clipping::atualizar(
                    $id,
                    $assessoriaId,
                    $campos
                );
                
                RelatorioService::sincronizarNovoClipping(
                    $assessoriaId,
                    $id
                );

                RelatorioService::atualizarRevisoesDoClipping(
                    $assessoriaId,
                    $id
                );
                
                return self::buscar(
                    $id,
                    $assessoriaId
                );
            }
        );
    }

    public static function excluir(
        mixed $id,
        int $assessoriaId
    ): array {
        $id = self::inteiro($id, 'ID do clipping');

        $pdo = Connection::get();
        $pdo->beginTransaction();

        try {
            $anexos = Clipping::excluirComAnexos(
                $id,
                $assessoriaId
            );

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if (
                $e instanceof \PDOException
                && (int) ($e->errorInfo[1] ?? 0) === 1451
            ) {
                throw new \DomainException(
                    'Este clipping ou seus anexos possuem vínculos que impedem a exclusão.',
                    0,
                    $e
                );
            }

            throw $e;
        }

        $limpezaPendente = false;

        foreach ($anexos as $anexo) {
            if (!ArquivoClippingService::remover($anexo)) {
                $limpezaPendente = true;
            }
        }

        return [
            'message' => $limpezaPendente
                ? 'Clipping excluído. A limpeza de alguns arquivos ficou pendente no servidor.'
                : 'Clipping excluído com sucesso.',

            'limpeza_pendente' => $limpezaPendente,
        ];
    }

    public static function excluirEmLote(
        mixed $ids,
        int $assessoriaId
    ): array {
        if (
            !is_array($ids)
            || !array_is_list($ids)
            || count($ids) === 0
            || count($ids) > 100
        ) {
            throw new \InvalidArgumentException(
                'Selecione entre 1 e 100 clippings.'
            );
        }

        $idsValidos = [];

        foreach ($ids as $valor) {
            $id = self::inteiro($valor, 'ID do clipping');

            if (in_array($id, $idsValidos, true)) {
                throw new \InvalidArgumentException(
                    'Há clippings duplicados na seleção.'
                );
            }

            $idsValidos[] = $id;
        }

        $resultados = [];
        $excluidos = 0;
        $limpezaPendente = false;

        foreach ($idsValidos as $id) {
            try {
                $resultado = self::excluir($id, $assessoriaId);

                $excluidos++;

                $limpezaPendente = $limpezaPendente
                    || $resultado['limpeza_pendente'];

                $resultados[] = [
                    'id' => $id,
                    'status' => 'excluido',
                    'message' => $resultado['message'],
                    'limpeza_pendente' => $resultado['limpeza_pendente'],
                ];
            } catch (\OutOfBoundsException $e) {
                $resultados[] = [
                    'id' => $id,
                    'status' => 'nao_encontrado',
                    'message' => 'Clipping não encontrado.',
                    'limpeza_pendente' => false,
                ];
            } catch (\DomainException $e) {
                $resultados[] = [
                    'id' => $id,
                    'status' => 'protegido',
                    'message' => $e->getMessage(),
                    'limpeza_pendente' => false,
                ];
            } catch (\Throwable $e) {
                error_log(
                    "Erro ao excluir clipping {$id} em lote: "
                    . $e->getMessage()
                );

                $resultados[] = [
                    'id' => $id,
                    'status' => 'erro',
                    'message' =>
                        'Não foi possível confirmar a exclusão deste clipping.',
                    'limpeza_pendente' => false,
                ];
            }
        }

        return [
            'message' => "{$excluidos} clipping(s) excluído(s).",
            'excluidos' => $excluidos,
            'nao_excluidos' => count($idsValidos) - $excluidos,
            'limpeza_pendente' => $limpezaPendente,
            'resultados' => $resultados,
        ];
    }
    public static function prepararImportacao(
        int $assessoriaId,
        array $dados,
        bool $clienteEmCriacao = false
    ): array {
        return self::validarDados(
            $assessoriaId,
            $dados,
            null,
            $clienteEmCriacao
        );
    }
    private static function associarEnderecoDoClipping(
        int $assessoriaId,
        array $campos,
        mixed $associacao
    ): void {
        if ($associacao === null) {
            return;
        }

        if (
            !is_array($associacao) ||
            !is_string($associacao['host'] ?? null) ||
            !isset($campos['veiculo_id']) ||
            !$campos['link']
        ) {
            throw new \InvalidArgumentException(
                'A associação do endereço é inválida.'
            );
        }

        $usuario = AuthContext::get();

        if (
            !$usuario ||
            !PermissaoService::usuarioTemPermissao(
                (int) $usuario->sub,
                (string) $usuario->perfil,
                'VEICULOS',
                'EDITAR'
            )
        ) {
            throw new \LogicException(
                'Você não possui permissão para associar o endereço ao veículo.'
            );
        }

        $host = strtolower(trim($associacao['host']));
        $hostLink = strtolower(
            (string) parse_url($campos['link'], PHP_URL_HOST)
        );
        $prefixo = $associacao['caminho_prefixo'] ?? '';

        if (!is_string($prefixo)) {
            throw new \InvalidArgumentException(
                'A seção do endereço é inválida.'
            );
        }

        $semWww = static fn(string $valor): string =>
            preg_replace('/^www\./', '', $valor);

        $caminho = (string) (
            parse_url($campos['link'], PHP_URL_PATH) ?: '/'
        );

        $ehCanalYoutube =
            $host === 'youtube.com' &&
            ExtracaoLinkService::ehVideoYoutube(
                (string) $campos['link']
            ) &&
            preg_match(
                '~^/(?:channel/UC[A-Za-z0-9_-]{22}|@[\pL\pN._-]{1,100}|user/[A-Za-z0-9._-]{1,100}|c/[A-Za-z0-9._-]{1,100})$~uD',
                $prefixo
            ) === 1 &&
            ($associacao['incluir_subdominios'] ?? false) === false;

        if (
            filter_var(
                $host,
                FILTER_VALIDATE_DOMAIN,
                FILTER_FLAG_HOSTNAME
            ) === false
        ) {
            throw new \InvalidArgumentException(
                'O domínio sugerido é inválido.'
            );
        }

        if (
            in_array(
                $semWww($host),
                ['youtube.com', 'youtu.be', 'instagram.com'],
                true
            ) &&
            !$ehCanalYoutube
        ) {
            throw new \InvalidArgumentException(
                'Associe o canal ou perfil, não a plataforma inteira.'
            );
        }

        if (!$ehCanalYoutube) {
            if ($semWww($host) !== $semWww($hostLink)) {
                throw new \InvalidArgumentException(
                    'O domínio sugerido não corresponde ao link do clipping.'
                );
            }

            if (
                $prefixo !== '' &&
                $caminho !== $prefixo &&
                !str_starts_with(
                    $caminho,
                    rtrim($prefixo, '/') . '/'
                )
            ) {
                throw new \InvalidArgumentException(
                    'A seção não corresponde ao link do clipping.'
                );
            }
        }
        
        $veiculoId = (int) $campos['veiculo_id'];

        VeiculoEnderecoService::alterarDiretamente(
            $assessoriaId,
            $veiculoId,
            function () use (
                $assessoriaId,
                $veiculoId,
                $host,
                $prefixo,
                $associacao
            ): void {
                $stmt = Connection::get()->prepare("
                    SELECT veiculo_id
                    FROM veiculo_enderecos
                    WHERE assessoria_id = :assessoria_id
                    AND host = :host
                    AND caminho_prefixo = :prefixo
                    FOR UPDATE
                ");

                $stmt->execute([
                    'assessoria_id' => $assessoriaId,
                    'host' => $host,
                    'prefixo' => $prefixo,
                ]);

                $dono = $stmt->fetchColumn();

                if ($dono !== false) {
                    if ((int) $dono !== $veiculoId) {
                        throw new \DomainException(
                            'Este endereço já pertence a outro veículo.'
                        );
                    }

                    return;
                }

                VeiculoEnderecoService::adicionar(
                    $assessoriaId,
                    $veiculoId,
                    [
                        'host' => $host,
                        'caminho_prefixo' => $prefixo,
                        'incluir_subdominios' =>
                            $associacao[
                                'incluir_subdominios'
                            ] ?? false,
                    ]
                );
            }
        );
    }
}