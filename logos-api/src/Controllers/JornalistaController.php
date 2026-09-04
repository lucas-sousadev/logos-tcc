<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\JornalistaService;

class JornalistaController
{
    public function listar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $page = filter_input(
            INPUT_GET,
            'page',
            FILTER_VALIDATE_INT
        ) ?: 1;

        $limit = filter_input(
            INPUT_GET,
            'limit',
            FILTER_VALIDATE_INT
        ) ?: 50;

        $veiculoId = filter_input(
            INPUT_GET,
            'veiculo_id',
            FILTER_VALIDATE_INT
        );

        $ativo = filter_input(
            INPUT_GET,
            'ativo',
            FILTER_VALIDATE_INT
        );

        if ($ativo === false) {
            $ativo = null;
        }

        try {
            $resultado =
                JornalistaService::listar(
                    (int) $usuario->assessoria_id,
                    $page,
                    $limit,
                    $_GET['busca'] ?? null,
                    $_GET['estado'] ?? null,
                    $_GET['cidade'] ?? null,
                    $_GET['cargo'] ?? null,
                    $veiculoId ?: null,
                    $ativo,
                    $_GET['ordem'] ?? 'nome',
                    $_GET['direcao'] ?? 'ASC'
                );

            echo json_encode([
                'success' => true,
                'jornalistas' =>
                    $resultado['jornalistas'],
                'pagination' =>
                    $resultado['pagination'],
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar o mailing.'
            ]);
        }
    }

    public function buscar(array $dados): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'ID do contato não informado.'
            ]);

            return;
        }

        try {
            $jornalista =
                JornalistaService::buscar(
                    (int) $id,
                    (int) $usuario->assessoria_id
                );

            if (!$jornalista) {
                http_response_code(404);

                echo json_encode([
                    'success' => false,
                    'message' =>
                        'Contato não encontrado.'
                ]);

                return;
            }

            echo json_encode([
                'success' => true,
                'jornalista' => $jornalista
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar o contato.'
            ]);
        }
    }

    public function criar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
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

        if (!is_array($dados)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'JSON inválido.'
            ]);

            return;
        }

        try {
            $id = JornalistaService::criar(
                (int) $usuario->assessoria_id,
                $dados
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contato cadastrado com sucesso.',
                'jornalista_id' => $id,
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível cadastrar o contato.'
            ]);
        }
    }

    public function atualizar(array $dados): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'ID do contato não informado.'
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
            JornalistaService::atualizar(
                (int) $id,
                (int) $usuario->assessoria_id,
                $body
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contato atualizado com sucesso.'
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível atualizar o contato.'
            ]);
        }
    }

    public function excluir(array $dados): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'ID do contato não informado.'
            ]);

            return;
        }

        try {
            JornalistaService::excluir(
                (int) $id,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contato excluído com sucesso.'
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível excluir este contato. Ele pode estar vinculado a registros existentes.'
            ]);
        }
    }
}