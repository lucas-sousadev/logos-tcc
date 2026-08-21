<?php

namespace Logos\AssessoriaApi\Middleware;

use Logos\AssessoriaApi\Services\AuthContext;
use CoffeeCode\Router\Router;
use Logos\AssessoriaApi\Services\JwtService;

class AuthMiddleware
{
    public function handle(Router $router): bool
    {   
        $headers = getallheaders();

        $authorization =
            $headers['Authorization']
            ?? $headers['authorization']
            ?? $_SERVER['HTTP_AUTHORIZATION']
            ?? '';

        if (!str_starts_with($authorization, 'Bearer ')) {
            http_response_code(401);

            header('Content-Type: application/json; charset=utf-8');

            echo json_encode([
                'success' => false,
                'message' => 'Token não informado.'
            ]);

            return false;
        }

        $token = substr($authorization, 7);

        try {
            $usuario = JwtService::decodificar($token);
            
            AuthContext::set($usuario);

            return true;
        } catch (\Throwable $e) {
            http_response_code(401);

            header('Content-Type: application/json; charset=utf-8');

            echo json_encode([
                'success' => false,
                'message' => 'Token inválido ou expirado.'
            ]);

            return false;
        }
    }
}