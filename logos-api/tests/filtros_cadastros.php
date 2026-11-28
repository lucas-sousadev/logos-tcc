<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Veiculo;
use Logos\AssessoriaApi\Services\ClienteService;
use Logos\AssessoriaApi\Services\ClippingService;
use Logos\AssessoriaApi\Services\JornalistaService;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\VeiculoService;

Dotenv::createImmutable(dirname(__DIR__))->load();
if (!in_array($_ENV['DB_HOST'] ?? '', ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Este teste exige MySQL local e um banco descartável.');
}

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_filtros_' . bin2hex(random_bytes(6));
$criado = false;
$processo = null;
$temporarios = [];
$verificacoes = 0;

function conferirFiltro(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
}

function requisitarFiltro(string $host, string $rota, ?string $token): array
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
        throw new RuntimeException('A API de teste não respondeu.');
    }
    return [$status, json_decode($texto, true, 512, JSON_THROW_ON_ERROR)];
}

try {
    $db->exec('CREATE DATABASE ' . $teste . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $criado = true;
    $db->exec('USE ' . $teste);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    conferirFiltro($inicio !== false, 'Schema disponível.');
    $schema = substr($schema, $inicio);
    conferirFiltro(!preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema), 'Schema restrito ao banco de teste.');
    $db->exec($schema);
    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'A'), (2, 'B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil) VALUES
        (1, 1, 'Assessor A', 'a@example.com', 'teste', 'ASSESSOR'),
        (2, 2, 'Assessor B', 'b@example.com', 'teste', 'ASSESSOR'),
        (3, 1, 'Funcionário A', 'f@example.com', 'teste', 'FUNCIONARIO')");
    $db->exec("INSERT INTO clientes (id, assessoria_id, nome, estado, ativo) VALUES
        (1, 1, 'Alfa', 'SP', 1), (2, 1, 'Beta', 'SP', 1), (3, 1, 'Gama', 'RJ', 1),
        (4, 1, 'Delta', 'SP', 1), (5, 1, 'Epsilon', 'RJ', 0), (99, 2, 'Externo', 'SP', 1)");
    $db->exec("INSERT INTO veiculos (id, assessoria_id, nome, tier, ativo) VALUES
        (1, 1, 'Alfa', 1, 1), (2, 1, 'Beta', 1, 0), (3, 1, 'Gama', 2, 1),
        (4, 1, 'Delta', 3, 1), (5, 1, 'Epsilon', NULL, 1), (6, 1, 'Zeta', NULL, 0),
        (99, 2, 'Externo', 1, 1)");
    $db->exec("INSERT INTO clippings (id, assessoria_id, cliente_id, veiculo_id, criado_por, ano_referencia, arquivado_em, arquivado_por) VALUES
        (1, 1, 2, 1, 1, 2026, NULL, NULL), (2, 1, 3, 1, 1, 2026, NULL, NULL),
        (3, 1, 3, 3, 1, 2025, NULL, NULL), (4, 1, 3, 3, 1, 2026, NULL, NULL),
        (5, 1, 4, 5, 1, 2020, '2026-11-27 10:00:00', 1),
        (99, 2, 99, 99, 2, 2026, NULL, NULL)");

    conferirFiltro(VeiculoService::listar(1)['pagination']['total'] === 6, 'Listagem sem Tier mantém todos os veículos da assessoria.');
    foreach ([1 => 2, 2 => 1, 3 => 1] as $tier => $total) {
        $resposta = VeiculoService::listar(1, ['tier' => $tier]);
        conferirFiltro($resposta['pagination']['total'] === $total && count($resposta['veiculos']) === $total, 'Tier filtra lista e contagem igualmente.');
        conferirFiltro(count(array_filter($resposta['veiculos'], fn($v) => (int) $v['tier'] !== $tier)) === 0, 'Veículos retornados correspondem ao Tier.');
    }
    conferirFiltro(VeiculoService::listar(1, ['sem_tier' => '1'])['pagination']['total'] === 2, 'Tier não definido usa NULL.');
    conferirFiltro(VeiculoService::listar(1, ['tier' => 1, 'ativo' => 1])['pagination']['total'] === 1, 'Tier combina com status.');
    conferirFiltro(VeiculoService::listar(1, ['tier' => 1, 'min_clippings' => 1])['pagination']['total'] === 1, 'Tier combina com quantidade de clippings.');
    $primeira = VeiculoService::listar(1, ['tier' => 1, 'limit' => 1]);
    $segunda = VeiculoService::listar(1, ['tier' => 1, 'limit' => 1, 'page' => 2]);
    conferirFiltro($primeira['pagination']['has_next'] && !$segunda['pagination']['has_next'] && $primeira['veiculos'][0]['id'] !== $segunda['veiculos'][0]['id'], 'Tier mantém paginação sem repetir registros.');
    foreach ([0, 4, 'abc', [], true, 1.5] as $invalido) {
        try {
            VeiculoService::listar(1, ['tier' => $invalido]);
            throw new RuntimeException('Tier inválido deveria ser recusado.');
        } catch (InvalidArgumentException) {
            conferirFiltro(true, 'Tier inválido recusado.');
        }
    }
    foreach ([['tier' => 1, 'sem_tier' => true], ['sem_tier' => 'inválido'], ['sem_tier' => []]] as $invalido) {
        try {
            VeiculoService::listar(1, $invalido);
            throw new RuntimeException('Filtro conflitante deveria ser recusado.');
        } catch (InvalidArgumentException) {
            conferirFiltro(true, 'Filtro de Tier conflitante recusado.');
        }
    }

    conferirFiltro(ClienteService::listar(1)['pagination']['total'] === 5, 'Listagem de clientes preserva filtros antigos.');
    conferirFiltro(ClienteService::listar(1, ['max_clippings' => 0])['pagination']['total'] === 2, 'Sem clippings considera zero explicitamente.');
    conferirFiltro(ClienteService::listar(1, ['min_clippings' => 1])['pagination']['total'] === 3, 'Com clippings considera todos os anos e arquivados.');
    $faixa = ClienteService::listar(1, ['min_clippings' => 2, 'max_clippings' => 3]);
    conferirFiltro($faixa['pagination']['total'] === 1 && $faixa['clientes'][0]['id'] === 3, 'Quantidade filtra clientes sem repetir os cards.');
    conferirFiltro(ClienteService::listar(1, ['min_clippings' => 1, 'estado' => 'SP'])['pagination']['total'] === 2, 'Clippings combinam com localização.');
    conferirFiltro(ClienteService::listar(1, ['max_clippings' => 0, 'ativo' => 1])['pagination']['total'] === 1, 'Clippings combinam com status.');
    $mais = ClienteService::listar(1, ['ordem' => 'clippings', 'direcao' => 'DESC', 'limit' => 2]);
    conferirFiltro($mais['clientes'][0]['id'] === 3 && $mais['pagination']['total'] === 5, 'Ordenação por mais clippings.');
    $menos = ClienteService::listar(1, ['ordem' => 'clippings', 'direcao' => 'ASC']);
    conferirFiltro($menos['clientes'][0]['id'] === 1 && $menos['clientes'][1]['id'] === 5, 'Ordenação por menos clippings tem desempate estável.');
    $p1 = ClienteService::listar(1, ['min_clippings' => 1, 'limit' => 2]);
    $p2 = ClienteService::listar(1, ['min_clippings' => 1, 'limit' => 2, 'page' => 2]);
    conferirFiltro($p1['pagination']['has_next'] && !$p2['pagination']['has_next'] && count($p2['clientes']) === 1 && array_intersect(array_column($p1['clientes'], 'id'), array_column($p2['clientes'], 'id')) === [], 'Filtros de clientes preservam paginação.');
    conferirFiltro(ClienteService::listar(2, ['min_clippings' => 2])['pagination']['total'] === 0, 'Clippings não vazam entre assessorias.');
    foreach ([['min_clippings' => -1], ['max_clippings' => '1.5'], ['min_clippings' => []], ['min_clippings' => '9999999999999999999999'], ['min_clippings' => 3, 'max_clippings' => 2], ['ordem' => 'DROP TABLE'], ['direcao' => 'inválida']] as $invalido) {
        try {
            ClienteService::listar(1, $invalido);
            throw new RuntimeException('Filtro de clientes inválido deveria ser recusado.');
        } catch (InvalidArgumentException) {
            conferirFiltro(true, 'Filtro de clientes inválido recusado.');
        }
    }

    $db->exec("INSERT INTO veiculos (id, assessoria_id, nome) VALUES (20, 1, 'Notícias Agrícolas de teste'), (30, 1, 'Livre'), (31, 1, 'Protegido')");
    $db->exec("INSERT INTO jornalistas (id, assessoria_id, nome, email, veiculo_id, ativo) VALUES
        (20, 1, 'Contato ativo', 'ativo@example.com', 20, 1), (21, 1, 'Contato inativo', 'inativo@example.com', 20, 0)");
    $db->exec("INSERT INTO clippings (id, assessoria_id, cliente_id, veiculo_id, criado_por, ano_referencia) VALUES
        (20, 1, 1, 20, 1, 2026), (31, 1, 1, 31, 1, 2026)");
    try {
        VeiculoService::excluir(20, 1);
        throw new RuntimeException('Vínculos devem proteger o veículo.');
    } catch (RuntimeException $erro) {
        conferirFiltro(str_contains($erro->getMessage(), 'contatos e clippings vinculados'), 'Mensagem identifica os dois tipos de vínculo.');
    }
    JornalistaService::excluir(20, 1);
    $db->exec('UPDATE jornalistas SET veiculo_id = NULL WHERE id = 21');
    conferirFiltro((int) Veiculo::buscarPorId(20, 1)['contatos_vinculados'] === 0, 'Excluir e desvincular contatos limpa a contagem real.');
    try {
        VeiculoService::excluir(20, 1);
        throw new RuntimeException('Clipping deve proteger o veículo.');
    } catch (RuntimeException $erro) {
        conferirFiltro(str_contains($erro->getMessage(), 'clippings vinculados') && !str_contains($erro->getMessage(), 'contatos'), 'Após retirar os contatos, o impedimento informa clippings.');
    }
    ClippingService::excluir(20, 1);
    VeiculoService::excluir(20, 1);
    conferirFiltro(Veiculo::buscarPorId(20, 1) === null, 'Sem contatos e clippings, veículo é excluído normalmente.');
    conferirFiltro((int) $db->query('SELECT COUNT(*) FROM jornalistas WHERE id = 21 AND veiculo_id IS NULL')->fetchColumn() === 1, 'Contato desvinculado é preservado.');
    try {
        VeiculoService::excluirEmLote(1, [30, 31]);
        throw new RuntimeException('Lote com vínculo deve ser recusado.');
    } catch (RuntimeException $erro) {
        conferirFiltro(str_contains($erro->getMessage(), 'clippings vinculados') && Veiculo::buscarPorId(30, 1) !== null, 'Exclusão em lote desfaz o lote inteiro e informa o vínculo correto.');
    }
    try {
        VeiculoService::excluir(5, 1);
        throw new RuntimeException('Clipping arquivado deve proteger o veículo.');
    } catch (RuntimeException $erro) {
        conferirFiltro(str_contains($erro->getMessage(), 'clippings vinculados'), 'Clippings arquivados também protegem a exclusão.');
    }

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $host = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-filtros-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-filtros-log-');
    $temporarios = [$wrapper, $log];
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_FILTROS_DB"); require '
        . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-S', $host, $wrapper], [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_FILTROS_DB' => $teste]);
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
    foreach (['/api/veiculos?tier=1', '/api/clientes?min_clippings=1'] as $rota) {
        conferirFiltro(requisitarFiltro($host, $rota, null)[0] === 401, 'Filtro exige autenticação.');
        conferirFiltro(requisitarFiltro($host, $rota, $funcionario)[0] === 403, 'Filtro exige visualizar o módulo.');
        conferirFiltro(requisitarFiltro($host, $rota, $token)[0] === 200, 'API disponibiliza o filtro com permissão.');
    }
    conferirFiltro(requisitarFiltro($host, '/api/veiculos?tier=4', $token)[0] === 422, 'API informa Tier inválido como erro de validação.');
    conferirFiltro(requisitarFiltro($host, '/api/clientes?min_clippings=3&max_clippings=2', $token)[0] === 422, 'API informa intervalo inválido como erro de validação.');
    $db->exec("INSERT IGNORE INTO permissoes (modulo, acao) VALUES ('CLIENTES', 'VISUALIZAR')");
    $db->exec("INSERT INTO usuario_permissoes (usuario_id, permissao_id) SELECT 3, id FROM permissoes WHERE modulo = 'CLIENTES' AND acao = 'VISUALIZAR'");
    conferirFiltro(requisitarFiltro($host, '/api/clientes?min_clippings=1', $funcionario)[0] === 403, 'Sem visualizar Clipping, o usuário não pode inferir vínculos pelos filtros.');
    conferirFiltro(requisitarFiltro($host, '/api/clientes?page=1', $funcionario)[0] === 200, 'Sem Clipping, continua podendo consultar clientes normalmente.');
    echo 'Filtros e exclusão: ' . $verificacoes . " verificações passaram em banco descartável.\n";
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
