<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

class Veiculo
{
    public static function listar(
        int $assessoriaId,
        array $filtros = []
    ): array {
        $pdo = Connection::get();

        $page = max(
            1,
            (int) ($filtros['page'] ?? 1)
        );

        $limit = min(
            100,
            max(
                1,
                (int) ($filtros['limit'] ?? 50)
            )
        );

        $offset = ($page - 1) * $limit;

        $busca = trim(
            $filtros['busca'] ?? ''
        );

        $where = [
            'v.assessoria_id = :assessoria_id',
        ];

        $params = [
            'assessoria_id' => $assessoriaId,
        ];

        if ($busca !== '') {
            $where[] = 'v.nome LIKE :busca';

            $params['busca'] =
                '%' . $busca . '%';
        }

        $ativo = self::filtroAtivo($filtros);

        if ($ativo !== null) {
            $where[] = 'v.ativo = :ativo';
            $params['ativo'] = $ativo;
        }

        $contagemVinculos = "
            (
                SELECT COUNT(*)
                FROM jornalistas j
                WHERE
                    j.veiculo_id = v.id
                    AND j.assessoria_id = v.assessoria_id
            )
        ";

        $minContatos =
            self::filtroMinimoContatos($filtros);

        if ($minContatos !== null) {
            $where[] =
                "{$contagemVinculos} >= :min_contatos";

            $params['min_contatos'] =
                $minContatos;
        }

        $maxContatos =
            self::filtroMaximoContatos($filtros);

        if ($maxContatos !== null) {
            $where[] =
                "{$contagemVinculos} <= :max_contatos";

            $params['max_contatos'] =
                $maxContatos;
        }

        $whereSql = implode(' AND ', $where);

        $ordenacao = self::ordenacao($filtros);

        $stmt = $pdo->prepare("
            SELECT
                v.id,
                v.assessoria_id,
                v.nome,
                v.descricao,
                v.alcance,
                v.logo_path,
                v.ativo,
                v.tier,
                {$contagemVinculos} AS contatos_vinculados,
                v.created_at,
                v.updated_at
            FROM veiculos v
            WHERE {$whereSql}
            ORDER BY {$ordenacao}
            LIMIT :limit
            OFFSET :offset
        ");

        foreach ($params as $chave => $valor) {
            $stmt->bindValue(
                ':' . $chave,
                $valor
            );
        }

        $stmt->bindValue(
            ':limit',
            $limit,
            PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':offset',
            $offset,
            PDO::PARAM_INT
        );

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function contar(
        int $assessoriaId,
        array $filtros = []
    ): int {
        $pdo = Connection::get();

        $busca = trim(
            $filtros['busca'] ?? ''
        );

        $where = [
            'v.assessoria_id = :assessoria_id',
        ];

        $params = [
            'assessoria_id' => $assessoriaId,
        ];

        if ($busca !== '') {
            $where[] = 'v.nome LIKE :busca';

            $params['busca'] =
                '%' . $busca . '%';
        }

        $ativo = self::filtroAtivo($filtros);

        if ($ativo !== null) {
            $where[] = 'v.ativo = :ativo';
            $params['ativo'] = $ativo;
        }

        $contagemVinculos = "
            (
                SELECT COUNT(*)
                FROM jornalistas j
                WHERE
                    j.veiculo_id = v.id
                    AND j.assessoria_id = v.assessoria_id
            )
        ";

        $minContatos =
            self::filtroMinimoContatos($filtros);

        if ($minContatos !== null) {
            $where[] =
                "{$contagemVinculos} >= :min_contatos";

            $params['min_contatos'] =
                $minContatos;
        }

        $maxContatos =
            self::filtroMaximoContatos($filtros);

        if ($maxContatos !== null) {
            $where[] =
                "{$contagemVinculos} <= :max_contatos";

            $params['max_contatos'] =
                $maxContatos;
        }
        
        $whereSql = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM veiculos v
            WHERE {$whereSql}
        ");

        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    public static function buscarPorId(
        int $id,
        int $assessoriaId
    ): ?array {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT
                v.id,
                v.assessoria_id,
                v.nome,
                v.descricao,
                v.alcance,
                v.logo_path,
                v.ativo,
                v.tier,
                (
                    SELECT COUNT(*)
                    FROM jornalistas j
                    WHERE
                        j.veiculo_id = v.id
                        AND j.assessoria_id = v.assessoria_id
                ) AS contatos_vinculados,
                v.created_at,
                v.updated_at
            FROM veiculos v
            WHERE
                v.id = :id
                AND v.assessoria_id = :assessoria_id
            LIMIT 1
        ");

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId
        ]);

        $veiculo =
            $stmt->fetch(PDO::FETCH_ASSOC);

        return $veiculo ?: null;
    }

    public static function buscarPorNome(
        string $nome,
        int $assessoriaId
    ): ?array {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT
                id,
                assessoria_id,
                nome,
                descricao,
                alcance,
                logo_path,
                ativo,
                tier,
                created_at,
                updated_at
            FROM veiculos
            WHERE
                assessoria_id = :assessoria_id
                AND nome = :nome
            LIMIT 1
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
            'nome' => $nome
        ]);

        $veiculo =
            $stmt->fetch(PDO::FETCH_ASSOC);

        return $veiculo ?: null;
    }

    public static function criar(
        int $assessoriaId,
        string $nome,
        ?string $descricao,
        ?string $logoPath,
        ?string $alcance,
        bool $ativo,
        ?int $tier = null
    ): int {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            INSERT INTO veiculos (
                assessoria_id,
                nome,
                descricao,
                alcance,
                logo_path,
                ativo,
                tier
            ) VALUES (
                :assessoria_id,
                :nome,
                :descricao,
                :alcance,
                :logo_path,
                :ativo,
                :tier
            )
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
            'nome' => $nome,
            'descricao' => $descricao,
            'alcance' => $alcance,
            'logo_path' => $logoPath,
            'ativo' => $ativo ? 1 : 0,
            'tier' => $tier,
        ]);

        return (int) $pdo->lastInsertId();
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        string $nome,
        ?string $descricao,
        ?string $logoPath,
        ?string $alcance,
        bool $ativo,
        ?int $tier
    ): void {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            UPDATE veiculos
            SET
                nome = :nome,
                descricao = :descricao,
                logo_path = :logo_path,
                alcance = :alcance,
                ativo = :ativo,
                tier = :tier
            WHERE
                id = :id
                AND assessoria_id = :assessoria_id
        ");

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId,
            'nome' => $nome,
            'descricao' => $descricao,
            'logo_path' => $logoPath,
            'alcance' => $alcance,
            'ativo' => $ativo ? 1 : 0,
            'tier' => $tier,
        ]);
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): void {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            DELETE FROM veiculos
            WHERE
                id = :id
                AND assessoria_id = :assessoria_id
        ");

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId
        ]);
    }

    private static function filtroMinimoContatos(
        array $filtros
    ): ?int {
        if (
            !array_key_exists(
                'min_contatos',
                $filtros
            ) ||
            $filtros['min_contatos'] === null ||
            $filtros['min_contatos'] === ''
        ) {
            return null;
        }

        if (!is_scalar($filtros['min_contatos'])) {
            return null;
        }

        $minimo = filter_var(
            $filtros['min_contatos'],
            FILTER_VALIDATE_INT
        );

        if ($minimo === false || $minimo < 0) {
            return null;
        }

        return (int) $minimo;
    }

    private static function filtroMaximoContatos(
        array $filtros
    ): ?int {
        if (
            !array_key_exists(
                'max_contatos',
                $filtros
            ) ||
            $filtros['max_contatos'] === null ||
            $filtros['max_contatos'] === ''
        ) {
            return null;
        }

        if (!is_scalar($filtros['max_contatos'])) {
            return null;
        }

        $maximo = filter_var(
            $filtros['max_contatos'],
            FILTER_VALIDATE_INT
        );

        if ($maximo === false || $maximo < 0) {
            return null;
        }

        return (int) $maximo;
    }

    private static function ordenacao(
        array $filtros
    ): string {
        $ordem = strtolower(
            trim(
                (string) (
                    $filtros['ordem'] ?? 'nome'
                )
            )
        );

        $direcao = strtoupper(
            trim(
                (string) (
                    $filtros['direcao'] ?? ''
                )
            )
        );

        if ($ordem === 'vinculos') {
            return $direcao === 'ASC'
                ? 'contatos_vinculados ASC, v.nome ASC'
                : 'contatos_vinculados DESC, v.nome ASC';
        }

        return $direcao === 'DESC'
            ? 'v.nome DESC'
            : 'v.nome ASC';
    }

    private static function filtroAtivo(
        array $filtros
    ): ?int {
        if (
            !array_key_exists('ativo', $filtros) ||
            $filtros['ativo'] === null ||
            $filtros['ativo'] === ''
        ) {
            return null;
        }

        $ativo = filter_var(
            $filtros['ativo'],
            FILTER_VALIDATE_INT
        );

        return $ativo === 0 || $ativo === 1
            ? $ativo
            : null;
    }
}
