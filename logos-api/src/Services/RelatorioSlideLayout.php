<?php

namespace Logos\AssessoriaApi\Services;

final class RelatorioSlideLayout
{
    public const LIMITE_DESCRICAO = 200;

    public static function escalaImagem(mixed $valor): int
    {
        return is_int($valor) && $valor >= 25 && $valor <= 100 ? $valor : 100;
    }

    // Avanços máximos a 16 px: Arial e Montserrat, incluindo negrito e kerning.
    // Índices correspondem aos códigos Unicode de 32 a 255.
    private const LARGURAS_TEXTO = [
        4.9, 5.6, 8.6, 11.9, 10.9, 15.1, 12.7, 5.1, 7.9, 6.9, 8.1, 10.3,
        6.1, 6.8, 6.1, 8.7, 11.4, 9.1, 10.3, 10.2, 11.9, 10.3, 11, 10.9,
        11.3, 11.2, 5.7, 5.7, 10, 10, 10, 10.4, 17.1, 13.7, 13, 12.2,
        13.9, 11.5, 11.2, 12.8, 13.7, 6.2, 10.3, 13.3, 10.7, 16, 13.7, 14.1,
        12.5, 14.7, 12.6, 10.9, 11.3, 12.9, 13.3, 20, 12.7, 12.1, 11.6, 8.1,
        9.1, 7.2, 10, 10.5, 9.8, 10.7, 11.7, 10.3, 11.9, 11, 7.7, 12.1,
        11.7, 5.6, 7.3, 11.9, 5.6, 17.4, 11.5, 11.4, 11.5, 11.9, 7.9, 9.2,
        7.9, 11.8, 10.8, 16.2, 10.8, 10.8, 9.4, 8.5, 5.3, 7.6, 10.3, 9.2,
        12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2,
        12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2,
        12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 12.2, 4.9, 6.3, 10.3, 11.7,
        11.6, 13.1, 5.3, 9.3, 9.8, 13.4, 7.5, 10.4, 10.3, 0.2, 13.4, 9.8,
        7.8, 10.3, 7.1, 7.1, 9.8, 11.9, 12.1, 5.7, 9.8, 7.1, 7.7, 10.2,
        17, 17, 17, 10.9, 13.7, 13.7, 13.7, 13.7, 13.7, 13.7, 18.7, 12.2,
        11.5, 11.5, 11.5, 11.5, 6.2, 6.2, 6.2, 6.2, 14.2, 13.7, 14.1, 14.1,
        14.1, 14.1, 14.1, 10, 14.1, 12.9, 12.9, 12.9, 12.9, 12.1, 12.5, 11.8,
        10.7, 10.7, 10.7, 10.7, 10.7, 10.7, 16.6, 10.3, 11, 11, 11, 11,
        6.2, 5.6, 6.1, 6, 10.6, 11.5, 11.4, 11.4, 11.4, 11.4, 11.4, 10.3,
        11.4, 11.8, 11.8, 11.8, 11.8, 10.8, 11.7, 10.8,
    ];

    private static function larguraTexto(string $texto): float
    {
        $total = 0;
        foreach (mb_str_split($texto) as $caractere) {
            $codigo = mb_ord($caractere, 'UTF-8');
            $total += self::LARGURAS_TEXTO[$codigo - 32] ?? 24;
        }
        return $total;
    }

    private static function linhasCampo(string $texto, int $maximo): array
    {
        $linhas = [];
        $linha = '';
        $abreviado = false;
        $texto = trim(preg_replace('/\s+/u', ' ', $texto) ?? '');
        foreach (mb_str_split($texto) as $caractere) {
            if (self::larguraTexto($linha . $caractere) > 342) {
                $espaco = mb_strrpos($linha, ' ');
                $linhas[] = $espaco !== false && $espaco > 0 ? mb_substr($linha, 0, $espaco) : $linha;
                $linha = $espaco !== false && $espaco > 0 ? mb_substr($linha, $espaco + 1) : '';
                if (count($linhas) === $maximo) {
                    $ultima = $linhas[$maximo - 1];
                    while (self::larguraTexto($ultima . '…') > 342) {
                        $ultima = mb_substr($ultima, 0, -1);
                    }
                    $linhas[$maximo - 1] = rtrim($ultima) . '…';
                    $abreviado = true;
                    break;
                }
            }
            $linha .= $caractere;
        }
        if (!$abreviado && trim($linha) !== '') {
            $linhas[] = trim($linha);
        }
        return ['linhas' => $linhas, 'abreviado' => $abreviado];
    }

    public static function dados(
        ?string $nome,
        ?string $descricao,
        ?string $alcance,
        bool $temData
    ): array {
        $valores = [
            [
                'rotulo' => 'Veículo',
                'valor' => trim($nome ?? '') !== ''
                    ? trim($nome)
                    : 'Veículo não informado',
                'maximo' => 3,
            ],
            [
                'rotulo' => 'Descrição',
                'valor' => self::descricao($descricao),
                'maximo' => 6,
            ],
            [
                'rotulo' => 'Alcance',
                'valor' => trim($alcance ?? ''),
                'maximo' => 3,
            ],
        ];
        $campos = [];
        foreach ($valores as $campo) {
            if ($campo['valor'] === '') {
                continue;
            }
            $quebrado = self::linhasCampo(
                $campo['rotulo'] . ': ' . $campo['valor'],
                $campo['maximo']
            );
            $campos[] = [
                'rotulo' => $campo['rotulo'],
                ...$quebrado,
                'altura' => count($quebrado['linhas']) * 22,
            ];
        }
        $altura = array_sum(array_column($campos, 'altura')) + (count($campos) - 1) * 8;
        $topo = ($temData ? 455 : 500) - $altura;
        foreach ($campos as &$campo) {
            $campo['topo'] = $topo;
            $topo += $campo['altura'] + 8;
        }
        unset($campo);
        return $campos;
    }

    public static function descricao(?string $valor): string
    {
        $texto = trim(preg_replace('/\s+/u', ' ', $valor ?? '') ?? '');

        return mb_strlen($texto, 'UTF-8') > self::LIMITE_DESCRICAO
            ? mb_substr($texto, 0, self::LIMITE_DESCRICAO - 1, 'UTF-8') . '…'
            : $texto;
    }

    public static function link(?string $valor): array
    {
        $link = trim($valor ?? '');
        $linhas = [];
        $linha = '';
        $largura = 0;
        $abreviado = false;

        foreach (mb_str_split($link) as $caractere) {
            $peso = preg_match('~[il1.:/\-_?=]~u', $caractere)
                ? 0.5
                : (preg_match('~[MWmw@#%&]|[^\x00-\x7F]~u', $caractere)
                    ? 2
                    : (preg_match('~[A-Z]~', $caractere) ? 1.2 : 1));

            if ($largura + $peso > 48) {
                $linhas[] = $linha;
                $linha = '';
                $largura = 0;

                if (count($linhas) === 5) {
                    $linhas[4] = mb_substr($linhas[4], 0, -3) . '…';
                    $abreviado = true;
                    break;
                }
            }

            $linha .= $caractere;
            $largura += $peso;
        }

        if ($linha !== '') {
            $linhas[] = $linha;
        }

        $alturaLink = count($linhas) * 20;
        $topoLink = 490 - $alturaLink;

        return [
            'texto' => implode("\n", $linhas),
            'abreviado' => $abreviado,
            'alturaLink' => $alturaLink,
            'topoLink' => $topoLink,
            'topoImagem' => 70,
            'alturaImagem' => min(360, $topoLink - 70 - 12),
        ];
    }
}
