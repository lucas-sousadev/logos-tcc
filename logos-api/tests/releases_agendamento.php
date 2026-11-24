<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\ReleaseEnvioService;
use Logos\AssessoriaApi\Services\ReleaseService;

Dotenv::createImmutable(dirname(__DIR__))->load();

if (!in_array($_ENV['DB_HOST'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Este teste exige o MySQL local e cria um banco descartável.');
}

// Somente a preparação do MIME é usada; todo transporte é simulado.
$_ENV['RELEASE_SMTP_HOST'] = 'localhost';
$_ENV['RELEASE_SMTP_PORT'] = '2525';
$_ENV['RELEASE_SMTP_USER'] = 'teste';
$_ENV['RELEASE_SMTP_PASSWORD'] = 'teste';
$_ENV['RELEASE_SMTP_FROM'] = 'teste@example.com';
$_ENV['RELEASE_SMTP_SECURITY'] = 'starttls';

$verificacoes = 0;
$conferir = static function (bool $condicao, string $mensagem) use (&$verificacoes): void {
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
};
$rejeitar = static function (callable $acao, string $classe) use ($conferir): void {
    try {
        $acao();
    } catch (Throwable $erro) {
        $conferir($erro instanceof $classe, 'Exceção inesperada: ' . $erro::class);
        return;
    }
    throw new RuntimeException('A operação deveria ter sido rejeitada.');
};

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_agenda_' . bin2hex(random_bytes(6));
$criado = false;

try {
    $db->exec("CREATE DATABASE `{$teste}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $criado = true;
    $db->exec("USE `{$teste}`");
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
        (1, 1, 'A', 'a@example.com', 1), (2, 1, 'B', 'b@example.com', 1), (3, 1, 'C', 'c@example.com', 1)");

    $novo = static function () use ($db): array {
        $release = ReleaseService::criar(1, 1, [
            'titulo' => 'Teste de agendamento',
            'jornalistas_ids' => [1, 2, 3],
        ]);
        $stmt = $db->prepare('UPDATE releases SET assunto = :assunto, blocos_json = :blocos WHERE id = :id');
        $stmt->execute([
            'assunto' => 'Assunto de teste',
            'blocos' => json_encode([['id' => 'texto', 'tipo' => 'texto', 'texto' => 'Conteúdo de teste']]),
            'id' => $release['id'],
        ]);
        return ReleaseService::buscar(1, $release['id']);
    };
    $futuro = new DateTimeImmutable('+2 hours', new DateTimeZone('America/Sao_Paulo'));
    $pedido = static fn(array $r, DateTimeImmutable $quando): array => [
        'data' => $quando->format('Y-m-d'),
        'hora' => $quando->format('H:i'),
        'versao_edicao' => $r['versao_edicao'],
    ];

    $r = $novo();
    $dados = $pedido($r, $futuro);
    foreach ([['data' => '2027-02-30'], ['hora' => '24:00'], ['hora' => '10:99'], ['data' => []]] as $invalido) {
        $rejeitar(fn() => ReleaseEnvioService::agendar(1, $r['id'], [...$dados, ...$invalido]), InvalidArgumentException::class);
    }
    $rejeitar(fn() => ReleaseEnvioService::agendar(1, $r['id'], $pedido($r, $futuro->modify('-3 hours'))), InvalidArgumentException::class);
    $rejeitar(fn() => ReleaseEnvioService::agendar(2, $r['id'], $dados), OutOfBoundsException::class);
    $rejeitar(fn() => ReleaseEnvioService::agendar(1, $r['id'], [...$dados, 'versao_edicao' => str_repeat('0', 64)]), DomainException::class);
    $vazio = ReleaseService::criar(1, 1, []);
    $rejeitar(fn() => ReleaseEnvioService::agendar(1, $vazio['id'], $pedido($vazio, $futuro)), InvalidArgumentException::class);

    $envio = ReleaseEnvioService::agendar(1, $r['id'], $dados);
    $conferir($envio['release']['status'] === 'AGENDADO', 'Deve agendar.');
    $conferir($envio['release']['agendamento_fuso'] === 'America/Sao_Paulo', 'O fuso deve ser explícito.');
    $conferir($envio['release']['agendado_para'] === $futuro->format('Y-m-d H:i:00'), 'Deve manter o horário de Brasília.');
    $resultado = ReleaseEnvioService::processar(20, 0, static function (): void {
        throw new RuntimeException('Não pode transmitir antes do horário.');
    });
    $conferir($resultado['processados'] === 0, 'Um agendamento futuro deve permanecer fora da fila.');
    $conferir(ReleaseEnvioService::agendar(1, $r['id'], $dados)['release']['status'] === 'AGENDADO', 'Repetir a solicitação deve ser seguro.');

    $atual = ReleaseService::buscar(1, $r['id']);
    ReleaseEnvioService::agendar(1, $r['id'], $pedido($atual, $futuro->modify('+1 hour')));
    $reagendado = ReleaseService::buscar(1, $r['id']);
    $conferir($reagendado['versao_edicao'] !== $atual['versao_edicao'], 'O horário deve participar da versão, inclusive no mesmo segundo.');
    $rejeitar(fn() => ReleaseEnvioService::agendar(1, $r['id'], $pedido($atual, $futuro->modify('+2 hours'))), DomainException::class);
    $cancelado = ReleaseEnvioService::cancelarAgendamento(1, $r['id'], $reagendado['versao_edicao']);
    $conferir($cancelado['release']['status'] === 'RASCUNHO' && $cancelado['release']['agendado_para'] === null, 'Cancelar agendamento deve devolver um rascunho editável.');
    $conferir($cancelado['totais']['pendentes'] === 3, 'Cancelar o agendamento preserva os destinatários.');
    $rejeitar(fn() => ReleaseEnvioService::agendar(1, $r['id'], $dados), DomainException::class);

    $atual = ReleaseService::buscar(1, $r['id']);
    ReleaseEnvioService::agendar(1, $r['id'], $pedido($atual, $futuro));
    $db->exec("UPDATE releases SET agendado_para = '2000-01-01 00:00:00' WHERE id = " . $r['id']);
    $transmitidos = 0;
    ReleaseEnvioService::processar(20, 0, static function () use (&$transmitidos): void {
        $transmitidos++;
    });
    $conferir($transmitidos === 3, 'O worker deve processar agendamentos vencidos.');
    $conferir(ReleaseService::buscar(1, $r['id'])['status'] === 'ENVIADO', 'O agendamento deve concluir o envio.');

    $r = $novo();
    ReleaseEnvioService::enfileirar(1, $r['id'], $r['versao_edicao']);
    $transmitidos = 0;
    ReleaseEnvioService::processar(20, 0, static function (array $d) use (&$transmitidos): void {
        $transmitidos++;
        $atual = ReleaseService::buscar(1, $d['release_id']);
        ReleaseEnvioService::cancelarEnvio(1, $d['release_id'], $atual['versao_edicao']);
    });
    $envio = ReleaseEnvioService::situacao(1, $r['id']);
    $conferir($transmitidos === 1, 'Cancelar durante a transmissão deve impedir os próximos destinatários.');
    $conferir($envio['release']['status'] === 'CANCELADO', 'O resultado em trânsito não pode sobrescrever o cancelamento.');
    $conferir($envio['totais']['aceitos'] === 1 && $envio['totais']['cancelados'] === 2, 'Deve separar aceitos e cancelados.');
    $conferir($envio['totais']['falhas'] === 0 && $envio['totais']['repetiveis'] === 0, 'Cancelados não são falhas repetíveis.');
    $conferir(ReleaseEnvioService::situacao(1, $r['id'], ['status' => 'CANCELADO'])['pagination']['total'] === 2, 'Deve filtrar os cancelados.');
    $rejeitar(fn() => ReleaseEnvioService::reenfileirarFalhas(1, $r['id']), DomainException::class);
    $conferir(ReleaseEnvioService::cancelarEnvio(1, $r['id'], $r['versao_edicao'])['release']['status'] === 'CANCELADO', 'Repetir o cancelamento deve ser seguro.');
    $conferir(ReleaseEnvioService::enfileirar(1, $r['id'])['release']['status'] === 'CANCELADO', 'Uma solicitação antiga não pode reativar cancelados.');
    $db->exec("UPDATE release_destinatarios SET status = 'ENVIANDO' WHERE release_id = " . $r['id'] . " AND status = 'ENVIADO'");
    $rejeitar(fn() => ReleaseService::excluir(1, $r['id'], ReleaseService::buscar(1, $r['id'])['versao_edicao']), DomainException::class);
    ReleaseEnvioService::processar(20, 0, static function (): void {
        throw new RuntimeException('Cancelados não podem ser reenviados.');
    });
    $envio = ReleaseEnvioService::situacao(1, $r['id']);
    $conferir($envio['totais']['processando'] === 0 && $envio['totais']['incertos'] === 1, 'Deve encerrar a transmissão interrompida sem repeti-la.');
    $conferir(ReleaseService::listar(1, ['status' => 'CANCELADO'])['pagination']['total'] === 1, 'Deve listar os releases cancelados.');

    $r = $novo();
    ReleaseEnvioService::enfileirar(1, $r['id']);
    $atual = ReleaseService::buscar(1, $r['id']);
    $envio = ReleaseEnvioService::cancelarEnvio(1, $r['id'], $atual['versao_edicao']);
    $conferir($envio['totais']['cancelados'] === 3, 'Deve cancelar toda a fila antes da primeira transmissão.');

    echo "Agendamento e cancelamento: {$verificacoes} verificações passaram, sem envio real.\n";
} finally {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $db->exec('USE `' . str_replace('`', '``', $original) . '`');
    if ($criado && preg_match('/^logos_teste_agenda_[a-f0-9]{12}$/D', $teste)) {
        $db->exec("DROP DATABASE `{$teste}`");
    }
}
