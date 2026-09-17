<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;
use Logos\AssessoriaApi\Models\Clipping;

class ClippingCsvService
{
    private const COLUNAS = [
        'Cliente',
        'Ano',
        'Data',
        'Categoria',
        'Veículo',
        'Programa/Seção',
        'Pauta',
        'Início',
        'Fim',
        'Duração total',
        'Tier',
        'Link',
        'Observações',
    ];

    private static function inteiro(
        mixed $valor,
        string $rotulo,
        int $minimo = 1,
        int $maximo = PHP_INT_MAX
    ): int {
        if (!is_int($valor) && !is_string($valor)) {
            throw new \InvalidArgumentException(
                "{$rotulo} inválido."
            );
        }

        $numero = filter_var(
            $valor,
            FILTER_VALIDATE_INT,
            [
                'options' => [
                    'min_range' => $minimo,
                    'max_range' => $maximo,
                ],
            ]
        );

        if ($numero === false) {
            throw new \InvalidArgumentException(
                "{$rotulo} inválido."
            );
        }

        return $numero;
    }

    private static function tempo(mixed $valor): string
    {
        if ($valor === null) {
            return '';
        }

        $segundos = (int) $valor;

        return sprintf(
            '%02d:%02d:%02d',
            intdiv($segundos, 3600),
            intdiv($segundos % 3600, 60),
            $segundos % 60
        );
    }

    private static function escreverLinha(
        mixed $arquivo,
        array $valores
    ): void {
        $resultado = fputcsv(
            $arquivo,
            $valores,
            ';',
            '"',
            '',
            "\r\n"
        );

        if ($resultado === false) {
            throw new \RuntimeException(
                'Não foi possível gravar o CSV.'
            );
        }
    }

    private static function escreverClipping(
        mixed $arquivo,
        array $c
    ): void {
        $categorias = implode(
            ', ',
            $c['categorias'] ?? []
        );

        // a ordem corresponde à constant COLUNAS la de cima
        $linha = [
            $c['cliente_nome'],
            $c['ano_referencia'],
            $c['data_publicacao'],
            $categorias,
            $c['veiculo_nome'],
            $c['programa_secao'],
            $c['pauta'],
            self::tempo($c['inicio_segundos']),
            self::tempo($c['fim_segundos']),
            self::tempo($c['duracao_segundos']),
            $c['tier'],
            $c['link'],
            $c['observacoes'],
        ];

        foreach ($linha as $indice => $valor) {
            if ($valor === null) {
                $linha[$indice] = '';
                continue;
            }

            $texto = (string) $valor;

            //  proteção contra interpretação de textos como fórmulas, sem adicionar colunas à planilha.
            if (
                preg_match(
                    "/\A(?:[=+\-@'\t\r\n]|[\s\p{Z}]+[=+\-@'])/u",
                    $texto
                ) === 1
            ) {
                $texto = "'" . $texto;
            }

            $linha[$indice] = $texto;
        }

        self::escreverLinha($arquivo, $linha);
    }

    public static function gerar(
        int $assessoriaId,
        array $dados
    ): mixed {
        $modo = $dados['modo'] ?? null;

        if (!in_array($modo, ['filtrados', 'selecionados'], true)) {
            throw new \InvalidArgumentException(
                'Informe o modo da exportação.'
            );
        }

        $clienteId = self::inteiro(
            $dados['cliente_id'] ?? null,
            'Cliente'
        );

        $ano = self::inteiro(
            $dados['ano_referencia'] ?? null,
            'Ano de referência',
            1000,
            9999
        );

        $ids = [];
        $filtros = [];

        if ($modo === 'selecionados') {
            $recebidos = $dados['ids'] ?? null;

            if (
                !is_array($recebidos)
                || !array_is_list($recebidos)
                || count($recebidos) === 0
                || count($recebidos) > 100
            ) {
                throw new \InvalidArgumentException(
                    'Selecione entre 1 e 100 clippings.'
                );
            }

            foreach ($recebidos as $valor) {
                $id = self::inteiro($valor, 'ID do clipping');

                if (in_array($id, $ids, true)) {
                    throw new \InvalidArgumentException(
                        'Há IDs duplicados na seleção.'
                    );
                }

                $ids[] = $id;
            }
        } else {
            $recebidos = $dados['filtros'] ?? new \stdClass();

            if (!$recebidos instanceof \stdClass) {
                throw new \InvalidArgumentException(
                    'Os filtros devem ser um objeto JSON.'
                );
            }

            $filtros = get_object_vars($recebidos);
        }

        $arquivo = tmpfile();

        if ($arquivo === false) {
            throw new \RuntimeException(
                'Não foi possível preparar o arquivo temporário.'
            );
        }

        $pdo = Connection::get();

        if ($pdo->inTransaction()) {
            fclose($arquivo);

            throw new \LogicException(
                'A exportação precisa iniciar sua própria leitura.'
            );
        }

        try {
            // Todas as páginas enxergam a mesma versão dos dados.
            $pdo->exec(
                'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'
            );

            $pdo->beginTransaction();

            if (!Cliente::buscarPorId($clienteId, $assessoriaId)) {
                throw new \OutOfBoundsException(
                    'Cliente não encontrado.'
                );
            }

            // BOM para facilitar o reconhecimento de UTF-8.
            if (fwrite($arquivo, "\xEF\xBB\xBF") !== 3) {
                throw new \RuntimeException(
                    'Não foi possível iniciar o CSV.'
                );
            }

            self::escreverLinha($arquivo, self::COLUNAS);

            if ($modo === 'selecionados') {
                foreach ($ids as $id) {
                    $clipping = Clipping::buscarPorId(
                        $id,
                        $assessoriaId
                    );

                    if (!$clipping) {
                        throw new \OutOfBoundsException(
                            'Um dos clippings selecionados não está disponível. Atualize a lista.'
                        );
                    }

                    if (
                        (int) $clipping['cliente_id'] !== $clienteId
                        || (int) $clipping['ano_referencia'] !== $ano
                        || $clipping['arquivado_em'] !== null
                    ) {
                        throw new \DomainException(
                            'Um dos clippings mudou de grupo ou foi arquivado. Atualize a lista e selecione novamente.'
                        );
                    }

                    self::escreverClipping($arquivo, $clipping);
                }
            } else {
                $pagina = 1;

                do {
                    // Cliente, ano e paginação não podem ser
                    // substituídos pelos filtros recebidos.
                    $consulta = array_merge(
                        $filtros,
                        [
                            'cliente_id' => $clienteId,
                            'ano_referencia' => $ano,
                            'page' => $pagina,
                            'limit' => 100,
                        ]
                    );

                    $resultado = ClippingService::listar(
                        $assessoriaId,
                        $consulta
                    );

                    foreach ($resultado['clippings'] as $clipping) {
                        self::escreverClipping($arquivo, $clipping);
                    }

                    $pagina++;
                } while ($resultado['pagination']['has_next']);
            }

            $pdo->commit();

            if (!rewind($arquivo)) {
                throw new \RuntimeException(
                    'Não foi possível preparar o download.'
                );
            }

            return $arquivo;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            fclose($arquivo);

            throw $e;
        }
    }
}