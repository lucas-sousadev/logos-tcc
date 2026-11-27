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
use Logos\AssessoriaApi\Services\ReleaseService;

Dotenv::createImmutable(dirname(__DIR__))->load();
if (!in_array($_ENV['DB_HOST'] ?? '', ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Este teste exige MySQL local e um banco descartável.');
}

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_vinculos_' . bin2hex(random_bytes(6));
$criado = false;
$processo = null;
$temporarios = [];
$verificacoes = 0;

function conferirVinculo(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
}

function consultarVinculo(string $host, string $rota, ?string $token): array
{
    $curl = curl_init('http://' . $host . '/LOGOS/logos-api/public' . $rota
        . '&route=' . rawurlencode(strtok($rota, '?')));
    curl_setopt_array($curl, [
        CURLOPT_HTTPHEADER => $token === null ? [] : ['Authorization: Bearer ' . $token],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $texto = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if ($texto === false) {
        throw new RuntimeException('A consulta não respondeu.');
    }
    return [$status, json_decode($texto, true, 512, JSON_THROW_ON_ERROR)];
}

try {
    $db->exec('CREATE DATABASE ' . $teste . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $criado = true;
    $db->exec('USE ' . $teste);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    conferirVinculo($inicio !== false, 'Schema disponível.');
    $schema = substr($schema, $inicio);
    conferirVinculo(!preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema), 'Schema restrito ao banco de teste.');
    $db->exec($schema);
    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'A'), (2, 'B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil) VALUES
        (1, 1, 'Assessor A', 'a@example.com', 'teste', 'ASSESSOR'),
        (2, 2, 'Assessor B', 'b@example.com', 'teste', 'ASSESSOR'),
        (3, 1, 'Funcionário A', 'f@example.com', 'teste', 'FUNCIONARIO')");
    $db->exec("INSERT INTO clientes (id, assessoria_id, nome) VALUES (1, 1, 'Cliente A'), (2, 2, 'Cliente B')");
    $db->exec("INSERT INTO jornalistas (id, assessoria_id, nome, email) VALUES
        (1, 1, 'Contato A', 'a@example.com'), (2, 1, 'Contato B', 'b@example.com'),
        (99, 2, 'Contato externo', 'outro@example.com')");

    for ($id = 1; $id <= 8; $id++) {
        $db->exec("INSERT INTO releases (id, assessoria_id, criado_por, titulo, assunto, blocos_json)
            VALUES ({$id}, 1, 1, 'Release {$id}', 'Assunto', '[]')");
        $contato = $id <= 6 ? '1' : ($id === 7 ? '2' : 'NULL');
        $db->exec("INSERT INTO release_destinatarios (assessoria_id, release_id, jornalista_id, email)
            VALUES (1, {$id}, {$contato}, 'snapshot-{$id}@example.com')");
    }
    $db->exec("INSERT INTO release_destinatarios (assessoria_id, release_id, jornalista_id, email)
        VALUES (1, 2, 2, 'outro-snapshot@example.com')");
    $db->exec("INSERT INTO releases (id, assessoria_id, criado_por, titulo, assunto, blocos_json)
        VALUES (99, 2, 2, 'Externo', '', '[]')");
    $db->exec("INSERT INTO release_destinatarios (assessoria_id, release_id, jornalista_id, email)
        VALUES (2, 99, 99, 'outro@example.com')");

    $pagina = ReleaseService::listar(1, ['jornalista_id' => 1, 'limit' => 5]);
    conferirVinculo($pagina['pagination']['total'] === 6 && count($pagina['releases']) === 5, 'Contato recebe apenas seus releases, sem duplicar o card por destinatário.');
    conferirVinculo($pagina['pagination']['has_next'], 'Releases informam a próxima página.');
    $segunda = ReleaseService::listar(1, ['jornalista_id' => 1, 'page' => 2, 'limit' => 5]);
    conferirVinculo(count($segunda['releases']) === 1 && !$segunda['pagination']['has_next'], 'Última página de releases correta.');
    conferirVinculo(array_intersect(array_column($pagina['releases'], 'id'), array_column($segunda['releases'], 'id')) === [], 'Paginação não repete releases.');
    $db->exec("UPDATE jornalistas SET email = 'novo@example.com', ativo = 0 WHERE id = 1");
    conferirVinculo(ReleaseService::listar(1, ['jornalista_id' => 1])['pagination']['total'] === 6, 'O vínculo histórico independe do e-mail atual e da atividade do contato.');
    conferirVinculo(ReleaseService::listar(1, ['jornalista_id' => 99])['pagination']['total'] === 0, 'Contato externo não revela releases.');
    conferirVinculo(ReleaseService::listar(2, ['jornalista_id' => 1])['pagination']['total'] === 0, 'Releases isolam a assessoria.');
    conferirVinculo(ReleaseService::listar(1, ['jornalista_id' => 12345])['pagination']['total'] === 0, 'Contato sem vínculos tem lista vazia.');

    $db->exec("INSERT INTO clippings (id, assessoria_id, cliente_id, criado_por, ano_referencia)
        VALUES (1, 1, 1, 1, 2026), (2, 1, 1, 1, 2026), (99, 2, 2, 2, 2026)");
    $db->exec("INSERT INTO relatorios (id, assessoria_id, cliente_id, criado_por, titulo) VALUES
        (1, 1, 1, 1, 'Relatório A'), (2, 1, 1, 1, 'Relatório B'),
        (3, 1, 1, 1, 'Mesmo cliente, outro clipping'), (99, 2, 2, 2, 'Externo')");
    $db->exec("INSERT INTO relatorio_slides (relatorio_id, assessoria_id, clipping_id, ordem) VALUES
        (1, 1, 1, 1), (1, 1, 1, 2), (2, 1, 1, 1), (3, 1, 2, 1), (99, 2, 99, 1)");
    $relatorios = RelatorioService::listar(1, ['clipping_id' => 1, 'limit' => 1]);
    conferirVinculo($relatorios['pagination']['total'] === 2 && count($relatorios['relatorios']) === 1, 'Relatórios exigem slide vinculado, sem repetir relatório com dois slides.');
    conferirVinculo($relatorios['pagination']['has_next'], 'Relatórios informam a próxima página.');
    $outraPagina = RelatorioService::listar(1, ['clipping_id' => 1, 'limit' => 1, 'page' => 2]);
    conferirVinculo(!$outraPagina['pagination']['has_next'] && $outraPagina['relatorios'][0]['id'] !== $relatorios['relatorios'][0]['id'], 'Paginação de relatórios não repete registros.');
    conferirVinculo(RelatorioService::listar(1, ['cliente_id' => 1])['pagination']['total'] === 3, 'Filtro existente por cliente continua funcionando.');
    conferirVinculo(RelatorioService::listar(1, ['clipping_id' => 99])['pagination']['total'] === 0, 'Clipping externo não revela relatórios.');
    conferirVinculo(RelatorioService::listar(2, ['clipping_id' => 1])['pagination']['total'] === 0, 'Relatórios isolam a assessoria.');
    $db->exec('DELETE FROM relatorio_slides WHERE relatorio_id = 2');
    conferirVinculo(RelatorioService::listar(1, ['clipping_id' => 1])['pagination']['total'] === 1, 'Remover o slide remove o vínculo.');
    conferirVinculo(RelatorioService::listar(1, ['clipping_id' => 12345])['pagination']['total'] === 0, 'Clipping sem vínculos tem lista vazia.');
    foreach ([0, -1, 'abc', '1 OR 1=1', []] as $invalido) {
        foreach ([ReleaseService::class => 'jornalista_id', RelatorioService::class => 'clipping_id'] as $servico => $campo) {
            try {
                $servico::listar(1, [$campo => $invalido]);
                throw new RuntimeException('Filtro inválido deveria ser recusado.');
            } catch (InvalidArgumentException) {
                conferirVinculo(true, 'Filtro inválido recusado.');
            }
        }
    }

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $host = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-vinculos-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-vinculos-log-');
    $temporarios = [$wrapper, $log];
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_VINCULOS_DB"); require '
        . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-S', $host, $wrapper], [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_VINCULOS_DB' => $teste]);
    fclose($pipes[0]);
    for ($tentativa = 0; $tentativa < 30; $tentativa++) {
        $conexao = @stream_socket_client('tcp://' . $host, $codigo, $mensagem, 0.1);
        if ($conexao) {
            fclose($conexao);
            break;
        }
        usleep(100000);
    }
    $token = JwtService::gerar(['id' => 1, 'assessoria_id' => 1, 'perfil' => 'ASSESSOR']);
    $funcionario = JwtService::gerar(['id' => 3, 'assessoria_id' => 1, 'perfil' => 'FUNCIONARIO']);
    foreach (['/api/releases?jornalista_id=1' => 'releases', '/api/relatorios?clipping_id=1' => 'relatorios'] as $rota => $campo) {
        conferirVinculo(consultarVinculo($host, $rota, null)[0] === 401, 'Consulta exige autenticação.');
        conferirVinculo(consultarVinculo($host, $rota, $funcionario)[0] === 403, 'Consulta exige visualizar o módulo.');
        [$status, $resposta] = consultarVinculo($host, $rota, $token);
        conferirVinculo($status === 200 && count($resposta[$campo]) > 0, 'API consulta os vínculos com permissão.');
        conferirVinculo(consultarVinculo($host, str_replace('=1', '=abc', $rota), $token)[0] === 422, 'API recusa filtros inválidos.');
    }
    echo 'Vínculos: ' . $verificacoes . " verificações passaram em banco descartável.\n";
} finally {
    if (is_resource($processo)) {
        proc_terminate($processo);
        proc_close($processo);
    }
    foreach ($temporarios as $arquivo) {
        @unlink($arquivo);
    }
    if ($criado) {
        $db->exec('USE `' . str_replace('`', '``', $original) . '`');
        $db->exec('DROP DATABASE ' . $teste);
    }
}
