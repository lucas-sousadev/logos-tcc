<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Exceptions\TempoConsultaLinkException;
use Logos\AssessoriaApi\Exceptions\ConsultaLinkIndisponivelException;

final class ResolverDominioService
{
    public static function resolver(
        string $host,
        int $limiteNs,
        ?int $limiteTotalNs = null
    ): array {
        $restanteMs = intdiv($limiteNs - hrtime(true), 1_000_000);
        $prazoTotal = $limiteTotalNs === null || $limiteNs === $limiteTotalNs;

        if ($restanteMs <= 0) {
            throw new TempoConsultaLinkException($prazoTotal, 10_000);
        }

        $segredo = $_ENV['CAPTURA_SEGREDO'] ?? '';

        if (
            !is_string($segredo) ||
            strlen($segredo) < 32 ||
            strpbrk($segredo, "\r\n") !== false
        ) {
            error_log('Configure CAPTURA_SEGREDO para a consulta local de DNS');
            throw new ConsultaLinkIndisponivelException();
        }

        $curl = curl_init('http://127.0.0.1:3777/resolver-dominio');

        if ($curl === false) {
            throw new ConsultaLinkIndisponivelException();
        }

        $corpo = '';

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'host' => $host,
                'restante_ms' => min(10_000, $restanteMs),
            ], JSON_THROW_ON_ERROR),
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => min(1000, $restanteMs),
            CURLOPT_TIMEOUT_MS => min(2000, $restanteMs),
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP,
            CURLOPT_PROXY => '',
            CURLOPT_NOPROXY => '*',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Captura-Segredo: ' . $segredo,
            ],
            CURLOPT_WRITEFUNCTION => static function (
                $ch,
                string $parte
            ) use (&$corpo): int {
                if (strlen($corpo) + strlen($parte) > 8192) return 0;
                $corpo .= $parte;
                return strlen($parte);
            },
        ]);

        try {
            $ok = curl_exec($curl);
            $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $erro = curl_errno($curl);
        } finally {
            curl_close($curl);
        }

        $esgotouPrazoTotal =
            $prazoTotal && hrtime(true) >= $limiteNs - 1_000_000;

        if (
            $status === 504 ||
            ($erro === CURLE_OPERATION_TIMEDOUT && $esgotouPrazoTotal)
        ) {
            throw new TempoConsultaLinkException(
                $esgotouPrazoTotal,
                10_000
            );
        }

        if ($ok === false || $erro !== 0 || $status >= 500 || $status === 404) {
            error_log("Consulta local de DNS falhou: HTTP {$status}, cURL {$erro}");
            throw new ConsultaLinkIndisponivelException($status === 503);
        }

        $dados = json_decode($corpo, true);

        if ($status !== 200) {
            throw new \InvalidArgumentException(
                $dados['message'] ?? 'Não foi possível localizar o site.'
            );
        }

        $ips = $dados['ips'] ?? null;

        if (!is_array($ips) || !$ips || count($ips) > 64) {
            throw new ConsultaLinkIndisponivelException();
        }

        foreach ($ips as $ip) {
            if (
                !is_string($ip) ||
                filter_var(
                    $ip,
                    FILTER_VALIDATE_IP,
                    FILTER_FLAG_IPV4 |
                        FILTER_FLAG_NO_PRIV_RANGE |
                        FILTER_FLAG_NO_RES_RANGE
                ) === false
            ) {
                throw new \InvalidArgumentException(
                    'Este endereço não pode ser consultado.'
                );
            }
        }

        return $ips;
    }
}
