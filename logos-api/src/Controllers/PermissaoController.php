<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\PermissaoService;
use Logos\AssessoriaApi\Models\Usuario;

class PermissaoController
{
    public function listarTodas(): void
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

        try {
            $permissoes =
                PermissaoService::listarConcediveis(
                    (int) $usuarioToken->sub,
                    $usuarioToken->perfil
                );

            echo json_encode([
                'success' => true,
                'permissoes' => $permissoes
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível carregar as permissões.'
            ]);
        }
    }

    public function listarDoFuncionario(): void
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

        $usuarioId = filter_input(
            INPUT_GET,
            'usuario_id',
            FILTER_VALIDATE_INT
        );

        if (!$usuarioId) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não informado.'
            ]);

            return;
        }

        $funcionario = Usuario::buscarPorId(
            (int) $usuarioId
        );

        if (!$funcionario) {
            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não encontrado.'
            ]);

            return;
        }

        if (
            (int) $funcionario['assessoria_id']
            !== (int) $usuarioToken->assessoria_id
        ) {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não pertence à sua assessoria.'
            ]);

            return;
        }

        if ($funcionario['perfil'] !== 'FUNCIONARIO') {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'As permissões desta rota são destinadas a funcionários.'
            ]);

            return;
        }

        if (
            $usuarioToken->perfil !== 'ASSESSOR' &&
            !PermissaoService::usuarioTemPermissao(
                (int) $usuarioToken->sub,
                $usuarioToken->perfil,
                'USUARIOS',
                'GERENCIAR_PERMISSOES'
            )
        ) {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Você não possui permissão para gerenciar permissões.'
            ]);

            return;
        }

        try {
            $permissoes = PermissaoService::listarDoUsuario(
                (int) $usuarioId
            );

            echo json_encode([
                'success' => true,
                'usuario_id' => (int) $usuarioId,
                'permissoes' => $permissoes
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível carregar as permissões do funcionário.'
            ]);
        }
    }

    public function atualizarFuncionario(): void
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

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $usuarioId = (int) (
            $dados['usuario_id'] ?? 0
        );

        $permissaoIds = $dados['permissoes'] ?? [];

        if ($usuarioId <= 0) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não informado.'
            ]);

            return;
        }

        if (!is_array($permissaoIds)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'O campo permissoes deve ser uma lista.'
            ]);

            return;
        }

        $funcionario = Usuario::buscarPorId(
            $usuarioId
        );

        if (!$funcionario) {
            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não encontrado.'
            ]);

            return;
        }

        if (
            (int) $funcionario['assessoria_id']
            !== (int) $usuarioToken->assessoria_id
        ) {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não pertence à sua assessoria.'
            ]);

            return;
        }

        if ($funcionario['perfil'] !== 'FUNCIONARIO') {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Só é possível alterar permissões de funcionários.'
            ]);

            return;
        }

        try {
            PermissaoService::substituirPorGestor(
                (int) $usuarioToken->sub,
                $usuarioToken->perfil,
                $usuarioId,
                $permissaoIds
            );

            echo json_encode([
                'success' => true,
                'message' => 'Permissões atualizadas com sucesso.'
            ]);

        } catch (\DomainException $e) {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível atualizar as permissões.'
            ]);
        }
    }
}