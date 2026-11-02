<?php

namespace Logos\AssessoriaApi\Services;

final class CapturaPaginaService
{
    private const LIMITE_IMAGEM = 4_194_304;

    public static function processar(
        int $assessoriaId,
        int $usuarioId,
        string $origem,
        array $dados
    ): array {
        if (
            $assessoriaId < 1 ||
            $usuarioId < 1 ||
            !in_array($origem, ['clipping', 'relatorio'], true)
        ) {
            throw new \InvalidArgumentException(
                'Solicitante da captura inválido.'
            );
        }

        $acao = $dados['acao'] ?? 'iniciar';

        if (
            !is_string($acao) ||
            !in_array($acao, ['iniciar', 'consultar', 'cancelar'], true)
        ) {
            throw new \InvalidArgumentException(
                'Ação de captura inválida.'
            );
        }

        $payload = [
            'solicitante' => [
                'assessoria_id' => $assessoriaId,
                'usuario_id' => $usuarioId,
                'origem' => $origem,
            ],
        ];

        $caminho = '/capturas';

        if ($acao === 'iniciar') {
            $link = $dados['link'] ?? null;
            $trecho = $dados['trecho'] ?? 0;

            if (
                !is_string($link) ||
                trim($link) === '' ||
                strlen($link) > 2048
            ) {
                throw new \InvalidArgumentException(
                    'Informe o link da página.'
                );
            }

            if (!is_int($trecho) || $trecho < 0 || $trecho > 36) {
                throw new \InvalidArgumentException(
                    'Trecho da página inválido.'
                );
            }

            $payload['link'] = trim($link);
            $payload['trecho'] = $trecho;
        } else {
            $id = $dados['captura_id'] ?? null;

            if (
                !is_string($id) ||
                preg_match(
                    '/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',
                    $id
                ) !== 1
            ) {
                throw new \InvalidArgumentException(
                    'Identificador da captura inválido.'
                );
            }

            $caminho .= '/' . $id;
            $payload['acao'] = $acao;
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

        $curl = curl_init('http://127.0.0.1:3777' . $caminho);

        if ($curl === false) {
            throw new \RuntimeException(
                'Não foi possível iniciar a captura.'
            );
        }

        $resposta = '';
        $excedeuLimite = false;
        $cabecalhos = [];

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(
                $payload,
                JSON_THROW_ON_ERROR
            ),
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => 1000,
            // só inicia, consulta ou cancela porque a captura roda na fila
            CURLOPT_TIMEOUT_MS => 6000,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP,
            CURLOPT_PROXY => '',
            CURLOPT_NOPROXY => '*',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: image/jpeg, application/json',
                'X-Captura-Segredo: ' . $segredo,
            ],
            CURLOPT_WRITEFUNCTION => static function (
                $ch,
                string $parte
            ) use (&$resposta, &$excedeuLimite): int {
                if (
                    strlen($resposta) + strlen($parte) >
                    self::LIMITE_IMAGEM
                ) {
                    $excedeuLimite = true;
                    return 0;
                }

                $resposta .= $parte;

                return strlen($parte);
            },
            CURLOPT_HEADERFUNCTION => static function (
                $ch,
                string $linha
            ) use (&$cabecalhos): int {
                if (str_starts_with($linha, 'HTTP/')) {
                    $cabecalhos = [];
                }

                if (str_contains($linha, ':')) {
                    [$nome, $valor] = explode(':', $linha, 2);
                    $nome = strtolower(trim($nome));

                    if (
                        in_array(
                            $nome,
                            [ 'x-captura-incompleta',
                              'x-captura-tem-proxima',
                              'x-captura-aviso',
                            ],
                            true
                        )
                    ) {
                        $cabecalhos[$nome] = trim($valor);
                    }
                }

                return strlen($linha);
            },
        ]);

        try {
            $ok = curl_exec($curl);
            $status = (int) curl_getinfo(
                $curl,
                CURLINFO_RESPONSE_CODE
            );
            $tipo = strtolower((string) curl_getinfo(
                $curl,
                CURLINFO_CONTENT_TYPE
            ));
        } finally {
            curl_close($curl);
        }

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

        if ($status === 200 && str_starts_with($tipo, 'image/jpeg')) {
            if ($acao !== 'consultar') {
                throw new \RuntimeException(
                    'Resposta de captura inválida.'
                );
            }

            $dimensoes = @getimagesizefromstring($resposta);

            if (
                $dimensoes === false ||
                ($dimensoes[0] ?? 0) < 1 ||
                $dimensoes[0] > 1280 ||
                ($dimensoes[1] ?? 0) < 1 ||
                $dimensoes[1] > 1200 ||
                !str_starts_with($resposta, "\xFF\xD8")
            ) {
                throw new \RuntimeException(
                    'O serviço retornou uma imagem inválida.'
                );
            }

            $aviso = $cabecalhos['x-captura-aviso'] ?? '';

            if (
                $aviso !== '' &&
                !in_array(
                    $aviso,
                    [
                        'bloqueio',
                        'pouco_conteudo',
                        'sobreposicao',
                        'incerto',
                    ],
                    true
                )
            ) {
                $aviso = 'incerto';
            }
            
            return [
                'status' => 200,
                'imagem' => $resposta,
                'largura' => (int) $dimensoes[0],
                'altura' => (int) $dimensoes[1],
                'incompleta' =>
                    ($cabecalhos['x-captura-incompleta'] ?? '0') === '1'
                    || $aviso !== '',
                'aviso' => $aviso === '' ? null : $aviso,
                'tem_proxima' =>
                    ($cabecalhos['x-captura-tem-proxima'] ?? '0') === '1',
            ];
        }

        if (
            !str_starts_with($tipo, 'application/json') ||
            strlen($resposta) > 16_384
        ) {
            throw new \RuntimeException(
                'O serviço retornou uma resposta inválida.'
            );
        }

        $json = json_decode($resposta, true, 16, JSON_THROW_ON_ERROR);

        if (!is_array($json)) {
            throw new \RuntimeException(
                'Resposta de captura inválida.'
            );
        }

        if ($status >= 400) {
            $status = in_array(
                $status,
                [400, 404, 409, 413, 422, 429, 503],
                true
            ) ? $status : 502;

            return [
                'status' => $status,
                'json' => [
                    'success' => false,
                    'message' =>
                        $status !== 502 && is_string($json['message'] ?? null)
                            ? $json['message']
                            : 'Não foi possível capturar esta página.',
                ],
            ];
        }

        $captura = $json['captura'] ?? null;

        if (
            !in_array($status, [200, 202], true) ||
            !is_array($captura) ||
            !is_string($captura['id'] ?? null) ||
            !in_array(
                $captura['estado'] ?? null,
                ['aguardando', 'processando', 'cancelada'],
                true
            )
        ) {
            throw new \RuntimeException(
                'Resposta de captura inválida.'
            );
        }

        return [
            'status' => $status,
            'json' => [
                'success' => true,
                'captura' => $captura,
            ],
        ];
    }
}
