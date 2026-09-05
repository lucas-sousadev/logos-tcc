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

    public static function listarConcediveis(
        int $usuarioId,
        string $perfil
    ): array {
        if ($perfil === 'ASSESSOR') {
            return self::listarTodas();
        }

        return self::listarDoUsuario(
            $usuarioId
        );
    }

    public static function substituir(
        int $usuarioId,
        array $permissaoIds
    ): void {
        $permissaoIds =
            self::normalizarPermissaoIds(
                $permissaoIds
            );

        Permissao::substituirDoUsuario(
            $usuarioId,
            $permissaoIds
        );
    }

    public static function substituirPorGestor(
        int $gestorId,
        string $perfilGestor,
        int $funcionarioId,
        array $permissaoIds
    ): void {
        $permissaoIds =
            self::normalizarPermissaoIds(
                $permissaoIds
            );

        if ($perfilGestor !== 'ASSESSOR') {
            if ($gestorId === $funcionarioId) {
                throw new \DomainException(
                    'Você não pode alterar as próprias permissões.'
                );
            }

            $permissoesDoGestor =
                self::idsDoUsuario($gestorId);

            $permissoesAtuaisDoFuncionario =
                self::idsDoUsuario($funcionarioId);

            $acessosSuperioresAtuais = array_diff(
                $permissoesAtuaisDoFuncionario,
                $permissoesDoGestor
            );

            if (!empty($acessosSuperioresAtuais)) {
                throw new \DomainException(
                    'Você não pode administrar um funcionário com permissões superiores às suas.'
                );
            }

            $acessosSuperioresSolicitados = array_diff(
                $permissaoIds,
                $permissoesDoGestor
            );

            if (!empty($acessosSuperioresSolicitados)) {
                throw new \DomainException(
                    'Você só pode conceder permissões que possui.'
                );
            }
        }

        Permissao::substituirDoUsuario(
            $funcionarioId,
            $permissaoIds
        );
    }

    public static function usuarioTemPermissao(
        int $usuarioId,
        string $perfil,
        string $modulo,
        string $acao
    ): bool {
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

    private static function idsDoUsuario(
        int $usuarioId
    ): array {
        $permissoes = self::listarDoUsuario(
            $usuarioId
        );

        return array_map(
            'intval',
            array_column($permissoes, 'id')
        );
    }

    private static function normalizarPermissaoIds(
        array $permissaoIds
    ): array {
        $ids = [];

        foreach ($permissaoIds as $permissaoId) {
            $id = filter_var(
                $permissaoId,
                FILTER_VALIDATE_INT
            );

            if ($id === false || $id <= 0) {
                throw new \InvalidArgumentException(
                    'ID de permissão inválido.'
                );
            }

            $ids[] = (int) $id;
        }

        $ids = array_values(
            array_unique($ids)
        );

        $idsExistentes = array_map(
            'intval',
            array_column(
                Permissao::listarTodas(),
                'id'
            )
        );

        $idsInvalidos = array_diff(
            $ids,
            $idsExistentes
        );

        if (!empty($idsInvalidos)) {
            throw new \InvalidArgumentException(
                'Uma ou mais permissões não existem.'
            );
        }

        return $ids;
    }
}