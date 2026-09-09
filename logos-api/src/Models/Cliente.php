<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;

class Cliente
{
    public static function listarPorAssessoria(
        int $assessoriaId,
        int $limit,
        int $offset,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $segmento = null,
        ?int $ativo = null
    ): array {
        [$where, $params] = self::filtros(
            $assessoriaId,
            $busca,
            $estado,
            $cidade,
            $segmento,
            $ativo
        );

        $sql = "
            SELECT
                c.id,
                c.assessoria_id,
                c.nome,
                c.email,
                c.telefone,
                c.cnpj,
                c.site,
                c.cidade,
                c.estado,
                c.descricao,
                c.segmento,
                c.responsavel,
                c.logo_path,
                c.ativo,
                c.created_at,
                c.updated_at
            FROM clientes c
            WHERE " . implode(' AND ', $where) . "
            ORDER BY c.nome ASC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = Connection::get()->prepare($sql);

        foreach ($params as $chave => $valor) {
            $stmt->bindValue($chave, $valor);
        }

        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public static function contarPorAssessoria(
        int $assessoriaId,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $segmento = null,
        ?int $ativo = null
    ): int {
        [$where, $params] = self::filtros(
            $assessoriaId,
            $busca,
            $estado,
            $cidade,
            $segmento,
            $ativo
        );

        $sql = "
            SELECT COUNT(*)
            FROM clientes c
            WHERE " . implode(' AND ', $where);

        $stmt = Connection::get()->prepare($sql);

        foreach ($params as $chave => $valor) {
            $stmt->bindValue($chave, $valor);
        }

        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    public static function buscarPorId(
        int $id,
        int $assessoriaId
    ): ?array {
        $sql = "
            SELECT
                id,
                assessoria_id,
                nome,
                email,
                telefone,
                cnpj,
                site,
                cidade,
                estado,
                descricao,
                segmento,
                responsavel,
                logo_path,
                ativo,
                created_at,
                updated_at
            FROM clientes
            WHERE id = :id
              AND assessoria_id = :assessoria_id
            LIMIT 1
        ";

        $stmt = Connection::get()->prepare($sql);

        $stmt->execute([
            ':id' => $id,
            ':assessoria_id' => $assessoriaId,
        ]);

        $cliente = $stmt->fetch(\PDO::FETCH_ASSOC);

        return $cliente ?: null;
    }

    public static function buscarPorNome(
        string $nome,
        int $assessoriaId
    ): ?array {
        $sql = "
            SELECT id, nome
            FROM clientes
            WHERE assessoria_id = :assessoria_id
              AND nome = :nome
            LIMIT 1
        ";

        $stmt = Connection::get()->prepare($sql);

        $stmt->execute([
            ':assessoria_id' => $assessoriaId,
            ':nome' => $nome,
        ]);

        $cliente = $stmt->fetch(\PDO::FETCH_ASSOC);

        return $cliente ?: null;
    }

    public static function buscarPorCnpj(
        string $cnpj,
        int $assessoriaId
    ): ?array {
        $sql = "
            SELECT id, cnpj
            FROM clientes
            WHERE assessoria_id = :assessoria_id
              AND cnpj = :cnpj
            LIMIT 1
        ";

        $stmt = Connection::get()->prepare($sql);

        $stmt->execute([
            ':assessoria_id' => $assessoriaId,
            ':cnpj' => $cnpj,
        ]);

        $cliente = $stmt->fetch(\PDO::FETCH_ASSOC);

        return $cliente ?: null;
    }

    public static function criar(
        int $assessoriaId,
        string $nome,
        ?string $email,
        ?string $telefone,
        ?string $cnpj,
        ?string $site,
        ?string $cidade,
        ?string $estado,
        ?string $descricao,
        ?string $segmento,
        ?string $responsavel,
        ?string $logoPath,
        bool $ativo
    ): int {
        $sql = "
            INSERT INTO clientes (
                assessoria_id,
                nome,
                email,
                telefone,
                cnpj,
                site,
                cidade,
                estado,
                descricao,
                segmento,
                responsavel,
                logo_path,
                ativo
            ) VALUES (
                :assessoria_id,
                :nome,
                :email,
                :telefone,
                :cnpj,
                :site,
                :cidade,
                :estado,
                :descricao,
                :segmento,
                :responsavel,
                :logo_path,
                :ativo
            )
        ";

        $stmt = Connection::get()->prepare($sql);

        $stmt->execute([
            ':assessoria_id' => $assessoriaId,
            ':nome' => $nome,
            ':email' => $email,
            ':telefone' => $telefone,
            ':cnpj' => $cnpj,
            ':site' => $site,
            ':cidade' => $cidade,
            ':estado' => $estado,
            ':descricao' => $descricao,
            ':segmento' => $segmento,
            ':responsavel' => $responsavel,
            ':logo_path' => $logoPath,
            ':ativo' => $ativo ? 1 : 0,
        ]);

        return (int) Connection::get()->lastInsertId();
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        string $nome,
        ?string $email,
        ?string $telefone,
        ?string $cnpj,
        ?string $site,
        ?string $cidade,
        ?string $estado,
        ?string $descricao,
        ?string $segmento,
        ?string $responsavel,
        ?string $logoPath,
        bool $ativo
    ): void {
        $sql = "
            UPDATE clientes
            SET
                nome = :nome,
                email = :email,
                telefone = :telefone,
                cnpj = :cnpj,
                site = :site,
                cidade = :cidade,
                estado = :estado,
                descricao = :descricao,
                segmento = :segmento,
                responsavel = :responsavel,
                logo_path = :logo_path,
                ativo = :ativo
            WHERE id = :id
              AND assessoria_id = :assessoria_id
        ";

        $stmt = Connection::get()->prepare($sql);

        $stmt->execute([
            ':id' => $id,
            ':assessoria_id' => $assessoriaId,
            ':nome' => $nome,
            ':email' => $email,
            ':telefone' => $telefone,
            ':cnpj' => $cnpj,
            ':site' => $site,
            ':cidade' => $cidade,
            ':estado' => $estado,
            ':descricao' => $descricao,
            ':segmento' => $segmento,
            ':responsavel' => $responsavel,
            ':logo_path' => $logoPath,
            ':ativo' => $ativo ? 1 : 0,
        ]);
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): void {
        $sql = "
            DELETE FROM clientes
            WHERE id = :id
              AND assessoria_id = :assessoria_id
        ";

        $stmt = Connection::get()->prepare($sql);

        $stmt->execute([
            ':id' => $id,
            ':assessoria_id' => $assessoriaId,
        ]);
    }

    private static function filtros(
        int $assessoriaId,
        ?string $busca,
        ?string $estado,
        ?string $cidade,
        ?string $segmento,
        ?int $ativo
    ): array {
        $where = [
            'c.assessoria_id = :assessoria_id',
        ];

        $params = [
            ':assessoria_id' => $assessoriaId,
        ];

        $busca = trim((string) $busca);

        if ($busca !== '') {
            $where[] = "(
                c.nome LIKE :busca_nome
                OR c.email LIKE :busca_email
                OR c.telefone LIKE :busca_telefone
                OR c.cnpj LIKE :busca_cnpj
                OR c.responsavel LIKE :busca_responsavel
                OR c.segmento LIKE :busca_segmento
                OR c.cidade LIKE :busca_cidade
                OR c.estado LIKE :busca_estado
            )";

            $termoBusca = '%' . $busca . '%';

            $params[':busca_nome'] = $termoBusca;
            $params[':busca_email'] = $termoBusca;
            $params[':busca_telefone'] = $termoBusca;
            $params[':busca_cnpj'] = $termoBusca;
            $params[':busca_responsavel'] = $termoBusca;
            $params[':busca_segmento'] = $termoBusca;
            $params[':busca_cidade'] = $termoBusca;
            $params[':busca_estado'] = $termoBusca;
        }

        $estado = trim((string) $estado);

        $estado = trim((string) $estado);

        if ($estado !== '') {
            $where[] = 'c.estado LIKE :estado';
            $params[':estado'] = '%' . $estado . '%';
        }

        $cidade = trim((string) $cidade);

        if ($cidade !== '') {
            $where[] = 'c.cidade LIKE :cidade';
            $params[':cidade'] = '%' . $cidade . '%';
        }

        $segmento = trim((string) $segmento);

        if ($segmento !== '') {
            $where[] = 'c.segmento LIKE :segmento';
            $params[':segmento'] = '%' . $segmento . '%';
        }

        if ($ativo !== null) {
            $where[] = 'c.ativo = :ativo';
            $params[':ativo'] = $ativo;
        }

        return [$where, $params];
    }
}