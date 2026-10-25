<?php

namespace Logos\AssessoriaApi\Services;

final class CapturaPaginaService
{
    private const LIMITE_IMAGEM = 4_194_304;

    public static function capturar(mixed $link): array
    {
        if (!is_string($link) || trim($link) === '') {
            throw new \InvalidArgumentException(
                'Informe o link da página.'
            );
        }

        $segredo = $_ENV['CAPTURA_SEGREDO'] ?? '';

        if (
            !is_string($segredo) ||
            strlen($segredo) < 32 ||
            strpbrk($segredo, "\r\n") !== false
        ) {
            throw new \RuntimeException(
                'O serviço de captura não está configurado.'
            );
        }

        $corpo = json_encode(
            ['link' => trim($link)],
            JSON_THROW_ON_ERROR
        );

        $resposta = '';
        $excedeuLimite = false;
        $curl = curl_init(
            'http://127.0.0.1:3777/capturar'
        );

        if ($curl === false) {
            throw new \RuntimeException(
                'Não foi possível iniciar a captura.'
            );
        }

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $corpo,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => 1000,
            CURLOPT_TIMEOUT_MS => 25000,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP,
            CURLOPT_PROXY => '',
            CURLOPT_NOPROXY => '*',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: image/jpeg, application/json',
                'X-Captura-Segredo: ' . $segredo,
            ],
            CURLOPT_WRITEFUNCTION =>
                static function ($ch, string $trecho) use (
                    &$resposta,
                    &$excedeuLimite
                ): int {
                    if (
                        strlen($resposta) + strlen($trecho) >
                        self::LIMITE_IMAGEM
                    ) {
                        $excedeuLimite = true;
                        return 0;
                    }

                    $resposta .= $trecho;
                    return strlen($trecho);
                },
        ]);

        $ok = curl_exec($curl);
        $status = (int) curl_getinfo(
            $curl,
            CURLINFO_RESPONSE_CODE
        );
        $tipo = (string) curl_getinfo(
            $curl,
            CURLINFO_CONTENT_TYPE
        );
        curl_close($curl);

        if ($excedeuLimite) {
            throw new \LengthException(
                'A captura ficou grande demais.'
            );
        }

        if ($ok === false) {
            throw new \RuntimeException(
                'O serviço de captura não respondeu.'
            );
        }

        if ($status === 429) {
            throw new \DomainException(
                'Já existe uma captura em andamento. Tente novamente.'
            );
        }

        if ($status === 422) {
            $erro = json_decode($resposta, true);

            throw new \InvalidArgumentException(
                is_array($erro) &&
                is_string($erro['message'] ?? null)
                    ? $erro['message']
                    : 'Este link não pôde ser capturado.'
            );
        }

        if (
            $status !== 200 ||
            !str_starts_with($tipo, 'image/jpeg')
        ) {
            throw new \RuntimeException(
                'Não foi possível capturar esta página.'
            );
        }

        $dimensoes = @getimagesizefromstring($resposta);

        if (
            $dimensoes === false ||
            ($dimensoes[0] ?? 0) < 1 ||
            ($dimensoes[0] ?? 0) > 1280 ||
            ($dimensoes[1] ?? 0) < 1 ||
            ($dimensoes[1] ?? 0) > 5000 ||
            !str_starts_with($resposta, "\xFF\xD8")
        ) {
            throw new \RuntimeException(
                'O serviço retornou uma imagem inválida.'
            );
        }

        return [
            'imagem' => $resposta,
            'largura' => (int) $dimensoes[0],
            'altura' => (int) $dimensoes[1],
        ];
    }
}