<?php

namespace Logos\AssessoriaApi\Services;

final class ClippingImportacaoData
{
    private const MESES = [
        'jan' => 1, 'janeiro' => 1,
        'fev' => 2, 'fevereiro' => 2, 'feb' => 2,
        'mar' => 3, 'marco' => 3,
        'abr' => 4, 'abril' => 4, 'apr' => 4,
        'mai' => 5, 'maio' => 5, 'may' => 5,
        'jun' => 6, 'junho' => 6,
        'jul' => 7, 'julho' => 7,
        'ago' => 8, 'agosto' => 8, 'aug' => 8,
        'set' => 9, 'setembro' => 9, 'sep' => 9,
        'out' => 10, 'outubro' => 10, 'oct' => 10,
        'nov' => 11, 'novembro' => 11,
        'dez' => 12, 'dezembro' => 12, 'dec' => 12,
    ];

    private static function ano(string $valor): int
    {
        if (!preg_match('/\A\d{2}(?:\d{2})?\z/', $valor)) {
            throw new \InvalidArgumentException('Ano inválido no CSV.');
        }

        $ano = strlen($valor) === 2
            ? 2000 + (int) $valor
            : (int) $valor;

        if ($ano < 1000 || $ano > 9999) {
            throw new \InvalidArgumentException('Ano inválido no CSV.');
        }

        return $ano;
    }

    private static function mes(string $valor): int
    {
        if (ctype_digit($valor)) {
            $mes = (int) $valor;
            if ($mes >= 1 && $mes <= 12) return $mes;
        }

        $normalizado = mb_strtolower(trim($valor), 'UTF-8');
        $normalizado = strtr($normalizado, ['ç' => 'c', 'á' => 'a']);

        if (isset(self::MESES[$normalizado])) {
            return self::MESES[$normalizado];
        }

        throw new \InvalidArgumentException('Mês inválido no CSV.');
    }

    private static function montar(int $dia, int $mes, int $ano): string
    {
        if (!checkdate($mes, $dia, $ano)) {
            throw new \InvalidArgumentException('Data inválida no CSV.');
        }

        return sprintf('%04d-%02d-%02d', $ano, $mes, $dia);
    }

    public static function interpretar(
        array $originais,
        int $anoPadrao,
        array &$avisos
    ): array {
        $anoTexto = trim((string) ($originais['ano_referencia'] ?? ''));
        $periodoTexto = trim((string) ($originais['mes_ano'] ?? ''));
        $dataTexto = trim((string) ($originais['data_publicacao'] ?? ''));
        $diaTexto = trim((string) ($originais['dia_mes'] ?? ''));

        $anoColuna = $anoTexto === '' ? null : self::ano($anoTexto);
        $mesPeriodo = null;
        $anoPeriodo = null;

        if ($periodoTexto !== '') {
            if (!preg_match(
                '/\A([\p{L}]{3,12}|\d{1,2})\s*[\/-]\s*(\d{2}|\d{4})\z/u',
                $periodoTexto,
                $partes
            )) {
                throw new \InvalidArgumentException(
                    'Mês/ano inválido. Use, por exemplo, Jan/26 ou 01/2026.'
                );
            }

            $mesPeriodo = self::mes($partes[1]);
            $anoPeriodo = self::ano($partes[2]);
        }

        if (
            $anoPeriodo !== null
            && $anoColuna !== null
            && $anoPeriodo !== $anoColuna
        ) {
            throw new \InvalidArgumentException(
                'O ano da coluna Mês/ano difere da coluna Ano.'
            );
        }

        $valorData = $dataTexto !== '' ? $dataTexto : $diaTexto;

        if ($dataTexto !== '' && $diaTexto !== '') {
            throw new \InvalidArgumentException(
                'Escolha uma só coluna para Dia/data ou Data da publicação.'
            );
        }

        $dataCompleta = null;

        if (preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $valorData)) {
            $dataCompleta = ClippingImportacaoCsv::data($valorData);
        } elseif (preg_match('/\A\d{1,2}\/\d{1,2}\/\d{4}\z/', $valorData)) {
            [$dia, $mes, $ano] = array_map('intval', explode('/', $valorData));
            $dataCompleta = self::montar($dia, $mes, $ano);
        } elseif (preg_match('/\A(\d{1,2})\/(\d{1,2})\/(\d{2})\z/', $valorData, $partes)) {
            $dataCompleta = self::montar(
                (int) $partes[1],
                (int) $partes[2],
                self::ano($partes[3])
            );
        }

        if ($dataCompleta !== null) {
            $anoData = (int) substr($dataCompleta, 0, 4);
            $mesData = (int) substr($dataCompleta, 5, 2);

            if ($anoPeriodo !== null && (
                $anoPeriodo !== $anoData || $mesPeriodo !== $mesData
            )) {
                throw new \InvalidArgumentException(
                    'A data completa não corresponde à coluna Mês/ano.'
                );
            }

            if ($anoColuna !== null && $anoColuna !== $anoData) {
                $avisos[] = "O ano informado foi substituído por {$anoData}, conforme a data da publicação.";
            }

            return [$dataCompleta, $anoData];
        }

        $ano = $anoPeriodo ?? $anoColuna ?? $anoPadrao;
        $mes = $mesPeriodo;
        $dia = null;

        if ($valorData !== '') {
            if (preg_match('/\A(\d{1,2})\/(\d{1,2})\z/', $valorData, $partes)) {
                $dia = (int) $partes[1];
                $mesDaData = (int) $partes[2];

                if ($mes !== null && $mes !== $mesDaData) {
                    throw new \InvalidArgumentException(
                        'O mês da coluna Dia/data difere da coluna Mês/ano.'
                    );
                }

                $mes = $mesDaData;
            } elseif (preg_match('/\A\d{1,2}\z/', $valorData)) {
                $dia = (int) $valorData;
            } else {
                throw new \InvalidArgumentException(
                    'Data inválida. Use DD/MM/AAAA, DD/MM ou apenas o dia junto de Mês/ano.'
                );
            }
        }

        $data = $dia !== null && $mes !== null
            ? self::montar($dia, $mes, $ano)
            : null;

        if ($dia !== null && $mes === null) {
            $avisos[] = 'A data ficou pendente porque falta o mês.';
        }

        return [$data, $ano];
    }
}