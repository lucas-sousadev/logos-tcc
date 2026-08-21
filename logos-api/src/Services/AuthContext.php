<?php

namespace Logos\AssessoriaApi\Services;

class AuthContext
{
    private static ?object $usuario = null;

    public static function set(object $usuario): void
    {
        self::$usuario = $usuario;
    }

    public static function get(): ?object
    {
        return self::$usuario;
    }

    public static function clear(): void
    {
        self::$usuario = null;
    }
}