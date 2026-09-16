<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;
use PDO;
use PDOStatement;

class Clipping
{
    private const CAMPOS = [
        'cliente_id',
        'veiculo_id',
        'ano_referencia',
        'data_publicacao',
        'categorias',
        'programa_secao',
        'pauta',
        'tier',
        'inicio_segundos',
        'fim_segundos',
        'link',
        'observacoes',
        'duracao_segundos',
    ];

    private const FROM = "
        FROM clippings c

        INNER JOIN clientes cl
            ON cl.id = c.cliente_id
            AND cl.assessoria_id = c.assessoria_id

        LEFT JOIN veiculos v
            ON v.id = c.veiculo_id
            AND v.assessoria_id = c.assessoria_id
    ";

    private const SELECT = "
        SELECT
            c.*,
            cl.nome AS cliente_nome,
            v.nome AS veiculo_nome,
            v.descricao AS veiculo_descricao,
            v.alcance AS veiculo_alcance,
            v.logo_path AS veiculo_logo_path,

            (
                SELECT COUNT(*)
                FROM clipping_anexos a
                WHERE
                    a.clipping_id = c.id
                    AND a.assessoria_id = c.assessoria_id
            ) AS total_anexos
    ";

    private static function consultar(
        string $sql,
        array $params = []
    ): PDOStatement {
        $stmt = Connection::get()->prepare($sql);

        foreach ($params as $nome => $valor) {
            $tipo = $valor === null
                ? PDO::PARAM_NULL
                : (
                    is_int($valor)
                        ? PDO::PARAM_INT
                        : PDO::PARAM_STR
                );

            $stmt->bindValue(
                ':' . $nome,
                $valor,
                $tipo
            );
        }

        $stmt->execute();

        return $stmt;
    }

    private static function prepararResposta(
        array $registro
    ): array {
        $registro['categorias'] =
            $registro['categorias'] === null
                ? []
                : json_decode(
                    $registro['categorias'],
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );

        return $registro;
    }

    private static function termoBusca(
        string $texto
    ): string {
        return '%' . strtr(
            $texto,
            [
                '!' => '!!',
                '%' => '!%',
                '_' => '!_',
            ]
        ) . '%';
    }

    public static function buscarPorId(
        int $id,
        int $assessoriaId,
        bool $bloquear = false
    ): ?array {
        $sql = self::SELECT . self::FROM . "
            WHERE
                c.id = :id
                AND c.assessoria_id = :assessoria_id
            LIMIT 1
        ";

        if ($bloquear) {
            $sql .= ' FOR UPDATE';
        }

        $registro = self::consultar(
            $sql,
            [
                'id' => $id,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetch();

        return $registro
            ? self::prepararResposta($registro)
            : null;
    }

    private static function valores(
        array $dados
    ): array {
        $valores = [];

        foreach (self::CAMPOS as $campo) {
            $valores[$campo] = $dados[$campo];
        }

        $valores['categorias'] =
            $dados['categorias'] === null
                ? null
                : json_encode(
                    $dados['categorias'],
                    JSON_UNESCAPED_UNICODE
                        | JSON_THROW_ON_ERROR
                );

        return $valores;
    }

    public static function criar(
        int $assessoriaId,
        int $usuarioId,
        array $dados
    ): int {
        $valores = self::valores($dados);

        $valores['assessoria_id'] = $assessoriaId;
        $valores['criado_por'] = $usuarioId;

        $colunas = implode(
            ', ',
            array_keys($valores)
        );

        $marcadores = ':' . implode(
            ', :',
            array_keys($valores)
        );

        self::consultar(
            "
                INSERT INTO clippings ({$colunas})
                VALUES ({$marcadores})
            ",
            $valores
        );

        return (int) Connection::get()->lastInsertId();
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        array $dados
    ): void {
        $valores = self::valores($dados);

        $atribuicoes = implode(
            ', ',
            array_map(
                fn(string $campo) =>
                    "{$campo} = :{$campo}",
                self::CAMPOS
            )
        );

        self::consultar(
            "
                UPDATE clippings
                SET {$atribuicoes}
                WHERE
                    id = :id
                    AND assessoria_id = :assessoria_id
            ",
            $valores + [
                'id' => $id,
                'assessoria_id' => $assessoriaId,
            ]
        );
    }

    public static function listar(
        int $assessoriaId,
        array $f
    ): array {
        $where = [
            'c.assessoria_id = :assessoria_id',
            'c.arquivado_em IS NULL',
        ];

        $params = [
            'assessoria_id' => $assessoriaId,
        ];

        foreach (
            [
                'cliente_id',
                'ano_referencia',
                'veiculo_id',
                'tier',
            ] as $campo
        ) {
            if ($f[$campo] !== null) {
                $where[] = "c.{$campo} = :{$campo}";
                $params[$campo] = $f[$campo];
            }
        }

        if ($f['sem_data']) {
            $where[] = 'c.data_publicacao IS NULL';
        }

        foreach (
            [
                'data_inicio' => '>=',
                'data_fim' => '<=',
            ] as $campo => $operador
        ) {
            if ($f[$campo] !== null) {
                $where[] =
                    "c.data_publicacao {$operador} :{$campo}";

                $params[$campo] = $f[$campo];
            }
        }

        if ($f['categoria'] !== null) {
            $where[] = "
                JSON_SEARCH(
                    LOWER(c.categorias),
                    'one',
                    :categoria,
                    '!'
                ) IS NOT NULL
            ";

            $params['categoria'] = mb_strtolower(
                self::termoBusca($f['categoria']),
                'UTF-8'
            );
        }

        if ($f['tem_link'] !== null) {
            $where[] = $f['tem_link']
                ? "(c.link IS NOT NULL AND c.link <> '')"
                : "(c.link IS NULL OR c.link = '')";
        }

        if ($f['tem_imagem_relatorio'] !== null) {
            $existe = "
                EXISTS (
                    SELECT 1
                    FROM clipping_anexos a
                    WHERE
                        a.clipping_id = c.id
                        AND a.assessoria_id = c.assessoria_id
                        AND a.imagem_relatorio = 1
                )
            ";

            $where[] = $f['tem_imagem_relatorio']
                ? $existe
                : "NOT {$existe}";
        }

        if ($f['busca'] !== null) {
            $where[] = "
                (
                    CONVERT(
                        CONCAT_WS(
                            ' ',
                            c.pauta,
                            v.nome,
                            c.programa_secao,
                            c.categorias,
                            CONCAT('Tier ', c.tier),
                            c.link,
                            c.observacoes,
                            c.data_publicacao,
                            DATE_FORMAT(
                                c.data_publicacao,
                                '%d/%m/%Y'
                            )
                        )
                        USING utf8mb4
                    ) COLLATE utf8mb4_unicode_ci
                        LIKE
                    CONVERT(:busca USING utf8mb4)
                        COLLATE utf8mb4_unicode_ci
                        ESCAPE '!'

                    OR EXISTS (
                        SELECT 1
                        FROM clipping_anexos a
                        WHERE
                            a.clipping_id = c.id
                            AND a.assessoria_id = c.assessoria_id
                            AND CONVERT(
                                a.nome_original USING utf8mb4
                            ) COLLATE utf8mb4_unicode_ci
                                LIKE
                            CONVERT(:busca_anexo USING utf8mb4)
                                COLLATE utf8mb4_unicode_ci
                                ESCAPE '!'
                    )
                )
            ";

            $params['busca'] =
                self::termoBusca($f['busca']);

            $params['busca_anexo'] = $params['busca'];
        }

        foreach (
            [
                'veiculo_nome' => 'v.nome',
                'programa_secao' => 'c.programa_secao',
            ] as $campo => $coluna
        ) {
            if ($f[$campo] !== null) {
                $where[] = "
                    CONVERT({$coluna} USING utf8mb4)
                        COLLATE utf8mb4_unicode_ci
                    LIKE
                    CONVERT(:{$campo} USING utf8mb4)
                        COLLATE utf8mb4_unicode_ci
                    ESCAPE '!'
                ";

                $params[$campo] = self::termoBusca($f[$campo]);
            }
        }

        if ($f['sem_tier']) {
            $where[] = 'c.tier IS NULL';
        }

        if ($f['duracao_min'] !== null) {
            // Somente mínimo: maior que.
            // Com os dois limites: intervalo inclusivo.
            $operador = $f['duracao_max'] === null ? '>' : '>=';

            $where[] = "c.duracao_segundos {$operador} :duracao_min";
            $params['duracao_min'] = $f['duracao_min'];
        }

        if ($f['duracao_max'] !== null) {
            $where[] = 'c.duracao_segundos <= :duracao_max';
            $params['duracao_max'] = $f['duracao_max'];
        }

        $whereSql =
            ' WHERE ' . implode(' AND ', $where);

        $coluna = match ($f['ordem']) {
            'veiculo' => 'v.nome',
            'tier' => 'c.tier',
            default => 'c.data_publicacao',
        };

        $direcao = $f['direcao'] === 'ASC'
            ? 'ASC'
            : 'DESC';

        $total = (int) self::consultar(
            'SELECT COUNT(*) '
                . self::FROM
                . $whereSql,
            $params
        )->fetchColumn();

        $registros = self::consultar(
            self::SELECT
                . self::FROM
                . $whereSql
                . "
                    ORDER BY
                        {$coluna} IS NULL,
                        {$coluna} {$direcao},
                        c.id {$direcao}

                    LIMIT :limit
                    OFFSET :offset
                ",
            $params + [
                'limit' => $f['limit'],
                'offset' => $f['offset'],
            ]
        )->fetchAll();

        return [
            'clippings' => array_map(
                [self::class, 'prepararResposta'],
                $registros
            ),
            'total' => $total,
        ];
    }

    public static function listarAnos(
        int $assessoriaId
    ): array {
        return self::consultar(
            "
                SELECT
                    ano_referencia,
                    COUNT(*) AS total_clippings,
                    COUNT(DISTINCT cliente_id) AS total_clientes

                FROM clippings

                WHERE
                    assessoria_id = :assessoria_id
                    AND arquivado_em IS NULL

                GROUP BY ano_referencia
                ORDER BY ano_referencia DESC
            ",
            [
                'assessoria_id' => $assessoriaId,
            ]
        )->fetchAll();
    }

    public static function clientesPorAno(
        int $assessoriaId,
        int $ano,
        array $f
    ): array {
        $from = "
            FROM clientes cl

            LEFT JOIN (
                SELECT
                    cliente_id,
                    COUNT(*) AS total_clippings

                FROM clippings

                WHERE
                    assessoria_id = :assessoria_clippings
                    AND ano_referencia = :ano
                    AND arquivado_em IS NULL

                GROUP BY cliente_id
            ) resumo ON resumo.cliente_id = cl.id

            WHERE
                cl.assessoria_id = :assessoria_clientes
        ";

        $params = [
            'assessoria_clippings' => $assessoriaId,
            'assessoria_clientes' => $assessoriaId,
            'ano' => $ano,
        ];

        if ($f['busca'] !== null) {
            $from .= "
                AND cl.nome LIKE :busca ESCAPE '!'
            ";

            $params['busca'] =
                self::termoBusca($f['busca']);
        }

        if ($f['ativo'] !== null) {
            $from .= ' AND cl.ativo = :ativo';
            $params['ativo'] = $f['ativo'] ? 1 : 0;
        }

        foreach (['estado', 'cidade', 'segmento'] as $campo) {
            if ($f[$campo] !== null) {
                $from .= "
                    AND CONVERT(cl.{$campo} USING utf8mb4)
                        COLLATE utf8mb4_unicode_ci
                    LIKE CONVERT(:{$campo} USING utf8mb4)
                        COLLATE utf8mb4_unicode_ci
                    ESCAPE '!'
                ";

                $params[$campo] = self::termoBusca($f[$campo]);
            }
        }

        $total = (int) self::consultar(
            'SELECT COUNT(*) ' . $from,
            $params
        )->fetchColumn();

        $clientes = self::consultar(
            "
                SELECT
                    cl.id,
                    cl.nome,
                    cl.logo_path,
                    cl.ativo,
                    COALESCE(
                        resumo.total_clippings,
                        0
                    ) AS total_clippings
            "
                . $from
                . "
                    ORDER BY cl.nome ASC, cl.id ASC
                    LIMIT :limit
                    OFFSET :offset
                ",
            $params + [
                'limit' => $f['limit'],
                'offset' => $f['offset'],
            ]
        )->fetchAll();

        return [
            'clientes' => $clientes,
            'total' => $total,
        ];
    }

    public static function pautasRecentes(
        int $assessoriaId,
        int $clienteId,
        ?string $busca
    ): array {
        $sql = "
            SELECT pauta

            FROM clippings

            WHERE
                assessoria_id = :assessoria_id
                AND cliente_id = :cliente_id
                AND arquivado_em IS NULL
                AND pauta IS NOT NULL
                AND TRIM(pauta) <> ''
        ";

        $params = [
            'assessoria_id' => $assessoriaId,
            'cliente_id' => $clienteId,
        ];

        if ($busca !== null) {
            $sql .= "
                AND CONVERT(pauta USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci
                    LIKE
                CONVERT(:busca USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci
                    ESCAPE '!'
            ";

            $params['busca'] =
                self::termoBusca($busca);
        }

        return self::consultar(
            $sql . "
                ORDER BY updated_at DESC, id DESC
                LIMIT 100
            ",
            $params
        )->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function excluirComAnexos(
        int $id,
        int $assessoriaId
    ): array {
        $params = [
            'id' => $id,
            'assessoria_id' => $assessoriaId,
        ];

        $clipping = self::consultar(
            'SELECT id
            FROM clippings
            WHERE id = :id
            AND assessoria_id = :assessoria_id
            FOR UPDATE',
            $params
        )->fetch();

        if (!$clipping) {
            throw new \OutOfBoundsException(
                'Clipping não encontrado.'
            );
        }

        $relatorio = self::consultar(
            'SELECT id
            FROM relatorio_slides
            WHERE clipping_id = :id
            AND assessoria_id = :assessoria_id
            LIMIT 1
            FOR UPDATE',
            $params
        )->fetchColumn();

        if ($relatorio !== false) {
            throw new \DomainException(
                'Este clipping está vinculado a um relatório e não pode ser excluído.'
            );
        }

        $anexos = self::consultar(
            'SELECT *
            FROM clipping_anexos
            WHERE clipping_id = :id
            AND assessoria_id = :assessoria_id
            FOR UPDATE',
            $params
        )->fetchAll();

        // Todos os anexos deste clipping serão removidos.
        // Desfaz apenas os vínculos internos entre eles.
        self::consultar(
            'UPDATE clipping_anexos
            SET anexo_origem_id = NULL
            WHERE clipping_id = :id
            AND assessoria_id = :assessoria_id',
            $params
        );

        self::consultar(
            'DELETE FROM clipping_anexos
            WHERE clipping_id = :id
            AND assessoria_id = :assessoria_id',
            $params
        );

        self::consultar(
            'DELETE FROM clippings
            WHERE id = :id
            AND assessoria_id = :assessoria_id',
            $params
        );

        return $anexos;
    }

    public static function contarPorClientesNoAno(
        int $assessoriaId,
        int $ano,
        array $clienteIds
    ): array {
        $clienteIds = array_values(
            array_unique(array_map('intval', $clienteIds))
        );

        if (!$clienteIds) {
            return [];
        }

        $params = [
            'assessoria_id' => $assessoriaId,
            'ano' => $ano,
        ];

        $marcadores = [];

        foreach ($clienteIds as $indice => $clienteId) {
            $nome = 'cliente_' . $indice;
            $marcadores[] = ':' . $nome;
            $params[$nome] = $clienteId;
        }

        $registros = self::consultar(
            'SELECT cliente_id, COUNT(*) AS total
            FROM clippings
            WHERE assessoria_id = :assessoria_id
            AND ano_referencia = :ano
            AND arquivado_em IS NULL
            AND cliente_id IN (' . implode(', ', $marcadores) . ')
            GROUP BY cliente_id',
            $params
        )->fetchAll();

        $contagens = [];

        foreach ($registros as $registro) {
            $contagens[(int) $registro['cliente_id']] =
                (int) $registro['total'];
        }

        return $contagens;
    }
}