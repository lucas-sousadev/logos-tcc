<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\ReleaseAberturaService;

final class ReleaseAberturaController
{
    public function registrar(array $rota): never
    {
        $finalidade = strtolower(implode(' ', [
            $_SERVER['HTTP_PURPOSE'] ?? '',
            $_SERVER['HTTP_SEC_PURPOSE'] ?? '',
            $_SERVER['HTTP_X_PURPOSE'] ?? '',
        ]));

        if (
            ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET'
            && !str_contains($finalidade, 'prefetch')
            && !str_contains($finalidade, 'prerender')
        ) {
            try {
                ReleaseAberturaService::registrar($rota['token'] ?? '');
            } catch (\Throwable) {
                // O pixel nunca revela dados do destinatário ou erros internos.
                error_log('Não foi possível registrar uma abertura de release.');
            }
        }

        $imagem = ReleaseAberturaService::gif();
        http_response_code(200);
        header('Content-Type: image/gif');
        header('Content-Length: ' . strlen($imagem));
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: no-referrer');

        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') {
            echo $imagem;
        }
        exit;
    }
}
