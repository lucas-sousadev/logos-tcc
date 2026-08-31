<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Usuario;

class UsuarioService
{
    public static function listarFuncionarios(
        int $assessoriaId
    ): array {
        return Usuario::listarFuncionariosPorAssessoria(
            $assessoriaId
        );
    }
} 