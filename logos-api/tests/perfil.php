<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Dotenv\Dotenv;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Services\FotoPerfilService;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\PerfilService;

Dotenv::createImmutable(dirname(__DIR__))->load();
if (!in_array($_ENV['DB_HOST'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Este teste exige MySQL local e cria um banco descartável.');
}

$verificacoes = 0;
function conferirPerfil(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
}

function requisitarPerfil(string $host, string $rota, ?string $token = null, ?array $dados = null, bool $json = false): array
{
    $curl = curl_init('http://' . $host . '/LOGOS/logos-api/public' . $rota . '?route=' . rawurlencode($rota));
    $headers = $token ? ['Authorization: Bearer ' . $token] : [];
    if ($json) {
        $headers[] = 'Content-Type: application/json';
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 5,
    ]);
    if ($dados !== null) {
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $json ? json_encode($dados, JSON_THROW_ON_ERROR) : $dados);
    }
    $texto = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($texto === false) {
        throw new RuntimeException('Falha na chamada de teste.');
    }
    curl_close($curl);
    clearstatcache();
    try {
        return [$status, json_decode($texto, true, 512, JSON_THROW_ON_ERROR)];
    } catch (\JsonException $erro) {
        throw new RuntimeException('Resposta inválida no teste: ' . substr(strip_tags($texto), 0, 1000), 0, $erro);
    }
}

function editarPerfil(array $perfil): array
{
    return [
        'nome' => $perfil['nome'],
        'email' => $perfil['email'],
        'telefone' => $perfil['telefone'] ?? '',
        'cargo' => $perfil['cargo'] ?? '',
        'cidade' => $perfil['cidade'] ?? '',
        'uf' => $perfil['uf'] ?? '',
        'perfil_versao' => $perfil['perfil_versao'],
    ];
}

$db = Connection::get();
$original = $db->query('SELECT DATABASE()')->fetchColumn();
$teste = 'logos_teste_perfil_' . bin2hex(random_bytes(6));
$assessoria = random_int(800_000_000, 900_000_000);
$usuario = $assessoria + 1;
$processo = null;
$criado = false;
$temporarios = [];
$fotos = [];

try {
    $db->exec('CREATE DATABASE ' . $teste . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $criado = true;
    $db->exec('USE ' . $teste);
    $schema = file_get_contents(dirname(__DIR__, 2) . '/LOGOS.sql');
    $inicio = strpos($schema, 'CREATE TABLE assessorias');
    conferirPerfil($inicio !== false, 'Schema válido.');
    $schema = substr($schema, $inicio);
    conferirPerfil(!preg_match('/\b(?:USE|CREATE DATABASE)\b/i', $schema), 'Schema restrito ao banco descartável.');
    $db->exec($schema);

    $db->exec("INSERT INTO assessorias (id, nome) VALUES ({$assessoria}, 'Assessoria de teste'), (2, 'Outra assessoria')");
    $stmt = $db->prepare('INSERT INTO usuarios (id, assessoria_id, nome, email, senha_hash, perfil, email_verificado) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $senha = password_hash('SenhaTeste123!', PASSWORD_DEFAULT);
    $stmt->execute([$usuario, $assessoria, 'Funcionário A', 'perfil-a@example.com', $senha, 'FUNCIONARIO', 1]);
    $stmt->execute([2, $assessoria, 'Assessor B', 'perfil-b@example.com', $senha, 'ASSESSOR', 0]);
    $stmt->execute([3, 2, 'Outra conta', 'perfil-c@example.com', $senha, 'FUNCIONARIO', 0]);
    $token = JwtService::gerar(['id' => $usuario, 'assessoria_id' => $assessoria, 'perfil' => 'FUNCIONARIO']);
    $outroToken = JwtService::gerar(['id' => 3, 'assessoria_id' => 2, 'perfil' => 'FUNCIONARIO']);

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $host = stream_socket_get_name($socket, false);
    fclose($socket);
    $wrapper = tempnam(sys_get_temp_dir(), 'logos-perfil-router-');
    $log = tempnam(sys_get_temp_dir(), 'logos-perfil-log-');
    $imagem = tempnam(sys_get_temp_dir(), 'logos-perfil-imagem-');
    $invalido = tempnam(sys_get_temp_dir(), 'logos-perfil-invalido-');
    $grande = tempnam(sys_get_temp_dir(), 'logos-perfil-grande-');
    $temporarios = [$wrapper, $log, $imagem, $invalido, $grande];
    $canvas = imagecreatetruecolor(8, 8);
    imagepng($canvas, $imagem);
    imagedestroy($canvas);
    file_put_contents($invalido, '<?php echo "arquivo disfarçado";');
    file_put_contents($grande, str_repeat('x', 2 * 1024 * 1024 + 1));
    file_put_contents($wrapper, '<?php $_ENV["DB_NAME"] = getenv("LOGOS_PERFIL_TEST_DB"); require '
        . var_export(dirname(__DIR__) . '/public/index.php', true) . ';');
    $processo = proc_open([PHP_BINARY, '-d', 'upload_tmp_dir=' . sys_get_temp_dir(), '-S', $host, $wrapper], [
        0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a'],
    ], $pipes, dirname(__DIR__), [...getenv(), 'LOGOS_PERFIL_TEST_DB' => $teste]);
    conferirPerfil(is_resource($processo), 'Servidor HTTP isolado iniciado.');
    fclose($pipes[0]);
    $pronto = false;
    for ($i = 0; $i < 30; $i++) {
        $conexao = @stream_socket_client('tcp://' . $host, $codigo, $mensagem, 0.1);
        if ($conexao !== false) {
            fclose($conexao);
            $pronto = true;
            break;
        }
        usleep(100000);
    }
    conferirPerfil($pronto, 'Servidor de teste disponível.');
    conferirPerfil(requisitarPerfil($host, '/api/perfil')[0] === 401, 'Perfil exige autenticação.');
    [$status, $resposta] = requisitarPerfil($host, '/api/perfil', $token);
    $perfil = $resposta['usuario'];
    conferirPerfil($status === 200 && $perfil['id'] === $usuario, 'Funcionário sem permissão de usuários acessa o próprio perfil.');
    conferirPerfil($perfil['assessoria_nome'] === 'Assessoria de teste' && $perfil['foto_path'] === null, 'Retorna vínculo e foto inicial.');
    conferirPerfil(!isset($perfil['senha_hash']), 'Não expõe senha.');
    conferirPerfil(preg_match('/^[a-f0-9]{64}$/D', $perfil['perfil_versao']) === 1, 'Fornece versão para edição.');
    $dados = [...editarPerfil($perfil), 'nome' => ' Nome atualizado ', 'cargo' => 'Redator', 'cidade' => 'São Paulo', 'uf' => 'sp', 'telefone' => '(11) 99999-9999'];
    [$status, $resposta] = requisitarPerfil($host, '/api/perfil', $token, $dados);
    $atual = $resposta['usuario'];
    conferirPerfil($status === 200 && $atual['nome'] === 'Nome atualizado', 'Salva e normaliza nome.');
    conferirPerfil($atual['cargo'] === 'Redator' && $atual['cidade'] === 'São Paulo' && $atual['uf'] === 'SP', 'Salva cargo, cidade e UF.');
    conferirPerfil($atual['telefone'] === '11999999999', 'Normaliza telefone.');
    conferirPerfil($atual['email_verificado'] === true, 'Preserva verificação quando e-mail não muda.');
    conferirPerfil($atual['perfil'] === 'FUNCIONARIO' && $atual['assessoria_id'] === $assessoria, 'Preserva tipo de acesso e assessoria.');
    conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, $dados)[0] === 409, 'Bloqueia versão antiga.');
    foreach ([
        ['perfil' => 'ASSESSOR'], ['assessoria_id' => '2'], ['id' => '3'], ['email_verificado' => '1'],
        ['uf' => 'XX'], ['telefone' => 'abc'], ['email' => 'inválido'], ['nome' => ''],
        ['cargo' => str_repeat('a', 101)], ['nome[0]' => 'teste'],
    ] as $invalidoDados) {
        conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), ...$invalidoDados])[0] === 422, 'Rejeita campos inválidos ou protegidos.');
    }
    conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'email' => 'novo@example.com'])[0] === 422, 'Trocar e-mail exige senha.');
    conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'email' => 'novo@example.com', 'senha_atual' => 'errada'])[0] === 422, 'Senha incorreta não muda e-mail.');
    [$status, $resposta] = requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'email' => 'novo@example.com', 'senha_atual' => 'SenhaTeste123!']);
    $atual = $resposta['usuario'];
    conferirPerfil($status === 200 && $atual['email'] === 'novo@example.com' && !$atual['email_verificado'], 'Troca e-mail e remove verificação anterior.');
    conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'foto' => new CURLFile($invalido, 'image/png', 'foto.png')])[0] === 422, 'Rejeita arquivo disfarçado de imagem.');
    conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'foto' => new CURLFile($grande, 'image/png', 'foto.png')])[0] === 422, 'Rejeita foto acima de 2 MB.');
    [$status, $resposta] = requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'foto' => new CURLFile($imagem, 'image/png', 'foto.php')]);
    $atual = $resposta['usuario'];
    $fotos[] = $atual['foto_path'];
    conferirPerfil($status === 200 && preg_match('#/([a-f0-9]{32})\.png$#', $atual['foto_path']) === 1, 'Armazena imagem válida com nome e extensão seguros.');
    $arquivoAnterior = dirname(__DIR__) . '/public/' . $atual['foto_path'];
    conferirPerfil(is_file($arquivoAnterior), 'Foto foi armazenada.');
    [$statusConta, $conta] = requisitarPerfil($host, '/api/auth/me', $token);
    conferirPerfil(
        $statusConta === 200 && $conta['usuario'] === $atual,
        'Sessão retorna o mesmo perfil completo e foto atual.'
    );
    [$statusLogin, $login] = requisitarPerfil($host, '/api/auth/login', null, [
        'email' => $atual['email'],
        'senha' => 'SenhaTeste123!',
        'perfil' => 'FUNCIONARIO',
    ], true);
    conferirPerfil(
        $statusLogin === 200
            && $login['usuario'] === $atual
            && is_string($login['token'] ?? null),
        'Login retorna perfil, foto e sessão válidos.'
    );
    $assessorToken = JwtService::gerar([
        'id' => 2,
        'assessoria_id' => $assessoria,
        'perfil' => 'ASSESSOR',
    ]);
    [$statusFuncionario, $detalhes] = requisitarPerfil(
        $host,
        '/api/funcionarios/' . $usuario,
        $assessorToken
    );
    conferirPerfil(
        $statusFuncionario === 200
            && $detalhes['funcionario']['foto_path'] === $atual['foto_path'],
        'Detalhes do funcionário retornam a foto atual.'
    );
    conferirPerfil(
        $detalhes['funcionario']['cargo'] === 'Redator'
            && $detalhes['funcionario']['cidade'] === 'São Paulo'
            && $detalhes['funcionario']['uf'] === 'SP',
        'Detalhes retornam os novos dados profissionais.'
    );
    [$statusLista, $lista] = requisitarPerfil($host, '/api/funcionarios', $assessorToken);
    conferirPerfil(
        $statusLista === 200
            && count($lista['funcionarios']) === 1
            && $lista['funcionarios'][0]['foto_path'] === $atual['foto_path'],
        'Listagem retorna a foto e apenas funcionários da assessoria.'
    );
    conferirPerfil(
        requisitarPerfil($host, '/api/funcionarios/3', $assessorToken)[0] === 404,
        'Não permite consultar funcionário de outra assessoria.'
    );
    conferirPerfil(
        requisitarPerfil($host, '/api/funcionarios/' . $usuario, $token)[0] === 403,
        'Acesso ao próprio perfil não concede acesso à gestão de funcionários.'
    );
    $pasta = dirname($arquivoAnterior);
    $quantidade = count(glob($pasta . '/*'));
    conferirPerfil(requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'email' => 'perfil-b@example.com', 'senha_atual' => 'SenhaTeste123!', 'foto' => new CURLFile($imagem, 'image/png', 'foto.png')])[0] === 422, 'E-mail duplicado é rejeitado com upload.');
    conferirPerfil(is_file($arquivoAnterior) && count(glob($pasta . '/*')) === $quantidade, 'Falha preserva foto anterior e remove upload sem uso.');
    [$status, $resposta] = requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'foto' => new CURLFile($imagem, 'image/png', 'foto.png')]);
    $atual = $resposta['usuario'];
    $fotos[] = $atual['foto_path'];
    conferirPerfil($status === 200 && !is_file($arquivoAnterior), 'Substituir foto remove arquivo antigo após salvar.');
    $arquivoAtual = dirname(__DIR__) . '/public/' . $atual['foto_path'];
    [$status, $resposta] = requisitarPerfil($host, '/api/perfil', $token, [...editarPerfil($atual), 'remover_foto' => '1']);
    $atual = $resposta['usuario'];
    conferirPerfil($status === 200 && $atual['foto_path'] === null && !is_file($arquivoAtual), 'Remove foto do cadastro e do armazenamento.');
    $outro = requisitarPerfil($host, '/api/perfil', $outroToken)[1]['usuario'];
    conferirPerfil($outro['id'] === 3 && $outro['nome'] === 'Outra conta', 'Outra conta mantém os próprios dados.');
    conferirPerfil(PerfilService::buscar(2, $assessoria)['nome'] === 'Assessor B', 'Alterar perfil não altera colega da mesma assessoria.');

    echo "Perfil: {$verificacoes} verificações passaram, com upload HTTP e banco descartável.\n";
} finally {
    if (is_resource($processo)) {
        proc_terminate($processo);
        proc_close($processo);
    }
    foreach ($fotos as $foto) {
        FotoPerfilService::excluir($foto, $assessoria, $usuario);
    }
    $pasta = dirname(__DIR__) . '/public/uploads/perfis/' . $assessoria . '/' . $usuario;
    if (is_dir($pasta)) {
        @rmdir($pasta);
    }
    if (is_dir(dirname($pasta))) {
        @rmdir(dirname($pasta));
    }
    foreach ($temporarios as $arquivo) {
        if (is_file($arquivo)) {
            unlink($arquivo);
        }
    }
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    $db->exec('USE ' . $original);
    if ($criado && preg_match('/^logos_teste_perfil_[a-f0-9]{12}$/D', $teste)) {
        $db->exec('DROP DATABASE ' . $teste);
    }
}
