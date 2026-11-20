<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use PHPMailer\PHPMailer\Exception as ErroMailer;
use PHPMailer\PHPMailer\PHPMailer;

final class ReleaseEnvioTesteService
{
    public static function enviar(
        int $assessoriaId,
        array $dados
    ): void {
        if (
            array_diff(
                array_keys($dados),
                ['email', 'dados_envio', 'blocos']
            ) !== []
        ) {
            throw new \InvalidArgumentException(
                'O envio de teste contém campos não permitidos.'
            );
        }

        if (!is_string($dados['email'] ?? null)) {
            throw new \InvalidArgumentException(
                'Informe um e-mail válido para receber o teste.'
            );
        }

        $envio = ReleaseService::validarDadosEnvio(
            $dados['dados_envio'] ?? null
        );

        $blocos = ReleaseBlocosService::validar(
            $dados['blocos'] ?? null
        );

        try {
            $mailer = ReleaseEmailService::preparar(
                $assessoriaId,
                $envio,
                $blocos,
                $dados['email'],
                true
            );

            self::reservarTentativa($assessoriaId);
            $mailer->send();
        } catch (ErroMailer $erro) {
            throw new \RuntimeException(
                'O servidor de e-mail não confirmou o teste. Confira a caixa de entrada antes de tentar novamente.',
                502,
                $erro
            );
        } finally {
            if (isset($mailer)) {
                $mailer->smtpClose();
            }
        }
    }

    private static function reservarTentativa(int $assessoriaId): void
    {
        $stmt = Connection::get()->prepare("
            INSERT INTO tentativas_autenticacao
                (acao, chave_hash, tentativas, janela_iniciada_em)
            VALUES ('RELEASE_TESTE', :chave, 1, NOW())
            ON DUPLICATE KEY UPDATE
                tentativas = CASE
                    WHEN janela_iniciada_em <= NOW() - INTERVAL 10 MINUTE THEN 1
                    ELSE LEAST(tentativas + 1, 10)
                END,
                janela_iniciada_em = CASE
                    WHEN janela_iniciada_em <= NOW() - INTERVAL 10 MINUTE THEN NOW()
                    ELSE janela_iniciada_em
                END
        ");
        $stmt->execute(['chave' => hash('sha256', 'RELEASE_TESTE|' . $assessoriaId)]);

        if ($stmt->rowCount() === 0) {
            throw new \RuntimeException(
                'A assessoria atingiu o limite de 10 testes em 10 minutos. Tente novamente em alguns minutos.',
                429
            );
        }
    }

}