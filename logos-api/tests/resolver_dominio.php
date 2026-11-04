<?php

namespace Logos\AssessoriaApi\Services {
    function curl_init(string $url): object
    {
        return (object) ['url' => $url, 'opcoes' => []];
    }

    function curl_setopt_array(object $curl, array $opcoes): bool
    {
        $curl->opcoes = $opcoes;
        return true;
    }

    function curl_exec(object $curl): bool
    {
        $GLOBALS['opcoes_curl'] = $curl->opcoes;
        usleep($GLOBALS['atraso_dns'] ?? 0);
        if (($GLOBALS['erro_dns'] ?? 0) !== 0) return false;
        $corpo = json_encode($GLOBALS['resposta_dns']);
        $escrever = $curl->opcoes[CURLOPT_WRITEFUNCTION];
        return $escrever($curl, $corpo) === strlen($corpo);
    }

    function curl_getinfo(object $curl, int $opcao): int
    {
        return $GLOBALS['status_dns'];
    }

    function curl_errno(object $curl): int
    {
        return $GLOBALS['erro_dns'];
    }

    function curl_close(object $curl): void {}
}

namespace {
    if (PHP_SAPI !== 'cli') {
        http_response_code(404);
        exit;
    }

    require dirname(__DIR__) . '/vendor/autoload.php';

    use Logos\AssessoriaApi\Services\ResolverDominioService;
    use Logos\AssessoriaApi\Exceptions\TempoConsultaLinkException;
    use Logos\AssessoriaApi\Exceptions\ConsultaLinkIndisponivelException;

    ob_start();

    function conferir(bool $condicao, string $nome): void
    {
        if (!$condicao) throw new RuntimeException($nome);
        echo "OK: {$nome}\n";
    }

    function rejeitar(callable $acao, string $classe): void
    {
        try {
            $acao();
        } catch (Throwable $erro) {
            conferir($erro instanceof $classe, $classe);
            return;
        }
        throw new RuntimeException('A consulta deveria ter sido rejeitada');
    }

    $_ENV['CAPTURA_SEGREDO'] = 'segredo-de-teste-local-sem-credenciais-reais';
    $GLOBALS['resposta_dns'] = ['ips' => ['8.8.8.8']];
    $GLOBALS['status_dns'] = 200;
    $GLOBALS['erro_dns'] = 0;

    $limite = hrtime(true) + 100_000_000;
    conferir(ResolverDominioService::resolver('site.example', $limite) === ['8.8.8.8'], 'lê os IPs aprovados pelo serviço local');
    conferir($GLOBALS['opcoes_curl'][CURLOPT_TIMEOUT_MS] <= 100, 'a consulta DNS cabe no prazo restante');

    $GLOBALS['resposta_dns'] = ['ips' => ['127.0.0.1']];
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 1_000_000_000), InvalidArgumentException::class);
    $GLOBALS['resposta_dns'] = ['ips' => []];
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 1_000_000_000), RuntimeException::class);
    $GLOBALS['erro_dns'] = CURLE_COULDNT_CONNECT;
    $GLOBALS['status_dns'] = 0;
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 1_000_000_000), ConsultaLinkIndisponivelException::class);
    $GLOBALS['erro_dns'] = CURLE_OPERATION_TIMEDOUT;
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 1_000_000_000), ConsultaLinkIndisponivelException::class);
    $GLOBALS['erro_dns'] = 0;
    $GLOBALS['status_dns'] = 504;
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 1_000_000_000), TempoConsultaLinkException::class);
    $GLOBALS['erro_dns'] = CURLE_OPERATION_TIMEDOUT;
    $GLOBALS['status_dns'] = 0;
    $GLOBALS['atraso_dns'] = 20_000;
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 10_000_000), TempoConsultaLinkException::class);
    $GLOBALS['atraso_dns'] = 0;
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) - 1), TempoConsultaLinkException::class);
    $GLOBALS['erro_dns'] = 0;
    $GLOBALS['status_dns'] = 503;
    rejeitar(fn () => ResolverDominioService::resolver('site.example', hrtime(true) + 1_000_000_000), RuntimeException::class);

    Logos\AssessoriaApi\Services\AuthContext::set((object) ['sub' => 1, 'assessoria_id' => 1]);
    $controller = new Logos\AssessoriaApi\Controllers\ClippingController();
    $executar = new ReflectionMethod($controller, 'executar');
    ob_start();
    $executar->invoke($controller, static function () {
        throw new ConsultaLinkIndisponivelException(true);
    });
    $resposta = json_decode(ob_get_clean(), true);
    conferir(http_response_code() === 503, 'a indisponibilidade chega ao app como HTTP 503');
    conferir(str_contains($resposta['message'], 'ocupada'), 'o assessor recebe uma mensagem clara para tentar novamente');
}
