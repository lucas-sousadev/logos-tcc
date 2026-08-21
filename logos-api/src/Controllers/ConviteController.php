<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\ConviteService;

class ConviteController
{
    public function criar(): void
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

        if (
            !isset($usuarioToken->perfil) ||
            $usuarioToken->perfil !== 'ASSESSOR'
        ) {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' => 'Apenas assessores podem criar convites.'
            ]);

            return;
        }

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $emailDestino = trim(
            $dados['email_destino'] ?? ''
        );

        $emailDestino = $emailDestino !== ''
            ? $emailDestino
            : null;

        try {
            $resultado = ConviteService::criar(
                (int) $usuarioToken->assessoria_id,
                (int) $usuarioToken->sub,
                $emailDestino
            );

            http_response_code(201);

            echo json_encode([
                'success' => true,
                'message' => 'Convite criado com sucesso.',
                'convite' => $resultado
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
                'message' => 'Não foi possível criar o convite.'
            ]);
        }
    }
    
    public function listar(): void
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

        if (
            !isset($usuarioToken->perfil) ||
            $usuarioToken->perfil !== 'ASSESSOR'
        ) {
            http_response_code(403);

            echo json_encode([
                'success' => false,
                'message' => 'Apenas assessores podem visualizar os convites.'
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

        $page = $page !== false && $page !== null
            ? $page
            : 1;

        $limit = $limit !== false && $limit !== null
            ? $limit
            : 20;

        if ($page < 1) {
            $page = 1;
        }

        if ($limit < 1 || $limit > 20) {
            $limit = 20;
        }

        try {
            $resultado = ConviteService::listarPorAssessoria(
                (int) $usuarioToken->assessoria_id,
                $page,
                $limit
            );

            echo json_encode([
                'success' => true,
                'convites' => $resultado['convites'],
                'pagination' => $resultado['pagination']
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível carregar os convites.'
            ]);
        }
    }
    
    public function validar(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $codigo = trim(
            $dados['codigo'] ?? ''
        );

        try {
            $convite = ConviteService::validar(
                $codigo
            );

            echo json_encode([
                'success' => true,
                'message' => 'Convite válido.',
                'convite' => $convite
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\RuntimeException $e) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível validar o convite.'
            ]);
        }
    }
}