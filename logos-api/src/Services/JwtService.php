<?php

namespace Logos\AssessoriaApi\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class JwtService
{
    public static function gerar(array $usuario): string
    {
        $agora = time();
        $expira = $agora + 7200;

        $payload = [
            'iat' => $agora,
            'exp' => $expira,

            'sub' => (int) $usuario['id'],
            'assessoria_id' => (int) $usuario['assessoria_id'],
            'perfil' => $usuario['perfil']
        ];

        return JWT::encode(
            $payload,
            $_ENV['JWT_SECRET'],
            'HS256'
        );
    }

    public static function decodificar(string $token): object
    {
        return JWT::decode(
            $token,
            new Key($_ENV['JWT_SECRET'], 'HS256')
        );
    }
}