<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

class TemplateService
{
    private static function numero(mixed $valor, string $rotulo): int
    {
        if (
            !is_int($valor)
            && (!is_string($valor) || !preg_match('/^[1-9][0-9]*$/D', $valor))
        ) {
            throw new \InvalidArgumentException("{$rotulo} inválido.");
        }

        $numero = filter_var($valor, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);

        if ($numero === false) {
            throw new \InvalidArgumentException("{$rotulo} inválido.");
        }

        return $numero;
    }

    private static function preparar(array $modelo): array
    {
        try {
            $blocos = is_string($modelo['blocos'])
                ? json_decode(
                    $modelo['blocos'],
                    true,
                    64,
                    JSON_THROW_ON_ERROR
                )
                : $modelo['blocos'];

            $modelo['blocos'] = ReleaseBlocosService::validar($blocos);
            $modelo['disponivel'] = count($modelo['blocos']) > 0;
        } catch (\JsonException | \InvalidArgumentException $erro) {
            $modelo['blocos'] = [];
            $modelo['disponivel'] = false;
        }

        $modelo['assinatura'] = hash('sha256', json_encode([
            $modelo['id'],
            $modelo['codigo'],
            $modelo['nome'],
            $modelo['blocos'],
        ], JSON_THROW_ON_ERROR));

        return $modelo;
    }

    private static function padroes(): array
    {
        $base = [
            [
                'id' => 'titulo',
                'tipo' => 'titulo',
                'texto' => 'Título da matéria',
            ],
            [
                'id' => 'linha-fina',
                'tipo' => 'linha_fina',
                'texto' => 'Uma apresentação breve da matéria.',
            ],
            [
                'id' => 'texto',
                'tipo' => 'texto',
                'texto' => 'Escreva aqui o conteúdo da matéria.',
            ],
            [
                'id' => 'divisor',
                'tipo' => 'divisor',
            ],
            [
                'id' => 'contato',
                'tipo' => 'contato',
                'texto' => "Contato de imprensa\nNome, telefone e e-mail da assessoria.",
            ],
        ];

        $modelos = [
            [
                'codigo' => 'release-simples',
                'nome' => 'Release simples',
                'blocos' => $base,
            ],
            [
                'codigo' => 'release-com-imagem',
                'nome' => 'Release com imagem',
                'blocos' => [
                    [
                        'id' => 'imagem',
                        'tipo' => 'imagem',
                        'texto' => 'Imagem da matéria',
                    ],
                    ...$base,
                ],
            ],
            [
                'codigo' => 'aviso-de-pauta',
                'nome' => 'Aviso de pauta',
                'blocos' => [
                    [
                        'id' => 'titulo',
                        'tipo' => 'titulo',
                        'texto' => 'Título do aviso de pauta',
                    ],
                    [
                        'id' => 'texto',
                        'tipo' => 'texto',
                        'texto' => 'Apresente o evento e os destaques para a imprensa.',
                    ],
                    [
                        'id' => 'servico',
                        'tipo' => 'texto',
                        'texto' => "Serviço\nData e horário\nLocal e endereço\nInformações para participação",
                    ],
                    [
                        'id' => 'divisor',
                        'tipo' => 'divisor',
                    ],
                    [
                        'id' => 'contato',
                        'tipo' => 'contato',
                        'texto' => "Contato de imprensa\nNome, telefone e e-mail da assessoria.",
                    ],
                ],
            ],
        ];

        return array_map(
            static fn(array $modelo) => self::preparar([
                'id' => null,
                'origem' => 'LOGOS',
                ...$modelo,
            ]),
            $modelos
        );
    }

    public static function listar(int $assessoriaId, array $dados = []): array
    {
        $page = self::numero($dados['page'] ?? 1, 'Página');
        $limit = self::numero($dados['limit'] ?? 20, 'Limite');

        if ($limit > 100 || $page > intdiv(PHP_INT_MAX, $limit)) {
            throw new \InvalidArgumentException(
                'Paginação inválida. Use até 100 templates por página.'
            );
        }

        $busca = $dados['busca'] ?? '';
        $origem = $dados['origem'] ?? 'TODOS';

        if (!is_string($busca) || mb_strlen($busca, 'UTF-8') > 150) {
            throw new \InvalidArgumentException('Busca inválida.');
        }

        if (!in_array($origem, ['TODOS', 'LOGOS', 'ASSESSORIA'], true)) {
            throw new \InvalidArgumentException('Origem de template inválida.');
        }

        $busca = trim($busca);

        $padroes = $origem === 'ASSESSORIA'
            ? []
            : array_values(array_filter(
                self::padroes(),
                static fn(array $modelo) => $busca === ''
                    || mb_stripos($modelo['nome'], $busca, 0, 'UTF-8') !== false
            ));

        $db = Connection::get();

        $where = ' WHERE assessoria_id = :assessoria_id AND ativo = 1';
        $parametros = ['assessoria_id' => $assessoriaId];

        if ($busca !== '') {
            $where .= " AND nome LIKE :busca ESCAPE '!'";

            $parametros['busca'] = '%' . strtr($busca, [
                '!' => '!!',
                '%' => '!%',
                '_' => '!_',
            ]) . '%';
        }

        $totalProprios = 0;

        if ($origem !== 'LOGOS') {
            $stmt = $db->prepare(
                'SELECT COUNT(*) FROM templates' . $where
            );
            $stmt->execute($parametros);

            $totalProprios = (int) $stmt->fetchColumn();
        }

        $total = count($padroes) + $totalProprios;
        $offset = ($page - 1) * $limit;
        $templates = array_slice($padroes, $offset, $limit);
        $restantes = $limit - count($templates);

        if ($origem !== 'LOGOS' && $restantes > 0) {
            $stmt = $db->prepare(
                'SELECT id, nome, blocos_json FROM templates' . $where
                . ' ORDER BY nome ASC, id ASC LIMIT :limit OFFSET :offset'
            );

            foreach ($parametros as $nome => $valor) {
                $stmt->bindValue(
                    ':' . $nome,
                    $valor,
                    is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR
                );
            }

            $stmt->bindValue(':limit', $restantes, PDO::PARAM_INT);
            $stmt->bindValue(
                ':offset',
                max(0, $offset - count($padroes)),
                PDO::PARAM_INT
            );
            $stmt->execute();

            foreach ($stmt->fetchAll() as $modelo) {
                $templates[] = self::preparar([
                    'id' => (int) $modelo['id'],
                    'codigo' => null,
                    'nome' => $modelo['nome'],
                    'origem' => 'ASSESSORIA',
                    'blocos' => $modelo['blocos_json'],
                ]);
            }
        }

        return [
            'templates' => $templates,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => $offset + count($templates) < $total,
            ],
        ];
    }

    public static function buscarParaRelease(
        int $assessoriaId,
        ?int $id,
        ?string $codigo,
        string $assinatura
    ): array {
        $modelo = null;

        if ($codigo !== null) {
            foreach (self::padroes() as $padrao) {
                if ($padrao['codigo'] === $codigo) {
                    $modelo = $padrao;
                    break;
                }
            }
        } elseif ($id !== null) {
            $stmt = Connection::get()->prepare('
                SELECT id, nome, blocos_json
                FROM templates
                WHERE id = :id
                  AND assessoria_id = :assessoria_id
                  AND ativo = 1
                LOCK IN SHARE MODE
            ');
            $stmt->execute([
                'id' => $id,
                'assessoria_id' => $assessoriaId,
            ]);

            $linha = $stmt->fetch();

            if ($linha) {
                $modelo = self::preparar([
                    'id' => (int) $linha['id'],
                    'codigo' => null,
                    'nome' => $linha['nome'],
                    'origem' => 'ASSESSORIA',
                    'blocos' => $linha['blocos_json'],
                ]);
            }
        }

        if ($modelo === null) {
            throw new \OutOfBoundsException(
                'Template não encontrado ou indisponível nesta assessoria.'
            );
        }

        if (!$modelo['disponivel']) {
            throw new \InvalidArgumentException(
                'Este template precisa ser revisado antes de ser utilizado.'
            );
        }

        if (!hash_equals($modelo['assinatura'], $assinatura)) {
            throw new \DomainException(
                'O template foi atualizado. Selecione o modelo novamente.'
            );
        }

        return $modelo;
    }
}