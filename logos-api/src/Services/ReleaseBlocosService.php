<?php

namespace Logos\AssessoriaApi\Services;

class ReleaseBlocosService
{
    public static function validar(mixed $blocos): array
    {
        if (
            !is_array($blocos)
            || !array_is_list($blocos)
            || count($blocos) > 100
        ) {
            throw new \InvalidArgumentException(
                'Informe uma lista com até 100 blocos.'
            );
        }

        $ids = [];

        foreach ($blocos as $indice => $bloco) {
            $numero = $indice + 1;

            if (
                !is_array($bloco)
                || array_diff(array_keys($bloco), [
                    'id', 'tipo', 'texto', 'url', 'legenda',
                ]) !== []
                || !isset($bloco['id'], $bloco['tipo'])
                || !is_string($bloco['id'])
                || !preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $bloco['id'])
                || isset($ids[$bloco['id']])
                || !in_array($bloco['tipo'], [
                    'titulo',
                    'linha_fina',
                    'texto',
                    'imagem',
                    'contato',
                    'divisor',
                    'espacamento',
                    'botao',
                    'arquivo',
                ], true)
            ) {
                throw new \InvalidArgumentException(
                    "Estrutura inválida no bloco {$numero}."
                );
            }

            $ids[$bloco['id']] = true;

            foreach ([
                'texto' => 50000,
                'url' => 2048,
                'legenda' => 1000,
            ] as $campo => $limite) {
                if (!array_key_exists($campo, $bloco)) {
                    continue;
                }

                if (
                    !is_string($bloco[$campo])
                    || !mb_check_encoding($bloco[$campo], 'UTF-8')
                    || mb_strlen($bloco[$campo], 'UTF-8') > $limite
                ) {
                    throw new \InvalidArgumentException(
                        "Campo {$campo} inválido no bloco {$numero}."
                    );
                }
            }

            if (array_key_exists('url', $bloco)) {
                $url = $bloco['url'];

                if (
                    !in_array(
                        $bloco['tipo'],
                        ['imagem', 'botao', 'arquivo'],
                        true
                    )
                    || (
                        $url !== ''
                        && (
                            !filter_var($url, FILTER_VALIDATE_URL)
                            || !in_array(
                                strtolower(
                                    (string) parse_url($url, PHP_URL_SCHEME)
                                ),
                                ['http', 'https'],
                                true
                            )
                        )
                    )
                ) {
                    throw new \InvalidArgumentException(
                        "Informe um link HTTP ou HTTPS válido no bloco {$numero}."
                    );
                }
            }

            if (
                array_key_exists('legenda', $bloco)
                && $bloco['tipo'] !== 'imagem'
            ) {
                throw new \InvalidArgumentException(
                    'A legenda deve pertencer a um bloco de imagem.'
                );
            }
        }

        return $blocos;
    }
}