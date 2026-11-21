<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Services\ReleaseEnvioService;

$diretorioLog = sys_get_temp_dir() . '/logos-releases';

$registrar = static function (array $dados) use (&$diretorioLog): void {
    if (
        !is_dir($diretorioLog) &&
        !mkdir($diretorioLog, 0700, true) &&
        !is_dir($diretorioLog)
    ) {
        throw new RuntimeException(
            'Não foi possível criar a pasta de logs.'
        );
    }

    $linha = json_encode(
        [
            'instante' => gmdate('c'),
            'pid' => getmypid(),
            ...$dados,
        ],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    ) . PHP_EOL;

    $gravado = file_put_contents(
        $diretorioLog .
            '/processamento-' .
            gmdate('Y-m') .
            '.log',
        $linha,
        FILE_APPEND | LOCK_EX
    );

    if ($gravado === false) {
        throw new RuntimeException(
            'Não foi possível gravar o log do processamento.'
        );
    }
};

try {
    require dirname(__DIR__) . '/vendor/autoload.php';

    Dotenv::createImmutable(dirname(__DIR__))->load();

    $diretorioLog = rtrim(
        trim($_ENV['RELEASE_WORKER_LOG_DIR'] ?? '')
            ?: $diretorioLog,
        '/\\'
    );

    $opcoes = getopt('', ['limite:', 'intervalo-ms:']);

    $lerNumero = static function (
        string $nome,
        int $padrao,
        int $minimo,
        int $maximo
    ) use ($opcoes): int {
        $valor = filter_var(
            $opcoes[$nome] ?? $padrao,
            FILTER_VALIDATE_INT,
            [
                'options' => [
                    'min_range' => $minimo,
                    'max_range' => $maximo,
                ],
            ]
        );

        if ($valor === false) {
            throw new InvalidArgumentException(
                'Opção inválida: ' . $nome
            );
        }

        return $valor;
    };

    $limite = $lerNumero('limite', 20, 1, 1000);
    $intervalo = $lerNumero('intervalo-ms', 1000, 0, 60000);

    $registrar(['evento' => 'inicio']);

    $resultado = ReleaseEnvioService::processar(
        $limite,
        $intervalo
    );

    $registrar([
        'evento' => 'fim',
        'resultado' => $resultado,
    ]);

    echo json_encode(
        $resultado,
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    ) . PHP_EOL;

    // falhas de destinatários são resultados tratados
    exit(0);
} catch (Throwable $erro) {
    try {
        $registrar([
            'evento' => 'erro',
            'mensagem' => $erro->getMessage(),
        ]);
    } catch (Throwable) {
        error_log(
            'Não foi possível registrar o erro no log da fila de releases.'
        );
    }

    fwrite(
        STDERR,
        "Não foi possível processar a fila. Consulte o log de releases.\n"
    );

    exit(1);
}