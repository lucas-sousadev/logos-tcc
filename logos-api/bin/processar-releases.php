<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Services\ReleaseEnvioService;

Dotenv::createImmutable(dirname(__DIR__))->load();

$opcoes = getopt('', ['limite::', 'intervalo-ms::']);

try {
    $resultado = ReleaseEnvioService::processar(
        (int) ($opcoes['limite'] ?? 20),
        (int) ($opcoes['intervalo-ms'] ?? 1000)
    );

    echo json_encode(
        $resultado,
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    ) . PHP_EOL;

    exit($resultado['falhas'] > 0 ? 1 : 0);
} catch (Throwable $erro) {
    error_log(
        'Processamento de releases: ' . $erro->getMessage()
    );

    fwrite(
        STDERR,
        "Não foi possível processar a fila. Consulte o log do PHP.\n"
    );

    exit(1);
}