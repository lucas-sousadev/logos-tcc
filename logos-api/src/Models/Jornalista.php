<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;

class Jornalista
{
    public static function listarPorAssessoria(
        int $assessoriaId,
        int $limit,
        int $offset,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $cargo = null,
        ?int $veiculoId = null,
        ?int $ativo = null,
        string $ordem = 'nome',
        string $direcao = 'ASC'
    ): array {
        $pdo = Connection::get();

        $ordensPermitidas = [
            'nome' => 'j.nome',
            'email' => 'j.email',
            'cargo' => 'j.cargo',
            'cidade' => 'j.cidade',
            'estado' => 'j.estado',
            'created_at' => 'j.created_at',
        ];

        $colunaOrdem =
            $ordensPermitidas[$ordem]
            ?? $ordensPermitidas['nome'];

        $direcao = strtoupper($direcao);

        if (!in_array($direcao, ['ASC', 'DESC'], true)) {
            $direcao = 'ASC';
        }

        $where = [
            'j.assessoria_id = :assessoria_id'
        ];

        $params = [
            'assessoria_id' => $assessoriaId,
        ];

        if ($busca !== null && trim($busca) !== '') {
            $where[] = "
                (
                    j.nome LIKE :busca_nome
                    OR j.email LIKE :busca_email
                    OR j.telefone LIKE :busca_telefone
                    OR j.cargo LIKE :busca_cargo
                    OR j.estado LIKE :busca_estado
                    OR j.cidade LIKE :busca_cidade
                    OR v.nome LIKE :busca_veiculo
                )
            ";

            $termoBusca = '%' . trim($busca) . '%';

            $params['busca_nome'] = $termoBusca;
            $params['busca_email'] = $termoBusca;
            $params['busca_telefone'] = $termoBusca;
            $params['busca_cargo'] = $termoBusca;
            $params['busca_estado'] = $termoBusca;
            $params['busca_cidade'] = $termoBusca;
            $params['busca_veiculo'] = $termoBusca;
        }

        if ($estado !== null && trim($estado) !== '') {
            $where[] = 'j.estado LIKE :estado';
            $params['estado'] = '%' . trim($estado) . '%';
        }

        if ($cidade !== null && trim($cidade) !== '') {
            $where[] = 'j.cidade LIKE :cidade';
            $params['cidade'] = '%' . trim($cidade) . '%';
        }

        if ($cargo !== null && trim($cargo) !== '') {
            $where[] = 'j.cargo LIKE :cargo';
            $params['cargo'] = '%' . trim($cargo) . '%';
        }

        if ($veiculoId !== null) {
            $where[] = 'j.veiculo_id = :veiculo_id';
            $params['veiculo_id'] = $veiculoId;
        }

        if ($ativo !== null) {
            $where[] = 'j.ativo = :ativo';
            $params['ativo'] = $ativo;
        }

        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
                j.id,
                j.assessoria_id,
                j.nome,
                j.email,
                j.telefone,
                j.cargo,
                j.estado,
                j.cidade,
                j.veiculo_id,
                v.nome AS veiculo_nome,
                j.observacoes,
                j.ativo,
                j.created_at,
                j.updated_at

            FROM jornalistas j

            LEFT JOIN veiculos v
                ON v.id = j.veiculo_id
                AND v.assessoria_id = j.assessoria_id

            WHERE {$whereSql}

            ORDER BY {$colunaOrdem} {$direcao}

            LIMIT :limit
            OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);

        foreach ($params as $parametro => $valor) {
            $stmt->bindValue(
                ':' . $parametro,
                $valor
            );
        }

        $stmt->bindValue(
            ':limit',
            $limit,
            \PDO::PARAM_INT
        );

        $stmt->bindValue(
            ':offset',
            $offset,
            \PDO::PARAM_INT
        );

        $stmt->execute();

        return $stmt->fetchAll();
    }

    public static function contarPorAssessoria(
        int $assessoriaId,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $cargo = null,
        ?int $veiculoId = null,
        ?int $ativo = null
    ): int {
        $pdo = Connection::get();

        $where = [
            'j.assessoria_id = :assessoria_id'
        ];

        $params = [
            'assessoria_id' => $assessoriaId,
        ];

        if ($busca !== null && trim($busca) !== '') {
            $where[] = "
                (
                    j.nome LIKE :busca_nome
                    OR j.email LIKE :busca_email
                    OR j.telefone LIKE :busca_telefone
                    OR j.cargo LIKE :busca_cargo
                    OR j.estado LIKE :busca_estado
                    OR j.cidade LIKE :busca_cidade
                    OR v.nome LIKE :busca_veiculo
                )
            ";

            $termoBusca = '%' . trim($busca) . '%';

            $params['busca_nome'] = $termoBusca;
            $params['busca_email'] = $termoBusca;
            $params['busca_telefone'] = $termoBusca;
            $params['busca_cargo'] = $termoBusca;
            $params['busca_estado'] = $termoBusca;
            $params['busca_cidade'] = $termoBusca;
            $params['busca_veiculo'] = $termoBusca;
        }

        if ($estado !== null && trim($estado) !== '') {
            $where[] = 'j.estado LIKE :estado';
            $params['estado'] = '%' . trim($estado) . '%';
        }

        if ($cidade !== null && trim($cidade) !== '') {
            $where[] = 'j.cidade LIKE :cidade';
            $params['cidade'] = '%' . trim($cidade) . '%';
        }

        if ($cargo !== null && trim($cargo) !== '') {
            $where[] = 'j.cargo LIKE :cargo';
            $params['cargo'] = '%' . trim($cargo) . '%';
        }

        if ($veiculoId !== null) {
            $where[] = 'j.veiculo_id = :veiculo_id';
            $params['veiculo_id'] = $veiculoId;
        }

        if ($ativo !== null) {
            $where[] = 'j.ativo = :ativo';
            $params['ativo'] = $ativo;
        }

        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT COUNT(*)
            FROM jornalistas j

            LEFT JOIN veiculos v
                ON v.id = j.veiculo_id
                AND v.assessoria_id = j.assessoria_id

            WHERE {$whereSql}
        ";

        $stmt = $pdo->prepare($sql);
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
                j.id,
                j.assessoria_id,
                j.nome,
                j.email,
                j.telefone,
                j.cargo,
                j.estado,
                j.cidade,
                j.veiculo_id,
                v.nome AS veiculo_nome,
                j.observacoes,
                j.ativo,
                j.created_at,
                j.updated_at

            FROM jornalistas j

            LEFT JOIN veiculos v
                ON v.id = j.veiculo_id
                AND v.assessoria_id = j.assessoria_id

            WHERE j.id = :id
              AND j.assessoria_id = :assessoria_id

            LIMIT 1
        ");

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId,
        ]);

        $resultado = $stmt->fetch();

        return $resultado ?: null;
    }

    public static function criar(
        int $assessoriaId,
        string $nome,
        string $email,
        ?string $telefone,
        ?string $cargo,
        ?string $estado,
        ?string $cidade,
        ?int $veiculoId,
        ?string $observacoes
    ): int {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            INSERT INTO jornalistas (
                assessoria_id,
                nome,
                email,
                telefone,
                cargo,
                estado,
                cidade,
                veiculo_id,
                observacoes
            ) VALUES (
                :assessoria_id,
                :nome,
                :email,
                :telefone,
                :cargo,
                :estado,
                :cidade,
                :veiculo_id,
                :observacoes
            )
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
            'nome' => $nome,
            'email' => $email,
            'telefone' => $telefone,
            'cargo' => $cargo,
            'estado' => $estado,
            'cidade' => $cidade,
            'veiculo_id' => $veiculoId,
            'observacoes' => $observacoes,
        ]);

        return (int) $pdo->lastInsertId();
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        string $nome,
        string $email,
        ?string $telefone,
        ?string $cargo,
        ?string $estado,
        ?string $cidade,
        ?int $veiculoId,
        ?string $observacoes,
        ?bool $ativo
    ): bool {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            UPDATE jornalistas
            SET
                nome = :nome,
                email = :email,
                telefone = :telefone,
                cargo = :cargo,
                estado = :estado,
                cidade = :cidade,
                veiculo_id = :veiculo_id,
                observacoes = :observacoes,
                ativo = COALESCE(:ativo, ativo)

            WHERE id = :id
              AND assessoria_id = :assessoria_id
        ");

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId,
            'nome' => $nome,
            'email' => $email,
            'telefone' => $telefone,
            'cargo' => $cargo,
            'estado' => $estado,
            'cidade' => $cidade,
            'veiculo_id' => $veiculoId,
            'observacoes' => $observacoes,
            'ativo' => $ativo,
        ]);

        return $stmt->rowCount() > 0;
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): bool {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            DELETE FROM jornalistas
            WHERE id = :id
              AND assessoria_id = :assessoria_id
        ");

        $stmt->execute([
            'id' => $id,
            'assessoria_id' => $assessoriaId,
        ]);

        return $stmt->rowCount() > 0;
    }

    public static function emailExiste(
        string $email,
        int $assessoriaId,
        ?int $ignorarId = null
    ): bool {
        $pdo = Connection::get();

        $sql = "
            SELECT 1
            FROM jornalistas
            WHERE assessoria_id = :assessoria_id
              AND email = :email
        ";

        $params = [
            'assessoria_id' => $assessoriaId,
            'email' => $email,
        ];

        if ($ignorarId !== null) {
            $sql .= " AND id <> :ignorar_id";
            $params['ignorar_id'] = $ignorarId;
        }

        $sql .= " LIMIT 1";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return (bool) $stmt->fetchColumn();
    }
}