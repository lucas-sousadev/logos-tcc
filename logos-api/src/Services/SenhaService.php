<?php

namespace Logos\AssessoriaApi\Services;

use InvalidArgumentException;

final class SenhaService
{
    public const MINIMO_CARACTERES = 8;

    public static function validar(mixed $senha): string
    {
        if (!is_string($senha)) {
            throw new InvalidArgumentException(
                'A senha é inválida.'
            );
        }

        $tamanho = function_exists('mb_strlen')
            ? mb_strlen($senha, 'UTF-8')
            : strlen($senha);

        if ($tamanho < self::MINIMO_CARACTERES) {
            throw new InvalidArgumentException(
                'A senha deve possuir pelo menos 8 caracteres.'
            );
        }

        return $senha;
    }
}