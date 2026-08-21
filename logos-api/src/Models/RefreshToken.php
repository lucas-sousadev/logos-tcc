<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

class RefreshToken
{
    public static function criar(
        int $usuarioId,
        string $tokenHash,
        string $expiresAt
    ): void {
        $pdo = Connection::get();

        $sql = "
            INSERT INTO refresh_tokens (
                usuario_id,
                token_hash,
                expires_at
            ) VALUES (
                :usuario_id,
                :token_hash,
                :expires_at
            )
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'usuario_id' => $usuarioId,
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt
        ]);
    }

    public static function buscarValidoPorHash(
        string $tokenHash
    ): ?array {
        $pdo = Connection::get();

        $sql = "
            SELECT
                rt.id,
                rt.usuario_id,
                rt.token_hash,
                rt.expires_at,
                rt.revoked_at,
                u.assessoria_id,
                u.nome,
                u.email,
                u.telefone,
                u.perfil,
                u.ativo,
                u.email_verificado
            FROM refresh_tokens rt
            INNER JOIN usuarios u
                ON u.id = rt.usuario_id
            WHERE rt.token_hash = :token_hash
              AND rt.revoked_at IS NULL
              AND rt.expires_at > NOW()
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'token_hash' => $tokenHash
        ]);

        $token = $stmt->fetch();

        return $token ?: null;
    }

    public static function revogarPorId(int $id): void
    {
        $pdo = Connection::get();

        $sql = "
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE id = :id
              AND revoked_at IS NULL
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'id' => $id
        ]);
    }
}