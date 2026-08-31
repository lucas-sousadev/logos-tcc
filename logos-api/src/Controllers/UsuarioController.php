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
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        if ($usuarioToken->perfil !== 'ASSESSOR') {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' => 'Apenas assessores podem listar funcionários.'
            ]);

            return;
        }

        try {
            $funcionarios = UsuarioService::listarFuncionarios(
                (int) $usuarioToken->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'funcionarios' => $funcionarios
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível carregar os funcionários.'
            ]);
        }
    }
}