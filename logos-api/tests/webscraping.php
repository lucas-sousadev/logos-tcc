<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\VeiculoEnderecoService;
use Logos\AssessoriaApi\Services\RelatorioMidiaService;

// usa uma base aleatória e arquivos temporários sem carregar a configuração do app
$host = getenv('LOGOS_TEST_DB_HOST') ?: '127.0.0.1';
$port = getenv('LOGOS_TEST_DB_PORT') ?: '3306';
$user = getenv('LOGOS_TEST_DB_USER') ?: 'root';
$password = getenv('LOGOS_TEST_DB_PASSWORD') ?: '';
$banco = 'logos_webscraping_test_' . bin2hex(random_bytes(6));
$criado = false;
$arquivos = [];
$pastas = [];
$saida = 0;

function conferir(bool $condicao, string $nome): void
{
    if (!$condicao) throw new RuntimeException($nome);
    echo "OK: {$nome}\n";
}

try {
    $db = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec("CREATE DATABASE `{$banco}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $criado = true;
    $db->exec("USE `{$banco}`");

    $sql = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $sql = preg_replace('/^CREATE DATABASE IF NOT EXISTS logos\b[^;]*;/m', '', $sql, 1, $cabecalho);
    $sql = preg_replace('/^USE logos\s*;/m', '', $sql, 1, $selecao);
    if ($cabecalho !== 1 || $selecao !== 1 || preg_match('/^\s*(?:USE\s|(?:CREATE|DROP|ALTER)\s+DATABASE\b)/mi', $sql)) {
        throw new RuntimeException('O SQL de testes tem um cabeçalho inesperado');
    }
    $db->exec($sql);
    (new ReflectionProperty(Connection::class, 'connection'))->setValue(null, $db);

    $db->exec("INSERT INTO assessorias (nome) VALUES ('Teste')");
    $db->exec("INSERT INTO clientes (assessoria_id, nome) VALUES (1, 'Teste')");
    $db->exec("INSERT INTO usuarios (assessoria_id, nome, email, senha_hash) VALUES (1, 'Teste', 'teste@example.invalid', 'teste')");
    $db->exec("INSERT INTO veiculos (assessoria_id, nome) VALUES (1, 'Teste')");

    for ($indice = 1; $indice <= 20; $indice++) {
        VeiculoEnderecoService::adicionar(1, 1, ['host' => "site-{$indice}.example"]);
    }
    conferir(count(VeiculoEnderecoService::listar(1, 1)) === 20, 'permite chegar a 20 endereços');
    try {
        VeiculoEnderecoService::adicionar(1, 1, ['host' => 'excedente.example']);
        throw new RuntimeException('A inclusão do endereço 21 não foi bloqueada');
    } catch (DomainException $erro) {
        conferir(str_contains($erro->getMessage(), '20 endereços'), 'bloqueia a inclusão individual acima do limite');
    }
    conferir(!$db->inTransaction(), 'a inclusão recusada libera a transação');

    $lista = VeiculoEnderecoService::listar(1, 1);
    array_pop($lista);
    $lista[] = ['host' => 'substituto.example'];
    $db->beginTransaction();
    VeiculoEnderecoService::bloquearVersao(1, 1);
    VeiculoEnderecoService::sincronizar(1, 1, $lista);
    $db->commit();
    conferir(count(VeiculoEnderecoService::listar(1, 1)) === 20, 'substituir um endereço no teto continua permitido');

    $db->exec("INSERT INTO relatorios (assessoria_id, cliente_id, criado_por, titulo) VALUES (1, 1, 1, 'Teste')");
    $raiz = sys_get_temp_dir() . '/' . $banco;
    $pasta = $raiz . '/relatorios/1/1/IMAGEM_CLIPPING';
    mkdir($pasta, 0750, true);
    $pastas = [$pasta, dirname($pasta), dirname($pasta, 2), dirname($pasta, 3), $raiz];
    $_ENV['CLIPPING_STORAGE_PATH'] = $raiz;
    $_SERVER['DOCUMENT_ROOT'] = dirname(__DIR__, 2);
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1f0AAAAASUVORK5CYII=');

    $inserir = $db->prepare("INSERT INTO relatorio_midias
        (relatorio_id, assessoria_id, tipo, arquivo_path, mime_type, tamanho_bytes, sha256)
        VALUES (1, 1, 'IMAGEM_CLIPPING', :path, 'image/png', :tamanho, :hash)");
    $ids = [];
    for ($indice = 1; $indice <= 4; $indice++) {
        $corpo = $png . chr($indice);
        $hash = hash('sha256', $corpo);
        $arquivo = $pasta . '/' . $hash . '.png';
        file_put_contents($arquivo, $corpo);
        touch($arquivo, time() - ($indice === 2 ? 60 : 259_200));
        $arquivos[] = $arquivo;
        $inserir->execute(['path' => "relatorios/1/1/IMAGEM_CLIPPING/{$hash}.png", 'tamanho' => strlen($corpo), 'hash' => $hash]);
        $ids[] = (int) $db->lastInsertId();
    }
    $slide = $db->prepare("INSERT INTO relatorio_slides
        (relatorio_id, assessoria_id, ordem, tipo, imagem_midia_id, edicoes_json)
        VALUES (1, 1, 1, 'COMPLEMENTAR', :imagem, :edicoes)");
    $slide->execute(['imagem' => $ids[2], 'edicoes' => json_encode(['imagem_midia_id' => $ids[3]])]);

    $simulacao = RelatorioMidiaService::limparSemUso(1, 1);
    conferir($simulacao['candidatas'] === [$ids[0]], 'limpeza preserva uploads recentes, slides e referências das edições');
    conferir(is_file($arquivos[0]), 'a simulação mantém o arquivo');
    $resultado = RelatorioMidiaService::limparSemUso(1, 1, true);
    conferir($resultado['removidas'] === 1 && !$resultado['avisos'], 'limpeza remove somente a mídia antiga sem uso');
    conferir(!is_file($arquivos[0]) && is_file($arquivos[1]) && is_file($arquivos[2]) && is_file($arquivos[3]), 'arquivos em uso continuam disponíveis');
    conferir((int) $db->query('SELECT COUNT(*) FROM relatorio_midias')->fetchColumn() === 3, 'limpeza mantém os demais registros de mídia');

    $db->exec("INSERT INTO relatorio_versoes (relatorio_id, assessoria_id, numero, conteudo_json, gerado_por) VALUES (1, 1, 1, '{}', 1)");
    conferir(RelatorioMidiaService::limparSemUso(1, 1, true)['removidas'] === 0, 'relatórios com histórico ficam preservados');
} catch (Throwable $erro) {
    fwrite(STDERR, $erro->getMessage() . "\n");
    $saida = 1;
} finally {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if ($criado && preg_match('/^logos_webscraping_test_[a-f0-9]{12}$/', $banco)) {
        $db->exec("DROP DATABASE `{$banco}`");
    }
    foreach ($arquivos as $arquivo) if (is_file($arquivo)) unlink($arquivo);
    foreach ($pastas as $pasta) if (is_dir($pasta)) rmdir($pasta);
}

exit($saida);
