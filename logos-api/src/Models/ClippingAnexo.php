<?php

namespace Logos\AssessoriaApi\Models;

use Logos\AssessoriaApi\Database\Connection;
use PDO;
use PDOStatement;

class ClippingAnexo
{
    private static function consultar(string $sql, array $params): PDOStatement
    {
        $stmt = Connection::get()->prepare($sql);

        foreach ($params as $nome => $valor) {
            $tipo = $valor === null ? PDO::PARAM_NULL
                : (is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR);

            $stmt->bindValue(':' . $nome, $valor, $tipo);
        }

        $stmt->execute();

        return $stmt;
    }

    public static function buscar(int $a, int $c, int $id): ?array
    {
        return self::consultar(
            'SELECT * FROM clipping_anexos
             WHERE assessoria_id = :a AND clipping_id = :c AND id = :id',
            compact('a', 'c', 'id')
        )->fetch() ?: null;
    }

    public static function listar(int $a, int $c, int $limit, int $offset): array
    {
        return self::consultar(
            'SELECT * FROM clipping_anexos
             WHERE assessoria_id = :a AND clipping_id = :c
             ORDER BY ordem, id LIMIT :limite OFFSET :deslocamento',
            [
                'a' => $a,
                'c' => $c,
                'limite' => $limit,
                'deslocamento' => $offset,
            ]
        )->fetchAll();
    }

    public static function resumo(int $a, int $c): array
    {
        return self::consultar(
            'SELECT COUNT(*) AS total, COALESCE(MAX(ordem), -1) AS ultima_ordem,
                    COALESCE(MAX(principal), 0) AS tem_principal,
                    COALESCE(MAX(imagem_relatorio), 0) AS tem_imagem
             FROM clipping_anexos WHERE assessoria_id = :a AND clipping_id = :c',
            compact('a', 'c')
        )->fetch();
    }

    public static function criar(int $a, int $c, int $u, array $arquivo): int
    {
        $resumo = self::resumo($a, $c);
        $ordem = (int) $resumo['ultima_ordem'] + 1;

        if ($ordem > 4294967295) {
            throw new \DomainException(
                'O limite de ordenação dos anexos foi atingido.'
            );
        }

        self::consultar(
            "INSERT INTO clipping_anexos
                (assessoria_id, clipping_id, criado_por, tipo, origem,
                 nome_original, arquivo_path, mime_type, tamanho_bytes,
                 ordem, principal, imagem_relatorio, metadados_json)
             VALUES
                (:a, :c, :u, :tipo, 'UPLOAD', :nome, :path, :mime, :tamanho,
                 :ordem, :principal, :imagem, :metadados)",
            [
                'a' => $a,
                'c' => $c,
                'u' => $u,
                'tipo' => $arquivo['tipo'],
                'nome' => $arquivo['nome_original'],
                'path' => $arquivo['arquivo_path'],
                'mime' => $arquivo['mime_type'],
                'tamanho' => $arquivo['tamanho_bytes'],
                'ordem' => $ordem,

                'principal' =>
                    (int) $resumo['tem_principal'] === 0 ? 1 : null,

                'imagem' =>
                    $arquivo['tipo'] === 'IMAGEM'
                    && (int) $resumo['tem_imagem'] === 0 ? 1 : null,

                'metadados' => $arquivo['metadados_json'],
            ]
        );

        return (int) Connection::get()->lastInsertId();
    }

    public static function atualizar(int $a, int $c, int $id, array $campos): void
    {
        $permitidos = ['principal', 'imagem_relatorio', 'ordem'];

        if (!$campos || array_diff(array_keys($campos), $permitidos)) {
            throw new \InvalidArgumentException('Campos de anexo inválidos.');
        }

        $sets = [];
        $params = compact('a', 'c', 'id');

        foreach ($campos as $campo => $valor) {
            if (
                in_array($campo, ['principal', 'imagem_relatorio'], true)
                && $valor === 1
            ) {
                self::consultar(
                    "UPDATE clipping_anexos SET {$campo} = NULL
                     WHERE assessoria_id = :a AND clipping_id = :c
                       AND {$campo} = 1",
                    compact('a', 'c')
                );
            }

            $sets[] = "{$campo} = :{$campo}";
            $params[$campo] = $valor;
        }

        self::consultar(
            'UPDATE clipping_anexos SET ' . implode(', ', $sets) .
            ' WHERE assessoria_id = :a AND clipping_id = :c AND id = :id',
            $params
        );
    }

    public static function temDependencias(int $a, int $c, int $id): bool
    {
        $derivado = self::consultar(
            'SELECT id FROM clipping_anexos
             WHERE assessoria_id = :a AND clipping_id = :c
               AND anexo_origem_id = :id LIMIT 1',
            compact('a', 'c', 'id')
        )->fetchColumn();

        // Proteção provisória até o versionamento dos materiais dos relatórios.
        $slide = self::consultar(
            'SELECT id FROM relatorio_slides
             WHERE assessoria_id = :a AND clipping_id = :c LIMIT 1',
            compact('a', 'c')
        )->fetchColumn();

        return $derivado !== false || $slide !== false;
    }

    public static function excluir(int $a, int $c, int $id): void
    {
        self::consultar(
            'DELETE FROM clipping_anexos
             WHERE assessoria_id = :a AND clipping_id = :c AND id = :id',
            compact('a', 'c', 'id')
        );
    }
}