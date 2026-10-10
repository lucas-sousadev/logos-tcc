<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\RelatorioService;

class RelatorioController
{
    private function responder(array $dados, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode(
            $dados,
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    }

    private function corpo(): array
    {
        try {
            $dados = json_decode(
                file_get_contents('php://input'),
                false,
                512,
                JSON_THROW_ON_ERROR
            );
        } catch (\JsonException $e) {
            throw new \UnexpectedValueException('JSON inválido.');
        }

        if (!$dados instanceof \stdClass) {
            throw new \UnexpectedValueException(
                'Envie um objeto JSON no corpo da requisição.'
            );
        }

        return get_object_vars($dados);
    }

    private function executar(callable $acao, int $status = 200): void
    {
        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responder([
                'success' => false,
                'message' => 'Usuário não autenticado.',
            ], 401);

            return;
        }

        try {
            $resultado = $acao(
                (int) $usuario->assessoria_id,
                (int) $usuario->sub
            );

            $this->responder([
                'success' => true,
                ...$resultado,
            ], $status);
        } catch (\OutOfBoundsException $e) {
            $this->responder([
                'success' => false,
                'message' => $e->getMessage(),
            ], 404);
        } catch (\InvalidArgumentException $e) {
            $this->responder([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\UnexpectedValueException $e) {
            $this->responder([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        } catch (\Throwable $e) {
            error_log('Erro no módulo Relatórios: ' . $e->getMessage());

            $this->responder([
                'success' => false,
                'message' => 'Não foi possível concluir a operação.',
            ], 500);
        }
    }

    public function materias(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::materias($assessoriaId, $_GET)
        );
    }

    public function listar(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::listar($assessoriaId, $_GET)
        );
    }

    public function buscar(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::buscar(
                    $assessoriaId,
                    $rota['id'] ?? null,
                    $_GET
                )
        );
    }

    public function criar(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) => [
                'message' => 'Relatório criado com sucesso.',
                'relatorio' => RelatorioService::criar(
                    $assessoriaId,
                    $usuarioId,
                    $this->corpo()
                ),
            ],
            201
        );
    }
}