<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\RelatorioService;

Dotenv::createImmutable(dirname(__DIR__))->load();
if (!in_array($_ENV['DB_HOST'] ?? '', ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Este teste exige MySQL local e banco descartável.');
}

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_relatorios_' . bin2hex(random_bytes(6));
$criado = false;
$processo = null;
$temporarios = [];
$verificacoes = 0;

function conferirEdicao(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
}

function requisitarEdicao(string $host, string $rota, ?string $token, array $dados, string $metodo = 'POST'): array
{
    $curl = curl_init('http://' . $host . '/LOGOS/logos-api/public' . $rota . '?route=' . rawurlencode($rota));
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $metodo,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', ...($token ? ['Authorization: Bearer ' . $token] : [])],
        CURLOPT_POSTFIELDS => json_encode($dados, JSON_THROW_ON_ERROR),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    $corpo = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if ($corpo === false) {
        throw new RuntimeException('API de teste indisponível.');
    }
    return [$status, json_decode($corpo, true, 512, JSON_THROW_ON_ERROR)];
}

try {
    $db->exec('CREATE DATABASE ' . $teste . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $criado = true;
    $db->exec('USE ' . $teste);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    conferirEdicao($inicio !== false, 'Schema disponível.');
    $schema = substr($schema, $inicio);
    conferirEdicao(!preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema), 'Schema restrito ao banco de teste.');
    $db->exec($schema);
    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'A'), (2, 'B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil) VALUES
        (1, 1, 'Assessor', 'a@example.com', 'teste', 'ASSESSOR'),
        (3, 1, 'Funcionário', 'f@example.com', 'teste', 'FUNCIONARIO')");
    $db->exec("INSERT INTO clientes (id, assessoria_id, nome) VALUES (1, 1, 'Cliente')");
    $db->exec("INSERT INTO relatorios (id, assessoria_id, cliente_id, criado_por, titulo) VALUES (1, 1, 1, 1, 'Teste')");
    $db->exec("INSERT INTO relatorio_slides (id, relatorio_id, assessoria_id, ordem, tipo, dados_json) VALUES (1, 1, 1, 1, 'CLIPPING', '{\"imagem\":{},\"veiculo\":{\"nome\":\"Jornal\"}}')");

    foreach ([25, 50, 95, 100] as $escala) {
        RelatorioService::atualizarSlide(1, 1, 1, ['imagem_escala' => $escala]);
        $slide = $db->query('SELECT dados_json, edicoes_json FROM relatorio_slides WHERE id = 1')->fetch();
        conferirEdicao(json_decode($slide['dados_json'], true)['imagem']['escala'] === $escala, 'Escala salva na prévia e exportação.');
        conferirEdicao(json_decode($slide['edicoes_json'], true)['imagem_escala'] === $escala, 'Escala preservada nas edições do slide.');
    }
    RelatorioService::atualizarSlide(1, 1, 1, ['veiculo_nome' => 'Nome atualizado']);
    conferirEdicao((int) $db->query("SELECT JSON_EXTRACT(dados_json, '$.imagem.escala') FROM relatorio_slides WHERE id = 1")->fetchColumn() === 100, 'Outra edição preserva o tamanho.');
    try {
        RelatorioService::atualizarSlide(2, 1, 1, ['imagem_escala' => 50]);
        throw new RuntimeException('Assessoria distinta não pode editar.');
    } catch (OutOfBoundsException) {
        conferirEdicao(true, 'Edição isolada por assessoria.');
    }

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $host = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-relatorios-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-relatorios-log-');
    $temporarios = [$wrapper, $log];
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_RELATORIOS_DB"); require ' . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-S', $host, $wrapper], [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_RELATORIOS_DB' => $teste]);
    fclose($pipes[0]);
    for ($tentativa = 0; $tentativa < 30; $tentativa++) {
        $conexao = @stream_socket_client('tcp://' . $host, $codigo, $mensagem, 0.1);
        if ($conexao) {
            fclose($conexao);
            break;
        }
        usleep(100000);
    }
    $assessor = JwtService::gerar(['id' => 1, 'assessoria_id' => 1, 'perfil' => 'ASSESSOR']);
    $funcionario = JwtService::gerar(['id' => 3, 'assessoria_id' => 1, 'perfil' => 'FUNCIONARIO']);
    $rota = '/api/veiculos/capturar-pagina';
    conferirEdicao(requisitarEdicao($host, $rota, null, ['link' => ''])[0] === 401, 'Captura exige autenticação.');
    conferirEdicao(requisitarEdicao($host, $rota, $funcionario, ['link' => ''])[0] === 403, 'Captura exige criar ou editar veículos.');
    foreach (['CRIAR', 'EDITAR'] as $acao) {
        $db->exec("INSERT IGNORE INTO permissoes (modulo, acao) VALUES ('VEICULOS', '$acao')");
        $db->exec("DELETE FROM usuario_permissoes WHERE usuario_id = 3");
        $db->exec("INSERT INTO usuario_permissoes (usuario_id, permissao_id) SELECT 3, id FROM permissoes WHERE modulo = 'VEICULOS' AND acao = '$acao'");
        [$status, $corpo] = requisitarEdicao($host, $rota, $funcionario, ['link' => '']);
        conferirEdicao($status === 422 && $corpo['message'] === 'Informe o link da página.', 'Captura aceita a permissão ' . $acao . ' sem acessar o worker.');
    }
    conferirEdicao(requisitarEdicao($host, '/api/relatorios/1/slides/1', $assessor, ['imagem_escala' => 50], 'PUT')[0] === 200, 'API salva escala do slide.');
    conferirEdicao(requisitarEdicao($host, '/api/relatorios/1/slides/1', $assessor, ['imagem_escala' => 101], 'PUT')[0] === 422, 'API informa escala inválida.');
    RelatorioService::atualizarSlide(1, 1, 1, ['veiculo_descricao' => 'Descrição de teste.', 'veiculo_alcance' => '100 mil leitores']);
    $slidesExportados = [];
    foreach (['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Mozilla/5.0 (Linux; Android 15) Mobile'] as $agente) {
        $curl = curl_init('http://' . $host . '/LOGOS/logos-api/public/api/relatorios/1/pptx-teste?route=/api/relatorios/1/pptx-teste');
        curl_setopt_array($curl, [CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $assessor], CURLOPT_USERAGENT => $agente, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        $conteudo = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
        conferirEdicao($status === 200 && str_starts_with($conteudo, 'PK'), 'Exportação disponível para desktop e mobile.');
        $pptx = tempnam(sys_get_temp_dir(), 'logos-relatorios-agente-');
        $temporarios[] = $pptx;
        file_put_contents($pptx, $conteudo);
        $zip = new ZipArchive();
        $zip->open($pptx);
        $slidesExportados[] = $zip->getFromName('ppt/slides/slide1.xml');
        $zip->close();
    }
    conferirEdicao($slidesExportados[0] === $slidesExportados[1], 'Mobile e desktop recebem exatamente o mesmo layout no PPTX.');
    echo $verificacoes . " verificações de edição e permissões passaram.\n";
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
    if ($criado) {
        $db->exec('USE `' . str_replace('`', '``', $original) . '`');
        $db->exec('DROP DATABASE ' . $teste);
    }
}
