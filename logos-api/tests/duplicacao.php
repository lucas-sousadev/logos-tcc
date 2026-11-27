<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\ClippingService;
use Logos\AssessoriaApi\Services\DuplicacaoCadastroService;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\ReleaseService;

Dotenv::createImmutable(dirname(__DIR__))->load();
if (!in_array($_ENV['DB_HOST'] ?? '', ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Este teste exige MySQL local e um banco descartável.');
}

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_duplicacao_' . bin2hex(random_bytes(6));
$pasta = sys_get_temp_dir() . '/logos-duplicacao-' . bin2hex(random_bytes(8));
$temporarios = [];
$processo = null;
$criado = false;
$verificacoes = 0;

function conferirDuplicacao(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
}

function inserirDuplicacao(string $tabela, array $valores): int
{
    global $db;
    if (!preg_match('/^[a-z_]+$/D', $tabela)) {
        throw new RuntimeException('Tabela de teste inválida.');
    }
    $stmt = $db->prepare('INSERT INTO ' . $tabela . ' (' . implode(', ', array_keys($valores))
        . ') VALUES (' . implode(', ', array_fill(0, count($valores), '?')) . ')');
    $stmt->execute(array_values($valores));
    return (int) $db->lastInsertId();
}

function chamarDuplicacao(string $host, string $rota, ?string $token, array $dados): array
{
    $curl = curl_init('http://' . $host . '/LOGOS/logos-api/public' . $rota . '?route=' . rawurlencode($rota));
    $headers = ['Content-Type: application/json'];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($dados, JSON_THROW_ON_ERROR),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $texto = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if ($texto === false) {
        throw new RuntimeException('A chamada de duplicação não respondeu.');
    }
    return [$status, json_decode($texto, true, 512, JSON_THROW_ON_ERROR)];
}

try {
    $db->exec('CREATE DATABASE ' . $teste . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $criado = true;
    $db->exec('USE ' . $teste);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    conferirDuplicacao($inicio !== false, 'Schema disponível.');
    $schema = substr($schema, $inicio);
    conferirDuplicacao(!preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema), 'Schema restrito ao banco de teste.');
    $db->exec($schema);
    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'A'), (2, 'B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil) VALUES
        (1, 1, 'Assessor A', 'a@example.com', 'teste', 'ASSESSOR'),
        (2, 2, 'Assessor B', 'b@example.com', 'teste', 'ASSESSOR'),
        (3, 1, 'Funcionário A', 'f@example.com', 'teste', 'FUNCIONARIO')");
    $db->exec("INSERT INTO clientes (id, assessoria_id, nome) VALUES (1, 1, 'Cliente A'), (2, 2, 'Cliente B')");
    $db->exec("INSERT INTO jornalistas (id, assessoria_id, nome, email, ativo) VALUES
        (1, 1, 'Contato atual', 'atual@example.com', 1),
        (2, 1, 'Inativo', 'inativo@example.com', 0),
        (3, 1, 'Duplicado', ' ATUAL@example.com ', 1)");

    mkdir($pasta . '/1/1', 0750, true);
    $_ENV['CLIPPING_STORAGE_PATH'] = $pasta;
    $id = inserirDuplicacao('clippings', [
        'id' => 1, 'assessoria_id' => 1, 'cliente_id' => 1,
        'criado_por' => 1, 'ano_referencia' => 2026,
        'data_publicacao' => '2026-11-26', 'pauta' => 'Título da publicação',
        'categorias' => '["Site"]', 'tier' => 2, 'observacoes' => 'Observações originais',
        'link' => 'https://example.com/noticia', 'inicio_segundos' => 10,
        'fim_segundos' => 70, 'duracao_segundos' => 60,
        'arquivado_em' => '2026-11-26 12:00:00', 'arquivado_por' => 1,
    ]);
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwAAAAABJRU5ErkJggg==');
    $anexosOriginais = [];
    foreach ([0, 1] as $indice) {
        $caminho = '1/1/' . bin2hex(random_bytes(16)) . '.png';
        file_put_contents($pasta . '/' . $caminho, $png);
        $anexoId = inserirDuplicacao('clipping_anexos', [
            'assessoria_id' => 1, 'clipping_id' => 1, 'criado_por' => 1,
            'anexo_origem_id' => $indice === 1 ? $anexosOriginais[0]['id'] : null,
            'tipo' => 'IMAGEM', 'origem' => $indice === 1 ? 'RECORTE' : 'UPLOAD',
            'nome_original' => 'imagem-' . $indice . '.png', 'arquivo_path' => $caminho,
            'mime_type' => 'image/png', 'tamanho_bytes' => strlen($png),
            'ordem' => $indice * 3, 'principal' => $indice === 0 ? 1 : null,
            'imagem_relatorio' => $indice === 1 ? 1 : null,
            'url_origem' => 'https://example.com/noticia', 'metadados_json' => '{"x":10}',
        ]);
        $anexosOriginais[] = ['id' => $anexoId, 'caminho' => $caminho];
    }
    $antes = ClippingService::buscar(1, 1);
    $copia = DuplicacaoCadastroService::clipping(1, 1, 'ASSESSOR', 1, true);
    $novo = $copia['clipping'];
    conferirDuplicacao($novo['id'] !== 1 && $novo['pauta'] === $antes['pauta'], 'Clipping ganha um ID próprio e preserva pauta.');
    foreach (['cliente_id', 'ano_referencia', 'data_publicacao', 'categorias', 'tier', 'observacoes', 'link', 'inicio_segundos', 'fim_segundos', 'duracao_segundos'] as $campo) {
        conferirDuplicacao($novo[$campo] === $antes[$campo], 'Preserva ' . $campo);
    }
    conferirDuplicacao($novo['arquivado_em'] === null && $novo['arquivado_por'] === null, 'A cópia fica disponível para edição.');
    conferirDuplicacao(ClippingService::buscar(1, 1) === $antes, 'Duplicar não altera o clipping original.');
    $anexos = $db->query('SELECT * FROM clipping_anexos WHERE clipping_id = ' . $novo['id'] . ' ORDER BY ordem')->fetchAll();
    conferirDuplicacao(count($anexos) === 2 && $copia['anexos_copiados'] === 2, 'Copia todos os anexos.');
    conferirDuplicacao((int) $anexos[1]['anexo_origem_id'] === (int) $anexos[0]['id'], 'O recorte referencia o novo original.');
    conferirDuplicacao((int) $anexos[0]['principal'] === 1 && (int) $anexos[1]['imagem_relatorio'] === 1, 'Preserva seleções de mídia.');
    foreach ($anexos as $indice => $anexo) {
        conferirDuplicacao($anexo['arquivo_path'] !== $anexosOriginais[$indice]['caminho'], 'Anexo tem caminho próprio.');
        conferirDuplicacao(file_get_contents($pasta . '/' . $anexo['arquivo_path']) === $png, 'Bytes da cópia conferem.');
    }
    ClippingService::excluir($novo['id'], 1);
    conferirDuplicacao(is_file($pasta . '/' . $anexosOriginais[0]['caminho']), 'Excluir a cópia preserva arquivos da origem.');
    $semAnexos = DuplicacaoCadastroService::clipping(1, 1, 'ASSESSOR', 1, false);
    conferirDuplicacao($semAnexos['clipping']['total_anexos'] === 0, 'Permite copiar somente os dados.');

    $quantidade = (int) $db->query('SELECT COUNT(*) FROM clippings')->fetchColumn();
    $quantidadeArquivos = count(glob($pasta . '/1/*/*.png'));
    unlink($pasta . '/' . $anexosOriginais[1]['caminho']);
    try {
        DuplicacaoCadastroService::clipping(1, 1, 'ASSESSOR', 1, true);
        throw new RuntimeException('Arquivo ausente deveria cancelar a duplicação.');
    } catch (OutOfBoundsException) {
        conferirDuplicacao((int) $db->query('SELECT COUNT(*) FROM clippings')->fetchColumn() === $quantidade, 'Falha desfaz o registro inteiro.');
        conferirDuplicacao(count(glob($pasta . '/1/*/*.png')) === $quantidadeArquivos - 1, 'Falha remove os arquivos parcialmente copiados.');
    }

    $origemId = inserirDuplicacao('releases', [
        'assessoria_id' => 1, 'cliente_id' => 1, 'criado_por' => 1,
        'titulo' => 'Release original', 'assunto' => 'Assunto original',
        'primeira_linha' => 'Prévia', 'nome_remetente' => 'Remetente', 'responder_para' => 'a@example.com',
        'blocos_json' => '[{"id":"titulo-1","tipo":"titulo","texto":"Conteúdo original"}]',
        'status' => 'ENVIADO', 'agendado_para' => '2026-11-26 10:00:00',
        'iniciado_em' => '2026-11-26 10:00:00', 'enviado_em' => '2026-11-26 11:00:00',
        'versao_programacao' => 5,
    ]);
    foreach ([1, 2, 3, null] as $indice => $contatoId) {
        inserirDuplicacao('release_destinatarios', [
            'assessoria_id' => 1, 'release_id' => $origemId, 'jornalista_id' => $contatoId,
            'email' => 'snapshot-' . $indice . '@example.com', 'status' => 'ENVIADO',
            'enviado_em' => '2026-11-26 11:00:00', 'tentativas' => 2,
        ]);
    }
    $origem = ReleaseService::buscar(1, $origemId);
    $chave = '1bab9c50-fb78-4e84-a0bc-4e48ed68a859';
    $duplicado = DuplicacaoCadastroService::release(1, 1, 'ASSESSOR', $origemId, $chave);
    $rascunho = $duplicado['release'];
    conferirDuplicacao($rascunho['id'] !== $origemId && $rascunho['status'] === 'RASCUNHO', 'Release é duplicado como novo rascunho.');
    conferirDuplicacao($rascunho['titulo'] === 'Cópia de Release original', 'Título interno identifica a cópia.');
    conferirDuplicacao($rascunho['blocos'] === $origem['blocos'] && $rascunho['assunto'] === $origem['assunto'], 'Preserva conteúdo e dados de e-mail.');
    conferirDuplicacao($rascunho['agendado_para'] === null && $rascunho['iniciado_em'] === null && $rascunho['enviado_em'] === null && $rascunho['versao_programacao'] === 0, 'Reinicia programação e histórico de envio.');
    conferirDuplicacao($rascunho['total_destinatarios'] === 1 && $duplicado['destinatarios_nao_copiados'] === 3, 'Remove contatos indisponíveis e e-mails repetidos.');
    conferirDuplicacao($rascunho['destinatarios'][0]['email'] === 'atual@example.com' && $rascunho['destinatarios'][0]['status'] === 'PENDENTE', 'Usa endereço atual sem copiar o envio anterior.');
    $destino = $db->query('SELECT * FROM release_destinatarios WHERE release_id = ' . $rascunho['id'])->fetch();
    conferirDuplicacao((int) $destino['tentativas'] === 0 && $destino['enviado_em'] === null && $destino['aberto_em'] === null && (int) $destino['aberturas_quantidade'] === 0, 'Métricas e tentativas começam vazias.');
    conferirDuplicacao(ReleaseService::buscar(1, $origemId) === $origem, 'Release original permanece intacto.');
    conferirDuplicacao(DuplicacaoCadastroService::release(1, 1, 'ASSESSOR', $origemId, $chave)['release']['id'] === $rascunho['id'], 'Repetir a chave recupera a mesma cópia.');

    $editado = ReleaseService::atualizar(1, $rascunho['id'], [
        'versao_edicao' => $rascunho['versao_edicao'],
        'titulo' => 'Cópia revisada',
        'cliente_id' => $rascunho['cliente_id'],
        'jornalistas_ids' => [1],
        'template_id' => $rascunho['template_id'],
        'template_codigo' => $rascunho['template_codigo'],
        'blocos' => $rascunho['blocos'],
        'dados_envio' => [
            'assunto' => $rascunho['assunto'],
            'primeira_linha' => $rascunho['primeira_linha'],
            'nome_remetente' => $rascunho['nome_remetente'],
            'responder_para' => $rascunho['responder_para'],
        ],
    ], true, true);
    conferirDuplicacao($editado['titulo'] === 'Cópia revisada' && $editado['status'] === 'RASCUNHO', 'A cópia pode ser editada pelo fluxo existente.');
    conferirDuplicacao(ReleaseService::buscar(1, $origemId) === $origem, 'Editar a cópia preserva o release original.');

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $host = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-duplicacao-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-duplicacao-log-');
    $temporarios = [$wrapper, $log];
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_DUPLICACAO_DB"); $_ENV["CLIPPING_STORAGE_PATH"] = getenv("LOGOS_DUPLICACAO_STORAGE"); require '
        . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-S', $host, $wrapper], [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_DUPLICACAO_DB' => $teste, 'LOGOS_DUPLICACAO_STORAGE' => $pasta]);
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
    $outro = JwtService::gerar(['id' => 2, 'assessoria_id' => 2, 'perfil' => 'ASSESSOR']);
    $funcionario = JwtService::gerar(['id' => 3, 'assessoria_id' => 1, 'perfil' => 'FUNCIONARIO']);
    foreach (['clippings/1' => ['incluir_anexos' => false], 'releases/' . $origemId => ['chave_rascunho' => $chave]] as $caminho => $dados) {
        $rota = '/api/' . $caminho . '/duplicar';
        conferirDuplicacao(chamarDuplicacao($host, $rota, null, $dados)[0] === 401, 'Rota exige autenticação.');
        conferirDuplicacao(chamarDuplicacao($host, $rota, $funcionario, $dados)[0] === 403, 'Rota exige criar.');
        conferirDuplicacao(chamarDuplicacao($host, $rota, $outro, $dados)[0] === 404, 'Rota isola assessorias.');
        conferirDuplicacao(chamarDuplicacao($host, $rota, $token, $dados)[0] === 201, 'Rota duplica com permissão.');
    }
    conferirDuplicacao(chamarDuplicacao($host, '/api/clippings/1/duplicar', $token, ['incluir_anexos' => 'sim'])[0] === 422, 'Valida opção de anexos.');
    conferirDuplicacao(chamarDuplicacao($host, '/api/releases/' . $origemId . '/duplicar', $token, ['chave_rascunho' => 'inválida'])[0] === 422, 'Valida chave da cópia.');
    $db->exec("INSERT IGNORE INTO permissoes (modulo, acao) VALUES ('CLIPPING', 'CRIAR'), ('CLIPPING', 'VISUALIZAR'), ('RELEASES', 'CRIAR'), ('RELEASES', 'VISUALIZAR')");
    $db->exec("INSERT INTO usuario_permissoes (usuario_id, permissao_id) SELECT 3, id FROM permissoes WHERE modulo IN ('CLIPPING', 'RELEASES') AND acao = 'CRIAR'");
    conferirDuplicacao(chamarDuplicacao($host, '/api/clippings/1/duplicar', $funcionario, ['incluir_anexos' => false])[0] === 403, 'Criar não permite ler clipping sem visualizar.');
    conferirDuplicacao(chamarDuplicacao($host, '/api/releases/' . $origemId . '/duplicar', $funcionario, ['chave_rascunho' => $chave])[0] === 403, 'Criar não permite ler release sem visualizar.');
    $db->exec("INSERT INTO usuario_permissoes (usuario_id, permissao_id) SELECT 3, id FROM permissoes WHERE modulo IN ('CLIPPING', 'RELEASES') AND acao = 'VISUALIZAR'");
    conferirDuplicacao(chamarDuplicacao($host, '/api/clippings/1/duplicar', $funcionario, ['incluir_anexos' => true])[0] === 403, 'Copiar arquivos exige anexar.');
    [$statusFuncionario, $copiaFuncionario] = chamarDuplicacao($host, '/api/clippings/1/duplicar', $funcionario, ['incluir_anexos' => false]);
    conferirDuplicacao($statusFuncionario === 201 && $copiaFuncionario['clipping']['criado_por'] === 3, 'Funcionário duplica dados com sua própria autoria.');
    $outroReleaseId = inserirDuplicacao('releases', ['assessoria_id' => 1, 'criado_por' => 1, 'titulo' => 'Outro release', 'assunto' => '', 'blocos_json' => '[]']);
    conferirDuplicacao(chamarDuplicacao($host, '/api/releases/' . $outroReleaseId . '/duplicar', $token, ['chave_rascunho' => $chave])[0] === 409, 'Uma chave não pode duplicar duas origens diferentes.');
    echo 'Duplicação: ' . $verificacoes . " verificações passaram, com arquivos e banco descartável.\n";
} finally {
    if (is_resource($processo)) {
        proc_terminate($processo);
        proc_close($processo);
    }
    foreach ($temporarios as $arquivo) {
        @unlink($arquivo);
    }
    if (is_dir($pasta)) {
        $raiz = realpath($pasta);
        if ($raiz !== false && str_starts_with(str_replace('\\', '/', $raiz), str_replace('\\', '/', sys_get_temp_dir()) . '/logos-duplicacao-')) {
            $itens = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($raiz, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($itens as $item) {
                $item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
            }
            rmdir($raiz);
        }
    }
    if ($criado) {
        $db->exec('USE `' . str_replace('`', '``', $original) . '`');
        $db->exec('DROP DATABASE ' . $teste);
    }
}
