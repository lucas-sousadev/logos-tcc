<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

class Usuario
{
    public static function buscarPorEmail(string $email): ?array
    {
        $pdo = Connection::get();

        $sql = "
            SELECT
                id,
                assessoria_id,
                nome,
                email,
                senha_hash,
                perfil,
                ativo,
                ultimo_login,
                created_at,
                updated_at
            FROM usuarios
            WHERE email = :email
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'email' => $email
        ]);

        $usuario = $stmt->fetch();

        return $usuario ?: null;
    }

    public static function verificarSenha(string $email, string $senha): ?array
    {
        $usuario = self::buscarPorEmail($email);

        if (!$usuario) {
            return null;
        }

        if (!$usuario['ativo']) {
            return null;
        }

        if (!password_verify($senha, $usuario['senha_hash'])) {
            return null;
        }

        return $usuario;
    }
    
    public static function atualizarUltimoLogin(int $id): void
    {
        $pdo = Connection::get();

        $sql = "
            UPDATE usuarios
            SET ultimo_login = NOW()
            WHERE id = :id
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'id' => $id
        ]);
    }

    public static function buscarPorId(int $id): ?array
    {
        $pdo = Connection::get();

        $sql = "
            SELECT
                id,
                assessoria_id,
                nome,
                email,
                telefone,
                perfil,
                ativo,
                email_verificado,
                ultimo_login,
                created_at,
                updated_at
            FROM usuarios
            WHERE id = :id
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'id' => $id
        ]);

        $usuario = $stmt->fetch();

        return $usuario ?: null;
    }
}

