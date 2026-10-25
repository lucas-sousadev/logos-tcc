<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\CapturaPaginaService;

final class CapturaPaginaController
{
    public function capturar(): void
    {
        if (!AuthContext::get()) {
            $this->erro('Usuário não autenticado.', 401);
            return;
        }

        try {
            $corpo = file_get_contents('php://input');

            if (
                $corpo === false ||
                strlen($corpo) > 4096
            ) {
                throw new \LengthException(
                    'A requisição é grande demais.'
                );
            }

            $dados = json_decode(
                $corpo,
                true,
                16,
                JSON_THROW_ON_ERROR
            );

            if (!is_array($dados)) {
                throw new \InvalidArgumentException(
                    'Informe o link da página.'
                );
            }

            $captura = CapturaPaginaService::capturar(
                $dados['link'] ?? null,
                $dados['trecho'] ?? 0
            );

            http_response_code(200);
            header('Content-Type: image/jpeg');
            header('Cache-Control: no-store');
            header(
                'Content-Length: ' .
                strlen($captura['imagem'])
            );
            header(
                'X-Captura-Largura: ' .
                $captura['largura']
            );
            header(
                'X-Captura-Altura: ' .
                $captura['altura']
            );
            header(
                'X-Captura-Incompleta: ' .
                ($captura['incompleta'] ? '1' : '0')
            );
            header(
                'X-Captura-Tem-Proxima: ' .
                ($captura['tem_proxima'] ? '1' : '0')
            );

            echo $captura['imagem'];
        } catch (\JsonException $e) {
            $this->erro('JSON inválido.', 400);
        } catch (\LengthException $e) {
            $this->erro($e->getMessage(), 413);
        } catch (\InvalidArgumentException $e) {
            $this->erro($e->getMessage(), 422);
        } catch (\DomainException $e) {
            $this->erro($e->getMessage(), 429);
        } catch (\Throwable $e) {
            error_log(
                'Erro na captura de página: ' .
                $e->getMessage()
            );

            $this->erro(
                'Não foi possível capturar esta página.',
                502
            );
        }
    }

    private function erro(
        string $mensagem,
        int $status
    ): void {
        http_response_code($status);
        header(
            'Content-Type: application/json; charset=utf-8'
        );
        header('Cache-Control: no-store');

        echo json_encode(
            [
                'success' => false,
                'message' => $mensagem,
            ],
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    }
}