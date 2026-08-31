<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Permissao;
use RuntimeException;

class PermissaoService
{
    public static function listarTodas(): array
    {
        return Permissao::listarTodas();
    }

    public static function listarDoUsuario(
        int $usuarioId
    ): array {
        return Permissao::listarPorUsuario(
            $usuarioId
        );
    }

    public static function substituir(
        int $usuarioId,
        array $permissaoIds
    ): void {
        $permissaoIds = array_values(
            array_unique(
                array_map(
                    'intval',
                    $permissaoIds
                )
            )
        );

        if (!empty($permissaoIds)) {
            foreach ($permissaoIds as $permissaoId) {
                if ($permissaoId <= 0) {
                    throw new \InvalidArgumentException(
                        'ID de permissão inválido.'
                    );
                }
            }
        }

        Permissao::substituirDoUsuario(
            $usuarioId,
            $permissaoIds
        );
    }

    public static function usuarioTemPermissao(
        int $usuarioId,
        string $perfil,
        string $modulo,
        string $acao
    ): bool {
        /*
         * Assessor possui acesso total por regra.
         */
        if ($perfil === 'ASSESSOR') {
            return true;
        }

        $permissao = Permissao::buscarPorModuloAcao(
            $modulo,
            $acao
        );

        if (!$permissao) {
            return false;
        }

        return Permissao::usuarioTemPermissao(
            $usuarioId,
            (int) $permissao['id']
        );
    }

    public static function exigir(
        int $usuarioId,
        string $perfil,
        string $modulo,
        string $acao
    ): void {
        if (!self::usuarioTemPermissao(
            $usuarioId,
            $perfil,
            $modulo,
            $acao
        )) {
            throw new RuntimeException(
                "Você não possui permissão para {$acao} em {$modulo}."
            );
        }
    }
}