<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Jornalista;
use InvalidArgumentException;

class JornalistaService
{
    public static function listar(
        int $assessoriaId,
        int $page = 1,
        int $limit = 50,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $cargo = null,
        ?int $veiculoId = null,
        ?int $ativo = 1,
        string $ordem = 'nome',
        string $direcao = 'ASC'
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));

        $offset = ($page - 1) * $limit;

        $jornalistas =
            Jornalista::listarPorAssessoria(
                $assessoriaId,
                $limit,
                $offset,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo,
                $ordem,
                $direcao
            );

        $total =
            Jornalista::contarPorAssessoria(
                $assessoriaId,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo
            );

        return [
            'jornalistas' => $jornalistas,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' =>
                    ($offset + count($jornalistas)) < $total,
            ],
        ];
    }

    public static function buscar(
        int $id,
        int $assessoriaId
    ): ?array {
        return Jornalista::buscarPorId(
            $id,
            $assessoriaId
        );
    }

    public static function criar(
        int $assessoriaId,
        array $dados
    ): int {
        $nome = trim($dados['nome'] ?? '');
        $email = strtolower(
            trim($dados['email'] ?? '')
        );

        if ($nome === '') {
            throw new InvalidArgumentException(
                'O nome é obrigatório.'
            );
        }

        if ($email === '') {
            throw new InvalidArgumentException(
                'O e-mail é obrigatório.'
            );
        }

        if (
            !filter_var(
                $email,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            throw new InvalidArgumentException(
                'Informe um e-mail válido.'
            );
        }

        if (
            Jornalista::emailExiste(
                $email,
                $assessoriaId
            )
        ) {
            throw new InvalidArgumentException(
                'Já existe um jornalista com este e-mail na assessoria.'
            );
        }

        return Jornalista::criar(
            $assessoriaId,
            $nome,
            $email,
            self::campo($dados, 'telefone'),
            self::campo($dados, 'cargo'),
            self::campo($dados, 'estado'),
            self::campo($dados, 'cidade'),
            self::veiculoId($dados),
            self::campo($dados, 'observacoes')
        );
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        array $dados
    ): void {
        $existente =
            Jornalista::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$existente) {
            throw new InvalidArgumentException(
                'Jornalista não encontrado.'
            );
        }

        $nome = trim($dados['nome'] ?? '');
        $email = strtolower(
            trim($dados['email'] ?? '')
        );

        if ($nome === '') {
            throw new InvalidArgumentException(
                'O nome é obrigatório.'
            );
        }

        if (
            !filter_var(
                $email,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            throw new InvalidArgumentException(
                'Informe um e-mail válido.'
            );
        }

        if (
            Jornalista::emailExiste(
                $email,
                $assessoriaId,
                $id
            )
        ) {
            throw new InvalidArgumentException(
                'Já existe outro jornalista com este e-mail.'
            );
        }

        $ativo = null;

        if (array_key_exists('ativo', $dados)) {
            $ativo = (bool) $dados['ativo'];
        }

        Jornalista::atualizar(
            $id,
            $assessoriaId,
            $nome,
            $email,
            self::campo($dados, 'telefone'),
            self::campo($dados, 'cargo'),
            self::campo($dados, 'estado'),
            self::campo($dados, 'cidade'),
            self::veiculoId($dados),
            self::campo($dados, 'observacoes'),
            $ativo
        );
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): void {
        $existente =
            Jornalista::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$existente) {
            throw new InvalidArgumentException(
                'Jornalista não encontrado.'
            );
        }

        Jornalista::excluir(
            $id,
            $assessoriaId
        );
    }

    private static function campo(
        array $dados,
        string $campo
    ): ?string {
        if (
            !array_key_exists($campo, $dados) ||
            $dados[$campo] === null
        ) {
            return null;
        }

        $valor = trim((string) $dados[$campo]);

        return $valor === '' ? null : $valor;
    }

    private static function veiculoId(
        array $dados
    ): ?int {
        if (
            !array_key_exists(
                'veiculo_id',
                $dados
            ) ||
            $dados['veiculo_id'] === null ||
            $dados['veiculo_id'] === ''
        ) {
            return null;
        }

        $id = filter_var(
            $dados['veiculo_id'],
            FILTER_VALIDATE_INT
        );

        if ($id === false || $id <= 0) {
            throw new InvalidArgumentException(
                'Veículo inválido.'
            );
        }

        return $id;
    }
}