<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Veiculo;

class VeiculoService
{
    public static function listar(
        int $assessoriaId,
        array $filtros = []
    ): array {
        $veiculos = Veiculo::listar(
            $assessoriaId,
            $filtros
        );

        $total = Veiculo::contar(
            $assessoriaId,
            $filtros
        );

        $page = max(
            1,
            (int) ($filtros['page'] ?? 1)
        );

        $limit = min(
            100,
            max(
                1,
                (int) ($filtros['limit'] ?? 50)
            )
        );

        return [
            'veiculos' => $veiculos,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' =>
                    ($page * $limit) < $total
            ]
        ];
    }

    public static function buscarPorId(
        int $id,
        int $assessoriaId
    ): array {
        $veiculo =
            Veiculo::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$veiculo) {
            throw new \RuntimeException(
                'Veículo não encontrado.'
            );
        }

        return $veiculo;
    }

    public static function criar(
        int $assessoriaId,
        array $dados
    ): array {
        $nome = self::nome($dados);

        if (Veiculo::buscarPorNome($nome, $assessoriaId)) {
            throw new \RuntimeException(
                'Este veículo já está cadastrado.'
            );
        }

        try {
            $id = Veiculo::criar(
                $assessoriaId,
                $nome,
                self::campo($dados, 'descricao'),
                self::campo($dados, 'logo_path'),
                self::campo($dados, 'alcance'),
                self::ativo($dados)
            );
        } catch (\PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                throw new \RuntimeException(
                    'Este veículo já está cadastrado.'
                );
            }

            throw $e;
        }

        return self::buscarPorId($id, $assessoriaId);
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        array $dados
    ): array {
        $nome = self::nome($dados);

        $veiculo =
            Veiculo::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$veiculo) {
            throw new \RuntimeException(
                'Veículo não encontrado.'
            );
        }

        $existente =
            Veiculo::buscarPorNome(
                $nome,
                $assessoriaId
            );

        if (
            $existente &&
            (int) $existente['id'] !== $id
        ) {
            throw new \RuntimeException(
                'Já existe outro veículo com este nome.'
            );
        }

        try {
            Veiculo::atualizar(
                $id,
                $assessoriaId,
                $nome,
                self::campo($dados, 'descricao'),
                self::campo($dados, 'logo_path'),
                self::campo($dados, 'alcance'),
                self::ativo($dados)
            );
        } catch (\PDOException $e) {
            if ((int) $e->errorInfo[1] === 1062) {
                throw new \RuntimeException(
                    'Já existe outro veículo com este nome.'
                );
            }

            throw $e;
        }

        return Veiculo::buscarPorId(
            $id,
            $assessoriaId
        );
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): void {
        $veiculo =
            Veiculo::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$veiculo) {
            throw new \RuntimeException(
                'Veículo não encontrado.'
            );
        }

        try {
            Veiculo::excluir(
                $id,
                $assessoriaId
            );
        } catch (\PDOException $e) {
            /*
             * O FK dos jornalistas usa RESTRICT.
             * Se o veículo estiver vinculado,
             * a exclusão será bloqueada.
             */
            if (
                (int) ($e->errorInfo[1] ?? 0) === 1451
            ) {
                throw new \RuntimeException(
                    'Este veículo possui jornalistas vinculados e não pode ser excluído.'
                );
            }

            throw $e;
        }
    }

    private static function nome(array $dados): string
    {
        $nome = trim((string) ($dados['nome'] ?? ''));

        if ($nome === '') {
            throw new \InvalidArgumentException(
                'O nome do veículo é obrigatório.'
            );
        }

        return $nome;
    }

    private static function campo(
        array $dados,
        string $campo
    ): ?string {
        if (!array_key_exists($campo, $dados) || $dados[$campo] === null) {
            return null;
        }

        $valor = trim((string) $dados[$campo]);

        return $valor === '' ? null : $valor;
    }

    private static function ativo(array $dados): bool
    {
        if (!array_key_exists('ativo', $dados)) {
            return true;
        }

        $ativo = filter_var(
            $dados['ativo'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($ativo === null) {
            throw new \InvalidArgumentException(
                'Status do veículo inválido.'
            );
        }

        return $ativo;
    }
}
