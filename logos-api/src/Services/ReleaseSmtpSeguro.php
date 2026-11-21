<?php

namespace Logos\AssessoriaApi\Services;

use PHPMailer\PHPMailer\SMTP;

class ReleaseSmtpSeguro extends SMTP
{
    private bool $dadosIniciados = false;
    private bool $aceito = false;
    private ?array $falha = null;

    protected function sendCommand(
        $command,
        $commandstring,
        $expect
    ) {
        $ok = parent::sendCommand(
            $command,
            $commandstring,
            $expect
        );

        // QUIT e RSET não devem apagar o resultado do envio.
        if (!in_array($command, ['QUIT', 'RSET'], true)) {
            if ($ok) {
                $this->falha = null;
            } else {
                $erro = $this->getError();
                $codigo = (int) ($erro['smtp_code'] ?? 0);

                $this->falha = [
                    'comando' => (string) $command,
                    'codigo' => $codigo >= 400 && $codigo <= 599
                        ? $codigo
                        : null,
                ];
            }
        }

        if ($command === 'DATA' && $ok) {
            $this->dadosIniciados = true;
        }

        if ($command === 'DATA END' && $ok) {
            $this->aceito = true;
        }

        return $ok;
    }

    public function resultado(bool $preparado): array
    {
        $codigo = $this->falha['codigo'] ?? null;
        $comando = $this->falha['comando'] ?? '';

        if ($this->aceito) {
            $tipo = 'ACEITO';
        } elseif (!$preparado) {
            $tipo = 'CONFIGURACAO';
        } elseif (
            $codigo !== null &&
            $codigo >= 400 &&
            $codigo < 500
        ) {
            $tipo = 'TEMPORARIA';
        } elseif ($codigo !== null && $codigo >= 500) {
            $tipo = in_array(
                $comando,
                ['RCPT TO', 'DATA', 'DATA END'],
                true
            )
                ? 'PERMANENTE'
                : 'CONFIGURACAO';
        } else {
            $tipo = $this->dadosIniciados
                ? 'INCERTA'
                : 'TEMPORARIA';
        }

        $mensagem = match ($tipo) {
            'ACEITO' => null,

            'TEMPORARIA' =>
                'Falha temporária de comunicação ou recusa temporária pelo servidor.',

            'PERMANENTE' =>
                'O servidor recusou este destinatário ou o conteúdo do e-mail.',

            'CONFIGURACAO' =>
                'Não foi possível preparar o e-mail ou autenticar o envio. Revise a configuração e o conteúdo.',

            default =>
                'O envio terminou sem confirmação. Não haverá repetição automática.',
        };

        return [
            'tipo' => $tipo,
            'codigo' => $codigo,
            'mensagem' => $mensagem,
        ];
    }
}