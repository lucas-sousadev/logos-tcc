<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;

class Permissao
{
    public static function listarTodas(): array
    {
        $pdo = Connection::get();

        $stmt = $pdo->query("
            SELECT
                id,
                modulo,
                acao,
                descricao
            FROM permissoes
            ORDER BY modulo, id
        ");

        return $stmt->fetchAll();
    }

    public static function listarPorUsuario(
        int $usuarioId
    ): array {
        $pdo = Connection::get();

        $sql = "
            SELECT
                p.id,
                p.modulo,
                p.acao,
                p.descricao
            FROM usuario_permissoes up

            INNER JOIN permissoes p
                ON p.id = up.permissao_id

            WHERE up.usuario_id = :usuario_id

            ORDER BY p.modulo, p.id
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'usuario_id' => $usuarioId
        ]);

        return $stmt->fetchAll();
    }

    public static function substituirDoUsuario(
        int $usuarioId,
        array $permissaoIds
    ): void {
        $pdo = Connection::get();

        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare("
                DELETE FROM usuario_permissoes
                WHERE usuario_id = :usuario_id
            ");

            $stmt->execute([
                'usuario_id' => $usuarioId
            ]);

            if (!empty($permissaoIds)) {
                $stmt = $pdo->prepare("
                    INSERT INTO usuario_permissoes (
                        usuario_id,
                        permissao_id
                    ) VALUES (
                        :usuario_id,
                        :permissao_id
                    )
                ");

                foreach ($permissaoIds as $permissaoId) {
                    $stmt->execute([
                        'usuario_id' => $usuarioId,
                        'permissao_id' => $permissaoId
                    ]);
                }
            }

            $pdo->commit();

        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function usuarioTemPermissao(
        int $usuarioId,
        int $permissaoId
    ): bool {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT 1
            FROM usuario_permissoes
            WHERE usuario_id = :usuario_id
              AND permissao_id = :permissao_id
            LIMIT 1
        ");

        $stmt->execute([
            'usuario_id' => $usuarioId,
            'permissao_id' => $permissaoId
        ]);

        return (bool) $stmt->fetchColumn();
    }

    public static function buscarPorModuloAcao(
        string $modulo,
        string $acao
    ): ?array {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT
                id,
                modulo,
                acao,
                descricao
            FROM permissoes
            WHERE modulo = :modulo
              AND acao = :acao
            LIMIT 1
        ");

        $stmt->execute([
            'modulo' => $modulo,
            'acao' => $acao
        ]);

        $permissao = $stmt->fetch();

        return $permissao ?: null;
    }
}