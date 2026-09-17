<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\ClippingService;
use Logos\AssessoriaApi\Services\ClippingAnexoService;
use Logos\AssessoriaApi\Services\ClippingCsvService;
use Logos\AssessoriaApi\Services\ClippingImportacaoService;

class ClippingController
{
    private function responder(
        array $dados,
        int $status
    ): void {
        http_response_code($status);

        header(
            'Content-Type: application/json; charset=utf-8'
        );

        echo json_encode(
            $dados,
            JSON_UNESCAPED_UNICODE
                | JSON_THROW_ON_ERROR
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
            throw new \UnexpectedValueException(
                'JSON inválido.'
            );
        }

        if (!$dados instanceof \stdClass) {
            throw new \UnexpectedValueException(
                'Envie um objeto JSON no corpo da requisição.'
            );
        }

        return get_object_vars($dados);
    }

    private function executar(
        callable $acao,
        int $status = 200
    ): void {
        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responder(
                [
                    'success' => false,
                    'message' => 'Usuário não autenticado.',
                ],
                401
            );

            return;
        }

        try {
            $resultado = $acao(
                (int) $usuario->assessoria_id,
                (int) $usuario->sub
            );

            $this->responder(
                [
                    'success' => true,
                    ...$resultado,
                ],
                $status
            );
        } catch (\OutOfBoundsException $e) {
            $this->responder(
                [
                    'success' => false,
                    'message' => $e->getMessage(),
                ],
                404
            );
          } catch (\LengthException $e) {
            $this->responder(
                [
                    'success' => false,
                    'message' => $e->getMessage(),
                ],
                413
            );
        } catch (\InvalidArgumentException $e) {
            $this->responder(
                [
                    'success' => false,
                    'message' => $e->getMessage(),
                ],
                422
            );
        } catch (\DomainException $e) {
            $this->responder(
                [
                    'success' => false,
                    'message' => $e->getMessage(),
                ],
                409
            );
        } catch (\UnexpectedValueException $e) {
            $this->responder(
                [
                    'success' => false,
                    'message' => $e->getMessage(),
                ],
                400
            );
        } catch (\Throwable $e) {
            error_log(
                'Erro no módulo Clipping: '
                    . $e->getMessage()
            );

            $this->responder(
                [
                    'success' => false,
                    'message' =>
                        'Não foi possível concluir a operação.',
                ],
                500
            );
        }
    }

    public function listar(): void
    {
        $this->executar(
            fn(int $a, int $u) =>
                ClippingService::listar($a, $_GET)
        );
    }

    public function anos(): void
    {
        $this->executar(
            fn(int $a, int $u) =>
                ClippingService::anos($a)
        );
    }

    public function clientesPorAno(
        array $rota
    ): void {
        $this->executar(
            fn(int $a, int $u) =>
                ClippingService::clientesPorAno(
                    $a,
                    $rota['ano'] ?? null,
                    $_GET
                )
        );
    }

    public function pautas(): void
    {
        $this->executar(
            fn(int $a, int $u) =>
                ClippingService::pautas($a, $_GET)
        );
    }

    public function buscar(
        array $rota
    ): void {
        $this->executar(
            fn(int $a, int $u) => [
                'clipping' => ClippingService::buscar(
                    $rota['id'] ?? null,
                    $a
                ),
            ]
        );
    }

    public function criar(): void
    {
        $this->executar(
            fn(int $a, int $u) => [
                'message' =>
                    'Clipping cadastrado com sucesso.',

                'clipping' => ClippingService::criar(
                    $a,
                    $u,
                    $this->corpo()
                ),
            ],
            201
        );
    }

    public function atualizar(
        array $rota
    ): void {
        $this->executar(
            fn(int $a, int $u) => [
                'message' =>
                    'Clipping atualizado com sucesso.',

                'clipping' => ClippingService::atualizar(
                    $rota['id'] ?? null,
                    $a,
                    $this->corpo()
                ),
            ]
        );
    }

        public function listarAnexos(array $rota): void
    {
        $this->executar(
            fn(int $a, int $u) => ClippingAnexoService::listar(
                $a,
                $rota['id'] ?? null,
                $_GET
            )
        );
    }
    
    public function excluir(array $rota): void
    {
        $this->executar(
            fn(int $a, int $u) => ClippingService::excluir(
                $rota['id'] ?? null,
                $a
            )
        );
    }

    public function excluirEmLote(): void
    {
        $this->executar(
            function (int $assessoriaId, int $usuarioId): array {
                $dados = $this->corpo();

                return ClippingService::excluirEmLote(
                    $dados['ids'] ?? null,
                    $assessoriaId
                );
            }
        );
    }

    public function buscarAnexo(array $rota): void
    {
        $this->executar(fn(int $a, int $u) => [
            'anexo' => ClippingAnexoService::buscar(
                $a,
                $rota['id'] ?? null,
                $rota['anexo_id'] ?? null
            ),
        ]);
    }

    public function criarAnexo(array $rota): void
    {
        $this->executar(
            fn(int $a, int $u) => [
                'message' => 'Anexo enviado com sucesso.',

                'anexo' => ClippingAnexoService::criar(
                    $a,
                    $u,
                    $rota['id'] ?? null
                ),
            ],
            201
        );
    }

    public function atualizarAnexo(array $rota): void
    {
        $this->executar(fn(int $a, int $u) => [
            'message' => 'Anexo atualizado com sucesso.',

            'anexo' => ClippingAnexoService::atualizar(
                $a,
                $rota['id'] ?? null,
                $rota['anexo_id'] ?? null,
                $this->corpo()
            ),
        ]);
    }

    public function excluirAnexo(array $rota): void
    {
        $this->executar(
            fn(int $a, int $u) => ClippingAnexoService::excluir(
                $a,
                $rota['id'] ?? null,
                $rota['anexo_id'] ?? null
            )
        );
    }

    public function arquivoAnexo(array $rota): void
    {
        $this->executar(
            fn(int $a, int $u) => ClippingAnexoService::arquivo(
                $a,
                $rota['id'] ?? null,
                $rota['anexo_id'] ?? null,
                $_GET['download'] ?? 0
            )
        );
    }

    public function exportar(): void
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
            $arquivo = ClippingCsvService::gerar(
                (int) $usuario->assessoria_id,
                $this->corpo()
            );

            $info = fstat($arquivo);

            if ($info === false) {
                throw new \RuntimeException(
                    'Não foi possível verificar o arquivo gerado.'
                );
            }
        } catch (\Throwable $e) {
            if (is_resource($arquivo)) {
                fclose($arquivo);
            }

            $status = match (true) {
                $e instanceof \OutOfBoundsException => 404,
                $e instanceof \InvalidArgumentException => 422,
                $e instanceof \DomainException => 409,
                $e instanceof \UnexpectedValueException => 400,
                default => 500,
            };

            if ($status === 500) {
                error_log(
                    'Erro na exportação de clipping: '
                    . $e->getMessage()
                );
            }

            $this->responder([
                'success' => false,
                'message' => $status === 500
                    ? 'Não foi possível gerar o CSV.'
                    : $e->getMessage(),
            ], $status);

            return;
        }

        $nome = 'clippings-' . date('Y-m-d-His') . '.csv';

        http_response_code(200);
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $nome . '"');
        header('Content-Length: ' . $info['size']);
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');

        try {
            fpassthru($arquivo);
        } finally {
            fclose($arquivo);
        }
    }
    
    public function previaImportacao(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                ClippingImportacaoService::previa(
                    $assessoriaId,
                    $usuarioId,
                    $_FILES['arquivo'] ?? null,
                    $_POST
                )
        );
    }

    public function confirmarImportacao(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                ClippingImportacaoService::confirmar(
                    $assessoriaId,
                    $usuarioId,
                    $this->corpo()
                )
        );
    }
}