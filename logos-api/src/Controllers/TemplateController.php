<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\PermissaoService;
use Logos\AssessoriaApi\Services\ReleaseImagemService;
use Logos\AssessoriaApi\Services\TemplateService;

final class TemplateController
{
    private function corpo(): array
    {
        $corpo = file_get_contents(
            'php://input',
            false,
            null,
            0,
            1048577
        );

        if ($corpo === false) {
            throw new \UnexpectedValueException(
                'Não foi possível ler a requisição.'
            );
        }

        if (strlen($corpo) > 1048576) {
            throw new \LengthException(
                'O template ultrapassou o limite de 1 MB.'
            );
        }

        try {
            $objeto = json_decode(
                $corpo,
                false,
                64,
                JSON_THROW_ON_ERROR
            );
        } catch (\JsonException) {
            throw new \UnexpectedValueException(
                'JSON inválido.'
            );
        }

        if (!$objeto instanceof \stdClass) {
            throw new \UnexpectedValueException(
                'Envie um objeto JSON.'
            );
        }

        return json_decode(
            $corpo,
            true,
            64,
            JSON_THROW_ON_ERROR
        );
    }

    private function executar(
        callable $acao,
        int $status = 200
    ): void {
        $usuario = AuthContext::get();
        $statusResposta = $status;

        try {
            if (!$usuario) {
                throw new \RuntimeException(
                    'Usuário não autenticado.',
                    401
                );
            }

            $resultado = [
                'success' => true,
                ...$acao($usuario),
            ];
        } catch (\Throwable $erro) {
            $statusResposta = match (true) {
                $erro instanceof \OutOfBoundsException => 404,
                $erro instanceof \LengthException => 413,
                $erro instanceof \UnexpectedValueException => 400,
                $erro instanceof \InvalidArgumentException => 422,
                $erro instanceof \DomainException => 409,

                $erro instanceof \RuntimeException
                    && in_array(
                        $erro->getCode(),
                        [401, 403, 503],
                        true
                    ) => $erro->getCode(),

                default => 500,
            };

            if ($statusResposta === 500) {
                error_log(
                    'Erro em Templates: ' . $erro->getMessage()
                );
            }

            $resultado = [
                'success' => false,
                'message' => $statusResposta === 500
                    ? 'Não foi possível concluir a operação.'
                    : $erro->getMessage(),
            ];
        }

        http_response_code($statusResposta);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode(
            $resultado,
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    }

    public function listar(): void
    {
        $this->executar(
            fn(object $u) => TemplateService::listar(
                (int) $u->assessoria_id,
                $_GET
            )
        );
    }

    public function criar(): void
    {
        $this->executar(
            fn(object $u) => [
                'template' => TemplateService::salvar(
                    (int) $u->assessoria_id,
                    (int) $u->sub,
                    $this->corpo()
                ),
            ],
            201
        );
    }

    public function atualizar(array $rota): void
    {
        $this->executar(
            fn(object $u) => [
                'template' => TemplateService::salvar(
                    (int) $u->assessoria_id,
                    (int) $u->sub,
                    $this->corpo(),
                    $rota['id']
                ),
            ]
        );
    }

    public function excluir(array $rota): void
    {
        $this->executar(function (object $u) use ($rota): array {
            TemplateService::excluir(
                (int) $u->assessoria_id,
                $rota['id']
            );

            return ['message' => 'Template removido.'];
        });
    }

    public function carregarImagem(): void
    {
        $this->executar(function (object $u): array {
            if (
                !PermissaoService::usuarioTemPermissao(
                    (int) $u->sub,
                    $u->perfil,
                    'TEMPLATES',
                    'CRIAR'
                )
                && !PermissaoService::usuarioTemPermissao(
                    (int) $u->sub,
                    $u->perfil,
                    'TEMPLATES',
                    'EDITAR'
                )
            ) {
                throw new \RuntimeException(
                    'Você não possui permissão para carregar imagens de templates.',
                    403
                );
            }

            return [
                'caminho' => ReleaseImagemService::salvar(
                    (int) $u->assessoria_id
                ),
            ];
        }, 201);
    }
}