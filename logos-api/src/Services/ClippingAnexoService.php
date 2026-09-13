<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Clipping;
use Logos\AssessoriaApi\Models\ClippingAnexo;

class ClippingAnexoService
{
    private static function inteiro(
        mixed $valor,
        string $campo,
        int $min = 1,
        int $max = PHP_INT_MAX
    ): int {
        if (
            (!is_int($valor) && !is_string($valor))
            || filter_var(
                $valor,
                FILTER_VALIDATE_INT,
                [
                    'options' => [
                        'min_range' => $min,
                        'max_range' => $max,
                    ],
                ]
            ) === false
        ) {
            throw new \InvalidArgumentException("{$campo} inválido.");
        }

        return (int) $valor;
    }

    private static function clipping(
        int $a,
        int $c,
        bool $editar = false
    ): void {
        $clipping = Clipping::buscarPorId($c, $a, $editar);

        if (!$clipping) {
            throw new \OutOfBoundsException(
                'Clipping não encontrado.'
            );
        }

        if ($editar && $clipping['arquivado_em'] !== null) {
            throw new \DomainException(
                'Restaure o clipping antes de alterar seus anexos.'
            );
        }
    }

    private static function registro(int $a, int $c, int $id): array
    {
        return ClippingAnexo::buscar($a, $c, $id)
            ?? throw new \OutOfBoundsException('Anexo não encontrado.');
    }

    private static function resposta(array $anexo): array
    {
        $anexo['metadados'] =
            $anexo['metadados_json'] === null
                ? null
                : json_decode(
                    $anexo['metadados_json'],
                    false,
                    512,
                    JSON_THROW_ON_ERROR
                );

        $anexo['arquivo_endpoint'] =
            '/clippings/' . $anexo['clipping_id']
            . '/anexos/' . $anexo['id']
            . '/arquivo';

        unset($anexo['arquivo_path'], $anexo['metadados_json']);

        return $anexo;
    }

    private static function transacao(callable $acao): mixed
    {
        $pdo = Connection::get();

        $pdo->beginTransaction();

        try {
            $resultado = $acao();

            $pdo->commit();

            return $resultado;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function listar(
        int $a,
        mixed $clippingId,
        array $query
    ): array {
        $c = self::inteiro($clippingId, 'ID do clipping');

        self::clipping($a, $c);

        $page = self::inteiro(
            $query['page'] ?? 1,
            'Página',
            1,
            1000000
        );

        $limit = self::inteiro(
            $query['limit'] ?? 50,
            'Limite',
            1,
            100
        );

        $offset = ($page - 1) * $limit;
        $total = (int) ClippingAnexo::resumo($a, $c)['total'];

        return [
            'anexos' => array_map(
                [self::class, 'resposta'],
                ClippingAnexo::listar($a, $c, $limit, $offset)
            ),

            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => $offset + $limit < $total,
            ],
        ];
    }

    public static function buscar(
        int $a,
        mixed $clippingId,
        mixed $anexoId
    ): array {
        $c = self::inteiro($clippingId, 'ID do clipping');
        $id = self::inteiro($anexoId, 'ID do anexo');

        self::clipping($a, $c);

        return self::resposta(self::registro($a, $c, $id));
    }

    public static function criar(
        int $a,
        int $u,
        mixed $clippingId
    ): array {
        $c = self::inteiro($clippingId, 'ID do clipping');

        self::clipping($a, $c);

        $validado = ArquivoClippingService::validarUpload();
        $salvo = null;

        try {
            $anexo = self::transacao(
                function () use ($a, $c, $u, $validado, &$salvo) {
                    // Serializa alterações dos anexos deste clipping.
                    self::clipping($a, $c, true);

                    $salvo = ArquivoClippingService::salvar(
                        $validado,
                        $a,
                        $c
                    );

                    $id = ClippingAnexo::criar($a, $c, $u, $salvo);

                    return self::registro($a, $c, $id);
                }
            );
        } catch (\Throwable $e) {
            if ($salvo !== null) {
                ArquivoClippingService::remover([
                    ...$salvo,
                    'assessoria_id' => $a,
                    'clipping_id' => $c,
                ]);
            }

            throw $e;
        }

        return self::resposta($anexo);
    }

    private static function campos(array $dados): array
    {
        if (
            !$dados
            || array_diff(
                array_keys($dados),
                ['principal', 'imagem_relatorio', 'ordem']
            )
        ) {
            throw new \InvalidArgumentException(
                'Envie principal, imagem_relatorio ou ordem.'
            );
        }

        $campos = [];

        foreach (['principal', 'imagem_relatorio'] as $campo) {
            if (!array_key_exists($campo, $dados)) {
                continue;
            }

            if ($dados[$campo] !== null && !is_bool($dados[$campo])) {
                throw new \InvalidArgumentException(
                    "{$campo} deve ser true, false ou null."
                );
            }

            $campos[$campo] = $dados[$campo] === true ? 1 : null;
        }

        if (array_key_exists('ordem', $dados)) {
            $campos['ordem'] = self::inteiro(
                $dados['ordem'],
                'Ordem',
                0,
                4294967295
            );
        }

        return $campos;
    }

    public static function atualizar(
        int $a,
        mixed $clippingId,
        mixed $anexoId,
        array $dados
    ): array {
        $c = self::inteiro($clippingId, 'ID do clipping');
        $id = self::inteiro($anexoId, 'ID do anexo');

        $anexo = self::transacao(
            function () use ($a, $c, $id, $dados) {
                self::clipping($a, $c, true);

                $atual = self::registro($a, $c, $id);
                $campos = self::campos($dados);

                if (
                    ($campos['imagem_relatorio'] ?? null) === 1
                    && $atual['tipo'] !== 'IMAGEM'
                ) {
                    throw new \InvalidArgumentException(
                        'Somente imagens podem ser a imagem do relatório.'
                    );
                }

                ClippingAnexo::atualizar($a, $c, $id, $campos);

                return self::registro($a, $c, $id);
            }
        );

        return self::resposta($anexo);
    }

    public static function excluir(
        int $a,
        mixed $clippingId,
        mixed $anexoId
    ): array {
        $c = self::inteiro($clippingId, 'ID do clipping');
        $id = self::inteiro($anexoId, 'ID do anexo');

        $anexo = self::transacao(
            function () use ($a, $c, $id) {
                self::clipping($a, $c, true);

                $atual = self::registro($a, $c, $id);

                if (ClippingAnexo::temDependencias($a, $c, $id)) {
                    throw new \DomainException(
                        'Este anexo possui derivados ou o clipping está vinculado a um relatório.'
                    );
                }

                ClippingAnexo::excluir($a, $c, $id);

                return $atual;
            }
        );

        $removido = ArquivoClippingService::remover($anexo);

        return [
            'message' => $removido
                ? 'Anexo excluído com sucesso.'
                : 'Anexo excluído do clipping. A limpeza do arquivo físico ficou pendente no servidor.',

            'limpeza_pendente' => !$removido,
        ];
    }

    public static function arquivo(
        int $a,
        mixed $clippingId,
        mixed $anexoId,
        mixed $download
    ): never {
        $c = self::inteiro($clippingId, 'ID do clipping');
        $id = self::inteiro($anexoId, 'ID do anexo');
        $baixar = self::inteiro($download, 'Download', 0, 1);

        self::clipping($a, $c);

        ArquivoClippingService::enviar(
            self::registro($a, $c, $id),
            $baixar === 1
        );
    }
}