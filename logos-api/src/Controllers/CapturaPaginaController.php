<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\CapturaPaginaService;

final class CapturaPaginaController
{
    public function capturar(): void
    {
        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->erro('Usuário não autenticado.', 401);
            return;
        }

        try {
            $corpo = file_get_contents(
                'php://input',
                false,
                null,
                0,
                4097
            );

            if ($corpo === false || strlen($corpo) > 4096) {
                throw new \LengthException(
                    'A requisição é grande demais.'
                );
            }

            $dados = json_decode($corpo, false, 16, JSON_THROW_ON_ERROR);

            if (!$dados instanceof \stdClass) {
                throw new \InvalidArgumentException(
                    'Envie um objeto JSON.'
                );
            }

            // pega a origem pela rota protegida pra não confiar no que vem do app
            $caminho = parse_url(
                $_SERVER['REQUEST_URI'] ?? '',
                PHP_URL_PATH
            );

            if (
                !is_string($caminho) ||
                preg_match(
                    '~/(clippings|relatorios)/capturar-pagina/?$~D',
                    $caminho,
                    $rota
                ) !== 1
            ) {
                throw new \InvalidArgumentException(
                    'Origem da captura inválida.'
                );
            }

            $resultado = CapturaPaginaService::processar(
                (int) ($usuario->assessoria_id ?? 0),
                (int) ($usuario->sub ?? 0),
                $rota[1] === 'clippings' ? 'clipping' : 'relatorio',
                get_object_vars($dados)
            );

            http_response_code($resultado['status']);
            header('Cache-Control: no-store');

            if (isset($resultado['imagem'])) {
                header('Content-Type: image/jpeg');
                header(
                    'Content-Length: ' . strlen($resultado['imagem'])
                );
                header('X-Captura-Largura: ' . $resultado['largura']);
                header('X-Captura-Altura: ' . $resultado['altura']);
                header(
                    'X-Captura-Incompleta: ' .
                    ($resultado['incompleta'] ? '1' : '0')
                );
                header(
                    'X-Captura-Tem-Proxima: ' .
                    ($resultado['tem_proxima'] ? '1' : '0')
                );
                header(
                    'X-Captura-Aviso: ' .
                    ($resultado['aviso'] ?? '')
                );
                echo $resultado['imagem'];

                return;
            }

            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(
                $resultado['json'],
                JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            );
        } catch (\JsonException $e) {
            $this->erro('JSON inválido.', 400);
        } catch (\LengthException $e) {
            $this->erro($e->getMessage(), 413);
        } catch (\InvalidArgumentException $e) {
            $this->erro($e->getMessage(), 422);
        } catch (\Throwable $e) {
            error_log(
                'Erro na captura de página: ' . $e->getMessage()
            );

            $this->erro('Não foi possível capturar esta página.', 502);
        }
    }

    private function erro(
        string $mensagem,
        int $status
    ): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
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
