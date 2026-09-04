<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\VeiculoService;

class VeiculoController
{
    public function listar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $assessoriaId =
            (int) $usuario->assessoria_id;

        try {
            $resultado =
                VeiculoService::listar(
                    $assessoriaId,
                    [
                        'page' =>
                            $_GET['page'] ?? 1,
                        'limit' =>
                            $_GET['limit'] ?? 50,
                        'busca' =>
                            $_GET['busca'] ?? '',
                        'ativo' =>
                            $_GET['ativo'] ?? null
                    ]
                );

            echo json_encode([
                'success' => true,
                ...$resultado
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar os veículos.'
            ]);
        }
    }

    public function buscar(
        array $dados
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.'
            ]);

            return;
        }

        try {
            $veiculo =
                VeiculoService::buscarPorId(
                    $id,
                    (int) $usuario->assessoria_id
                );

            echo json_encode([
                'success' => true,
                'veiculo' => $veiculo
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }

    public function criar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (!is_array($dados)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'JSON inválido.'
            ]);

            return;
        }

        try {
            $veiculo =
                VeiculoService::criar(
                    (int) $usuario->assessoria_id,
                    $dados
                );

            http_response_code(201);

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo criado com sucesso.',
                'veiculo' => $veiculo
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível criar o veículo.'
            ]);
        }
    }

    public function atualizar(
        array $dados
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.'
            ]);

            return;
        }

        $body = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (!is_array($body)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'JSON inválido.'
            ]);

            return;
        }

        try {
            $veiculo =
                VeiculoService::atualizar(
                    $id,
                    (int) $usuario->assessoria_id,
                    $body
                );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo atualizado com sucesso.',
                'veiculo' => $veiculo
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(
                str_contains(
                    $e->getMessage(),
                    'não encontrado'
                )
                    ? 404
                    : 409
            );

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível atualizar o veículo.'
            ]);
        }
    }

    public function excluir(
        array $dados
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.'
            ]);

            return;
        }

        try {
            VeiculoService::excluir(
                $id,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo excluído com sucesso.'
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(
                str_contains(
                    $e->getMessage(),
                    'não encontrado'
                )
                    ? 404
                    : 409
            );

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível excluir o veículo.'
            ]);
        }
    }
}