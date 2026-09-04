<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Usuario;

class UsuarioService
{
    public static function listarFuncionarios(
        int $assessoriaId,
        int $page = 1,
        int $limit = 50,
        ?string $busca = null,
        ?int $ativo = null
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));

        $offset = ($page - 1) * $limit;

        $funcionarios =
            Usuario::listarFuncionariosPorAssessoria(
                $assessoriaId,
                $limit,
                $offset,
                $busca,
                $ativo
            );

        $total =
            Usuario::contarFuncionariosPorAssessoria(
                $assessoriaId,
                $busca,
                $ativo
            );

        return [
            'funcionarios' => $funcionarios,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' =>
                    ($offset + count($funcionarios)) < $total,
            ],
        ];
    }

    public static function buscarFuncionario(
        int $id,
        int $assessoriaId
    ): ?array {
        return Usuario::buscarFuncionarioPorId(
            $id,
            $assessoriaId
        );
    }
}