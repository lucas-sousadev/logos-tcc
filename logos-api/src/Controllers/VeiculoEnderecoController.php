<?php

namespace Logos\AssessoriaApi\Controllers;

use DomainException;
use InvalidArgumentException;
use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\VeiculoEnderecoService;
use OutOfBoundsException;
use Throwable;

class VeiculoEnderecoController
{
    public function listar(array $rota): void
    {
        try {
           $snapshot = VeiculoEnderecoService::listarComVersao(
                $this->assessoriaId(),
                $this->id($rota, 'id')
            );

            $this->responder(200, [
                'success' => true,
                'enderecos' => $snapshot['enderecos'],
                'versao' => $snapshot['versao'],
            ]);
        } catch (InvalidArgumentException $e) {
            $this->erro(400, $e->getMessage());
        } catch (OutOfBoundsException $e) {
            $this->erro(404, $e->getMessage());
        } catch (Throwable $e) {
            $this->erro(
                500,
                'Não foi possível carregar os endereços.'
            );
        }
    }

    public function adicionar(array $rota): void
    {
        try {
            $body = json_decode(
                file_get_contents('php://input'),
                true
            );

            if (!is_array($body)) {
                throw new InvalidArgumentException(
                    'JSON inválido.'
                );
            }

            $assessoriaId = $this->assessoriaId();
            $veiculoId = $this->id($rota, 'id');

            $endereco = VeiculoEnderecoService::alterarDiretamente(
                $assessoriaId,
                $veiculoId,
                fn () => VeiculoEnderecoService::adicionar(
                    $assessoriaId,
                    $veiculoId,
                    $body
                )
            );

            $this->responder(201, [
                'success' => true,
                'endereco' => $endereco,
            ]);
        } catch (InvalidArgumentException $e) {
            $this->erro(422, $e->getMessage());
        } catch (OutOfBoundsException $e) {
            $this->erro(404, $e->getMessage());
        } catch (DomainException $e) {
            $this->erro(409, $e->getMessage());
        } catch (Throwable $e) {
            $this->erro(
                500,
                'Não foi possível adicionar o endereço.'
            );
        }
    }

    public function atualizar(array $rota): void
    {
        try {
            $body = json_decode(
                file_get_contents('php://input'),
                true
            );

            if (!is_array($body)) {
                throw new InvalidArgumentException(
                    'JSON inválido.'
                );
            }

            $assessoriaId = $this->assessoriaId();
            $veiculoId = $this->id($rota, 'id');
            $enderecoId = $this->id($rota, 'enderecoId');

            $endereco = VeiculoEnderecoService::alterarDiretamente(
                $assessoriaId,
                $veiculoId,
                fn () => VeiculoEnderecoService::atualizar(
                    $assessoriaId,
                    $veiculoId,
                    $enderecoId,
                    $body
                )
            );

            $this->responder(200, [
                'success' => true,
                'endereco' => $endereco,
            ]);
        } catch (InvalidArgumentException $e) {
            $this->erro(422, $e->getMessage());
        } catch (OutOfBoundsException $e) {
            $this->erro(404, $e->getMessage());
        } catch (DomainException $e) {
            $this->erro(409, $e->getMessage());
        } catch (Throwable $e) {
            $this->erro(
                500,
                'Não foi possível atualizar o endereço.'
            );
        }
    }

    public function remover(array $rota): void
    {
        try {
            $assessoriaId = $this->assessoriaId();
            $veiculoId = $this->id($rota, 'id');
            $enderecoId = $this->id($rota, 'enderecoId');

            VeiculoEnderecoService::alterarDiretamente(
                $assessoriaId,
                $veiculoId,
                function () use (
                    $assessoriaId,
                    $veiculoId,
                    $enderecoId
                ): void {
                    VeiculoEnderecoService::remover(
                        $assessoriaId,
                        $veiculoId,
                        $enderecoId
                    );
                }
            );

            $this->responder(200, [
                'success' => true,
                'message' => 'Endereço removido.',
            ]);
        } catch (InvalidArgumentException $e) {
            $this->erro(400, $e->getMessage());
        } catch (OutOfBoundsException $e) {
            $this->erro(404, $e->getMessage());
        } catch (Throwable $e) {
            $this->erro(
                500,
                'Não foi possível remover o endereço.'
            );
        }
    }

    private function assessoriaId(): int
    {
        return (int) AuthContext::get()->assessoria_id;
    }

    private function id(array $rota, string $campo): int
    {
        $id = filter_var(
            $rota[$campo] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if ($id === false) {
            throw new InvalidArgumentException(
                'ID inválido.'
            );
        }

        return $id;
    }

    private function erro(
        int $status,
        string $mensagem
    ): void {
        $this->responder($status, [
            'success' => false,
            'message' => $mensagem,
        ]);
    }

    private function responder(
        int $status,
        array $dados
    ): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode(
            $dados,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES
        );
    }
}