<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Jornalista;
use Logos\AssessoriaApi\Models\Veiculo;
use Logos\AssessoriaApi\Services\VeiculoService;
use InvalidArgumentException;

class JornalistaService
{   
    private const MAX_NOME = 150;
    private const MAX_EMAIL = 180;
    private const MAX_TELEFONE = 30;
    private const MAX_CARGO = 100;
    private const MAX_ESTADO = 100;
    private const MAX_CIDADE = 100;
    private const MAX_OBSERVACOES = 2000;

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
        $campos = self::validarDados($dados);

        $nome = $campos['nome'];
        $email = $campos['email'];

        if (
            Jornalista::emailExiste(
                $email,
                $assessoriaId
            )
        ) {
            throw new InvalidArgumentException(
                'Já existe um contato com este e-mail na assessoria.'
            );
        }

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            $veiculoId = self::veiculoId(
                $dados,
                $assessoriaId
            );


            $id = Jornalista::criar(
                $assessoriaId,
                $nome,
                $email,
                $campos['telefone'],
                $campos['cargo'],
                $campos['estado'],
                $campos['cidade'],
                $veiculoId,
                $campos['observacoes']
            );
            $pdo->commit();

            return $id;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
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

        $campos = self::validarDados($dados);

        $nome = $campos['nome'];
        $email = $campos['email'];

        if (
            Jornalista::emailExiste(
                $email,
                $assessoriaId,
                $id
            )
        ) {
            throw new InvalidArgumentException(
                'Já existe um contato com este e-mail na assessoria.'
            );
        }
        $ativo = self::ativo($dados);

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            Jornalista::atualizar(
                $id,
                $assessoriaId,
                $nome,
                $email,
                $campos['telefone'],
                $campos['cargo'],
                $campos['estado'],
                $campos['cidade'],
                self::veiculoId($dados, $assessoriaId),
                $campos['observacoes'],
                $ativo
            );

            $pdo->commit();
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
        $existente =
            Jornalista::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$existente) {
            throw new InvalidArgumentException(
                'Contato não encontrado.'
            );
        }

        Jornalista::excluir(
            $id,
            $assessoriaId
        );
    }

    private static function validarDados(array $dados): array
    {
        return [
            'nome' => self::textoObrigatorio(
                $dados,
                'nome',
                self::MAX_NOME,
                'O nome do contato'
            ),
            'email' => self::email($dados),
            'telefone' => self::telefone($dados),
            'cargo' => self::campo(
                $dados,
                'cargo',
                self::MAX_CARGO,
                'O cargo'
            ),
            'estado' => self::campo(
                $dados,
                'estado',
                self::MAX_ESTADO,
                'O estado'
            ),
            'cidade' => self::campo(
                $dados,
                'cidade',
                self::MAX_CIDADE,
                'A cidade'
            ),
            'observacoes' => self::campo(
                $dados,
                'observacoes',
                self::MAX_OBSERVACOES,
                'As observações'
            ),
        ];
    }

    private static function textoObrigatorio(
        array $dados,
        string $campo,
        int $maximo,
        string $rotulo
    ): string {
        $valor = $dados[$campo] ?? '';

        if (!is_scalar($valor)) {
            throw new InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $texto = trim((string) $valor);

        if ($texto === '') {
            throw new InvalidArgumentException(
                "{$rotulo} é obrigatório."
            );
        }

        if (self::tamanho($texto) > $maximo) {
            throw new InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $texto;
    }

    private static function email(array $dados): string
    {
        $email = strtolower(
            self::textoObrigatorio(
                $dados,
                'email',
                self::MAX_EMAIL,
                'O e-mail'
            )
        );

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException(
                'Informe um e-mail válido.'
            );
        }

        return $email;
    }

    private static function telefone(array $dados): ?string
    {
        $telefone = self::campo(
            $dados,
            'telefone',
            self::MAX_TELEFONE,
            'O telefone'
        );

        if (
            $telefone !== null &&
            !TelefoneService::validar($telefone)
        ) {
            throw new InvalidArgumentException(
                'O telefone deve possuir 10 ou 11 dígitos.'
            );
        }

        return $telefone;
    }

    private static function campo(
        array $dados,
        string $campo,
        int $maximo,
        string $rotulo
    ): ?string {
        if (
            !array_key_exists($campo, $dados) ||
            $dados[$campo] === null
        ) {
            return null;
        }

        if (!is_scalar($dados[$campo])) {
            throw new InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $valor = trim((string) $dados[$campo]);

        if ($valor === '') {
            return null;
        }

        if (self::tamanho($valor) > $maximo) {
            throw new InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $valor;
    }

    private static function ativo(array $dados): ?bool
    {
        if (!array_key_exists('ativo', $dados)) {
            return null;
        }

        $ativo = filter_var(
            $dados['ativo'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($ativo === null) {
            throw new InvalidArgumentException(
                'Status do contato inválido.'
            );
        }

        return $ativo;
    }

    private static function tamanho(string $valor): int
    {
        return function_exists('mb_strlen')
            ? mb_strlen($valor, 'UTF-8')
            : strlen($valor);
    }

    private static function veiculoId(
        array $dados,
        int $assessoriaId
    ): ?int {
        if (
            !array_key_exists(
                'veiculo_id',
                $dados
            ) ||
            $dados['veiculo_id'] === null ||
            $dados['veiculo_id'] === ''
        ) {
            $nome = self::campo(
                $dados,
                'veiculo_nome',
                150,
                'O nome do veículo'
            );

            if ($nome === null) {
                return null;
            }   
            $nome = VeiculoService::normalizarNome($nome);

            $veiculo = Veiculo::buscarPorNome(
                $nome,
                $assessoriaId
            );

            if ($veiculo) {
                return (int) $veiculo['id'];
            }

            try {
                return Veiculo::criar(
                    $assessoriaId,
                    $nome,
                    null,
                    null,
                    null,
                    true
                );
            } catch (\PDOException $e) {
                if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                    throw $e;
                }

                $veiculo = Veiculo::buscarPorNome(
                    $nome,
                    $assessoriaId
                );

                if ($veiculo) {
                    return (int) $veiculo['id'];
                }

                throw $e;
            }
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

        $veiculo = Veiculo::buscarPorId(
            $id,
            $assessoriaId
        );

        if (!$veiculo) {
            throw new InvalidArgumentException(
                'Veículo inválido.'
            );
        }

        return $id;
    }
}