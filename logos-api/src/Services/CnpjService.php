<?php

namespace Logos\AssessoriaApi\Services;

class CnpjService
{
    public static function normalizar(string $cnpj): string
    {
        return strtoupper(
            preg_replace('/[^A-Za-z0-9]/', '', $cnpj)
        );
    }

    public static function validar(string $cnpj): bool
    {
        $cnpj = self::normalizar($cnpj);

        /*
         * CNPJ possui 14 posições.
         * As 12 primeiras podem conter A-Z ou 0-9.
         * Os 2 dígitos verificadores são numéricos.
         */
        if (!preg_match('/^[A-Z0-9]{12}[0-9]{2}$/', $cnpj)) {
            return false;
        }

        
         /* Evita valores compostos por um único caractere repetido. */
        if (count(array_unique(str_split($cnpj))) === 1) {
            return false;
        }

        $base = substr($cnpj, 0, 12);

        $primeiroDv = self::calcularDigito(
            $base,
            [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        );

        if ((int) $cnpj[12] !== $primeiroDv) {
            return false;
        }

        $segundoDv = self::calcularDigito(
            $base . $primeiroDv,
            [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        );

        return (int) $cnpj[13] === $segundoDv;
    }

    private static function calcularDigito(
        string $valor,
        array $pesos
    ): int {
        $soma = 0;

        foreach (str_split($valor) as $index => $caractere) {
            $valorCaractere = ord($caractere) - 48;

            $soma += $valorCaractere * $pesos[$index];
        }

        $resto = $soma % 11;

        return $resto < 2 ? 0 : 11 - $resto;
    }
}