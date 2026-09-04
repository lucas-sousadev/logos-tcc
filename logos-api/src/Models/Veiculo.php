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
            'v.assessoria_id = :assessoria_id'
        ];

        $params = [
            'assessoria_id' => $assessoriaId
        ];

        if ($busca !== '') {
            $where[] = '
                v.nome LIKE :busca
            ';

            $params['busca'] =
                '%' . $busca . '%';
        }

        $ativo = self::filtroAtivo($filtros);

        if ($ativo !== null) {
            $where[] = 'v.ativo = :ativo';
            $params['ativo'] = $ativo;
        }

        $whereSql = implode(
            ' AND ',
            $where
        );

        $stmt = $pdo->prepare("
            SELECT
                v.id,
                v.assessoria_id,
                v.nome,
                v.descricao,
                v.alcance,
                v.logo_path,
                v.ativo,
                v.created_at,
                v.updated_at
            FROM veiculos v
            WHERE {$whereSql}
            ORDER BY v.nome ASC
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

        return $stmt->fetchAll(
            PDO::FETCH_ASSOC
        );
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
            'assessoria_id = :assessoria_id'
        ];

        $params = [
            'assessoria_id' => $assessoriaId
        ];

        if ($busca !== '') {
            $where[] = '
                nome LIKE :busca
            ';

            $params['busca'] =
                '%' . $busca . '%';
        }

        $ativo = self::filtroAtivo($filtros);

        if ($ativo !== null) {
            $where[] = 'ativo = :ativo';
            $params['ativo'] = $ativo;
        }

        $whereSql = implode(
            ' AND ',
            $where
        );

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM veiculos
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
                id,
                assessoria_id,
                nome,
                descricao,
                alcance,
                logo_path,
                ativo,
                created_at,
                updated_at
            FROM veiculos
            WHERE
                id = :id
                AND assessoria_id = :assessoria_id
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
        bool $ativo
    ): int {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            INSERT INTO veiculos (
                assessoria_id,
                nome,
                descricao,
                alcance,
                logo_path,
                ativo
            ) VALUES (
                :assessoria_id,
                :nome,
                :descricao,
                :alcance,
                :logo_path,
                :ativo
            )
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
            'nome' => $nome,
            'descricao' => $descricao,
            'alcance' => $alcance,
            'logo_path' => $logoPath,
            'ativo' => $ativo ? 1 : 0,
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
        bool $ativo
    ): void {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            UPDATE veiculos
            SET
                nome = :nome,
                descricao = :descricao,
                logo_path = :logo_path,
                alcance = :alcance,
                ativo = :ativo
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
