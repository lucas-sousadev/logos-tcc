<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Veiculo;
use Logos\AssessoriaApi\Database\Connection;

class VeiculoService
{   
    private const MAX_NOME = 150;
    private const MAX_DESCRICAO = 1000;
    private const MAX_ALCANCE = 500;
    private const MAX_LOGO_PATH = 500;
    private const LIMITE_EXCLUSAO_EM_LOTE = 100;

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

        $descricao = self::campo(
            $dados,
            'descricao',
            self::MAX_DESCRICAO,
            'A descrição'
        );

        $logoPath = self::campo(
            $dados,
            'logo_path',
            self::MAX_LOGO_PATH,
            'O logo ou caminho'
        );

        $alcance = self::campo(
            $dados,
            'alcance',
            self::MAX_ALCANCE,
            'O alcance'
        );

        if (Veiculo::buscarPorNome($nome, $assessoriaId)) {
            throw new \RuntimeException(
                'Este veículo já está cadastrado.'
            );
        }

        try {
            $id = Veiculo::criar(
                $assessoriaId,
                $nome,
                $descricao,
                $logoPath,
                $alcance,
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

        $descricao = self::campo(
            $dados,
            'descricao',
            self::MAX_DESCRICAO,
            'A descrição'
        );

        $logoPath = self::campo(
            $dados,
            'logo_path',
            self::MAX_LOGO_PATH,
            'O logo ou caminho'
        );

        $alcance = self::campo(
            $dados,
            'alcance',
            self::MAX_ALCANCE,
            'O alcance'
        );

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
                $descricao,
                $logoPath,
                $alcance,
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

    public static function excluirEmLote(
        int $assessoriaId,
        array $ids
    ): int {
        if (
            !array_is_list($ids) ||
            count($ids) === 0 ||
            count($ids) > self::LIMITE_EXCLUSAO_EM_LOTE
        ) {
            throw new \InvalidArgumentException(
                'Selecione entre 1 e ' .
                self::LIMITE_EXCLUSAO_EM_LOTE .
                ' veículos.'
            );
        }

        $idsValidos = [];

        foreach ($ids as $valor) {
            if (
                !is_int($valor) &&
                !(
                    is_string($valor) &&
                    ctype_digit($valor)
                )
            ) {
                throw new \InvalidArgumentException(
                    'Há veículos inválidos na seleção.'
                );
            }

            $id = (int) $valor;

            if ($id <= 0) {
                throw new \InvalidArgumentException(
                    'Há veículos inválidos na seleção.'
                );
            }

            $idsValidos[] = $id;
        }

        if (count($idsValidos) !== count(array_unique($idsValidos))) {
            throw new \InvalidArgumentException(
                'Há veículos duplicados na seleção.'
            );
        }

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            foreach ($idsValidos as $id) {
                $veiculo = Veiculo::buscarPorId(
                    $id,
                    $assessoriaId
                );

                if (!$veiculo) {
                    throw new \InvalidArgumentException(
                        'Um dos veículos selecionados não está mais disponível.'
                    );
                }
            }

            foreach ($idsValidos as $id) {
                self::excluir($id, $assessoriaId);
            }

            $pdo->commit();

            return count($idsValidos);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
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
                    'Este veículo possui contatos vinculados e não pode ser excluído.'
                );
            }

            throw $e;
        }
    }

    public static function normalizarNome(mixed $valor): string
    {
        if (!is_scalar($valor)) {
            throw new \InvalidArgumentException(
                'O nome do veículo é inválido.'
            );
        }

        $nome = trim((string) $valor);

        if ($nome === '') {
            throw new \InvalidArgumentException(
                'O nome do veículo é obrigatório.'
            );
        }

        if (self::tamanho($nome) > self::MAX_NOME) {
            throw new \InvalidArgumentException(
                'O nome do veículo deve possuir no máximo 150 caracteres.'
            );
        }

        return $nome;
    }

    private static function nome(array $dados): string
    {
        return self::normalizarNome(
            $dados['nome'] ?? ''
        );
}   

    private static function campo(
        array $dados,
        string $campo,
        int $maximo,
        string $rotulo
    ): ?string {
        if (!array_key_exists($campo, $dados) || $dados[$campo] === null) {
            return null;
        }

        if (!is_scalar($dados[$campo])) {
            throw new \InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $valor = trim((string) $dados[$campo]);

        if ($valor === '') {
            return null;
        }

        if (self::tamanho($valor) > $maximo) {
            throw new \InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $valor;
    }

    private static function tamanho(string $valor): int
    {
        return function_exists('mb_strlen')
            ? mb_strlen($valor, 'UTF-8')
            : strlen($valor);
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
