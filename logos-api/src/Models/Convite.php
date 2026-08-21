<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

class Convite
{
    public static function criar(
        int $assessoriaId,
        int $criadoPor,
        string $codigo,
        ?string $emailDestino,
        string $expiraEm
    ): int {
        $pdo = Connection::get();

        $sql = "
            INSERT INTO convites (
                assessoria_id,
                criado_por,
                codigo,
                email_destino,
                expira_em
            ) VALUES (
                :assessoria_id,
                :criado_por,
                :codigo,
                :email_destino,
                :expira_em
            )
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
            'criado_por' => $criadoPor,
            'codigo' => $codigo,
            'email_destino' => $emailDestino,
            'expira_em' => $expiraEm
        ]);

        return (int) $pdo->lastInsertId();
    }

    public static function buscarPorCodigo(
        string $codigo
    ): ?array {
        $pdo = Connection::get();

        $sql = "
            SELECT
                id,
                assessoria_id,
                criado_por,
                codigo,
                email_destino,
                expira_em,
                utilizado_em,
                utilizado_por,
                created_at
            FROM convites
            WHERE codigo = :codigo
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'codigo' => $codigo
        ]);

        $convite = $stmt->fetch();

        return $convite ?: null;
    }
    
    public static function buscarValidoPorCodigo(
        string $codigo
    ): ?array {
        $pdo = Connection::get();

        $sql = "
            SELECT
                id,
                assessoria_id,
                criado_por,
                codigo,
                email_destino,
                expira_em,
                utilizado_em,
                utilizado_por,
                created_at
            FROM convites
            WHERE codigo = :codigo
            AND utilizado_em IS NULL
            AND expira_em > NOW()
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'codigo' => $codigo
        ]);

        $convite = $stmt->fetch();

        return $convite ?: null;
    }

    public static function listarPorAssessoria(int $assessoriaId,int $limit, int $offset): array {
        $pdo = Connection::get();

        $sql = "
            SELECT
                c.id,
                c.codigo,
                c.email_destino,
                c.expira_em,
                c.utilizado_em,
                c.created_at,

                criador.nome AS criado_por_nome,
                usuario.nome AS utilizado_por_nome

            FROM convites c

            INNER JOIN usuarios criador
                ON criador.id = c.criado_por

            LEFT JOIN usuarios usuario
                ON usuario.id = c.utilizado_por

            WHERE c.assessoria_id = :assessoria_id

            ORDER BY c.created_at DESC

            LIMIT {$limit} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'assessoria_id' => $assessoriaId
        ]);

        return $stmt->fetchAll();
    }
    public static function contarPorAssessoria(
        int $assessoriaId
    ): int {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM convites
            WHERE assessoria_id = :assessoria_id
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId
        ]);

        return (int) $stmt->fetchColumn();
    }
}

