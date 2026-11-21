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
    throw new RuntimeException('Este teste deve usar o MySQL local e um banco descartável.');
}

$verificacoes = 0;
$conferir = static function (bool $condicao, string $mensagem) use (&$verificacoes): void {
    if (!$condicao) throw new RuntimeException($mensagem);
    $verificacoes++;
};
$rejeitar = static function (callable $acao, string $classe) use ($conferir): void {
    try { $acao(); }
    catch (Throwable $erro) { $conferir($erro instanceof $classe, 'Exceção inesperada: ' . $erro::class); return; }
    throw new RuntimeException('A operação deveria ter sido bloqueada.');
};
$pedido = [
    'id' => null,
    'chave' => '00000000-0000-4000-8000-000000000001',
    'versao' => null,
    'dados' => [
        'titulo' => '', 'cliente_id' => null, 'jornalistas_ids' => [],
        'template_id' => null, 'template_codigo' => null, 'template_assinatura' => '',
        'blocos' => [],
        'dados_envio' => ['assunto' => '', 'primeira_linha' => '', 'nome_remetente' => '', 'responder_para' => ''],
    ],
];

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_rascunho_' . bin2hex(random_bytes(6));
$criado = false;

try {
    $db->exec("CREATE DATABASE `{$teste}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $criado = true;
    $db->exec("USE `{$teste}`");
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    if ($inicio === false) throw new RuntimeException('Schema de teste inválido.');
    $schema = substr($schema, $inicio);
    if (preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema)) throw new RuntimeException('Schema fora do banco descartável.');
    $db->exec($schema);
    $db->exec("INSERT INTO assessorias (id, nome) VALUES (1, 'A'), (2, 'B')");
    $db->exec("INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil) VALUES
        (1, 1, 'A', 'a@example.com', 'teste', 'ASSESSOR'),
        (2, 1, 'B', 'b@example.com', 'teste', 'FUNCIONARIO'),
        (3, 2, 'C', 'c@example.com', 'teste', 'ASSESSOR')");
    $db->exec("INSERT INTO clientes (id, assessoria_id, nome) VALUES (1, 1, 'A'), (2, 2, 'B')");
    $db->exec("INSERT INTO jornalistas (id, assessoria_id, nome, email, ativo) VALUES
        (1, 1, 'A', 'contato@example.com', 1), (2, 1, 'Repetido', ' contato@example.com', 1),
        (3, 2, 'Outro', 'outro@example.com', 1)");

    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 1, $pedido, false, true, true, true), RuntimeException::class);
    $r = ReleaseService::salvarAutomaticamente(1, 1, $pedido, true, false, false, false);
    $conferir($r['status'] === 'RASCUNHO' && $r['titulo'] === '', 'Deve aceitar preenchimento incompleto.');
    $repetido = ReleaseService::salvarAutomaticamente(1, 1, $pedido, true, false, false, false);
    $conferir($r['id'] === $repetido['id'] && $r['versao_edicao'] === $repetido['versao_edicao'], 'Repetição não deve recriar nem alterar a versão.');

    $edicao = $pedido;
    $edicao['id'] = $r['id'];
    $edicao['versao'] = $r['versao_edicao'];
    $edicao['dados']['titulo'] = 'Atualizado';
    $atual = ReleaseService::salvarAutomaticamente(1, 1, $edicao, true, false, false, false);
    $conferir($atual['titulo'] === 'Atualizado', 'O criador deve continuar seu próprio rascunho.');
    $repetido = ReleaseService::salvarAutomaticamente(1, 1, $edicao, true, false, false, false);
    $conferir($repetido['versao_edicao'] === $atual['versao_edicao'], 'Deve reconhecer atualização sem resposta.');
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 1, $pedido, true, false, false, false), DomainException::class);
    $velha = $edicao; $velha['dados']['titulo'] = 'Versão antiga';
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 1, $velha, true, false, false, false), DomainException::class);
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 2, $edicao, true, false, false, false), RuntimeException::class);
    $outraChave = $edicao; $outraChave['chave'] = '00000000-0000-4000-8000-000000000002';
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 1, $outraChave, true, false, false, false), RuntimeException::class);
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(2, 3, $edicao, true, true, true, true), OutOfBoundsException::class);

    $edicao['versao'] = $atual['versao_edicao'];
    $edicao['dados']['jornalistas_ids'] = [2, 1];
    $atual = ReleaseService::salvarAutomaticamente(1, 2, $edicao, false, true, true, true);
    $conferir(count($atual['destinatarios']) === 1, 'Deve eliminar e-mails repetidos.');
    $conferir(ReleaseService::salvarAutomaticamente(1, 2, $edicao, false, true, true, true)['versao_edicao'] === $atual['versao_edicao'], 'Deduplicação deve manter a repetição idempotente.');
    $edicao['versao'] = $atual['versao_edicao'];
    $edicao['dados']['jornalistas_ids'] = [1];
    $invalido = $edicao; $invalido['dados']['dados_envio']['responder_para'] = 'emailincompleto@';
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 2, $invalido, false, true, true, true), InvalidArgumentException::class);
    $invalido = $edicao; $invalido['dados']['status'] = 'ENVIADO';
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 2, $invalido, false, true, true, true), InvalidArgumentException::class);
    $invalido = $edicao; $invalido['dados']['cliente_id'] = 1;
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 2, $invalido, false, true, true, false), RuntimeException::class);
    $invalido = $edicao; $invalido['dados']['jornalistas_ids'] = [];
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 2, $invalido, false, true, false, true), RuntimeException::class);

    // Uma revisão antiga deve ser recusada antes de preparar ou transmitir e-mail.
    $rejeitar(fn() => ReleaseEnvioService::enfileirar(1, $r['id'], str_repeat('0', 64)), DomainException::class);
    $conferir(ReleaseService::buscar(1, $r['id'])['status'] === 'RASCUNHO', 'Revisão antiga não deve enfileirar.');
    $rejeitar(fn() => ReleaseEnvioService::enfileirar(1, $r['id'], 'invalida'), InvalidArgumentException::class);
    $db->exec("UPDATE releases SET status = 'NA_FILA' WHERE id = " . (int) $r['id']);
    $envio = ReleaseEnvioService::enfileirar(1, $r['id'], $atual['versao_edicao']);
    $conferir($envio['release']['status'] === 'NA_FILA', 'Uma repetição deve consultar o envio já existente.');
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 2, $edicao, false, true, true, true), DomainException::class);
    $conferir((int) $db->query('SELECT COUNT(*) FROM releases')->fetchColumn() === 1, 'Não deve duplicar releases.');

    $preservado = ReleaseService::descartarCriacao(1, 1, ['chave_rascunho' => $pedido['chave']]);
    $conferir(!$preservado['descartado'] && $preservado['envio_preservado'], 'SAIR não deve interromper um envio já iniciado.');
    $conferir(ReleaseService::buscar(1, $r['id'])['status'] === 'NA_FILA', 'O envio existente deve permanecer intacto.');

    $antes = ReleaseService::listar(1)['pagination']['total'];
    $atrasado = $pedido; $atrasado['chave'] = '00000000-0000-4000-8000-000000000090';
    $conferir(ReleaseService::descartarCriacao(1, 1, ['chave_rascunho' => $atrasado['chave']])['descartado'], 'Pode descartar antes de um cadastro atrasado chegar.');
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 1, $atrasado, true, false, false, false), DomainException::class);
    $conferir(ReleaseService::listar(1)['pagination']['total'] === $antes, 'Reservas de descarte não aparecem na listagem nem na contagem.');

    $cancelavel = $pedido; $cancelavel['chave'] = '00000000-0000-4000-8000-000000000091';
    $cancelavel['dados']['titulo'] = 'Não conservar';
    $cancelavel['dados']['blocos'] = [['id' => 'texto', 'tipo' => 'texto', 'texto' => 'Conteúdo descartado']];
    $cancelavel['dados']['jornalistas_ids'] = [1];
    $cadastro = ReleaseService::salvarAutomaticamente(1, 1, $cancelavel, true, false, true, false);
    $conferir(ReleaseService::descartarCriacao(1, 1, ['chave_rascunho' => $cancelavel['chave']])['descartado'], 'Pode descartar o rascunho automático do criador.');
    $rejeitar(fn() => ReleaseService::buscar(1, $cadastro['id']), OutOfBoundsException::class);
    $rejeitar(fn() => ReleaseEnvioService::enfileirar(1, $cadastro['id']), OutOfBoundsException::class);
    $rejeitar(fn() => ReleaseEnvioService::situacao(1, $cadastro['id']), OutOfBoundsException::class);
    $rejeitar(fn() => ReleaseService::salvarAutomaticamente(1, 1, $cancelavel, true, false, true, false), DomainException::class);
    $limpo = $db->query('SELECT titulo, blocos_json FROM releases WHERE id = ' . (int) $cadastro['id'])->fetch();
    $conferir($limpo['titulo'] === '' && json_decode($limpo['blocos_json'], true) === [], 'Descartar remove o conteúdo do servidor.');
    $conferir((int) $db->query('SELECT COUNT(*) FROM release_destinatarios WHERE release_id = ' . (int) $cadastro['id'])->fetchColumn() === 0, 'Descartar remove os destinatários do rascunho.');
    $quantidade = (int) $db->query('SELECT COUNT(*) FROM releases')->fetchColumn();
    ReleaseService::descartarCriacao(1, 1, ['chave_rascunho' => $cancelavel['chave']]);
    $conferir((int) $db->query('SELECT COUNT(*) FROM releases')->fetchColumn() === $quantidade, 'Repetir descarte não duplica a reserva.');

    $outro = $pedido; $outro['chave'] = '00000000-0000-4000-8000-000000000092';
    $outro['dados']['titulo'] = 'Outro criador';
    $alheio = ReleaseService::salvarAutomaticamente(1, 1, $outro, true, false, false, false);
    ReleaseService::descartarCriacao(1, 2, ['chave_rascunho' => $outro['chave']]);
    ReleaseService::descartarCriacao(2, 3, ['chave_rascunho' => $outro['chave']]);
    $conferir(ReleaseService::buscar(1, $alheio['id'])['titulo'] === 'Outro criador', 'Descarte é isolado por criador e assessoria.');
    $rejeitar(fn() => ReleaseService::descartarCriacao(1, 1, ['chave_rascunho' => 'invalida']), InvalidArgumentException::class);
    $rejeitar(fn() => ReleaseService::descartarCriacao(1, 1, ['chave_rascunho' => $outro['chave'], 'id' => $r['id']]), InvalidArgumentException::class);
    echo "Rascunhos: {$verificacoes} verificações passaram.\n";
} finally {
    if ($db->inTransaction()) $db->rollBack();
    $db->exec('USE `' . str_replace('`', '``', $original) . '`');
    if ($criado && preg_match('/^logos_teste_rascunho_[a-f0-9]{12}$/D', $teste)) {
        $db->exec("DROP DATABASE `{$teste}`");
    }
}
