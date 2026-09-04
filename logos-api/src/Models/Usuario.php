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

    public static function buscarFuncionarioPorId(
        int $id,
        int $assessoriaId
    ): ?array {
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
                created_at
            FROM usuarios
            WHERE id = :id
            AND assessoria_id = :assessoria_id
            AND perfil = 'FUNCIONARIO'
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId,
        ]);

        $funcionario = $stmt->fetch();

        return $funcionario ?: null;
    }

    public static function listarFuncionariosPorAssessoria(
        int $assessoriaId,
        int $limit,
        int $offset,
        ?string $busca = null,
        ?int $ativo = null
    ): array {
        $pdo = Connection::get();

        [$condicoes, $parametros] =
            self::filtrosFuncionarios(
                $assessoriaId,
                $busca,
                $ativo
            );

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
                created_at
            FROM usuarios
            WHERE " . implode(" AND ", $condicoes) . "
            ORDER BY nome ASC, id ASC
            LIMIT :limit
            OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);

        self::vincularParametros(
            $stmt,
            $parametros
        );

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

        return $stmt->fetchAll();
    }

    public static function contarFuncionariosPorAssessoria(
        int $assessoriaId,
        ?string $busca = null,
        ?int $ativo = null
    ): int {
        $pdo = Connection::get();

        [$condicoes, $parametros] =
            self::filtrosFuncionarios(
                $assessoriaId,
                $busca,
                $ativo
            );

        $sql = "
            SELECT COUNT(*)
            FROM usuarios
            WHERE " . implode(" AND ", $condicoes);

        $stmt = $pdo->prepare($sql);

        self::vincularParametros(
            $stmt,
            $parametros
        );

        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    private static function filtrosFuncionarios(
        int $assessoriaId,
        ?string $busca,
        ?int $ativo
    ): array {
        $condicoes = [
            'assessoria_id = :assessoria_id',
            "perfil = 'FUNCIONARIO'",
        ];

        $parametros = [
            'assessoria_id' => [
                $assessoriaId,
                PDO::PARAM_INT,
            ],
        ];

        $buscaTratada = trim((string) $busca);

        if ($buscaTratada !== '') {
            $termo = "%{$buscaTratada}%";

            $condicoes[] = "
                (
                    nome LIKE :busca_nome
                    OR email LIKE :busca_email
                )
            ";

            $parametros['busca_nome'] = [
                $termo,
                PDO::PARAM_STR,
            ];

            $parametros['busca_email'] = [
                $termo,
                PDO::PARAM_STR,
            ];
        }

        if ($ativo !== null) {
            $condicoes[] = 'ativo = :ativo';

            $parametros['ativo'] = [
                $ativo,
                PDO::PARAM_INT,
            ];
        }

        return [$condicoes, $parametros];
    }

    private static function vincularParametros(
        \PDOStatement $stmt,
        array $parametros
    ): void {
        foreach ($parametros as $nome => [$valor, $tipo]) {
            $stmt->bindValue(
                ":{$nome}",
                $valor,
                $tipo
            );
        }
    }
}

