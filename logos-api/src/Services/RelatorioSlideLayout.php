<?php

namespace Logos\AssessoriaApi\Services;

final class RelatorioSlideLayout
{
    public const LIMITE_DESCRICAO = 200;

    public static function escalaImagem(mixed $valor): int
    {
        return is_int($valor) && $valor >= 25 && $valor <= 100 ? $valor : 100;
    }

    private static function pesoTexto(string $texto): float
    {
        $total = 0;
        foreach (mb_str_split($texto) as $caractere) {
            $total += preg_match('~[il1.:/\-_?=]~u', $caractere) ? 0.5
                : (preg_match('~[MWmw@#%&]|[^\x00-\x7F]~u', $caractere) ? 2
                    : (preg_match('~[A-Z]~', $caractere) ? 1.2 : 1));
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
            if (self::pesoTexto($linha . $caractere) > 40) {
                $espaco = mb_strrpos($linha, ' ');
                $linhas[] = $espaco !== false && $espaco > 0 ? mb_substr($linha, 0, $espaco) : $linha;
                $linha = $espaco !== false && $espaco > 0 ? mb_substr($linha, $espaco + 1) : '';
                if (count($linhas) === $maximo) {
                    $linhas[$maximo - 1] = mb_substr($linhas[$maximo - 1], 0, -3) . '…';
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
