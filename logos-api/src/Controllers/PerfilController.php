<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\PerfilService;

final class PerfilController
{
    private function executar(callable $acao): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        try {
            $usuario = AuthContext::get();
            if (!$usuario) {
                throw new \RuntimeException('Usuário não autenticado.', 401);
            }
            $perfil = $acao(
                (int) $usuario->sub,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'usuario' => $perfil,
            ], JSON_THROW_ON_ERROR);
        } catch (\Throwable $erro) {
            $status = match (true) {
                $erro instanceof \OutOfBoundsException => 404,
                $erro instanceof \DomainException => 409,
                $erro instanceof \LengthException => 413,
                $erro instanceof \InvalidArgumentException => 422,
                $erro->getCode() === 401 => 401,
                default => 500,
            };
            http_response_code($status);
            if ($status === 500) {
                error_log('Perfil: ' . $erro->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => $status === 500
                    ? 'Não foi possível salvar o perfil. Tente novamente.'
                    : $erro->getMessage(),
            ]);
        }
    }

    public function buscar(): void
    {
        $this->executar(
            fn(int $id, int $assessoria) => PerfilService::buscar($id, $assessoria)
        );
    }

    public function atualizar(): void
    {
        $this->executar(function (int $id, int $assessoria): array {
            if (!str_starts_with(
                strtolower($_SERVER['CONTENT_TYPE'] ?? ''),
                'multipart/form-data'
            )) {
                throw new \InvalidArgumentException('Envie os dados do perfil como formulário.');
            }
            if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 3 * 1024 * 1024) {
                throw new \LengthException('A foto deve possuir no máximo 2 MB.');
            }
            if (array_diff(array_keys($_FILES), ['foto'])) {
                throw new \InvalidArgumentException('O formulário contém arquivos não permitidos.');
            }
            return PerfilService::atualizar(
                $id,
                $assessoria,
                $_POST,
                $_FILES['foto'] ?? null
            );
        });
    }
}
