<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Throwable;

final class AuthRateLimitService
{
    private const JANELA_SEGUNDOS = 900;
    private const BLOQUEIO_SEGUNDOS = 900;

    private const LIMITE_LOGIN_EMAIL = 5;
    private const LIMITE_LOGIN_IP = 20;

    private const LIMITE_CONVITE_CODIGO = 5;
    private const LIMITE_CONVITE_IP = 20;

    public static function bloqueioLoginRestante(
        string $email
    ): int {
        return self::maiorTempoRestante([
            ['LOGIN_EMAIL', strtolower(trim($email))],
            ['LOGIN_IP', self::ipCliente()],
        ]);
    }

    public static function registrarFalhaLogin(
        string $email
    ): bool {
        $bloqueadoPorEmail = self::registrarFalha(
            'LOGIN_EMAIL',
            strtolower(trim($email)),
            self::LIMITE_LOGIN_EMAIL
        );

        $bloqueadoPorIp = self::registrarFalha(
            'LOGIN_IP',
            self::ipCliente(),
            self::LIMITE_LOGIN_IP
        );

        return $bloqueadoPorEmail || $bloqueadoPorIp;
    }

    public static function limparFalhasLogin(
        string $email
    ): void {
        self::limpar('LOGIN_EMAIL', strtolower(trim($email)));
        self::limpar('LOGIN_IP', self::ipCliente());
    }

    public static function bloqueioConviteRestante(
        string $codigo
    ): int {
        return self::maiorTempoRestante([
            ['CONVITE_CODIGO', strtoupper(trim($codigo))],
            ['CONVITE_IP', self::ipCliente()],
        ]);
    }

    public static function registrarFalhaConvite(
        string $codigo
    ): bool {
        $bloqueadoPorCodigo = self::registrarFalha(
            'CONVITE_CODIGO',
            strtoupper(trim($codigo)),
            self::LIMITE_CONVITE_CODIGO
        );

        $bloqueadoPorIp = self::registrarFalha(
            'CONVITE_IP',
            self::ipCliente(),
            self::LIMITE_CONVITE_IP
        );

        return $bloqueadoPorCodigo || $bloqueadoPorIp;
    }

    private static function maiorTempoRestante(
        array $chaves
    ): int {
        $maior = 0;

        foreach ($chaves as [$acao, $chave]) {
            $maior = max(
                $maior,
                self::tempoRestante($acao, $chave)
            );
        }

        return $maior;
    }

    private static function tempoRestante(
        string $acao,
        string $chave
    ): int {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT bloqueado_ate
            FROM tentativas_autenticacao
            WHERE acao = :acao
            AND chave_hash = :chave_hash
            LIMIT 1
        ");

        $stmt->execute([
            'acao' => $acao,
            'chave_hash' => self::hashChave($acao, $chave),
        ]);

        $bloqueadoAte = $stmt->fetchColumn();

        if (!$bloqueadoAte) {
            return 0;
        }

        $timestamp = strtotime((string) $bloqueadoAte);

        if ($timestamp === false) {
            return 0;
        }

        return max(0, $timestamp - time());
    }

    private static function registrarFalha(
        string $acao,
        string $chave,
        int $limite
    ): bool {
        $pdo = Connection::get();
        $chaveHash = self::hashChave($acao, $chave);

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                SELECT
                    tentativas,
                    janela_iniciada_em,
                    bloqueado_ate
                FROM tentativas_autenticacao
                WHERE acao = :acao
                AND chave_hash = :chave_hash
                LIMIT 1
                FOR UPDATE
            ");

            $stmt->execute([
                'acao' => $acao,
                'chave_hash' => $chaveHash,
            ]);

            $registro = $stmt->fetch();

            if (!$registro) {
                $stmt = $pdo->prepare("
                    INSERT INTO tentativas_autenticacao (
                        acao,
                        chave_hash,
                        tentativas,
                        janela_iniciada_em,
                        bloqueado_ate
                    ) VALUES (
                        :acao,
                        :chave_hash,
                        1,
                        NOW(),
                        NULL
                    )
                ");

                $stmt->execute([
                    'acao' => $acao,
                    'chave_hash' => $chaveHash,
                ]);

                $pdo->commit();

                return false;
            }

            $agora = time();
            $inicioJanela = strtotime(
                $registro['janela_iniciada_em']
            ) ?: 0;

            $bloqueadoAte = $registro['bloqueado_ate']
                ? strtotime($registro['bloqueado_ate'])
                : 0;

            if ($bloqueadoAte > $agora) {
                $pdo->commit();

                return true;
            }

            $reiniciarJanela =
                $inicioJanela === 0 ||
                ($inicioJanela + self::JANELA_SEGUNDOS) <= $agora ||
                $bloqueadoAte > 0;

            $tentativas = $reiniciarJanela
                ? 1
                : ((int) $registro['tentativas'] + 1);

            $novoBloqueio = $tentativas >= $limite
                ? date(
                    'Y-m-d H:i:s',
                    $agora + self::BLOQUEIO_SEGUNDOS
                )
                : null;

            $stmt = $pdo->prepare("
                UPDATE tentativas_autenticacao
                SET
                    tentativas = :tentativas,
                    janela_iniciada_em = :janela_iniciada_em,
                    bloqueado_ate = :bloqueado_ate
                WHERE acao = :acao
                AND chave_hash = :chave_hash
            ");

            $stmt->execute([
                'tentativas' => $tentativas,
                'janela_iniciada_em' => $reiniciarJanela
                    ? date('Y-m-d H:i:s', $agora)
                    : $registro['janela_iniciada_em'],
                'bloqueado_ate' => $novoBloqueio,
                'acao' => $acao,
                'chave_hash' => $chaveHash,
            ]);

            $pdo->commit();

            return $novoBloqueio !== null;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    private static function limpar(
        string $acao,
        string $chave
    ): void {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            DELETE FROM tentativas_autenticacao
            WHERE acao = :acao
            AND chave_hash = :chave_hash
        ");

        $stmt->execute([
            'acao' => $acao,
            'chave_hash' => self::hashChave($acao, $chave),
        ]);
    }

    private static function hashChave(
        string $acao,
        string $chave
    ): string {
        return hash(
            'sha256',
            "{$acao}|" . trim($chave)
        );
    }

    private static function ipCliente(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';

        return filter_var($ip, FILTER_VALIDATE_IP)
            ? $ip
            : 'indefinido';
    }
}