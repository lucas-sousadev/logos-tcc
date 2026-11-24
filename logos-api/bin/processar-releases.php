<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\ReleaseEmailService;
use Logos\AssessoriaApi\Services\ReleaseAberturaService;
use Logos\AssessoriaApi\Services\ReleaseEnvioService;

$opcoes = getopt('', ['limite:', 'intervalo-ms:', 'verificar']);
$verificando = is_array($opcoes) && array_key_exists('verificar', $opcoes);
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
    // Impede que um erro de digitação em uma opção inicie um envio.
    for ($indice = 1; $indice < count($argv); $indice++) {
        $argumento = $argv[$indice];
        if (
            $argumento === '--verificar'
            || preg_match('/^--(?:limite|intervalo-ms)=/', $argumento)
        ) {
            continue;
        }
        if (
            in_array($argumento, ['--limite', '--intervalo-ms'], true)
            && isset($argv[$indice + 1])
        ) {
            $indice++;
            continue;
        }
        throw new InvalidArgumentException(
            'Opção desconhecida. Use --verificar, --limite=20 ou --intervalo-ms=1000.'
        );
    }

    require dirname(__DIR__) . '/vendor/autoload.php';

    try {
        Dotenv::createImmutable(dirname(__DIR__))->load();
    } catch (Throwable $erro) {
        if ($verificando) {
            throw new RuntimeException(
                'Confira a existência e o formato de logos-api/.env.',
                1001
            );
        }
        throw $erro;
    }

    $diretorioLog = rtrim(
        trim($_ENV['RELEASE_WORKER_LOG_DIR'] ?? '')
            ?: $diretorioLog,
        '/\\'
    );

    if ($verificando) {
        foreach (['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'] as $campo) {
            if (trim($_ENV[$campo] ?? '') === '') {
                throw new RuntimeException('Preencha ' . $campo . ' no arquivo .env.', 1001);
            }
        }
        if (!array_key_exists('DB_PASSWORD', $_ENV)) {
            throw new RuntimeException(
                'Defina DB_PASSWORD no arquivo .env, mesmo que esteja vazio.',
                1001
            );
        }
        if (!class_exists(ReleaseEnvioService::class)) {
            throw new RuntimeException(
                'Atualize o código e execute composer install na pasta logos-api.',
                1001
            );
        }
        try {
            ReleaseEmailService::validarConfiguracao();
        } catch (Throwable) {
            throw new RuntimeException(
                'Revise os campos RELEASE_SMTP_* no .env, incluindo a senha de app e RELEASE_SMTP_FROM.',
                1001
            );
        }
        try {
            ReleaseAberturaService::validarConfiguracao();
        } catch (Throwable) {
            throw new RuntimeException(
                'Use uma URL pública HTTPS em RELEASE_TRACKING_URL ou deixe esse campo vazio.',
                1001
            );
        }
        $url = parse_url(trim($_ENV['RELEASE_API_URL'] ?? ''));
        if (
            !$url
            || !in_array($url['scheme'] ?? '', ['http', 'https'], true)
            || empty($url['host'])
        ) {
            throw new RuntimeException(
                'Defina RELEASE_API_URL com o endereço da API neste servidor.',
                1001
            );
        }
        try {
            $db = Connection::get();
        } catch (Throwable) {
            throw new RuntimeException(
                'Não foi possível conectar ao banco. Ligue o MySQL e confira DB_* no .env.',
                1001
            );
        }
        $tabelas = [
            'releases' => [
                'status', 'agendado_para', 'versao_programacao', 'assinatura_cadastro',
            ],
            'release_destinatarios' => [
                'status', 'tentativas', 'ultima_tentativa_em',
                'proxima_tentativa_em', 'erro_tipo', 'smtp_codigo',
                'tracking_token', 'aberto_em', 'aberturas_quantidade',
            ],
        ];
        foreach ($tabelas as $tabela => $campos) {
            try {
                $colunas = $db->query('SHOW COLUMNS FROM ' . $tabela)->fetchAll(PDO::FETCH_UNIQUE);
            } catch (Throwable) {
                throw new RuntimeException(
                    'Confira se o banco foi importado e atualizado conforme o LOGOS.sql.',
                    1001
                );
            }
            foreach ($campos as $campo) {
                if (!isset($colunas[$campo])) {
                    throw new RuntimeException(
                        'Atualize a estrutura do banco: falta ' . $tabela . '.' . $campo . '.',
                        1001
                    );
                }
            }
            if (!str_contains($colunas['status']['Type'], "'CANCELADO'")) {
                throw new RuntimeException(
                    'Atualize o status CANCELADO na tabela ' . $tabela . '.',
                    1001
                );
            }
        }
        echo json_encode([
            'verificacao' => 'ok',
            'banco' => 'conectado',
            'estrutura' => 'compativel',
            'smtp' => 'configurado, sem realizar envio de teste',
            'rastreamento_aberturas' => ReleaseAberturaService::basePublica() !== null
                ? 'configurado'
                : 'aguardando URL publica HTTPS',
            'logs' => $diretorioLog,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
        exit(0);
    }

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
    if ($verificando) {
        $mensagem = $erro->getCode() === 1001
            ? $erro->getMessage()
            : 'Não foi possível verificar a configuração. Confira o PHP, o composer install e o arquivo .env.';

        fwrite(STDERR, $mensagem . PHP_EOL);
        exit(1);
    }
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
