<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\RefreshToken;
use RuntimeException;
use Throwable;

class RefreshTokenService
{
    private const DURACAO_DIAS = 30;

    public static function criar(int $usuarioId): string
    {
        $token = bin2hex(random_bytes(32));

        $tokenHash = hash('sha256', $token);

        $expiresAt = date(
            'Y-m-d H:i:s',
            strtotime('+' . self::DURACAO_DIAS . ' days')
        );

        RefreshToken::criar(
            $usuarioId,
            $tokenHash,
            $expiresAt
        );

        return $token;
    }

    public static function renovar(string $token): array
    {
        if ($token === '') {
            throw new RuntimeException(
                'Refresh token não informado.'
            );
        }

        $tokenHash = hash('sha256', $token);

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            $sql = "
                SELECT
                    rt.id,
                    rt.usuario_id,
                    rt.expires_at,
                    rt.revoked_at,

                    u.id AS usuario_id_real,
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
                LIMIT 1

                FOR UPDATE
            ";

            $stmt = $pdo->prepare($sql);

            $stmt->execute([
                'token_hash' => $tokenHash
            ]);

            $dados = $stmt->fetch();

            if (!$dados) {
                throw new RuntimeException(
                    'Refresh token inválido.'
                );
            }

            if ($dados['revoked_at'] !== null) {
                throw new RuntimeException(
                    'Refresh token revogado.'
                );
            }

            if (
                strtotime($dados['expires_at']) <= time()
            ) {
                throw new RuntimeException(
                    'Refresh token expirado.'
                );
            }

            if (!(bool) $dados['ativo']) {
                throw new RuntimeException(
                    'Usuário inativo.'
                );
            }

            /*
             * Revoga o refresh token atual.
             */
            $stmt = $pdo->prepare("
                UPDATE refresh_tokens
                SET revoked_at = NOW()
                WHERE id = :id
            ");

            $stmt->execute([
                'id' => $dados['id']
            ]);

            /*
             * Cria um novo refresh token.
             */
            $novoToken = bin2hex(random_bytes(32));

            $novoTokenHash = hash(
                'sha256',
                $novoToken
            );

            $novoExpiresAt = date(
                'Y-m-d H:i:s',
                strtotime('+' . self::DURACAO_DIAS . ' days')
            );

            $stmt = $pdo->prepare("
                INSERT INTO refresh_tokens (
                    usuario_id,
                    token_hash,
                    expires_at
                ) VALUES (
                    :usuario_id,
                    :token_hash,
                    :expires_at
                )
            ");

            $stmt->execute([
                'usuario_id' => $dados['usuario_id'],
                'token_hash' => $novoTokenHash,
                'expires_at' => $novoExpiresAt
            ]);

            $pdo->commit();

            $usuario = [
                'id' => (int) $dados['usuario_id'],
                'assessoria_id' => (int) $dados['assessoria_id'],
                'nome' => $dados['nome'],
                'email' => $dados['email'],
                'telefone' => $dados['telefone'],
                'perfil' => $dados['perfil'],
                'ativo' => (bool) $dados['ativo'],
                'email_verificado' => (bool) $dados['email_verificado']
            ];

            return [
                'token' => JwtService::gerar($usuario),
                'refresh_token' => $novoToken,
                'usuario' => $usuario
            ];

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function revogar(string $token): void
    {
        if ($token === '') {
            return;
        }

        $tokenHash = hash('sha256', $token);

        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE token_hash = :token_hash
              AND revoked_at IS NULL
        ");

        $stmt->execute([
            'token_hash' => $tokenHash
        ]);
    }
}