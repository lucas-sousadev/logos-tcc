<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;

final class ReleaseAberturaService
{
    public static function basePublica(): ?string
    {
        $valor = trim($_ENV['RELEASE_TRACKING_URL'] ?? '');
        $url = parse_url($valor);

        if (
            $valor === '' || !filter_var($valor, FILTER_VALIDATE_URL)
            || !is_array($url) || strtolower($url['scheme'] ?? '') !== 'https'
            || empty($url['host']) || isset($url['user']) || isset($url['pass'])
            || isset($url['query']) || isset($url['fragment'])
            || preg_match('/[\x00-\x20\x7f]/', $valor)
        ) {
            return null;
        }

        $host = strtolower(trim($url['host'], '[]'));
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return null;
            }
        } elseif (
            !str_contains($host, '.') || $host === 'localhost'
            || preg_match('/\.(?:localhost|local|lan|internal)$/D', $host)
        ) {
            return null;
        }

        return rtrim($valor, '/');
    }

    public static function validarConfiguracao(): void
    {
        if (trim($_ENV['RELEASE_TRACKING_URL'] ?? '') !== '' && self::basePublica() === null) {
            throw new \RuntimeException(
                'Configure RELEASE_TRACKING_URL com uma URL pública HTTPS da API ou deixe o campo vazio.',
                503
            );
        }
    }

    public static function tokenValido(?string $token): bool
    {
        return $token !== null && preg_match('/^[a-f0-9]{64}$/D', $token) === 1;
    }

    public static function urlPixel(?string $token): ?string
    {
        $base = self::basePublica();
        return $base !== null && self::tokenValido($token)
            ? $base . '/api/releases/aberturas/' . $token
            : null;
    }

    public static function registrar(string $token): void
    {
        if (!self::tokenValido($token)) {
            return;
        }

        // Inclui a janela entre a transmissão e a confirmação no banco.
        // Uma abertura não altera o resultado SMTP nem a versão do release.
        $stmt = Connection::get()->prepare(
            "UPDATE release_destinatarios
             SET aberto_em = COALESCE(aberto_em, UTC_TIMESTAMP()),
                 aberturas_quantidade = LEAST(aberturas_quantidade + 1, 4294967295)
             WHERE tracking_token = :token
               AND (status IN ('ENVIANDO', 'ENVIADO') OR (status = 'ERRO' AND erro_tipo = 'INCERTA'))"
        );
        $stmt->execute(['token' => $token]);
    }

    public static function metricas(int $assessoriaId, int $releaseId): array
    {
        $stmt = Connection::get()->prepare(
            "SELECT
                COALESCE(SUM(status = 'ENVIADO' AND tracking_token IS NOT NULL), 0) AS envios_rastreados,
                COALESCE(SUM(status = 'ENVIADO' AND tracking_token IS NULL), 0) AS envios_sem_rastreamento,
                COALESCE(SUM(status = 'ENVIADO' AND tracking_token IS NOT NULL AND aberto_em IS NOT NULL), 0) AS destinatarios_abertos,
                COALESCE(SUM(CASE WHEN status = 'ENVIADO' AND tracking_token IS NOT NULL THEN aberturas_quantidade ELSE 0 END), 0) AS carregamentos_registrados,
                COALESCE(SUM(tracking_token IS NOT NULL AND aberto_em IS NOT NULL
                    AND (status = 'ENVIANDO' OR (status = 'ERRO' AND erro_tipo = 'INCERTA'))), 0) AS aberturas_sem_confirmacao
             FROM release_destinatarios WHERE assessoria_id = :a AND release_id = :id"
        );
        $stmt->execute(['a' => $assessoriaId, 'id' => $releaseId]);
        $metricas = array_map('intval', $stmt->fetch());

        return [
            ...$metricas,
            'coleta_configurada' => self::basePublica() !== null,
            'taxa_percentual' => $metricas['envios_rastreados'] > 0
                ? round(100 * $metricas['destinatarios_abertos'] / $metricas['envios_rastreados'], 1)
                : null,
        ];
    }

    public static function gif(): string
    {
        return base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', true);
    }
}
