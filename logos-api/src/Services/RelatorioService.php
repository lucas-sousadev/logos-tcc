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

    public static function clientesParaSelecao(
        int $assessoriaId,
        array $dados
    ): array {
        $page = self::id($dados['page'] ?? 1, 'Página');
        $limit = self::id($dados['limit'] ?? 50, 'Limite');

        if ($limit > 100) {
            throw new \InvalidArgumentException(
                'O limite máximo é 100 clientes por página.'
            );
        }

        $busca = $dados['busca'] ?? '';

        if (!is_string($busca) || mb_strlen($busca, 'UTF-8') > 150) {
            throw new \InvalidArgumentException('Busca inválida.');
        }

        $busca = trim($busca);
        $where = ' WHERE assessoria_id = :assessoria_id';
        $parametros = ['assessoria_id' => $assessoriaId];

        if ($busca !== '') {
            $termo = '%' . strtr(
                $busca,
                ['!' => '!!', '%' => '!%', '_' => '!_']
            ) . '%';

            $where .= " AND nome LIKE :busca ESCAPE '!'";
            $parametros['busca'] = $termo;
        }

        $total = (int) self::consultar(
            'SELECT COUNT(*) FROM clientes' . $where,
            $parametros
        )->fetchColumn();

        $offset = ($page - 1) * $limit;

        $clientes = self::consultar(
            'SELECT id, nome, ativo FROM clientes'
                . $where
                . ' ORDER BY nome ASC, id ASC'
                . ' LIMIT :limit OFFSET :offset',
            [
                ...$parametros,
                'limit' => $limit,
                'offset' => $offset,
            ]
        )->fetchAll();

        foreach ($clientes as &$cliente) {
            $cliente['id'] = (int) $cliente['id'];
            $cliente['ativo'] = (int) $cliente['ativo'];
        }
        unset($cliente);

        return [
            'clientes' => $clientes,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => $offset + count($clientes) < $total,
            ],
        ];
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

        if ($slide['tipo'] !== 'CLIPPING') {
            return;
        }

        $slideId = (int) Connection::get()->lastInsertId();
        $logoPath = $slide['dados']['veiculo']['logo_path'] ?? null;

        $logoMidiaId = RelatorioMidiaService::copiarLogo(
            $assessoriaId,
            $relatorioId,
            is_string($logoPath) ? $logoPath : null
        );

        $imagemMidiaId = RelatorioMidiaService::copiarImagem(
            $assessoriaId,
            $relatorioId,
            (int) $slide['clipping_id'],
            $slide['imagem_path'] ?? null
        );

        if ($logoMidiaId !== null || $imagemMidiaId !== null) {
            self::consultar(
                "
                    UPDATE relatorio_slides
                    SET logo_midia_id = :logo_midia_id,
                        imagem_midia_id = :imagem_midia_id
                    WHERE id = :slide_id
                    AND relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'logo_midia_id' => $logoMidiaId,
                    'imagem_midia_id' => $imagemMidiaId,
                    'slide_id' => $slideId,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );
        }
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
                    AND (
                        pendente.revisao_pendente = 1
                        OR EXISTS (
                            SELECT 1
                            FROM relatorio_slide_revisoes rv
                            WHERE rv.slide_id = pendente.id
                            AND rv.assinatura_atual
                                <> rv.assinatura_reconhecida
                        )
                    )
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
                    ) AS novos_pendentes,
                    (
                        SELECT COUNT(*)
                        FROM relatorio_slides s
                        WHERE s.relatorio_id = r.id
                        AND s.assessoria_id = r.assessoria_id
                        AND (
                            s.revisao_pendente = 1
                            OR EXISTS (
                                SELECT 1
                                FROM relatorio_slide_revisoes rv
                                WHERE rv.slide_id = s.id
                                AND rv.assinatura_atual
                                    <> rv.assinatura_reconhecida
                            )
                        )
                    ) AS total_pendentes
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
            $relatorio['total_pendentes'] =
                (int) $relatorio['total_pendentes'];
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

    private static function valoresOrigem(
        array $dados,
        string $origem
    ): array {
        $clipping = $dados['clipping'] ?? [];
        $veiculo = $dados['veiculo'] ?? [];
        $imagem = $dados['imagem'] ?? [];

        if ($origem === 'VEICULO') {
            return [
                'id' => $veiculo['id'] ?? null,
                'nome' => $veiculo['nome'] ?? null,
                'descricao' => $veiculo['descricao'] ?? null,
                'alcance' => $veiculo['alcance'] ?? null,
                'logo_path' => $veiculo['logo_path'] ?? null,
            ];
        }

        return [
            'cliente_id' => $dados['cliente']['id'] ?? null,
            'id' => $clipping['id'] ?? null,
            'veiculo_id' => $veiculo['id'] ?? null,
            'veiculo_nome_informado' => $veiculo['nome_informado'] ?? null,
            'ano_referencia' => $clipping['ano_referencia'] ?? null,
            'data_publicacao' => $clipping['data_publicacao'] ?? null,
            'categorias' => $clipping['categorias'] ?? [],
            'programa_secao' => $clipping['programa_secao'] ?? null,
            'pauta' => $clipping['pauta'] ?? null,
            'tier' => $clipping['tier'] ?? null,
            'inicio_segundos' => $clipping['inicio_segundos'] ?? null,
            'fim_segundos' => $clipping['fim_segundos'] ?? null,
            'duracao_segundos' => $clipping['duracao_segundos'] ?? null,
            'link' => $clipping['link'] ?? null,
            'observacoes' => $clipping['observacoes'] ?? null,
            'imagem_anexo_id' => $imagem['anexo_id'] ?? null,
            'imagem_path' => $imagem['arquivo_path'] ?? null,
        ];
    }

    private static function assinaturaOrigem(
        array $dados,
        string $origem
    ): string {
        return hash(
            'sha256',
            json_encode(
                self::valoresOrigem($dados, $origem),
                JSON_UNESCAPED_UNICODE
                    | JSON_UNESCAPED_SLASHES
                    | JSON_THROW_ON_ERROR
            )
        );
    }

    private static function registrarRevisoes(
        int $assessoriaId,
        int $relatorioId
    ): array {
        $slides = self::consultar(
            "
                SELECT id, clipping_id, dados_json
                FROM relatorio_slides
                WHERE relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
                AND tipo = 'CLIPPING'
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetchAll();

        if (!$slides) {
            return [
                'campos' => [],
                'valores' => [],
                'tokens' => [],
                'atuais' => [],
            ];
        }
        
        $ids = array_values(array_unique(array_map(
            'intval',
            array_column($slides, 'clipping_id')
        )));

        $parametros = ['assessoria_id' => $assessoriaId];
        $marcadores = [];

        foreach ($ids as $indice => $id) {
            $nome = 'clipping_' . $indice;
            $marcadores[] = ':' . $nome;
            $parametros[$nome] = $id;
        }

        $linhas = self::consultar(
            self::SELECT_MATERIA
                . self::ORIGEM
                . ' WHERE c.assessoria_id = :assessoria_id'
                . ' AND c.id IN (' . implode(', ', $marcadores) . ')',
            $parametros
        )->fetchAll();

        $atuais = [];
        $historico = [];

        $revisoes = self::consultar(
            "
                SELECT
                    slide_id,
                    origem,
                    assinatura_reconhecida
                FROM relatorio_slide_revisoes
                WHERE relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetchAll();

        foreach ($revisoes as $revisao) {
            $historico[(int) $revisao['slide_id']][$revisao['origem']] =
                $revisao;
        }

        foreach ($linhas as $linha) {
            $materia = self::prepararMateria($linha);

            $atuais[$materia['id']] = self::slideClipping(
                $materia,
                [
                    'id' => $materia['cliente_id'],
                    'nome' => '',
                ]
            )['dados'];
        }

        $registrar = Connection::get()->prepare(
            "
                INSERT INTO relatorio_slide_revisoes (
                    slide_id,
                    relatorio_id,
                    assessoria_id,
                    origem,
                    assinatura_reconhecida,
                    assinatura_atual,
                    dados_reconhecidos_json
                ) VALUES (
                    :slide_id,
                    :relatorio_id,
                    :assessoria_id,
                    :origem,
                    :assinatura_reconhecida,
                    :assinatura_atual,
                    :dados_reconhecidos_json
                )
                ON DUPLICATE KEY UPDATE
                    assinatura_reconhecida = CASE
                    WHEN VALUES(assinatura_atual) = VALUES(assinatura_reconhecida)
                        THEN VALUES(assinatura_reconhecida)
                    ELSE assinatura_reconhecida
                END,
                assinatura_atual = VALUES(assinatura_atual),
                dados_reconhecidos_json = CASE
                    WHEN VALUES(assinatura_atual) = VALUES(assinatura_reconhecida)
                        THEN VALUES(dados_reconhecidos_json)
                    ELSE COALESCE(
                        dados_reconhecidos_json,
                        VALUES(dados_reconhecidos_json)
                    )
                END
            "
        );

        $camposAlterados = [];
        $novosValores = [];
        $tokens = [];

        foreach ($slides as $slide) {
            $slideId = (int) $slide['id'];
            $atual = $atuais[(int) $slide['clipping_id']] ?? null;

            if ($atual === null) {
                continue;
            }
            
            $assinaturas = [];

            $salvo = json_decode(
                $slide['dados_json'] ?? '{}',
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            foreach (['VEICULO', 'CLIPPING'] as $origem) {
                $valoresSalvos = self::valoresOrigem($salvo, $origem);
                $valoresAtuais = self::valoresOrigem($atual, $origem);
                $registro = $historico[$slideId][$origem] ?? null;

                $assinaturaSalva = self::assinaturaOrigem($salvo, $origem);

                $assinaturaReconhecida = $registro === null
                    ? $assinaturaSalva
                    : $registro['assinatura_reconhecida'];

                $assinaturaAtual = self::assinaturaOrigem($atual, $origem);
                $chave = strtolower($origem);
                $assinaturas[$chave] = $assinaturaAtual;
                $camposAlterados[$slideId][$chave] = [];
                $novosValores[$slideId][$chave] = [];

                if ($assinaturaAtual === $assinaturaSalva) {
                    $assinaturaReconhecida = $assinaturaAtual;
                }

                if ($assinaturaAtual !== $assinaturaReconhecida) {
                    foreach ($valoresAtuais as $campo => $valor) {
                        if (($valoresSalvos[$campo] ?? null) !== $valor) {
                            $camposAlterados[$slideId][$chave][] = $campo;
                            $novosValores[$slideId][$chave][$campo] = $valor;
                        }
                    }
                }

                $registrar->execute([
                    'slide_id' => $slideId,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                    'origem' => $origem,
                    'assinatura_reconhecida' =>
                        self::assinaturaOrigem($salvo, $origem),
                    'assinatura_atual' => $assinaturaAtual,
                    'dados_reconhecidos_json' => json_encode(
                        $valoresSalvos,
                        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
                    ),
                ]);
            }
            $tokens[$slideId] = hash(
                'sha256',
                $slideId . '|'
                . $assinaturas['veiculo'] . '|'
                . $assinaturas['clipping']
            );
        }

        return [
            'campos' => $camposAlterados,
            'valores' => $novosValores,
            'tokens' => $tokens,
            'atuais' => $atuais,
        ];
    }

    public static function atualizarRevisoesDoClipping(
        int $assessoriaId,
        int $clippingId
    ): void {
        $ids = self::consultar(
            "
                SELECT DISTINCT relatorio_id
                FROM relatorio_slides
                WHERE assessoria_id = :assessoria_id
                AND clipping_id = :clipping_id
                AND tipo = 'CLIPPING'
            ",
            [
                'assessoria_id' => $assessoriaId,
                'clipping_id' => $clippingId,
            ]
        )->fetchAll(PDO::FETCH_COLUMN);

        foreach ($ids as $relatorioId) {
            self::registrarRevisoes(
                $assessoriaId,
                (int) $relatorioId
            );
        }
    }

    public static function atualizarRevisoesDoVeiculo(
        int $assessoriaId,
        int $veiculoId
    ): void {
        $ids = self::consultar(
            "
                SELECT DISTINCT s.relatorio_id
                FROM relatorio_slides s
                INNER JOIN clippings c
                    ON c.id = s.clipping_id
                    AND c.assessoria_id = s.assessoria_id
                WHERE s.assessoria_id = :assessoria_id
                AND s.tipo = 'CLIPPING'
                AND c.veiculo_id = :veiculo_id
            ",
            [
                'assessoria_id' => $assessoriaId,
                'veiculo_id' => $veiculoId,
            ]
        )->fetchAll(PDO::FETCH_COLUMN);

        foreach ($ids as $relatorioId) {
            self::registrarRevisoes(
                $assessoriaId,
                (int) $relatorioId
            );
        }
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
                    ) AS total_slides,
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

        $resultadoRevisoes = self::registrarRevisoes(
            $assessoriaId,
            $relatorioId
        );

        $contagens = self::consultar(
        "
            SELECT
                COUNT(DISTINCT CASE
                    WHEN s.revisao_pendente = 1 THEN s.id
                END) AS novo,
                COUNT(DISTINCT CASE
                    WHEN rv.origem = 'VEICULO'
                        AND rv.assinatura_atual <> rv.assinatura_reconhecida
                    THEN s.id
                END) AS veiculo,
                COUNT(DISTINCT CASE
                    WHEN rv.origem = 'CLIPPING'
                        AND rv.assinatura_atual <> rv.assinatura_reconhecida
                    THEN s.id
                END) AS clipping,
                COUNT(DISTINCT CASE
                    WHEN s.revisao_pendente = 1
                        OR rv.assinatura_atual <> rv.assinatura_reconhecida
                    THEN s.id
                END) AS total
            FROM relatorio_slides s
            LEFT JOIN relatorio_slide_revisoes rv
                ON rv.slide_id = s.id
                AND rv.relatorio_id = s.relatorio_id
                AND rv.assessoria_id = s.assessoria_id
            WHERE s.relatorio_id = :relatorio_id
            AND s.assessoria_id = :assessoria_id
        ",
        [
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
        ]
    )->fetch();

    $relatorio['total_pendentes'] = (int) ($contagens['total'] ?? 0);
    $relatorio['pendentes_por_origem'] = [
        'novo' => (int) ($contagens['novo'] ?? 0),
        'veiculo' => (int) ($contagens['veiculo'] ?? 0),
        'clipping' => (int) ($contagens['clipping'] ?? 0),
];

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

        $relatorio['total_slides'] = (int) $relatorio['total_slides'];

        $relatorio['configuracao_json'] =
            $relatorio['configuracao_json'] === null
                ? null
                : json_decode(
                    $relatorio['configuracao_json'],
                    true,
                    512,
                    JSON_THROW_ON_ERROR
                );

                $busca = $dados['busca'] ?? '';

        if (!is_string($busca) || mb_strlen($busca, 'UTF-8') > 200) {
            throw new \InvalidArgumentException('Busca inválida.');
        }

        $busca = trim($busca);

        $whereSlides = '
            WHERE s.relatorio_id = :relatorio_id
            AND s.assessoria_id = :assessoria_id
        ';

        $parametrosSlides = [
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
        ];

        $revisao = $dados['revisao'] ?? 'todas';

        if (!is_string($revisao) || !in_array($revisao, ['todas', 'pendentes'], true)) {
            throw new \InvalidArgumentException('Filtro de revisão inválido.');
        }

        if ($revisao === 'pendentes') {
            $origens = $dados['origens'] ?? 'novo,veiculo,clipping';

            if (!is_string($origens) || strlen($origens) > 40) {
                throw new \InvalidArgumentException(
                    'Filtros de revisão inválidos.'
                );
            }

            $origens = array_values(array_unique(array_map(
                'trim',
                explode(',', $origens)
            )));

            if (
                !$origens
                || array_diff($origens, ['novo', 'veiculo', 'clipping'])
            ) {
                throw new \InvalidArgumentException(
                    'Filtros de revisão inválidos.'
                );
            }

            $condicoes = [];

            if (in_array('novo', $origens, true)) {
                $condicoes[] = 's.revisao_pendente = 1';
            }

            foreach ([
                'veiculo' => 'VEICULO',
                'clipping' => 'CLIPPING',
            ] as $filtro => $origem) {
                if (!in_array($filtro, $origens, true)) {
                    continue;
                }

                $condicoes[] = "
                    EXISTS (
                        SELECT 1
                        FROM relatorio_slide_revisoes rv
                        WHERE rv.slide_id = s.id
                        AND rv.origem = '{$origem}'
                        AND rv.assinatura_atual
                            <> rv.assinatura_reconhecida
                    )
                ";
            }

            $whereSlides .= ' AND (' . implode(' OR ', $condicoes) . ')';
        }

        if ($busca !== '') {
            $termo = '%' . strtr(
                $busca,
                ['!' => '!!', '%' => '!%', '_' => '!_']
            ) . '%';

            $whereSlides .= "
                AND (
                    s.titulo LIKE :busca_titulo ESCAPE '!'
                    OR JSON_UNQUOTE(
                        JSON_EXTRACT(s.dados_json, '$.clipping.pauta')
                    ) LIKE :busca_pauta ESCAPE '!'
                    OR JSON_UNQUOTE(
                        JSON_EXTRACT(s.dados_json, '$.veiculo.nome')
                    ) LIKE :busca_veiculo ESCAPE '!'
                )
            ";

            $parametrosSlides['busca_titulo'] = $termo;
            $parametrosSlides['busca_pauta'] = $termo;
            $parametrosSlides['busca_veiculo'] = $termo;
        }

        $totalSlides = (int) self::consultar(
            'SELECT COUNT(*) FROM relatorio_slides s' . $whereSlides,
            $parametrosSlides
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
                    relatorio_id,
                    logo_midia_id,
                    imagem_midia_id,
                    EXISTS (
                        SELECT 1
                        FROM relatorio_slide_revisoes rv
                        WHERE rv.slide_id = s.id
                        AND rv.origem = 'VEICULO'
                        AND rv.assinatura_atual <> rv.assinatura_reconhecida
                    ) AS revisao_veiculo_pendente,
                    EXISTS (
                        SELECT 1
                        FROM relatorio_slide_revisoes rv
                        WHERE rv.slide_id = s.id
                        AND rv.origem = 'CLIPPING'
                        AND rv.assinatura_atual <> rv.assinatura_reconhecida
                    ) AS revisao_clipping_pendente,
                    created_at,
                    updated_at
                FROM relatorio_slides s
                {$whereSlides}
                ORDER BY s.ordem ASC
                LIMIT :limit OFFSET :offset
                ",
                [
                    ...$parametrosSlides,
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
            $campos = $resultadoRevisoes['campos'][$slide['id']]
                ?? ['veiculo' => [], 'clipping' => []];

            $valores = $resultadoRevisoes['valores'][$slide['id']]
                ?? ['veiculo' => [], 'clipping' => []];

            $slide['campos_alterados'] = $slide['revisao_pendente']
                ? ['veiculo' => [], 'clipping' => []]
                : $campos;

            $slide['novos_valores'] = $slide['revisao_pendente']
                ? ['veiculo' => null, 'clipping' => null]
                : [
                    'veiculo' => empty($valores['veiculo'])
                        ? null
                        : (object) $valores['veiculo'],
                    'clipping' => empty($valores['clipping'])
                        ? null
                        : (object) $valores['clipping'],
                ];
            $slide['revisao_token'] =
                $resultadoRevisoes['tokens'][$slide['id']] ?? null;
            $slide['revisao_veiculo_pendente'] =
                (bool) $slide['revisao_veiculo_pendente'];
            $slide['revisao_clipping_pendente'] =
                (bool) $slide['revisao_clipping_pendente'];

            $slide['relatorio_id'] = (int) $slide['relatorio_id'];

            foreach (['logo_midia_id', 'imagem_midia_id'] as $campo) {
                $slide[$campo] = $slide[$campo] === null
                    ? null
                    : (int) $slide[$campo];
            }

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

            if ($slide['revisao_pendente']) {
                $dadosAtuais = $resultadoRevisoes['atuais'][
                    $slide['clipping_id']
                ] ?? null;

                if ($dadosAtuais !== null) {
                    $dadosAtuais['cliente']['nome'] =
                        $relatorio['cliente_nome'];

                    $pautaAtual =
                        $dadosAtuais['clipping']['pauta'] ?? null;

                    $slide['dados_json'] = $dadosAtuais;
                    $slide['titulo'] = is_string($pautaAtual)
                        ? mb_substr($pautaAtual, 0, 255, 'UTF-8')
                        : null;
                    $slide['link'] =
                        $dadosAtuais['clipping']['link'] ?? null;
                    $slide['observacoes'] =
                        $dadosAtuais['clipping']['observacoes'] ?? null;
                    $slide['imagem_anexo_id'] =
                        $dadosAtuais['imagem']['anexo_id'] ?? null;
                    $slide['imagem_path'] =
                        $dadosAtuais['imagem']['arquivo_path'] ?? null;

                    $slide['logo_midia_id'] = null;
                    $slide['imagem_midia_id'] = null;
                }
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

    public static function revisarSlide(
        int $assessoriaId,
        mixed $valorRelatorioId,
        mixed $valorSlideId,
        array $dados
    ): array {
        $relatorioId = self::id($valorRelatorioId, 'Relatório');
        $slideId = self::id($valorSlideId, 'Slide');

        if (
            count($dados) !== 1
            || !array_key_exists('revisao_pendente', $dados)
            || $dados['revisao_pendente'] !== false
        ) {
            throw new \InvalidArgumentException(
                'Envie revisao_pendente como false.'
            );
        }

        $existe = self::consultar(
            "
                SELECT s.id
                FROM relatorio_slides s
                INNER JOIN relatorios r
                    ON r.id = s.relatorio_id
                    AND r.assessoria_id = s.assessoria_id
                WHERE s.id = :slide_id
                AND s.relatorio_id = :relatorio_id
                AND s.assessoria_id = :assessoria_id
                AND s.tipo = 'CLIPPING'
                AND s.origem_inclusao = 'AUTOMATICA'
                LIMIT 1
            ",
            [
                'slide_id' => $slideId,
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetchColumn();

        if ($existe === false) {
            throw new \OutOfBoundsException(
                'Slide automático não encontrado neste relatório.'
            );
        }

        self::consultar(
            "
                UPDATE relatorio_slides
                SET revisao_pendente = 0
                WHERE id = :slide_id
                AND relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
                AND revisao_pendente = 1
            ",
            [
                'slide_id' => $slideId,
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        );

        return [
            'slide_id' => $slideId,
            'revisao_pendente' => false,
        ];
    }

    public static function decidirRevisaoSlide(
        int $assessoriaId,
        int $usuarioId,
        mixed $valorRelatorioId,
        mixed $valorSlideId,
        array $dados
    ): array {
        $relatorioId = self::id($valorRelatorioId, 'Relatório');
        $slideId = self::id($valorSlideId, 'Slide');
        $decisao = $dados['decisao'] ?? null;
        $token = $dados['revisao_token'] ?? null;

        if (
            array_diff(array_keys($dados), ['decisao', 'revisao_token'])
            || !is_string($decisao)
            || !in_array($decisao, ['INCLUIR', 'ALTERAR', 'IGNORAR'], true)
            || !is_string($token)
            || !preg_match('/^[a-f0-9]{64}$/D', $token)
        ) {
            throw new \InvalidArgumentException(
                'Decisão ou token de revisão inválido.'
            );
        }

        $db = Connection::get();
        $db->beginTransaction();

        try {
            $relatorio = self::consultar(
                "
                    SELECT cliente_id
                    FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
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

            $slide = self::consultar(
                "
                    SELECT
                        id, clipping_id, ordem, tipo, origem_inclusao,
                        revisao_pendente, titulo, link, observacoes,
                        imagem_anexo_id, imagem_path, dados_json,
                        logo_midia_id, imagem_midia_id
                    FROM relatorio_slides
                    WHERE id = :slide_id
                    AND relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
                ",
                [
                    'slide_id' => $slideId,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetch();

            if (!$slide || $slide['tipo'] !== 'CLIPPING') {
                throw new \OutOfBoundsException(
                    'Slide não encontrado neste relatório.'
                );
            }

            $novo = (bool) $slide['revisao_pendente'];

            if (
                ($novo && $decisao === 'ALTERAR')
                || (!$novo && $decisao === 'INCLUIR')
            ) {
                throw new \InvalidArgumentException(
                    'A decisão não corresponde à situação do slide.'
                );
            }

            if ($novo && $slide['origem_inclusao'] !== 'AUTOMATICA') {
                throw new \DomainException(
                    'A inclusão pendente não é automática.'
                );
            }

            $clippingId = (int) $slide['clipping_id'];

            $linha = self::consultar(
                self::SELECT_MATERIA
                    . self::ORIGEM
                    . "
                        WHERE c.id = :clipping_id
                        AND c.assessoria_id = :assessoria_id
                        LIMIT 1
                    ",
                [
                    'clipping_id' => $clippingId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetch();

            if (!$linha) {
                throw new \DomainException(
                    'O clipping de origem não está disponível. Reabra o relatório.'
                );
            }

            $materia = self::prepararMateria($linha);

            if ((int) $materia['cliente_id'] !== (int) $relatorio['cliente_id']) {
                throw new \DomainException(
                    'O clipping não pertence mais ao cliente do relatório.'
                );
            }

            $cliente = self::cliente(
                $assessoriaId,
                (int) $relatorio['cliente_id']
            );

            $atual = self::slideClipping($materia, $cliente);
            $assinaturas = [
                'VEICULO' => self::assinaturaOrigem(
                    $atual['dados'],
                    'VEICULO'
                ),
                'CLIPPING' => self::assinaturaOrigem(
                    $atual['dados'],
                    'CLIPPING'
                ),
            ];

            $tokenAtual = hash(
                'sha256',
                $slideId . '|'
                    . $assinaturas['VEICULO'] . '|'
                    . $assinaturas['CLIPPING']
            );

            if (!hash_equals($tokenAtual, $token)) {
                throw new \DomainException(
                    'O veículo ou clipping mudou. Reabra o slide antes de decidir.'
                );
            }

            if ($novo && $decisao === 'IGNORAR') {
                self::consultar(
                    "
                        INSERT IGNORE INTO relatorio_clippings_excluidos (
                            relatorio_id,
                            assessoria_id,
                            clipping_id,
                            excluido_por
                        ) VALUES (
                            :relatorio_id,
                            :assessoria_id,
                            :clipping_id,
                            :usuario_id
                        )
                    ",
                    [
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                        'clipping_id' => $clippingId,
                        'usuario_id' => $usuarioId,
                    ]
                );

                self::consultar(
                    "
                        DELETE FROM relatorio_slides
                        WHERE id = :slide_id
                        AND relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                    ",
                    [
                        'slide_id' => $slideId,
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                    ]
                );

                self::consultar(
                    "
                        UPDATE relatorio_slides
                        SET ordem = ordem - 1
                        WHERE relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                        AND ordem > :ordem
                        ORDER BY ordem ASC
                    ",
                    [
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                        'ordem' => (int) $slide['ordem'],
                    ]
                );

                $db->commit();

                return [
                    'slide_id' => $slideId,
                    'decisao' => $decisao,
                    'removido' => true,
                    'origens_decididas' => [],
                ];
            }

            $reconhecidas = self::consultar(
                "
                    SELECT origem, assinatura_reconhecida
                    FROM relatorio_slide_revisoes
                    WHERE slide_id = :slide_id
                    AND relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    FOR UPDATE
                ",
                [
                    'slide_id' => $slideId,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchAll(PDO::FETCH_KEY_PAIR);

            if (!$novo && (
                !isset($reconhecidas['VEICULO'])
                || !isset($reconhecidas['CLIPPING'])
            )) {
                throw new \DomainException(
                    'A revisão mudou. Reabra o relatório antes de decidir.'
                );
            }

            $pendentes = [
                'VEICULO' => $novo || (
                    isset($reconhecidas['VEICULO'])
                    && !hash_equals(
                        $reconhecidas['VEICULO'],
                        $assinaturas['VEICULO']
                    )
                ),
                'CLIPPING' => $novo || (
                    isset($reconhecidas['CLIPPING'])
                    && !hash_equals(
                        $reconhecidas['CLIPPING'],
                        $assinaturas['CLIPPING']
                    )
                ),
            ];

            if (!$pendentes['VEICULO'] && !$pendentes['CLIPPING']) {
                throw new \DomainException(
                    'Este slide já não precisa de revisão.'
                );
            }

            $salvo = json_decode(
                $slide['dados_json'] ?? '{}',
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            $novosDados = $salvo;
            $titulo = $slide['titulo'];
            $link = $slide['link'];
            $observacoes = $slide['observacoes'];
            $imagemAnexoId = $slide['imagem_anexo_id'];
            $imagemPath = $slide['imagem_path'];
            $logoMidiaId = $slide['logo_midia_id'];
            $imagemMidiaId = $slide['imagem_midia_id'];

            if ($decisao === 'IGNORAR') {
                $logoSalvo = $salvo['veiculo']['logo_path'] ?? null;

                if ($logoMidiaId === null && $logoSalvo) {
                    $logoMidiaId = RelatorioMidiaService::copiarLogo(
                        $assessoriaId,
                        $relatorioId,
                        $logoSalvo
                    );

                    if ($logoMidiaId === null) {
                        throw new \DomainException(
                            'A logo salva não está disponível para preservação.'
                        );
                    }
                }

                $imagemSalva = $salvo['imagem']['arquivo_path'] ?? null;

                if ($imagemMidiaId === null && $imagemSalva) {
                    $imagemMidiaId = RelatorioMidiaService::copiarImagem(
                        $assessoriaId,
                        $relatorioId,
                        $clippingId,
                        $imagemSalva
                    );

                    if ($imagemMidiaId === null) {
                        throw new \DomainException(
                            'A imagem salva não está disponível para preservação.'
                        );
                    }
                }
            } else {
                if ($novo) {
                    $novosDados = $atual['dados'];
                } elseif ($pendentes['VEICULO']) {
                    $nomeInformado =
                        $novosDados['veiculo']['nome_informado'] ?? null;

                    $novosDados['veiculo'] = $atual['dados']['veiculo'];
                    $novosDados['veiculo']['nome_informado'] =
                        $nomeInformado;
                }

                if ($novo || $pendentes['VEICULO']) {
                    $logoAtual = $atual['dados']['veiculo']['logo_path'];
                    $logoMidiaId = RelatorioMidiaService::copiarLogo(
                        $assessoriaId,
                        $relatorioId,
                        $logoAtual
                    );

                    if ($logoAtual && $logoMidiaId === null) {
                        throw new \DomainException(
                            'A nova logo do veículo não está disponível.'
                        );
                    }
                }

                if ($novo || $pendentes['CLIPPING']) {
                    $novosDados['cliente'] = $atual['dados']['cliente'];
                    $novosDados['clipping'] = $atual['dados']['clipping'];
                    $novosDados['imagem'] = $atual['dados']['imagem'];
                    $novosDados['veiculo']['nome_informado'] =
                        $atual['dados']['veiculo']['nome_informado'];

                    $titulo = $atual['titulo'];
                    $link = $atual['link'];
                    $observacoes = $atual['observacoes'];
                    $imagemAnexoId = $atual['imagem_anexo_id'];
                    $imagemPath = $atual['imagem_path'];

                    $imagemMidiaId = RelatorioMidiaService::copiarImagem(
                        $assessoriaId,
                        $relatorioId,
                        $clippingId,
                        $imagemPath
                    );

                    if ($imagemPath && $imagemMidiaId === null) {
                        throw new \DomainException(
                            'A nova imagem do clipping não está disponível.'
                        );
                    }
                }
            }

            self::consultar(
                "
                    UPDATE relatorio_slides
                    SET revisao_pendente = 0,
                        titulo = :titulo,
                        link = :link,
                        observacoes = :observacoes,
                        imagem_anexo_id = :imagem_anexo_id,
                        imagem_path = :imagem_path,
                        logo_midia_id = :logo_midia_id,
                        imagem_midia_id = :imagem_midia_id,
                        dados_json = :dados_json
                    WHERE id = :slide_id
                    AND relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'titulo' => $titulo,
                    'link' => $link,
                    'observacoes' => $observacoes,
                    'imagem_anexo_id' => $imagemAnexoId,
                    'imagem_path' => $imagemPath,
                    'logo_midia_id' => $logoMidiaId,
                    'imagem_midia_id' => $imagemMidiaId,
                    'dados_json' => json_encode(
                        $novosDados,
                        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
                    ),
                    'slide_id' => $slideId,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );

            $registrar = $db->prepare(
                "
                    INSERT INTO relatorio_slide_revisoes (
                        slide_id, relatorio_id, assessoria_id, origem,
                        assinatura_reconhecida, assinatura_atual,
                        dados_reconhecidos_json, ultima_decisao,
                        decidido_por, decidido_em
                    ) VALUES (
                        :slide_id, :relatorio_id, :assessoria_id, :origem,
                        :assinatura, :assinatura_atual,
                        :dados_reconhecidos_json, :ultima_decisao,
                        :usuario_id, NOW()
                    )
                    ON DUPLICATE KEY UPDATE
                        assinatura_reconhecida =
                            VALUES(assinatura_reconhecida),
                        assinatura_atual = VALUES(assinatura_atual),
                        dados_reconhecidos_json =
                            VALUES(dados_reconhecidos_json),
                        ultima_decisao = VALUES(ultima_decisao),
                        decidido_por = VALUES(decidido_por),
                        decidido_em = NOW()
                "
            );

            $origensDecididas = [];

            foreach (['VEICULO', 'CLIPPING'] as $origem) {
                if (!$pendentes[$origem]) {
                    continue;
                }

                $registrar->execute([
                    'slide_id' => $slideId,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                    'origem' => $origem,
                    'assinatura' => $assinaturas[$origem],
                    'assinatura_atual' => $assinaturas[$origem],
                    'dados_reconhecidos_json' => json_encode(
                        self::valoresOrigem($atual['dados'], $origem),
                        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
                    ),
                    'ultima_decisao' => $decisao === 'IGNORAR'
                        ? 'IGNORADO'
                        : 'VALIDADO',
                    'usuario_id' => $usuarioId,
                ]);

                $origensDecididas[] = $origem;
            }

            $db->commit();

            return [
                'slide_id' => $slideId,
                'decisao' => $decisao,
                'removido' => false,
                'origens_decididas' => $origensDecididas,
            ];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }

    public static function atualizar(
        int $assessoriaId,
        mixed $valorId,
        array $dados
    ): array {
        $relatorioId = self::id($valorId, 'Relatório');

        if (
            array_diff(
                array_keys($dados),
                ['titulo', 'inclusao_automatica']
            )
        ) {
            throw new \InvalidArgumentException(
                'Há campos não permitidos na edição do relatório.'
            );
        }

        $titulo = $dados['titulo'] ?? null;
        $inclusaoAutomatica =
            $dados['inclusao_automatica'] ?? null;

        if (
            !is_string($titulo)
            || trim($titulo) === ''
            || mb_strlen(trim($titulo), 'UTF-8') > 200
        ) {
            throw new \InvalidArgumentException(
                'Informe um título com até 200 caracteres.'
            );
        }

        if (!is_bool($inclusaoAutomatica)) {
            throw new \InvalidArgumentException(
                'Informe se a inclusão automática está ativa.'
            );
        }

        $titulo = trim($titulo);
        $db = Connection::get();
        $db->beginTransaction();

        try {
            $atual = self::consultar(
                "
                    SELECT id, periodo_inicio, periodo_fim
                    FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetch();

            if (!$atual) {
                throw new \OutOfBoundsException(
                    'Relatório não encontrado nesta assessoria.'
                );
            }

            if (
                $inclusaoAutomatica
                && (
                    $atual['periodo_inicio'] === null
                    || $atual['periodo_fim'] === null
                )
            ) {
                throw new \InvalidArgumentException(
                    'Defina o período antes de ativar a inclusão automática.'
                );
            }

            self::consultar(
                "
                    UPDATE relatorios
                    SET titulo = :titulo,
                        inclusao_automatica = :inclusao_automatica
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'titulo' => $titulo,
                    'inclusao_automatica' =>
                        $inclusaoAutomatica ? 1 : 0,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );

            self::consultar(
                "
                    UPDATE relatorio_slides
                    SET titulo = :titulo
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    AND tipo = 'CAPA'
                    AND (
                        edicoes_json IS NULL
                        OR JSON_CONTAINS_PATH(
                            edicoes_json,
                            'one',
                            '$.titulo'
                        ) = 0
                    )
                ",
                [
                    'titulo' => $titulo,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );

            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }

        return self::buscar(
            $assessoriaId,
            $relatorioId,
            ['page' => 1, 'limit' => 1]
        )['relatorio'];
    }

    public static function excluir(
        int $assessoriaId,
        mixed $valorId
    ): array {
        $relatorioId = self::id($valorId, 'Relatório');
        $db = Connection::get();
        $db->beginTransaction();

        try {
            $relatorio = self::consultar(
                "
                    SELECT id, arquivo_path, gerado_em
                    FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
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

            $totalVersoes = (int) self::consultar(
                "
                    SELECT COUNT(*)
                    FROM relatorio_versoes
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchColumn();

            if (
                $totalVersoes > 0
                || $relatorio['arquivo_path'] !== null
                || $relatorio['gerado_em'] !== null
            ) {
                throw new \DomainException(
                    'Este relatório possui uma versão gerada. A exclusão ficará disponível após tratarmos esses arquivos.'
                );
            }

            self::consultar(
                "
                    DELETE FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );

            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }

        return [
            'message' => 'Relatório excluído com sucesso.',
        ];
    }

    public static function excluirSlides(
        int $assessoriaId,
        int $usuarioId,
        mixed $valorRelatorioId,
        array $dados
    ): array {
        $relatorioId = self::id($valorRelatorioId, 'Relatório');
        $valores = $dados['slide_ids'] ?? null;

        if (
            array_diff(array_keys($dados), ['slide_ids'])
            || !is_array($valores)
            || !array_is_list($valores)
            || count($valores) < 1
            || count($valores) > 100
        ) {
            throw new \InvalidArgumentException(
                'Envie de 1 a 100 IDs de slides.'
            );
        }

        $ids = array_map(
            fn(mixed $valor): int => self::id($valor, 'Slide'),
            $valores
        );

        if (count(array_unique($ids)) !== count($ids)) {
            throw new \InvalidArgumentException(
                'A seleção contém slides repetidos.'
            );
        }

        $db = Connection::get();
        $db->beginTransaction();

        try {
            $relatorio = self::consultar(
                "
                    SELECT id
                    FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchColumn();

            if ($relatorio === false) {
                throw new \OutOfBoundsException(
                    'Relatório não encontrado nesta assessoria.'
                );
            }

            $linhas = self::consultar(
                "
                    SELECT id, ordem, tipo, clipping_id
                    FROM relatorio_slides
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    ORDER BY ordem ASC
                    FOR UPDATE
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchAll();

            $porId = [];

            foreach ($linhas as $linha) {
                $porId[(int) $linha['id']] = $linha;
            }

            $alvos = [];

            foreach ($ids as $id) {
                $slide = $porId[$id] ?? null;

                if (!$slide) {
                    throw new \OutOfBoundsException(
                        'Um dos slides não pertence a este relatório.'
                    );
                }

                if (
                    !in_array(
                        $slide['tipo'],
                        ['CLIPPING', 'COMPLEMENTAR'],
                        true
                    )
                ) {
                    throw new \DomainException(
                        'Capa e encerramento não podem ser excluídos.'
                    );
                }

                $alvos[] = $slide;
            }

            usort(
                $alvos,
                fn(array $a, array $b): int =>
                    (int) $b['ordem'] <=> (int) $a['ordem']
            );

            foreach ($alvos as $slide) {
                if ($slide['clipping_id'] !== null) {
                    self::consultar(
                        "
                            INSERT IGNORE INTO relatorio_clippings_excluidos (
                                relatorio_id,
                                assessoria_id,
                                clipping_id,
                                excluido_por
                            ) VALUES (
                                :relatorio_id,
                                :assessoria_id,
                                :clipping_id,
                                :usuario_id
                            )
                        ",
                        [
                            'relatorio_id' => $relatorioId,
                            'assessoria_id' => $assessoriaId,
                            'clipping_id' => (int) $slide['clipping_id'],
                            'usuario_id' => $usuarioId,
                        ]
                    );
                }

                self::consultar(
                    "
                        DELETE FROM relatorio_slides
                        WHERE id = :slide_id
                        AND relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                    ",
                    [
                        'slide_id' => (int) $slide['id'],
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                    ]
                );

                self::consultar(
                    "
                        UPDATE relatorio_slides
                        SET ordem = ordem - 1
                        WHERE relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                        AND ordem > :ordem
                        ORDER BY ordem ASC
                    ",
                    [
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                        'ordem' => (int) $slide['ordem'],
                    ]
                );
            }

            $db->commit();

            return ['slides_excluidos' => count($alvos)];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }

    public static function materiasParaEdicao(
        int $assessoriaId,
        mixed $valorId,
        array $dados
    ): array {
        $relatorioId = self::id($valorId, 'Relatório');

        $relatorio = self::consultar(
            "
                SELECT cliente_id
                FROM relatorios
                WHERE id = :relatorio_id
                AND assessoria_id = :assessoria_id
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

        [$inicio, $fim] = self::periodo($dados);
        $page = self::id($dados['page'] ?? 1, 'Página');
        $limit = self::id($dados['limit'] ?? 20, 'Limite');

        if ($limit > 100) {
            throw new \InvalidArgumentException(
                'O limite máximo é 100 matérias por página.'
            );
        }

        $busca = $dados['busca'] ?? '';

        if (!is_string($busca) || mb_strlen($busca, 'UTF-8') > 200) {
            throw new \InvalidArgumentException('Busca inválida.');
        }

        [$where, $parametros] = self::condicao(
            $assessoriaId,
            (int) $relatorio['cliente_id'],
            $inicio,
            $fim,
            false
        );

        $where .= "
            AND NOT EXISTS (
                SELECT 1
                FROM relatorio_slides s
                WHERE s.relatorio_id = :relatorio_id
                AND s.assessoria_id = c.assessoria_id
                AND s.clipping_id = c.id
                AND s.tipo = 'CLIPPING'
            )
        ";
        $parametros['relatorio_id'] = $relatorioId;

        $idsCandidatas = self::consultar(
            'SELECT c.id '
                . self::ORIGEM
                . $where
                . ' ORDER BY c.id ASC',
            $parametros
        )->fetchAll(PDO::FETCH_COLUMN);

        $totalNovas = count($idsCandidatas);
        $assinatura = hash('sha256', implode(',', $idsCandidatas));

        $busca = trim($busca);

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

        $totalFiltrado = (int) self::consultar(
            'SELECT COUNT(DISTINCT c.id) '
                . self::ORIGEM
                . $where,
            $parametros
        )->fetchColumn();

        $offset = ($page - 1) * $limit;

        $linhas = self::consultar(
            self::SELECT_MATERIA
                . self::ORIGEM
                . $where
                . "
                    ORDER BY c.data_publicacao ASC, c.id ASC
                    LIMIT :limit OFFSET :offset
                ",
            [
                ...$parametros,
                'limit' => $limit,
                'offset' => $offset,
            ]
        )->fetchAll();

        $jaIncluidas = (int) self::consultar(
            "
                SELECT COUNT(*)
                FROM relatorio_slides
                WHERE relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
                AND tipo = 'CLIPPING'
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
            ]
        )->fetchColumn();

        $foraDoPeriodo = (int) self::consultar(
            "
                SELECT COUNT(*)
                FROM relatorio_slides s
                INNER JOIN clippings c
                    ON c.id = s.clipping_id
                AND c.assessoria_id = s.assessoria_id
                WHERE s.relatorio_id = :relatorio_id
                AND s.assessoria_id = :assessoria_id
                AND s.tipo = 'CLIPPING'
                AND (
                    c.data_publicacao IS NULL
                    OR c.data_publicacao NOT BETWEEN :inicio AND :fim
                )
            ",
            [
                'relatorio_id' => $relatorioId,
                'assessoria_id' => $assessoriaId,
                'inicio' => $inicio,
                'fim' => $fim,
            ]
        )->fetchColumn();

        return [
            'materias' => array_map(
                self::prepararMateria(...),
                $linhas
            ),
            'resumo' => [
                'novas' => $totalNovas,
                'ja_incluidas' => $jaIncluidas,
                'fora_do_periodo' => $foraDoPeriodo,
                'assinatura' => $assinatura,
            ],
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltrado,
                'has_next' => $offset + count($linhas) < $totalFiltrado,
            ],
        ];
    }

    public static function atualizarPeriodo(
        int $assessoriaId,
        int $usuarioId,
        mixed $valorId,
        array $dados
    ): array {
        $relatorioId = self::id($valorId, 'Relatório');
        [$inicio, $fim] = self::periodo($dados);
        $incluirTodas = $dados['incluir_todas'] ?? false;

        if (!is_bool($incluirTodas)) {
            throw new \InvalidArgumentException(
                'A opção de selecionar todas é inválida.'
            );
        }

        $idsIncluir = self::listaIds(
            $dados['ids_incluir'] ?? [],
            'Matérias escolhidas'
        );

        $idsExcluir = self::listaIds(
            $dados['ids_excluir'] ?? [],
            'Matérias desmarcadas'
        );

        if ($incluirTodas && $idsIncluir !== []) {
            throw new \InvalidArgumentException(
                'Envie apenas as matérias desmarcadas ao selecionar todas.'
            );
        }

        if (!$incluirTodas && $idsExcluir !== []) {
            throw new \InvalidArgumentException(
                'As matérias desmarcadas exigem a seleção de todas.'
            );
        }
        
        $assinaturaEsperada = $dados['assinatura'] ?? null;

        if (
            !is_string($assinaturaEsperada)
            || !preg_match('/^[a-f0-9]{64}$/D', $assinaturaEsperada)
        ) {
            throw new \InvalidArgumentException(
                'Revise as matérias antes de salvar o período.'
            );
        }

        $db = Connection::get();
        $db->beginTransaction();

        try {
            $relatorio = self::consultar(
                "
                    SELECT cliente_id
                    FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
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

            [$where, $parametros] = self::condicao(
                $assessoriaId,
                (int) $relatorio['cliente_id'],
                $inicio,
                $fim,
                false
            );

            $where .= "
                AND NOT EXISTS (
                    SELECT 1
                    FROM relatorio_slides s
                    WHERE s.relatorio_id = :relatorio_id
                    AND s.assessoria_id = c.assessoria_id
                    AND s.clipping_id = c.id
                    AND s.tipo = 'CLIPPING'
                )
            ";

            $parametros['relatorio_id'] = $relatorioId;

            $linhas = self::consultar(
                self::SELECT_MATERIA
                    . self::ORIGEM
                    . $where
                    . ' ORDER BY c.data_publicacao ASC, c.id ASC',
                $parametros
            )->fetchAll();

            $idsAtuais = array_map(
                static fn(array $linha): int => (int) $linha['id'],
                $linhas
            );
            sort($idsAtuais, SORT_NUMERIC);

            $assinaturaAtual = hash(
                'sha256',
                implode(',', $idsAtuais)
            );

            if (!hash_equals($assinaturaEsperada, $assinaturaAtual)) {
                throw new \DomainException(
                    'A lista de matérias mudou. Revise as disponíveis antes de salvar.'
                );
            }

            $disponiveis = array_fill_keys($idsAtuais, true);

            if ($incluirTodas) {
                foreach ($idsExcluir as $id) {
                    if (!isset($disponiveis[$id])) {
                        throw new \DomainException(
                            'Uma matéria desmarcada não está mais disponível. Revise a seleção.'
                        );
                    }
                }

                $excluidas = array_fill_keys($idsExcluir, true);

                $idsIncluir = array_values(array_filter(
                    $idsAtuais,
                    static fn(int $id): bool => !isset($excluidas[$id])
                ));
            } else {
                foreach ($idsIncluir as $id) {
                    if (!isset($disponiveis[$id])) {
                        throw new \DomainException(
                            'Uma matéria escolhida não está mais disponível. Revise a seleção.'
                        );
                    }
                }
            }

            $escolhidas = array_fill_keys($idsIncluir, true);

            $cliente = $idsIncluir === []
                ? null
                : self::bloquearCliente(
                    $assessoriaId,
                    (int) $relatorio['cliente_id']
                );

            $ordem = 0;
            $stmtSlide = null;

            if ($idsIncluir !== []) {
                $encerramento = self::consultar(
                    "
                        SELECT id, ordem
                        FROM relatorio_slides
                        WHERE relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                        AND tipo = 'ENCERRAMENTO'
                        ORDER BY ordem DESC
                        LIMIT 1
                        FOR UPDATE
                    ",
                    [
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                    ]
                )->fetch();

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

                if (
                    !$encerramento
                    || (int) $encerramento['ordem'] !== $ultimaOrdem
                ) {
                    throw new \DomainException(
                        'A ordem dos slides precisa ser revisada antes de incluir matérias.'
                    );
                }

                self::consultar(
                    "
                        UPDATE relatorio_slides
                        SET ordem = :nova_ordem
                        WHERE id = :slide_id
                        AND relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                    ",
                    [
                        'nova_ordem' => $ultimaOrdem + count($idsIncluir),
                        'slide_id' => (int) $encerramento['id'],
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                    ]
                );

                $ordem = $ultimaOrdem;

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
            }

            $stmtExcluir = $db->prepare(
                "
                    INSERT IGNORE INTO relatorio_clippings_excluidos (
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

            $stmtReincluir = $db->prepare(
                "
                    DELETE FROM relatorio_clippings_excluidos
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    AND clipping_id = :clipping_id
                "
            );

            foreach ($linhas as $linha) {
                $id = (int) $linha['id'];

                if (!isset($escolhidas[$id])) {
                    $stmtExcluir->execute([
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                        'clipping_id' => $id,
                        'excluido_por' => $usuarioId,
                    ]);

                    continue;
                }

                $stmtReincluir->execute([
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                    'clipping_id' => $id,
                ]);

                self::inserirSlide(
                    $stmtSlide,
                    $assessoriaId,
                    $relatorioId,
                    $ordem,
                    self::slideClipping(
                        self::prepararMateria($linha),
                        $cliente
                    )
                );
            }

            self::consultar(
                "
                    UPDATE relatorios
                    SET periodo_inicio = :inicio,
                        periodo_fim = :fim
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                ",
                [
                    'inicio' => $inicio,
                    'fim' => $fim,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );

            self::consultar(
                "
                    UPDATE relatorio_slides
                    SET dados_json = JSON_SET(
                        COALESCE(dados_json, JSON_OBJECT()),
                        '$.periodo.inicio', :inicio,
                        '$.periodo.fim', :fim
                    )
                    WHERE relatorio_id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    AND tipo IN ('CAPA', 'ENCERRAMENTO')
                ",
                [
                    'inicio' => $inicio,
                    'fim' => $fim,
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            );

            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }

        return [
            'relatorio' => self::buscar(
                $assessoriaId,
                $relatorioId,
                ['page' => 1, 'limit' => 1]
            )['relatorio'],
            'materias_incluidas' => count($idsIncluir),
        ];
    }

    public static function completarDadosVeiculos(
        int $assessoriaId,
        mixed $valorId
    ): array {
        $relatorioId = self::id($valorId, 'Relatório');
        $db = Connection::get();
        $db->beginTransaction();

        try {
            $existe = self::consultar(
                "
                    SELECT id
                    FROM relatorios
                    WHERE id = :relatorio_id
                    AND assessoria_id = :assessoria_id
                    LIMIT 1
                    FOR UPDATE
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchColumn();

            if (!$existe) {
                throw new \OutOfBoundsException(
                    'Relatório não encontrado nesta assessoria.'
                );
            }

            $slides = self::consultar(
                "
                    SELECT
                        s.id,
                        s.dados_json,
                        s.edicoes_json,
                        v.descricao,
                        v.alcance,
                        v.logo_path
                    FROM relatorio_slides s
                    INNER JOIN clippings c
                        ON c.id = s.clipping_id
                        AND c.assessoria_id = s.assessoria_id
                    INNER JOIN veiculos v
                        ON v.id = c.veiculo_id
                        AND v.assessoria_id = s.assessoria_id
                    WHERE s.relatorio_id = :relatorio_id
                    AND s.assessoria_id = :assessoria_id
                    AND s.tipo = 'CLIPPING'
                    FOR UPDATE
                ",
                [
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]
            )->fetchAll();

            $atualizados = 0;

            foreach ($slides as $slide) {
                $dados = $slide['dados_json'] === null
                    ? []
                    : json_decode(
                        $slide['dados_json'],
                        true,
                        512,
                        JSON_THROW_ON_ERROR
                    );

                $edicoes = $slide['edicoes_json'] === null
                    ? []
                    : json_decode(
                        $slide['edicoes_json'],
                        true,
                        512,
                        JSON_THROW_ON_ERROR
                    );

                $dadosVeiculo = is_array($dados['veiculo'] ?? null)
                    ? $dados['veiculo']
                    : [];

                $edicoesVeiculo = is_array($edicoes['veiculo'] ?? null)
                    ? $edicoes['veiculo']
                    : [];

                $mudou = false;

                foreach (['descricao', 'alcance'] as $campo) {
                    $valorAtual = trim(
                        (string) ($dadosVeiculo[$campo] ?? '')
                    );
                    $valorVeiculo = trim(
                        (string) ($slide[$campo] ?? '')
                    );

                    if (
                        $valorAtual === ''
                        && $valorVeiculo !== ''
                        && !array_key_exists(
                            $campo,
                            $edicoesVeiculo
                        )
                    ) {
                        $dadosVeiculo[$campo] = $valorVeiculo;
                        $mudou = true;
                    }
                }

                $logoAtual = trim((string) ($slide['logo_path'] ?? '')) ?: null;
                $logoDoSlide =
                    trim((string) ($dadosVeiculo['logo_path'] ?? '')) ?: null;

                if (
                    !array_key_exists('logo_path', $edicoesVeiculo)
                    && $logoDoSlide !== $logoAtual
                ) {
                    $dadosVeiculo['logo_path'] = $logoAtual;
                    $mudou = true;
                }

                if (!$mudou) {
                    continue;
                }

                $dados['veiculo'] = $dadosVeiculo;

                self::consultar(
                    "
                        UPDATE relatorio_slides
                        SET dados_json = :dados_json
                        WHERE id = :slide_id
                        AND relatorio_id = :relatorio_id
                        AND assessoria_id = :assessoria_id
                    ",
                    [
                        'dados_json' => json_encode(
                            $dados,
                            JSON_UNESCAPED_UNICODE
                                | JSON_THROW_ON_ERROR
                        ),
                        'slide_id' => (int) $slide['id'],
                        'relatorio_id' => $relatorioId,
                        'assessoria_id' => $assessoriaId,
                    ]
                );

                $atualizados++;
            }

            $db->commit();

            return ['slides_atualizados' => $atualizados];
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }
}