<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\RelatorioService;
use Logos\AssessoriaApi\Services\RelatorioPptxService;

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
        } catch (\DomainException $e) {
            $this->responder([
                'success' => false,
                'message' => $e->getMessage(),
            ], 409); 
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

    public function clientes(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::clientesParaSelecao(
                    $assessoriaId,
                    $_GET
                )
        );
    }

    public function atualizar(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) => [
                'message' => 'Relatório atualizado com sucesso.',
                'relatorio' => RelatorioService::atualizar(
                    $assessoriaId,
                    $rota['id'] ?? null,
                    $this->corpo()
                ),
            ]
        );
    }

    public function excluir(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::excluir(
                    $assessoriaId,
                    $rota['id'] ?? null
                )
        );
    }

    public function revisarSlide(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) => [
                'message' => 'Slide marcado como revisado.',
                ...RelatorioService::revisarSlide(
                    $assessoriaId,
                    $rota['id'] ?? null,
                    $rota['slide_id'] ?? null,
                    $this->corpo()
                ),
            ]
        );
    }

    public function materiasParaEdicao(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::materiasParaEdicao(
                    $assessoriaId,
                    $rota['id'] ?? null,
                    $_GET
                )
        );
    }
    
    public function atualizarPeriodo(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                RelatorioService::atualizarPeriodo(
                    $assessoriaId,
                    $usuarioId,
                    $rota['id'] ?? null,
                    $this->corpo()
                )
        );
    }

    public function completarDadosVeiculos(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) => [
                'message' => 'Dados dos veículos conferidos.',
                ...RelatorioService::completarDadosVeiculos(
                    $assessoriaId,
                    $rota['id'] ?? null
                ),
            ]
        );
    }

    public function pptxTeste(array $rota): void
    {
        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responder([
                'success' => false,
                'message' => 'Usuário não autenticado.',
            ], 401);
            return;
        }

        $arquivo = null;

        try {
            $arquivo = RelatorioPptxService::gerar(
                (int) $usuario->assessoria_id,
                $rota['id'] ?? null
            );

            $tamanho = filesize($arquivo);

            if ($tamanho === false || $tamanho < 1) {
                throw new \RuntimeException(
                    'Não foi possível verificar o PPTX gerado.'
                );
            }
        } catch (\Throwable $e) {
            if ($arquivo && is_file($arquivo)) {
                @unlink($arquivo);
            }

            $status = match (true) {
                $e instanceof \OutOfBoundsException => 404,
                $e instanceof \InvalidArgumentException => 422,
                $e instanceof \DomainException => 409,
                default => 500,
            };

            if ($status === 500) {
                error_log('Erro ao gerar PPTX: ' . $e->getMessage());
            }

            $this->responder([
                'success' => false,
                'message' => $status === 500
                    ? 'Não foi possível gerar o PPTX.'
                    : $e->getMessage(),
            ], $status);

            return;
        }

        $nome = 'relatorio-'
            . (int) ($rota['id'] ?? 0)
            . '-teste.pptx';

        http_response_code(200);
        header(
            'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation'
        );
        header(
            'Content-Disposition: attachment; filename="' . $nome . '"'
        );
        header('Content-Length: ' . $tamanho);
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');

        try {
            readfile($arquivo);
        } finally {
            @unlink($arquivo);
        }
    }
    
}