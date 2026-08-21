<?php

namespace Logos\AssessoriaApi\Services;

class TelefoneService
{
    public static function normalizar(string $telefone): string
    {
        return preg_replace('/\D/', '', $telefone);
    }

    public static function validar(string $telefone): bool
    {
        $telefone = self::normalizar($telefone);

        /*
         * Brasil:
         * 10 dígitos = telefone fixo
         * 11 dígitos = celular
         */
        return preg_match('/^\d{10,11}$/', $telefone) === 1;
    }
}