<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\ReleaseService;

Dotenv::createImmutable(dirname(__DIR__))->load();

if (!in_array($_ENV['DB_HOST'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Este teste cria um banco descartável e deve usar o MySQL local.');
}

function conferirRelease(bool $condicao, string $mensagem): void
{
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
}

function rejeitarRelease(callable $acao, string $classe): void
{
    try {
        $acao();
    } catch (Throwable $erro) {
        conferirRelease($erro instanceof $classe, 'Exceção esperada: ' . $classe);
        return;
    }

    throw new RuntimeException('A operação deveria ter sido rejeitada.');
}

function requisitarRelease(string $url, string $metodo = 'GET', ?string $token = null, ?string $corpo = null): array
{
    // O Apache fornece este parâmetro pela regra de reescrita do .htaccess.
    $rota = substr(parse_url($url, PHP_URL_PATH), strlen('/LOGOS/logos-api/public'));
    $url .= (str_contains($url, '?') ? '&' : '?') . 'route=' . rawurlencode($rota);
    $headers = ['Content-Type: application/json'];

    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    $contexto = stream_context_create(['http' => [
        'method' => $metodo,
        'header' => implode("\r\n", $headers),
        'content' => $corpo ?? '',
        'ignore_errors' => true,
        'timeout' => 5,
    ]]);
    $resposta = file_get_contents($url, false, $contexto);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $status);

    return [
        (int) ($status[1] ?? 0),
        json_decode($resposta, true, 512, JSON_THROW_ON_ERROR),
    ];
}

$db = Connection::get();
$bancoOriginal = $db->query('SELECT DATABASE()')->fetchColumn();
$bancoTeste = 'logos_teste_releases_' . bin2hex(random_bytes(6));
$processo = null;
$arquivosTemporarios = [];
$bancoCriado = false;

try {
    $db->exec("CREATE DATABASE `{$bancoTeste}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $bancoCriado = true;
    $db->exec("USE `{$bancoTeste}`");

    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    conferirRelease($inicio !== false, 'O schema deve conter as tabelas esperadas.');
    $schema = substr($schema, $inicio);
    conferirRelease(!preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema), 'O schema de teste deve usar somente o banco descartável.');
    $db->exec($schema);

    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'Assessoria A'), (2, 'Assessoria B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil) VALUES
        (1, 1, 'Assessor A', 'assessor-a@example.com', 'teste', 'ASSESSOR'),
        (2, 2, 'Assessor B', 'assessor-b@example.com', 'teste', 'ASSESSOR'),
        (3, 1, 'Funcionário A', 'funcionario-a@example.com', 'teste', 'FUNCIONARIO')");
    $db->exec("INSERT INTO clientes (id, assessoria_id, nome) VALUES (1, 1, 'Cliente A'), (2, 2, 'Cliente B')");
    $db->exec("INSERT INTO jornalistas (id, assessoria_id, nome, email, ativo) VALUES
        (1, 1, 'Contato A', 'contato@example.com', 1),
        (2, 2, 'Contato B', 'outro@example.com', 1),
        (3, 1, 'Sem e-mail', NULL, 1),
        (4, 1, 'Inativo', 'inativo@example.com', 0),
        (5, 1, 'Endereço repetido', ' contato@example.com', 1),
        (6, 1, 'E-mail inválido', 'ana..silva@example.org', 1)");

    $dados = [
        'titulo' => ' Release inicial ',
        'cliente_id' => 1,
        'jornalistas_ids' => [5, 1, 1],
        'chave_rascunho' => '9ba37c50-fb78-4e84-a0bc-4e48ed68a859',
    ];
    $release = ReleaseService::criar(1, 1, $dados);
    conferirRelease($release['titulo'] === 'Release inicial', 'Normaliza o título.');
    conferirRelease($release['status'] === 'RASCUNHO' && $release['assunto'] === '', 'Cria como rascunho incompleto.');
    conferirRelease($release['total_destinatarios'] === 1, 'Elimina IDs e e-mails repetidos.');
    conferirRelease($release['destinatarios'][0]['email'] === 'contato@example.com', 'Normaliza o endereço escolhido.');

    $dados['jornalistas_ids'] = [1, 5];
    conferirRelease(ReleaseService::criar(1, 1, $dados)['id'] === $release['id'], 'Repetir o cadastro recupera o mesmo rascunho.');
    rejeitarRelease(
        fn() => ReleaseService::criar(1, 1, [...$dados, 'titulo' => 'Outros dados']),
        DomainException::class
    );
    $vazio = ReleaseService::criar(1, 1, []);
    conferirRelease($vazio['cliente_id'] === null && $vazio['blocos'] === [], 'Aceita rascunho ainda sem cliente ou conteúdo.');
    $outro = ReleaseService::criar(2, 2, ['titulo' => 'Outra assessoria', 'cliente_id' => 2, 'jornalistas_ids' => [2]]);
    ReleaseService::criar(1, 3, ['titulo' => 'Feira 100%_regional']);
    conferirRelease(ReleaseService::listar(1)['pagination']['total'] === 3, 'A listagem respeita a assessoria.');
    conferirRelease(ReleaseService::listar(1, ['busca' => '%_'])['pagination']['total'] === 1, 'A busca trata curingas como texto.');
    conferirRelease(ReleaseService::listar(1, ['cliente_id' => 1])['pagination']['total'] === 1, 'Filtra pelo cliente.');
    conferirRelease(ReleaseService::listar(1, ['criado_por' => 3])['pagination']['total'] === 1, 'Filtra pelo responsável.');
    $pagina1 = ReleaseService::listar(1, ['limit' => 1]);
    $pagina2 = ReleaseService::listar(1, ['limit' => 1, 'page' => 2]);
    conferirRelease($pagina1['pagination']['has_next'] && $pagina1['releases'][0]['id'] !== $pagina2['releases'][0]['id'], 'Pagina com ordenação estável.');

    rejeitarRelease(fn() => ReleaseService::buscar(1, $outro['id']), OutOfBoundsException::class);
    rejeitarRelease(fn() => ReleaseService::criar(1, 1, ['cliente_id' => 2]), OutOfBoundsException::class);
    rejeitarRelease(fn() => ReleaseService::criar(1, 1, ['jornalistas_ids' => [2]]), InvalidArgumentException::class);
    $quantidade = $db->query('SELECT COUNT(*) FROM releases')->fetchColumn();
    $destinatarios = $db->query('SELECT COUNT(*) FROM release_destinatarios')->fetchColumn();

    foreach ([[1, 3], [1, 4], [6], [99999]] as $ids) {
        rejeitarRelease(fn() => ReleaseService::criar(1, 1, ['jornalistas_ids' => $ids]), InvalidArgumentException::class);
    }

    conferirRelease($db->query('SELECT COUNT(*) FROM releases')->fetchColumn() === $quantidade, 'Falhas desfazem o cadastro inteiro.');
    conferirRelease($db->query('SELECT COUNT(*) FROM release_destinatarios')->fetchColumn() === $destinatarios, 'Falhas desfazem destinatários já inseridos.');
    rejeitarRelease(fn() => ReleaseService::criar(1, 1, ['status' => 'ENVIADO']), InvalidArgumentException::class);
    rejeitarRelease(fn() => ReleaseService::criar(1, 1, ['titulo' => str_repeat('á', 151)]), InvalidArgumentException::class);
    rejeitarRelease(fn() => ReleaseService::criar(1, 1, ['cliente_id' => true]), InvalidArgumentException::class);

    foreach ([
        ['page' => 0], ['limit' => 101], ['page' => PHP_INT_MAX], ['busca' => []],
        ['status' => 'INVALIDO'], ['ordem' => []], ['data_inicio' => '2026-02-30'],
        ['data_inicio' => '2026-11-02', 'data_fim' => '2026-11-01'],
    ] as $filtro) {
        rejeitarRelease(fn() => ReleaseService::listar(1, $filtro), InvalidArgumentException::class);
    }

    $db->exec("UPDATE releases SET assunto = 'Economia rural', status = 'ENVIADO', enviado_em = '2026-10-31 12:00:00' WHERE id = " . $release['id']);
    conferirRelease(ReleaseService::listar(1, ['busca' => 'Economia'])['pagination']['total'] === 1, 'Busca também pelo assunto.');
    conferirRelease(ReleaseService::listar(1, ['status' => 'ENVIADO', 'data_inicio' => '2026-10-31', 'data_fim' => '2026-10-31'])['pagination']['total'] === 1, 'O período acompanha a data de referência do envio.');
    echo "OK: cadastro, repetição, busca, filtros, paginação, validação, transações e isolamento.\n";

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $endereco = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-release-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-release-log-');
    $arquivosTemporarios = [$wrapper, $log];
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_RELEASES_TEST_DB"); require '
        . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-S', $endereco, $wrapper], [
        0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a'],
    ], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_RELEASES_TEST_DB' => $bancoTeste]);
    conferirRelease(is_resource($processo), 'Inicia o servidor isolado para testar as rotas.');
    fclose($pipes[0]);

    $pronto = false;
    for ($tentativa = 0; $tentativa < 30; $tentativa++) {
        $conexao = @stream_socket_client('tcp://' . $endereco, $codigo, $mensagem, 0.1);
        if ($conexao !== false) {
            fclose($conexao);
            $pronto = true;
            break;
        }
        usleep(100000);
    }
    conferirRelease($pronto, 'O servidor de teste está disponível.');

    $url = 'http://' . $endereco . '/LOGOS/logos-api/public/api/releases';
    $token = JwtService::gerar(['id' => 1, 'assessoria_id' => 1, 'perfil' => 'ASSESSOR']);
    $semPermissao = JwtService::gerar(['id' => 3, 'assessoria_id' => 1, 'perfil' => 'FUNCIONARIO']);
    conferirRelease(requisitarRelease($url)[0] === 401, 'A rota exige autenticação.');
    conferirRelease(requisitarRelease($url, 'GET', $semPermissao)[0] === 403, 'A rota exige a permissão de visualizar.');
    conferirRelease(requisitarRelease($url, 'POST', $semPermissao, '{}')[0] === 403, 'O cadastro exige a permissão de criar.');
    $db->exec("INSERT IGNORE INTO permissoes (modulo, acao, descricao) VALUES ('RELEASES', 'CRIAR', '')");
    $db->exec("INSERT INTO usuario_permissoes (usuario_id, permissao_id)
        SELECT 3, id FROM permissoes WHERE modulo = 'RELEASES' AND acao = 'CRIAR'");
    conferirRelease(requisitarRelease($url, 'POST', $semPermissao, '{}')[0] === 201, 'A permissão de criar permite rascunho sem vínculos.');
    conferirRelease(requisitarRelease($url, 'POST', $semPermissao, '{"jornalistas_ids":[1]}')[0] === 403, 'Vincular jornalistas exige visualizar o Mailing.');
    conferirRelease(requisitarRelease($url, 'POST', $semPermissao, '{"cliente_id":1}')[0] === 403, 'Vincular cliente exige visualizar Clientes.');

    $filtroContato = '?busca=' . rawurlencode('ana..silva@example.org');
    [$statusPagina, $pagina] = requisitarRelease($url . '/destinatarios' . $filtroContato . '&page=1&limit=30', 'GET', $token);
    [$statusLote, $lote] = requisitarRelease($url . '/destinatarios' . $filtroContato, 'GET', $token);
    conferirRelease($statusPagina === 200 && $pagina['pagination']['total'] === 1, 'A listagem paginada inclui a contagem de contatos encontrados.');
    conferirRelease($pagina['jornalistas'][0]['elegivel'] === false, 'A seleção individual recebe a elegibilidade calculada na API.');
    conferirRelease($statusLote === 200 && $lote['jornalistas'] === [] && $lote['total_ignorados'] === 1, 'Selecionar todos ignora o mesmo e-mail inválido.');
    conferirRelease(requisitarRelease($url, 'POST', $token, '[]')[0] === 400, 'A rota rejeita um corpo que não seja objeto.');
    conferirRelease(requisitarRelease($url, 'POST', $token, '{')[0] === 400, 'A rota rejeita JSON inválido.');
    conferirRelease(requisitarRelease($url, 'POST', $token, '{"status":"ENVIADO"}')[0] === 422, 'O cadastro rejeita alterações indevidas de status.');
    $payload = json_encode(['titulo' => 'Cadastro pela API', 'cliente_id' => 1, 'jornalistas_ids' => [1]]);
    [$status, $resposta] = requisitarRelease($url, 'POST', $token, $payload);
    conferirRelease($status === 201 && $resposta['success'], 'A rota cadastra o rascunho.');
    [$status, $detalhe] = requisitarRelease($url . '/' . $resposta['release']['id'], 'GET', $token);
    conferirRelease($status === 200 && $detalhe['release']['total_destinatarios'] === 1, 'A rota consulta o rascunho cadastrado.');
    conferirRelease(requisitarRelease($url . '/' . $outro['id'], 'GET', $token)[0] === 404, 'A rota protege registros de outra assessoria.');
    conferirRelease(requisitarRelease($url . '?status=RASCUNHO&limit=1', 'GET', $token)[0] === 200, 'A rota lista com filtros e paginação.');
    echo "OK: rotas HTTP, autenticação, permissões e respostas de erro.\n";
} finally {
    if (is_resource($processo)) {
        proc_terminate($processo);
        proc_close($processo);
    }

    foreach ($arquivosTemporarios as $arquivo) {
        unlink($arquivo);
    }

    if ($db->inTransaction()) {
        $db->rollBack();
    }

    if ($bancoCriado && preg_match('/^logos_teste_releases_[a-f0-9]{12}$/D', $bancoTeste)) {
        $db->exec('USE `' . str_replace('`', '``', $bancoOriginal) . '`');
        $db->exec("DROP DATABASE `{$bancoTeste}`");
    }
}
