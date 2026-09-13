<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\ClippingService;
use Logos\AssessoriaApi\Services\ClippingAnexoService;

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
}