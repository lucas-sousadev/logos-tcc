<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;
use PDO;
use PDOStatement;

class RelatorioService
{
    private const SELECT_MATERIA = "
        SELECT
            c.id,
            c.cliente_id,
            c.veiculo_id,
            c.veiculo_nome_informado,
            c.ano_referencia,
            c.data_publicacao,
            c.categorias,
            c.programa_secao,
            c.pauta,
            c.tier,
            c.inicio_segundos,
            c.fim_segundos,
            c.duracao_segundos,
            c.link,
            c.observacoes,
            c.updated_at AS clipping_atualizado_em,
            v.nome AS veiculo_cadastrado_nome,
            v.descricao AS veiculo_descricao,
            v.alcance AS veiculo_alcance,
            v.logo_path AS veiculo_logo_path,
            a.id AS imagem_anexo_id,
            a.arquivo_path AS imagem_path
    ";

    private const ORIGEM = "
        FROM clippings c

        LEFT JOIN veiculos v
            ON v.id = c.veiculo_id
            AND v.assessoria_id = c.assessoria_id

        LEFT JOIN clipping_anexos a
            ON a.clipping_id = c.id
            AND a.assessoria_id = c.assessoria_id
            AND a.imagem_relatorio = 1
    ";

    private static function consultar(
        string $sql,
        array $parametros = []
    ): PDOStatement {
        $stmt = Connection::get()->prepare($sql);

        foreach ($parametros as $nome => $valor) {
            $tipo = $valor === null
                ? PDO::PARAM_NULL
                : (is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR);

            $stmt->bindValue(':' . $nome, $valor, $tipo);
        }

        $stmt->execute();

        return $stmt;
    }

    private static function id(mixed $valor, string $rotulo): int
    {
        if (
            !is_int($valor)
            && (!is_string($valor) || !preg_match('/^[1-9][0-9]*$/D', $valor))
        ) {
            throw new \InvalidArgumentException("{$rotulo} inválido.");
        }

        $id = filter_var(
            $valor,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if ($id === false) {
            throw new \InvalidArgumentException("{$rotulo} inválido.");
        }

        return $id;
    }

    private static function data(mixed $valor, string $rotulo): string
    {
        if (
            !is_string($valor)
            || !preg_match(
                '/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D',
                $valor,
                $partes
            )
            || !checkdate((int) $partes[2], (int) $partes[3], (int) $partes[1])
        ) {
            throw new \InvalidArgumentException(
                "{$rotulo} deve ser uma data válida em AAAA-MM-DD."
            );
        }

        return $valor;
    }

    private static function periodo(array $dados): array
    {
        $inicio = self::data(
            $dados['periodo_inicio'] ?? null,
            'Data inicial'
        );

        $fim = self::data(
            $dados['periodo_fim'] ?? null,
            'Data final'
        );

        if ($inicio > $fim) {
            throw new \InvalidArgumentException(
                'A data inicial não pode ser posterior à data final.'
            );
        }

        return [$inicio, $fim];
    }

    private static function listaIds(mixed $valor, string $rotulo): array
    {
        if (!is_array($valor) || !array_is_list($valor)) {
            throw new \InvalidArgumentException(
                "{$rotulo} deve ser uma lista de IDs."
            );
        }

        if (count($valor) > 10000) {
            throw new \InvalidArgumentException(
                "{$rotulo} ultrapassou o limite de 10.000 itens."
            );
        }

        $unicos = [];

        foreach ($valor as $item) {
            $id = self::id($item, $rotulo);
            $unicos[$id] = $id;
        }

        return array_values($unicos);
    }

    private static function cliente(
        int $assessoriaId,
        int $clienteId
    ): array {
        $cliente = Cliente::buscarPorId($clienteId, $assessoriaId);

        if (!$cliente) {
            throw new \OutOfBoundsException(
                'Cliente não encontrado nesta assessoria.'
            );
        }

        return $cliente;
    }

    private static function condicao(
        int $assessoriaId,
        int $clienteId,
        string $inicio,
        string $fim,
        bool $semData
    ): array {
        $parametros = [
            'assessoria_id' => $assessoriaId,
            'cliente_id' => $clienteId,
        ];

        $where = "
            WHERE c.assessoria_id = :assessoria_id
              AND c.cliente_id = :cliente_id
              AND c.arquivado_em IS NULL
        ";

        if ($semData) {
            $where .= ' AND c.data_publicacao IS NULL';
        } else {
            $where .= "
                AND c.data_publicacao
                    BETWEEN :periodo_inicio AND :periodo_fim
            ";

            $parametros['periodo_inicio'] = $inicio;
            $parametros['periodo_fim'] = $fim;
        }

        return [$where, $parametros];
    }

    private static function prepararMateria(array $linha): array
    {
        $linha['id'] = (int) $linha['id'];
        $linha['cliente_id'] = (int) $linha['cliente_id'];
        $linha['veiculo_id'] = $linha['veiculo_id'] === null
            ? null
            : (int) $linha['veiculo_id'];

        $linha['ano_referencia'] = (int) $linha['ano_referencia'];

        $linha['tier'] = $linha['tier'] === null
            ? null
            : (int) $linha['tier'];

        foreach (
            ['inicio_segundos', 'fim_segundos', 'duracao_segundos']
            as $campo
        ) {
            $linha[$campo] = $linha[$campo] === null
                ? null
                : (int) $linha[$campo];
        }

        $linha['imagem_anexo_id'] = $linha['imagem_anexo_id'] === null
            ? null
            : (int) $linha['imagem_anexo_id'];

        $linha['categorias'] = $linha['categorias'] === null
            ? []
            : json_decode(
                $linha['categorias'],
                true,
                512,
                JSON_THROW_ON_ERROR
            );

        $linha['veiculo_nome'] =
            $linha['veiculo_cadastrado_nome']
            ?? $linha['veiculo_nome_informado'];

        return $linha;
    }

    public static function materias(
        int $assessoriaId,
        array $dados
    ): array {
        $clienteId = self::id(
            $dados['cliente_id'] ?? null,
            'Cliente'
        );

        self::cliente($assessoriaId, $clienteId);

        [$inicio, $fim] = self::periodo($dados);

        $tipo = $dados['tipo'] ?? 'periodo';

        if (!in_array($tipo, ['periodo', 'sem_data'], true)) {
            throw new \InvalidArgumentException(
                'Tipo de consulta inválido.'
            );
        }

        $page = self::id($dados['page'] ?? 1, 'Página');
        $limit = self::id($dados['limit'] ?? 50, 'Limite');

        if ($limit > 100) {
            throw new \InvalidArgumentException(
                'O limite máximo é 100 matérias por página.'
            );
        }

        $busca = $dados['busca'] ?? '';

        if (!is_string($busca) || mb_strlen($busca, 'UTF-8') > 200) {
            throw new \InvalidArgumentException(
                'Busca inválida.'
            );
        }

        $busca = trim($busca);

        [$where, $parametros] = self::condicao(
            $assessoriaId,
            $clienteId,
            $inicio,
            $fim,
            $tipo === 'sem_data'
        );

        if ($busca !== '') {
            $termo = '%' . strtr(
                $busca,
                ['!' => '!!', '%' => '!%', '_' => '!_']
            ) . '%';

            $where .= "
                AND (
                    c.pauta LIKE :busca_pauta ESCAPE '!'
                    OR COALESCE(
                        v.nome,
                        c.veiculo_nome_informado
                    ) LIKE :busca_veiculo ESCAPE '!'
                )
            ";

            $parametros['busca_pauta'] = $termo;
            $parametros['busca_veiculo'] = $termo;
        }

        $total = (int) self::consultar(
            'SELECT COUNT(*) '
                . self::ORIGEM
                . $where,
            $parametros
        )->fetchColumn();

        $offset = ($page - 1) * $limit;

        $linhas = self::consultar(
            self::SELECT_MATERIA
                . self::ORIGEM
                . $where
                . " ORDER BY c.data_publicacao ASC, c.id ASC
                    LIMIT :limit OFFSET :offset",
            [
                ...$parametros,
                'limit' => $limit,
                'offset' => $offset,
            ]
        )->fetchAll();

        [$wherePeriodo, $paramsPeriodo] = self::condicao(
            $assessoriaId,
            $clienteId,
            $inicio,
            $fim,
            false
        );

        [$whereSemData, $paramsSemData] = self::condicao(
            $assessoriaId,
            $clienteId,
            $inicio,
            $fim,
            true
        );

        $totalPeriodo = (int) self::consultar(
            'SELECT COUNT(*) FROM clippings c ' . $wherePeriodo,
            $paramsPeriodo
        )->fetchColumn();

        $totalSemData = (int) self::consultar(
            'SELECT COUNT(*) FROM clippings c ' . $whereSemData,
            $paramsSemData
        )->fetchColumn();

        return [
            'materias' => array_map(
                self::prepararMateria(...),
                $linhas
            ),
            'resumo' => [
                'no_periodo' => $totalPeriodo,
                'sem_data' => $totalSemData,
            ],
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => $offset + count($linhas) < $total,
            ],
        ];
    }

    private static function inserirSlide(
        PDOStatement $stmt,
        int $assessoriaId,
        int $relatorioId,
        int &$ordem,
        array $slide
    ): void {
        $stmt->execute([
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
            'clipping_id' => $slide['clipping_id'] ?? null,
            'ordem' => $ordem++,
            'tipo' => $slide['tipo'],
            'origem_inclusao' => $slide['origem_inclusao'],
            'imagem_anexo_id' => $slide['imagem_anexo_id'] ?? null,
            'titulo' => $slide['titulo'] ?? null,
            'imagem_path' => $slide['imagem_path'] ?? null,
            'link' => $slide['link'] ?? null,
            'observacoes' => $slide['observacoes'] ?? null,
            'dados_json' => json_encode(
                $slide['dados'],
                JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            ),
            'revisao_pendente' => $slide['revisao_pendente'] ?? 0,
        ]);
    }

    private static function slideClipping(
        array $materia,
        array $cliente
    ): array {
        $pauta = $materia['pauta'];

        return [
            'clipping_id' => $materia['id'],
            'tipo' => 'CLIPPING',
            'origem_inclusao' => 'MANUAL',
            'imagem_anexo_id' => $materia['imagem_anexo_id'],
            'imagem_path' => $materia['imagem_path'],

            // o título curto identifica o slide; a pauta completa fica em dados_json
            'titulo' => $pauta === null
                ? null
                : mb_substr($pauta, 0, 255, 'UTF-8'),

            'link' => $materia['link'],
            'observacoes' => $materia['observacoes'],
            'dados' => [
                'cliente' => [
                    'id' => (int) $cliente['id'],
                    'nome' => $cliente['nome'],
                ],
                'clipping' => [
                    'id' => $materia['id'],
                    'ano_referencia' => $materia['ano_referencia'],
                    'data_publicacao' => $materia['data_publicacao'],
                    'categorias' => $materia['categorias'],
                    'programa_secao' => $materia['programa_secao'],
                    'pauta' => $materia['pauta'],
                    'tier' => $materia['tier'],
                    'inicio_segundos' => $materia['inicio_segundos'],
                    'fim_segundos' => $materia['fim_segundos'],
                    'duracao_segundos' => $materia['duracao_segundos'],
                    'link' => $materia['link'],
                    'observacoes' => $materia['observacoes'],
                    'atualizado_em' =>
                        $materia['clipping_atualizado_em'],
                ],
                'veiculo' => [
                    'id' => $materia['veiculo_id'],
                    'nome' => $materia['veiculo_nome'],
                    'nome_informado' =>
                        $materia['veiculo_nome_informado'],
                    'descricao' => $materia['veiculo_descricao'],
                    'alcance' => $materia['veiculo_alcance'],
                    'logo_path' => $materia['veiculo_logo_path'],
                ],
                'imagem' => [
                    'anexo_id' => $materia['imagem_anexo_id'],
                    'arquivo_path' => $materia['imagem_path'],
                ],
            ],
        ];
    }

    private static function bloquearCliente(
        int $assessoriaId,
        int $clienteId
    ): array {
        $cliente = self::consultar(
            "
                SELECT id, nome
                FROM clientes
                WHERE id = :cliente_id
                AND assessoria_id = :assessoria_id
                LIMIT 1
                FOR UPDATE
            ",
            [
                'cliente_id' => $clienteId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetch();

        if (!$cliente) {
            throw new \OutOfBoundsException(
                'Cliente não encontrado nesta assessoria.'
            );
        }

        return $cliente;
    }

    public static function sincronizarNovoClipping(
        int $assessoriaId,
        int $clippingId
    ): array {
        $db = Connection::get();

        if (!$db->inTransaction()) {
            throw new \LogicException(
                'A inclusão em relatórios exige a transação do clipping.'
            );
        }

        $linha = self::consultar(
            self::SELECT_MATERIA
                . self::ORIGEM
                . "
                    WHERE c.id = :clipping_id
                    AND c.assessoria_id = :assessoria_id
                    AND c.arquivado_em IS NULL
                    LIMIT 1
                ",
            [
                'clipping_id' => $clippingId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetch();

        if (!$linha) {
            throw new \OutOfBoundsException(
                'Clipping não encontrado para inclusão no relatório.'
            );
        }

        $materia = self::prepararMateria($linha);

        // sem data exata não há como comparar com o período do relatório
        if ($materia['data_publicacao'] === null) {
            return [
                'total_relatorios' => 0,
                'relatorio_ids' => [],
            ];
        }

        $cliente = self::cliente(
            $assessoriaId,
            $materia['cliente_id']
        );

        // bloqueia os relatórios para duas inclusões simultâneas
        // não criarem o mesmo slide duas vezes
        $relatorios = self::consultar(
            "
                SELECT r.id
                FROM relatorios r
                WHERE r.assessoria_id = :assessoria_id
                AND r.cliente_id = :cliente_id
                AND r.inclusao_automatica = 1
                AND :data_publicacao
                        BETWEEN r.periodo_inicio AND r.periodo_fim
                ORDER BY r.id ASC
                FOR UPDATE
            ",
            [
                'assessoria_id' => $assessoriaId,
                'cliente_id' => $materia['cliente_id'],
                'data_publicacao' => $materia['data_publicacao'],
            ]
        )->fetchAll();

        if ($relatorios === []) {
            return [
                'total_relatorios' => 0,
                'relatorio_ids' => [],
            ];
        }

        $stmtSlide = $db->prepare(
            "
                INSERT INTO relatorio_slides (
                    relatorio_id,
                    assessoria_id,
                    clipping_id,
                    ordem,
                    tipo,
                    origem_inclusao,
                    revisao_pendente,
                    imagem_anexo_id,
                    titulo,
                    imagem_path,
                    link,
                    observacoes,
                    dados_json
                )
                VALUES (
                    :relatorio_id,
                    :assessoria_id,
                    :clipping_id,
                    :ordem,
                    :tipo,
                    :origem_inclusao,
                    :revisao_pendente,
                    :imagem_anexo_id,
                    :titulo,
                    :imagem_path,
                    :link,
                    :observacoes,
                    :dados_json
                )
            "
        );

        $incluidos = [];

        foreach ($relatorios as $relatorio) {
            $relatorioId = (int) $relatorio['id'];

            $vinculos = self::consultar(
                "
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM relatorio_slides s
                            WHERE s.relatorio_id = :relatorio_slide
                            AND s.assessoria_id = :assessoria_slide
                            AND s.clipping_id = :clipping_slide
                            AND s.tipo = 'CLIPPING'
                        ) AS total_slides,
                        (
                            SELECT COUNT(*)
                            FROM relatorio_clippings_excluidos e
                            WHERE e.relatorio_id = :relatorio_exclusao
                            AND e.assessoria_id = :assessoria_exclusao
                            AND e.clipping_id = :clipping_exclusao
                        ) AS total_exclusoes
                ",
                [
                    'relatorio_slide' => $relatorioId,
                    'assessoria_slide' => $assessoriaId,
                    'clipping_slide' => $clippingId,
                    'relatorio_exclusao' => $relatorioId,
                    'assessoria_exclusao' => $assessoriaId,
                    'clipping_exclusao' => $clippingId,
                ]
            )->fetch();

            if (
                (int) $vinculos['total_slides'] > 0
                || (int) $vinculos['total_exclusoes'] > 0
            ) {
                continue;
            }

            $ultimaOrdem = (int) self::consultar(
                "
                    SELECT COALESCE(MAX(ordem), 0)
                    FROM relatorio_slides
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchColumn();

            $encerramento = self::consultar(
                "
                    SELECT id, ordem
                    FROM relatorio_slides
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    AND tipo = 'ENCERRAMENTO'
                    ORDER BY ordem DESC
                    LIMIT 1
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetch();

            if ($encerramento) {
                if ((int) $encerramento['ordem'] !== $ultimaOrdem) {
                    throw new \DomainException(
                        'A ordem dos slides do relatório precisa ser revisada.'
                    );
                }

                // libera a posição anterior ao encerramento
                self::consultar(
                    "
                        UPDATE relatorio_slides
                        SET ordem = :nova_ordem
                        WHERE id = :slide_id
                        AND relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                    ",
                    [
                        'nova_ordem' => $ultimaOrdem + 1,
                        'slide_id' => (int) $encerramento['id'],
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                    ]
                );

                $ordemNova = $ultimaOrdem;
            } else {
                $ordemNova = $ultimaOrdem + 1;
            }

            $slide = self::slideClipping($materia, $cliente);
            $slide['origem_inclusao'] = 'AUTOMATICA';
            $slide['revisao_pendente'] = 1;

            self::inserirSlide(
                $stmtSlide,
                $assessoriaId,
                $relatorioId,
                $ordemNova,
                $slide
            );

            $incluidos[] = $relatorioId;
        }

        return [
            'total_relatorios' => count($incluidos),
            'relatorio_ids' => $incluidos,
        ];
    }

    public static function criar(
        int $assessoriaId,
        int $usuarioId,
        array $dados
    ): array {
        $clienteId = self::id(
            $dados['cliente_id'] ?? null,
            'Cliente'
        );

        [$inicio, $fim] = self::periodo($dados);

        $titulo = $dados['titulo'] ?? null;

        if (
            !is_string($titulo)
            || trim($titulo) === ''
            || mb_strlen(trim($titulo), 'UTF-8') > 200
        ) {
            throw new \InvalidArgumentException(
                'Informe um título com até 200 caracteres.'
            );
        }

        $titulo = trim($titulo);

        $inclusaoAutomatica =
            $dados['inclusao_automatica'] ?? true;

        if (!is_bool($inclusaoAutomatica)) {
            throw new \InvalidArgumentException(
                'Inclusão automática deve ser verdadeira ou falsa.'
            );
        }

        $idsExcluidos = self::listaIds(
            $dados['ids_excluidos'] ?? [],
            'Matérias desmarcadas'
        );

        $idsSemData = self::listaIds(
            $dados['ids_sem_data_incluidos'] ?? [],
            'Matérias sem data escolhidas'
        );

        $db = Connection::get();
        $db->beginTransaction();

        try {
            $cliente = self::bloquearCliente(
                $assessoriaId,
                $clienteId
            );

            [$wherePeriodo, $paramsPeriodo] = self::condicao(
                $assessoriaId,
                $clienteId,
                $inicio,
                $fim,
                false
            );

            $materiasPeriodo = array_map(
                self::prepararMateria(...),
                self::consultar(
                    self::SELECT_MATERIA
                        . self::ORIGEM
                        . $wherePeriodo
                        . ' ORDER BY c.data_publicacao ASC, c.id ASC',
                    $paramsPeriodo
                )->fetchAll()
            );

            $idsDoPeriodo = [];

            foreach ($materiasPeriodo as $materia) {
                $idsDoPeriodo[$materia['id']] = true;
            }

            foreach ($idsExcluidos as $id) {
                if (!isset($idsDoPeriodo[$id])) {
                    throw new \InvalidArgumentException(
                        'Uma matéria desmarcada saiu do período. Revise a seleção.'
                    );
                }
            }

            $materiasSemData = [];

            if ($idsSemData !== []) {
                [$whereSemData, $paramsSemData] =
                    self::condicao(
                        $assessoriaId,
                        $clienteId,
                        $inicio,
                        $fim,
                        true
                    );

                $marcadores = [];

                foreach ($idsSemData as $indice => $id) {
                    $chave = 'sem_data_' . $indice;
                    $marcadores[] = ':' . $chave;
                    $paramsSemData[$chave] = $id;
                }

                $linhas = self::consultar(
                    self::SELECT_MATERIA
                        . self::ORIGEM
                        . $whereSemData
                        . ' AND c.id IN ('
                        . implode(', ', $marcadores)
                        . ') ORDER BY c.id ASC',
                    $paramsSemData
                )->fetchAll();

                foreach ($linhas as $linha) {
                    $materia = self::prepararMateria($linha);
                    $materiasSemData[$materia['id']] = $materia;
                }

                foreach ($idsSemData as $id) {
                    if (!isset($materiasSemData[$id])) {
                        throw new \InvalidArgumentException(
                            'Uma matéria sem data não está mais disponível. Revise a seleção.'
                        );
                    }
                }
            }

            self::consultar(
                "
                    INSERT INTO relatorios (
                        assessoria_id,
                        cliente_id,
                        criado_por,
                        titulo,
                        periodo_inicio,
                        periodo_fim,
                        inclusao_automatica
                    )
                    VALUES (
                        :assessoria_id,
                        :cliente_id,
                        :criado_por,
                        :titulo,
                        :periodo_inicio,
                        :periodo_fim,
                        :inclusao_automatica
                    )
                ",
                [
                    'assessoria_id' => $assessoriaId,
                    'cliente_id' => $clienteId,
                    'criado_por' => $usuarioId,
                    'titulo' => $titulo,
                    'periodo_inicio' => $inicio,
                    'periodo_fim' => $fim,
                    'inclusao_automatica' =>
                        $inclusaoAutomatica ? 1 : 0,
                ]
            );

            $relatorioId = (int) $db->lastInsertId();

            $stmtSlide = $db->prepare(
                "
                    INSERT INTO relatorio_slides (
                        relatorio_id,
                        assessoria_id,
                        clipping_id,
                        ordem,
                        tipo,
                        origem_inclusao,
                        revisao_pendente,
                        imagem_anexo_id,
                        titulo,
                        imagem_path,
                        link,
                        observacoes,
                        dados_json
                    )
                    VALUES (
                        :relatorio_id,
                        :assessoria_id,
                        :clipping_id,
                        :ordem,
                        :tipo,
                        :origem_inclusao,
                        :revisao_pendente,
                        :imagem_anexo_id,
                        :titulo,
                        :imagem_path,
                        :link,
                        :observacoes,
                        :dados_json
                    )
                "
            );

            $ordem = 1;
            $base = [
                'cliente' => [
                    'id' => $clienteId,
                    'nome' => $cliente['nome'],
                ],
                'periodo' => [
                    'inicio' => $inicio,
                    'fim' => $fim,
                ],
            ];

            self::inserirSlide(
                $stmtSlide,
                $assessoriaId,
                $relatorioId,
                $ordem,
                [
                    'tipo' => 'CAPA',
                    'origem_inclusao' => 'ESTRUTURA',
                    'titulo' => $titulo,
                    'dados' => $base,
                ]
            );

            $excluidos = array_fill_keys($idsExcluidos, true);
            $totalMaterias = 0;

            foreach ($materiasPeriodo as $materia) {
                if (isset($excluidos[$materia['id']])) {
                    continue;
                }

                self::inserirSlide(
                    $stmtSlide,
                    $assessoriaId,
                    $relatorioId,
                    $ordem,
                    self::slideClipping($materia, $cliente)
                );

                $totalMaterias++;
            }

            foreach ($idsSemData as $id) {
                self::inserirSlide(
                    $stmtSlide,
                    $assessoriaId,
                    $relatorioId,
                    $ordem,
                    self::slideClipping(
                        $materiasSemData[$id],
                        $cliente
                    )
                );

                $totalMaterias++;
            }

            self::inserirSlide(
                $stmtSlide,
                $assessoriaId,
                $relatorioId,
                $ordem,
                [
                    'tipo' => 'ENCERRAMENTO',
                    'origem_inclusao' => 'ESTRUTURA',
                    'titulo' => 'Encerramento',
                    'dados' => $base,
                ]
            );

            if ($idsExcluidos !== []) {
                $stmtExclusao = $db->prepare(
                    "
                        INSERT INTO relatorio_clippings_excluidos (
                            relatorio_id,
                            assessoria_id,
                            clipping_id,
                            excluido_por
                        )
                        VALUES (
                            :relatorio_id,
                            :assessoria_id,
                            :clipping_id,
                            :excluido_por
                        )
                    "
                );

                foreach ($idsExcluidos as $id) {
                    $stmtExclusao->execute([
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                        'clipping_id' => $id,
                        'excluido_por' => $usuarioId,
                    ]);
                }
            }

            $db->commit();

            return [
                'id' => $relatorioId,
                'cliente_id' => $clienteId,
                'titulo' => $titulo,
                'periodo_inicio' => $inicio,
                'periodo_fim' => $fim,
                'inclusao_automatica' => $inclusaoAutomatica,
                'total_materias' => $totalMaterias,
                'total_sem_data_incluidas' => count($idsSemData),
                'total_desmarcadas' => count($idsExcluidos),
            ];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }

    public static function listar(
        int $assessoriaId,
        array $dados
    ): array {
        $page = self::id($dados['page'] ?? 1, 'Página');
        $limit = self::id($dados['limit'] ?? 20, 'Limite');

        if ($limit > 100) {
            throw new \InvalidArgumentException(
                'O limite máximo é 100 relatórios por página.'
            );
        }

        $busca = $dados['busca'] ?? '';

        if (!is_string($busca) || mb_strlen($busca, 'UTF-8') > 200) {
            throw new \InvalidArgumentException('Busca inválida.');
        }

        $busca = trim($busca);

        $where = 'WHERE r.assessoria_id = :assessoria_id';
        $parametros = ['assessoria_id' => $assessoriaId];

        if (
            isset($dados['cliente_id'])
            && $dados['cliente_id'] !== ''
        ) {
            $where .= ' AND r.cliente_id = :cliente_id';
            $parametros['cliente_id'] = self::id(
                $dados['cliente_id'],
                'Cliente'
            );
        }

        if (isset($dados['ano']) && $dados['ano'] !== '') {
            $ano = self::id($dados['ano'], 'Ano');

            if ($ano < 1000 || $ano > 9999) {
                throw new \InvalidArgumentException('Ano inválido.');
            }

            // inclui relatórios cujo período cruza esse ano
            $where .= "
                AND r.periodo_inicio <= :fim_ano
                AND r.periodo_fim >= :inicio_ano
            ";

            $parametros['inicio_ano'] = $ano . '-01-01';
            $parametros['fim_ano'] = $ano . '-12-31';
        }

        $inclusao = $dados['inclusao'] ?? 'todas';

        if (!in_array(
            $inclusao,
            ['todas', 'ativa', 'pausada'],
            true
        )) {
            throw new \InvalidArgumentException(
                'Filtro de inclusão automática inválido.'
            );
        }

        if ($inclusao !== 'todas') {
            $where .= ' AND r.inclusao_automatica = :inclusao';
            $parametros['inclusao'] =
                $inclusao === 'ativa' ? 1 : 0;
        }

        $pendencias = $dados['pendencias'] ?? 'todas';

        if (!in_array(
            $pendencias,
            ['todas', 'com', 'sem'],
            true
        )) {
            throw new \InvalidArgumentException(
                'Filtro de revisão inválido.'
            );
        }

        if ($pendencias !== 'todas') {
            $existePendente = "
                EXISTS (
                    SELECT 1
                    FROM relatorio_slides pendente
                    WHERE pendente.relatorio_id = r.id
                    AND pendente.assessoria_id = r.assessoria_id
                    AND pendente.origem_inclusao = 'AUTOMATICA'
                    AND pendente.revisao_pendente = 1
                )
            ";

            $where .= $pendencias === 'com'
                ? " AND {$existePendente}"
                : " AND NOT {$existePendente}";
        }

        $ordem = $dados['ordem'] ?? 'recentes';

        $ordenacaoSql = match ($ordem) {
            'recentes' => 'r.created_at DESC, r.id DESC',
            'antigos' => 'r.created_at ASC, r.id ASC',
            'mais_materias' =>
                'total_materias DESC, r.created_at DESC, r.id DESC',

            default => throw new \InvalidArgumentException(
                'Ordenação inválida.'
            ),
        };

        if ($busca !== '') {
            $termo = '%' . strtr(
                $busca,
                ['!' => '!!', '%' => '!%', '_' => '!_']
            ) . '%';

            $where .= "
                AND (
                    r.titulo LIKE :busca_titulo ESCAPE '!'
                    OR cl.nome LIKE :busca_cliente ESCAPE '!'
                )
            ";

            $parametros['busca_titulo'] = $termo;
            $parametros['busca_cliente'] = $termo;
        }

        $origem = "
            FROM relatorios r
            INNER JOIN clientes cl
                ON cl.id = r.cliente_id
                AND cl.assessoria_id = r.assessoria_id
        ";

        $total = (int) self::consultar(
            'SELECT COUNT(*) ' . $origem . $where,
            $parametros
        )->fetchColumn();

        $offset = ($page - 1) * $limit;

        $relatorios = self::consultar(
            "
                SELECT
                    r.id,
                    r.cliente_id,
                    cl.nome AS cliente_nome,
                    r.titulo,
                    r.periodo_inicio,
                    r.periodo_fim,
                    r.inclusao_automatica,
                    r.created_at,
                    r.updated_at,
                    (
                        SELECT COUNT(*)
                        FROM relatorio_slides s
                        WHERE s.relatorio_id = r.id
                        AND s.assessoria_id = r.assessoria_id
                        AND s.tipo = 'CLIPPING'
                    ) AS total_materias,
                    (
                        SELECT COUNT(*)
                        FROM relatorio_slides s
                        WHERE s.relatorio_id = r.id
                        AND s.assessoria_id = r.assessoria_id
                        AND s.origem_inclusao = 'AUTOMATICA'
                        AND s.revisao_pendente = 1
                    ) AS novos_pendentes
            "
                . $origem
                . $where
                . "
                    ORDER BY {$ordenacaoSql}
                    LIMIT :limit OFFSET :offset
                ",
            [
                ...$parametros,
                'limit' => $limit,
                'offset' => $offset,
            ]
        )->fetchAll();

        foreach ($relatorios as &$relatorio) {
            $relatorio['id'] = (int) $relatorio['id'];
            $relatorio['cliente_id'] =
                (int) $relatorio['cliente_id'];

            $relatorio['inclusao_automatica'] =
                (bool) $relatorio['inclusao_automatica'];

            $relatorio['total_materias'] =
                (int) $relatorio['total_materias'];

            $relatorio['novos_pendentes'] =
                (int) $relatorio['novos_pendentes'];
        }

        unset($relatorio);

        return [
            'relatorios' => $relatorios,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => $offset + count($relatorios) < $total,
            ],
        ];
    }

    public static function buscar(
        int $assessoriaId,
        mixed $valorId,
        array $dados
    ): array {
        $relatorioId = self::id(
            $valorId,
            'Relatório'
        );

        $page = self::id(
            $dados['page'] ?? 1,
            'Página'
        );

        $limit = self::id(
            $dados['limit'] ?? 20,
            'Limite'
        );

        if ($limit > 100) {
            throw new \InvalidArgumentException(
                'O limite máximo é 100 slides por página.'
            );
        }

        $relatorio = self::consultar(
            "
                SELECT
                    r.id,
                    r.cliente_id,
                    cl.nome AS cliente_nome,
                    r.criado_por,
                    r.titulo,
                    r.periodo_inicio,
                    r.periodo_fim,
                    r.inclusao_automatica,
                    r.modelo_codigo,
                    r.modelo_versao,
                    r.configuracao_json,
                    r.created_at,
                    r.updated_at,
                    (
                        SELECT COUNT(*)
                        FROM relatorio_slides s
                        WHERE s.relatorio_id = r.id
                        AND s.assessoria_id = r.assessoria_id
                        AND s.tipo = 'CLIPPING'
                    ) AS total_materias,
                    (
                        SELECT COUNT(*)
                        FROM relatorio_slides s
                        WHERE s.relatorio_id = r.id
                        AND s.assessoria_id = r.assessoria_id
                        AND s.origem_inclusao = 'AUTOMATICA'
                        AND s.revisao_pendente = 1
                    ) AS novos_pendentes
                FROM relatorios r
                INNER JOIN clientes cl
                    ON cl.id = r.cliente_id
                    AND cl.assessoria_id = r.assessoria_id
                WHERE r.id = :relatorio_id
                AND r.assessoria_id = :assessoria_id
                LIMIT 1
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetch();

        if (!$relatorio) {
            throw new \OutOfBoundsException(
                'Relatório não encontrado nesta assessoria.'
            );
        }

        $relatorio['id'] = (int) $relatorio['id'];
        $relatorio['cliente_id'] =
            (int) $relatorio['cliente_id'];

        $relatorio['criado_por'] =
            (int) $relatorio['criado_por'];

        $relatorio['inclusao_automatica'] =
            (bool) $relatorio['inclusao_automatica'];

        $relatorio['modelo_versao'] =
            (int) $relatorio['modelo_versao'];

        $relatorio['total_materias'] =
            (int) $relatorio['total_materias'];

        $relatorio['novos_pendentes'] =
            (int) $relatorio['novos_pendentes'];

        $relatorio['configuracao_json'] =
            $relatorio['configuracao_json'] === null
                ? null
                : json_decode(
                    $relatorio['configuracao_json'],
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );

        $totalSlides = (int) self::consultar(
            "
                SELECT COUNT(*)
                FROM relatorio_slides
                WHERE relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetchColumn();

        $offset = ($page - 1) * $limit;

        $slides = self::consultar(
            "
                SELECT
                    id,
                    clipping_id,
                    ordem,
                    tipo,
                    origem_inclusao,
                    revisao_pendente,
                    imagem_anexo_id,
                    titulo,
                    imagem_path,
                    link,
                    observacoes,
                    dados_json,
                    edicoes_json,
                    created_at,
                    updated_at
                FROM relatorio_slides
                WHERE relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
                ORDER BY ordem ASC
                LIMIT :limit OFFSET :offset
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
                'limit' => $limit,
                'offset' => $offset,
            ]
        )->fetchAll();

        foreach ($slides as &$slide) {
            $slide['id'] = (int) $slide['id'];
            $slide['ordem'] = (int) $slide['ordem'];

            $slide['clipping_id'] =
                $slide['clipping_id'] === null
                    ? null
                    : (int) $slide['clipping_id'];

            $slide['imagem_anexo_id'] =
                $slide['imagem_anexo_id'] === null
                    ? null
                    : (int) $slide['imagem_anexo_id'];

            $slide['revisao_pendente'] =
                (bool) $slide['revisao_pendente'];

            foreach (['dados_json', 'edicoes_json'] as $campo) {
                $slide[$campo] =
                    $slide[$campo] === null
                        ? null
                        : json_decode(
                            $slide[$campo],
                            true,
                            512,
                            JSON_THROW_ON_ERROR
                        );
            }
        }

        unset($slide);

        return [
            'relatorio' => $relatorio,
            'slides' => $slides,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalSlides,
                'has_next' => $offset + count($slides) < $totalSlides,
            ],
        ];
    }

}