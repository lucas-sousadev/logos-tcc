<?php

namespace Logos\AssessoriaApi\Middleware;

use CoffeeCode\Router\Router;
use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\PermissaoService;

class PermissionMiddleware
{
    public function handle(Router $router): bool
    {
        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return false;
        }

        $rota = $router->current();

        if (!$rota) {
            http_response_code(500);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível identificar a rota.'
            ]);

            return false;
        }

        $nomeRota = $rota->name ?? null;

        if (!$nomeRota) {
            http_response_code(500);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'A rota não possui permissão configurada.'
            ]);

            return false;
        }

        $partes = explode('.', $nomeRota);

        if (count($partes) !== 2) {
            http_response_code(500);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Formato de permissão da rota inválido.'
            ]);

            return false;
        }

        [$modulo, $acao] = $partes;

        $permitido =
            PermissaoService::usuarioTemPermissao(
                (int) $usuario->sub,
                $usuario->perfil,
                strtoupper($modulo),
                strtoupper($acao)
            );

        if (!$permitido) {
            http_response_code(403);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Você não possui permissão para realizar esta ação.'
            ]);

            return false;
        }

        return true;
    }
}