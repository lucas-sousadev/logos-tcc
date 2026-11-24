<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\ReleaseAberturaService;
use Logos\AssessoriaApi\Services\ReleaseEmailService;
use Logos\AssessoriaApi\Services\ReleaseEnvioService;
use Logos\AssessoriaApi\Services\ReleaseService;

Dotenv::createImmutable(dirname(__DIR__))->load();

if (!in_array($_ENV['DB_HOST'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Este teste exige o MySQL local e um banco descartável.');
}

$verificacoes = 0;
$conferir = static function (bool $condicao, string $mensagem) use (&$verificacoes): void {
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
};
$smtp = [
    'RELEASE_SMTP_HOST' => 'localhost',
    'RELEASE_SMTP_PORT' => '2525',
    'RELEASE_SMTP_USER' => 'teste',
    'RELEASE_SMTP_PASSWORD' => 'teste',
    'RELEASE_SMTP_FROM' => 'teste@example.com',
    'RELEASE_SMTP_SECURITY' => 'starttls',
];
foreach ($smtp as $campo => $valor) {
    $_ENV[$campo] = $valor;
}
$urlRastreamento = 'https://tracking.example.org/LOGOS/logos-api/public';
$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$bancoTeste = 'logos_teste_aberturas_' . bin2hex(random_bytes(6));
$bancoCriado = false;
$processo = null;
$temporarios = [];

try {
    foreach ([
        '', 'http://tracking.example.org', 'https://192.168.0.1/api', 'https://127.0.0.1',
        'https://[::1]', 'https://localhost', 'https://api.local',
        'https://user:pass@tracking.example.org', 'https://tracking.example.org?teste=1',
        'https://tracking.example.org#fragmento',
    ] as $invalida) {
        $_ENV['RELEASE_TRACKING_URL'] = $invalida;
        $conferir(
            ReleaseAberturaService::basePublica() === null,
            'Deve recusar URL de rastreamento inválida ou local.'
        );
    }
    $_ENV['RELEASE_TRACKING_URL'] = $urlRastreamento . '/';
    $conferir(ReleaseAberturaService::basePublica() === $urlRastreamento, 'Deve normalizar a barra final.');
    $tokenHtml = bin2hex(random_bytes(32));
    $pixelHtml = ReleaseAberturaService::urlPixel($tokenHtml);
    $blocos = [['id' => 'texto', 'tipo' => 'texto', 'texto' => 'Conteúdo do release']];
    $envioEmail = ['assunto' => 'Teste de abertura', 'primeira_linha' => '', 'nome_remetente' => 'LOGOS', 'responder_para' => ''];
    $mailer = ReleaseEmailService::preparar(1, $envioEmail, $blocos, 'teste@example.com', false, $tokenHtml);
    $conferir(
        str_contains($mailer->Body, $pixelHtml),
        'Um envio real preparado deve incluir o pixel individual.'
    );
    $conferir(
        !str_contains($mailer->AltBody, $tokenHtml),
        'A versão em texto não deve incluir o endereço de rastreamento.'
    );
    $testeEmail = ReleaseEmailService::preparar(
        1,
        $envioEmail,
        $blocos,
        'teste@example.com',
        true,
        $tokenHtml
    );
    $conferir(
        !str_contains($testeEmail->Body, $tokenHtml),
        'Envio de teste não deve receber pixel, mesmo com token informado.'
    );
    $previa = ReleaseEmailService::preparar(1, $envioEmail, $blocos, 'teste@example.com');
    $conferir(
        !str_contains($previa->Body, '/api/releases/aberturas/'),
        'Preparar uma prévia não deve gerar token ou pixel.'
    );
    $_ENV['RELEASE_TRACKING_URL'] = '';
    $semColeta = ReleaseEmailService::preparar(
        1,
        $envioEmail,
        $blocos,
        'teste@example.com',
        false,
        $tokenHtml
    );
    $conferir(
        !str_contains($semColeta->Body, $tokenHtml),
        'Configuração vazia deve manter o envio sem rastreamento.'
    );

    $db->exec("CREATE DATABASE `{$bancoTeste}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $bancoCriado = true;
    $db->exec("USE `{$bancoTeste}`");
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    if ($inicio === false) {
        throw new RuntimeException('Schema de teste inválido.');
    }
    $schema = substr($schema, $inicio);
    if (preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema)) {
        throw new RuntimeException('O schema deve usar somente o banco descartável.');
    }
    $db->exec($schema);
    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'A'), (2, 'B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil)
        VALUES (1, 1, 'A', 'a@example.com', 'teste', 'ASSESSOR')");
    $db->exec("INSERT INTO jornalistas (id, assessoria_id, nome, email, ativo) VALUES
        (1, 1, 'A', 'a@example.com', 1), (2, 1, 'B', 'b@example.com', 1),
        (3, 1, 'C', 'c@example.com', 1), (4, 1, 'D', 'd@example.com', 1)");

    $novo = static function (array $ids = [1, 2, 3, 4]) use ($db, $blocos): array {
        $r = ReleaseService::criar(1, 1, ['titulo' => 'Aberturas', 'jornalistas_ids' => $ids]);
        $db->prepare('UPDATE releases SET assunto = :assunto, blocos_json = :blocos WHERE id = :id')->execute([
            'assunto' => 'Teste', 'blocos' => json_encode($blocos), 'id' => $r['id'],
        ]);
        return ReleaseService::buscar(1, $r['id']);
    };
    $r = $novo();
    $metricas = ReleaseAberturaService::metricas(1, $r['id']);
    $conferir($metricas['taxa_percentual'] === null, 'Sem base rastreada, a taxa deve ser indisponível.');
    $_ENV['RELEASE_TRACKING_URL'] = $urlRastreamento;
    ReleaseEnvioService::enfileirar(1, $r['id'], $r['versao_edicao']);
    $conferir(
        (int) $db->query('SELECT COUNT(*) FROM release_destinatarios WHERE tracking_token IS NOT NULL')->fetchColumn() === 0,
        'Enfileirar não deve emitir tokens antes da transmissão.'
    );
    ReleaseEnvioService::processar(1, 0, static function (): void {
    });
    $linha = $db->query('SELECT * FROM release_destinatarios WHERE release_id = ' . $r['id'] . " AND status = 'ENVIADO'")->fetch();
    $token = $linha['tracking_token'];
    $conferir(
        ReleaseAberturaService::tokenValido($token),
        'O processador deve emitir um token aleatório válido.'
    );
    $conferir(
        ReleaseAberturaService::metricas(1, $r['id'])['taxa_percentual'] === 0.0,
        'Com base rastreada e nenhuma abertura, a taxa é zero.'
    );
    $versao = ReleaseService::buscar(1, $r['id'])['versao_edicao'];
    ReleaseAberturaService::registrar($token);
    $primeira = $db->query('SELECT aberto_em FROM release_destinatarios WHERE id = ' . $linha['id'])->fetchColumn();
    ReleaseAberturaService::registrar($token);
    $metricas = ReleaseAberturaService::metricas(1, $r['id']);
    $conferir(
        $metricas['destinatarios_abertos'] === 1 && $metricas['carregamentos_registrados'] === 2,
        'Duas requisições devem representar um único destinatário aberto.'
    );
    $conferir($metricas['taxa_percentual'] === 100.0, 'A taxa deve usar destinatários únicos.');
    $conferir(
        ReleaseService::buscar(1, $r['id'])['versao_edicao'] === $versao,
        'Uma abertura não pode invalidar a versão de edição.'
    );
    $conferir(
        $db->query('SELECT aberto_em FROM release_destinatarios WHERE id = ' . $linha['id'])->fetchColumn() === $primeira,
        'A primeira detecção deve ser preservada.'
    );

    ReleaseEnvioService::processar(1, 0, static function (): void {
    });
    $conferir(
        ReleaseAberturaService::metricas(1, $r['id'])['taxa_percentual'] === 50.0,
        'Um aberto entre dois envios rastreados representa 50%.'
    );
    ReleaseEnvioService::processar(1, 0, static function (array $d) use ($conferir): void {
        ReleaseAberturaService::registrar($d['tracking_token']);
        $conferir(
            ReleaseAberturaService::metricas(1, $d['release_id'])['aberturas_sem_confirmacao'] === 1,
            'Deve aceitar a detecção antes da confirmação do SMTP.'
        );
    });
    $conferir(
        ReleaseAberturaService::metricas(1, $r['id'])['taxa_percentual'] === 66.7,
        'Deve incorporar a detecção antecipada após o aceite.'
    );
    $_ENV['RELEASE_TRACKING_URL'] = '';
    ReleaseEnvioService::processar(1, 0, static function (): void {
    });
    $metricas = ReleaseAberturaService::metricas(1, $r['id']);
    $conferir(
        $metricas['envios_sem_rastreamento'] === 1 && $metricas['envios_rastreados'] === 3,
        'O envio sem pixel deve ficar fora da base.'
    );
    $conferir(
        $metricas['taxa_percentual'] === 66.7 && !$metricas['coleta_configurada'],
        'Desativar novos rastreamentos não apaga a métrica existente.'
    );
    ReleaseAberturaService::registrar($token);
    $conferir(
        ReleaseAberturaService::metricas(1, $r['id'])['carregamentos_registrados'] === 4,
        'Pixels já emitidos continuam válidos sem a configuração para novos envios.'
    );
    $conferir(
        ReleaseAberturaService::metricas(2, $r['id'])['envios_rastreados'] === 0,
        'As métricas devem respeitar a assessoria.'
    );
    foreach (['invalido', str_repeat('z', 64), str_repeat('a', 63), str_repeat('f', 64)] as $invalido) {
        ReleaseAberturaService::registrar($invalido);
    }
    $conferir(
        ReleaseAberturaService::metricas(1, $r['id'])['carregamentos_registrados'] === 4,
        'Tokens inválidos e desconhecidos não devem alterar as métricas.'
    );

    $_ENV['RELEASE_TRACKING_URL'] = $urlRastreamento;
    $incerto = $novo([1]);
    ReleaseEnvioService::enfileirar(1, $incerto['id']);
    ReleaseEnvioService::processar(1, 0, static function (array $d): void {
        ReleaseAberturaService::registrar($d['tracking_token']);
        throw new RuntimeException('Transporte simulado sem confirmação.');
    });
    $metricasIncerto = ReleaseAberturaService::metricas(1, $incerto['id']);
    $conferir(
        $metricasIncerto['taxa_percentual'] === null && $metricasIncerto['aberturas_sem_confirmacao'] === 1,
        'Aberturas de envios incertos não podem inflar a base dos aceitos.'
    );

    $cancelado = $novo([1]);
    ReleaseEnvioService::enfileirar(1, $cancelado['id']);
    $atual = ReleaseService::buscar(1, $cancelado['id']);
    ReleaseEnvioService::cancelarEnvio(1, $cancelado['id'], $atual['versao_edicao']);
    $tokenCancelado = bin2hex(random_bytes(32));
    $db->prepare('UPDATE release_destinatarios SET tracking_token = :token WHERE release_id = :id')->execute([
        'token' => $tokenCancelado, 'id' => $cancelado['id'],
    ]);
    ReleaseAberturaService::registrar($tokenCancelado);
    $conferir(
        ReleaseAberturaService::metricas(1, $cancelado['id'])['envios_rastreados'] === 0,
        'Destinatários cancelados ficam fora da taxa.'
    );
    $conferir(
        $db->query('SELECT aberto_em FROM release_destinatarios WHERE release_id = ' . $cancelado['id'])->fetchColumn() === null,
        'Não deve registrar aberturas de destinatários não transmitidos.'
    );

    $repetido = $novo([1]);
    ReleaseEnvioService::enfileirar(1, $repetido['id']);
    $tokenRepetido = bin2hex(random_bytes(32));
    $db->prepare("UPDATE release_destinatarios SET tracking_token = :token, tentativas = 1,
        erro_tipo = 'TEMPORARIA' WHERE release_id = :id")->execute([
        'token' => $tokenRepetido, 'id' => $repetido['id'],
    ]);
    ReleaseEnvioService::processar(1, 0, static function (): void {
    });
    $conferir(
        $db->query('SELECT tracking_token FROM release_destinatarios WHERE release_id = ' . $repetido['id'])->fetchColumn() === $tokenRepetido,
        'Uma nova tentativa deve reutilizar o token individual.'
    );

    $desativado = $novo([1]);
    ReleaseEnvioService::enfileirar(1, $desativado['id']);
    $db->prepare("UPDATE release_destinatarios SET tracking_token = :token,
        aberto_em = '2000-01-01 00:00:00', aberturas_quantidade = 1 WHERE release_id = :id")->execute([
        'token' => bin2hex(random_bytes(32)), 'id' => $desativado['id'],
    ]);
    $_ENV['RELEASE_TRACKING_URL'] = 'http://tracking.example.org';
    try {
        ReleaseEnvioService::processar(1, 0, static function (): void {
        });
        throw new LogicException('Uma configuração inválida deveria impedir o processamento.');
    } catch (RuntimeException $erro) {
        $conferir(
            $erro->getCode() === 503,
            'Configuração preenchida e inválida deve ser sinalizada antes de transmitir.'
        );
    }
    $_ENV['RELEASE_TRACKING_URL'] = '';
    ReleaseEnvioService::processar(1, 0, static function (): void {
    });
    $limpo = $db->query('SELECT tracking_token, aberto_em, aberturas_quantidade FROM release_destinatarios WHERE release_id = ' . $desativado['id'])->fetch();
    $conferir(
        $limpo['tracking_token'] === null && $limpo['aberto_em'] === null && (int) $limpo['aberturas_quantidade'] === 0,
        'Uma transmissão sem pixel não pode herdar a métrica de uma tentativa anterior.'
    );
    $conferir(
        ReleaseAberturaService::metricas(1, $desativado['id'])['taxa_percentual'] === null,
        'O envio sem rastreamento deve permanecer sem taxa, mesmo após a tentativa anterior.'
    );

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $endereco = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-open-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-open-log-');
    $temporarios = [$wrapper, $log];
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_OPEN_TEST_DB"); $_ENV["RELEASE_TRACKING_URL"] = '
        . var_export($urlRastreamento, true) . '; require '
        . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-S', $endereco, $wrapper], [
        0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a'],
    ], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_OPEN_TEST_DB' => $bancoTeste]);
    if (!is_resource($processo)) {
        throw new RuntimeException('Não foi possível iniciar o servidor de teste.');
    }
    fclose($pipes[0]);
    $pronto = false;
    for ($i = 0; $i < 30; $i++) {
        $conexao = @stream_socket_client('tcp://' . $endereco, $codigo, $mensagem, 0.1);
        if ($conexao !== false) {
            fclose($conexao);
            $pronto = true;
            break;
        }
        usleep(100000);
    }
    $conferir($pronto, 'O servidor de teste deve iniciar.');
    $requisitar = static function (string $rota, string $metodo = 'GET', array $headers = []) use ($endereco): array {
        $url = 'http://' . $endereco . '/LOGOS/logos-api/public' . $rota
            . '?route=' . rawurlencode($rota);
        $contexto = stream_context_create(['http' => [
            'method' => $metodo, 'header' => implode("\r\n", $headers),
            'ignore_errors' => true, 'timeout' => 5,
        ]]);
        $corpo = file_get_contents($url, false, $contexto);
        preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $status);
        return [(int) ($status[1] ?? 0), $corpo, implode("\n", $http_response_header)];
    };
    $rotaPixel = '/api/releases/aberturas/' . $token;
    [$status, $gif, $headers] = $requisitar($rotaPixel);
    $tamanho = getimagesizefromstring($gif);
    $conferir(
        $status === 200 && $tamanho[0] === 1 && $tamanho[1] === 1,
        'O pixel deve ser público, transparente e de um pixel.'
    );
    $conferir(
        str_contains(strtolower($headers), 'content-type: image/gif') && str_contains($headers, 'no-store'),
        'O pixel deve informar tipo e impedir cache.'
    );
    $antes = ReleaseAberturaService::metricas(1, $r['id'])['carregamentos_registrados'];
    [$statusHead, $corpoHead] = $requisitar($rotaPixel, 'HEAD');
    $conferir($statusHead === 200 && $corpoHead === '', 'HEAD deve responder sem corpo.');
    $requisitar($rotaPixel, 'GET', ['Purpose: prefetch']);
    $conferir(
        ReleaseAberturaService::metricas(1, $r['id'])['carregamentos_registrados'] === $antes,
        'HEAD e pré-carregamento explícito não contam.'
    );
    [$statusInvalido, $gifInvalido] = $requisitar('/api/releases/aberturas/invalido');
    [$statusDesconhecido, $gifDesconhecido] = $requisitar('/api/releases/aberturas/' . str_repeat('f', 64));
    $conferir(
        $statusInvalido === 200 && $statusDesconhecido === 200 && $gif === $gifInvalido && $gif === $gifDesconhecido,
        'A resposta não pode revelar a existência de tokens.'
    );
    $rotaEnvio = '/api/releases/' . $r['id'] . '/envio';
    $conferir($requisitar($rotaEnvio)[0] === 401, 'Consultar métricas deve exigir autenticação.');
    $jwt = JwtService::gerar(['id' => 1, 'assessoria_id' => 1, 'perfil' => 'ASSESSOR']);
    [$statusEnvio, $corpoEnvio] = $requisitar($rotaEnvio, 'GET', ['Authorization: Bearer ' . $jwt]);
    $resposta = json_decode($corpoEnvio, true, 512, JSON_THROW_ON_ERROR);
    $conferir(
        $statusEnvio === 200 && $resposta['envio']['aberturas']['taxa_percentual'] === 66.7,
        'A API autenticada deve retornar a taxa calculada.'
    );
    $conferir(
        !str_contains($corpoEnvio, $token) && !str_contains($corpoEnvio, 'tracking_token'),
        'A consulta não deve expor os tokens.'
    );
    $conferir(
        str_ends_with($resposta['envio']['destinatarios'][0]['aberto_em'], 'Z'),
        'A detecção deve retornar data UTC explícita.'
    );
    $conferir(
        ReleaseEnvioService::situacao(1, $r['id'], ['status' => 'ERRO'])['aberturas']['taxa_percentual'] === 66.7,
        'Filtros da lista não podem alterar a taxa geral.'
    );

    echo "Aberturas: {$verificacoes} verificações passaram, sem envio real.\n";
} finally {
    if (is_resource($processo)) {
        proc_terminate($processo);
        proc_close($processo);
    }
    foreach ($temporarios as $arquivo) {
        if (is_file($arquivo)) {
            unlink($arquivo);
        }
    }
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $db->exec('USE `' . str_replace('`', '``', $original) . '`');
    if ($bancoCriado && preg_match('/^logos_teste_aberturas_[a-f0-9]{12}$/D', $bancoTeste)) {
        $db->exec("DROP DATABASE `{$bancoTeste}`");
    }
}
