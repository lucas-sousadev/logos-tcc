<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\UsuarioService;

class UsuarioController
{
    public function listarFuncionarios(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $usuarioToken = AuthContext::get();

        if (!$usuarioToken) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.',
            ]);

            return;
        }

        if ($usuarioToken->perfil !== 'ASSESSOR') {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Apenas assessores podem listar funcionários.',
            ]);

            return;
        }

        $page = filter_input(
            INPUT_GET,
            'page',
            FILTER_VALIDATE_INT
        );

        $limit = filter_input(
            INPUT_GET,
            'limit',
            FILTER_VALIDATE_INT
        );

        $ativoRecebido = filter_input(
            INPUT_GET,
            'ativo',
            FILTER_VALIDATE_INT
        );

        $ativo = in_array(
            $ativoRecebido,
            [0, 1],
            true
        )
            ? $ativoRecebido
            : null;

        try {
            $resultado =
                UsuarioService::listarFuncionarios(
                    (int) $usuarioToken->assessoria_id,
                    $page ?: 1,
                    $limit ?: 50,
                    $_GET['busca'] ?? null,
                    $ativo
                );

            echo json_encode([
                'success' => true,
                ...$resultado,
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar os funcionários.',
            ]);
        }
    }

    public function buscarFuncionario(
        array $dados
    ): void {
        header('Content-Type: application/json; charset=utf-8');

        $usuarioToken = AuthContext::get();

        if (!$usuarioToken) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.',
            ]);

            return;
        }

        if ($usuarioToken->perfil !== 'ASSESSOR') {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Apenas assessores podem visualizar funcionários.',
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id || $id <= 0) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID do funcionário inválido.',
            ]);

            return;
        }

        try {
            $funcionario =
                UsuarioService::buscarFuncionario(
                    $id,
                    (int) $usuarioToken->assessoria_id
                );

            if (!$funcionario) {
                http_response_code(404);

                echo json_encode([
                    'success' => false,
                    'message' =>
                        'Funcionário não encontrado.',
                ]);

                return;
            }

            echo json_encode([
                'success' => true,
                'funcionario' => $funcionario,
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar o funcionário.',
            ]);
        }
    }
}