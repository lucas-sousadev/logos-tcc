<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;
use PDO;
use PDOStatement;

class ReleaseService
{
    private const STATUS = ['RASCUNHO', 'AGENDADO', 'ENVIANDO', 'ENVIADO'];

    private const DATA_LISTAGEM =
        'COALESCE(r.enviado_em, r.agendado_para, r.updated_at)';

    private const CAMPOS = '
        r.id, r.cliente_id, r.template_id, r.template_codigo, r.criado_por,
        r.titulo, r.assunto, r.status, r.chave_rascunho,
        r.agendado_para, r.iniciado_em, r.enviado_em,
        r.created_at, r.updated_at,
        c.nome AS cliente_nome,
        u.nome AS criado_por_nome,
        (
            SELECT COUNT(*)
            FROM release_destinatarios d
            WHERE d.release_id = r.id
              AND d.assessoria_id = r.assessoria_id
        ) AS total_destinatarios
    ';

    private const ORIGEM = '
        FROM releases r
        LEFT JOIN clientes c
            ON c.id = r.cliente_id
           AND c.assessoria_id = r.assessoria_id
        INNER JOIN usuarios u
            ON u.id = r.criado_por
           AND u.assessoria_id = r.assessoria_id
    ';

    private static function consultar(string $sql, array $parametros = []): PDOStatement
    {
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

        $id = filter_var($valor, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);

        if ($id === false) {
            throw new \InvalidArgumentException("{$rotulo} inválido.");
        }

        return $id;
    }

    private static function texto(mixed $valor, string $rotulo, int $limite): string
    {
        if (!is_string($valor) || !mb_check_encoding($valor, 'UTF-8')) {
            throw new \InvalidArgumentException("{$rotulo} inválido.");
        }

        $valor = trim($valor);

        if (mb_strlen($valor, 'UTF-8') > $limite) {
            throw new \InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$limite} caracteres."
            );
        }

        return $valor;
    }

    private static function data(mixed $valor, string $rotulo): string
    {
        if (
            !is_string($valor)
            || !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $valor, $partes)
            || !checkdate((int) $partes[2], (int) $partes[3], (int) $partes[1])
        ) {
            throw new \InvalidArgumentException(
                "{$rotulo} deve ser uma data válida em AAAA-MM-DD."
            );
        }

        return $valor;
    }

    private static function preparar(array $release): array
    {
        foreach (['id', 'cliente_id', 'template_id', 'criado_por', 'total_destinatarios'] as $campo) {
            $release[$campo] = $release[$campo] === null ? null : (int) $release[$campo];
        }

        return $release;
    }

    public static function listar(int $assessoriaId, array $dados = []): array
    {
        $page = self::id($dados['page'] ?? 1, 'Página');
        $limit = self::id($dados['limit'] ?? 20, 'Limite');

        if ($limit > 100 || $page > intdiv(PHP_INT_MAX, $limit)) {
            throw new \InvalidArgumentException('Paginação inválida. Use até 100 releases por página.');
        }

        $where = ' WHERE r.assessoria_id = :assessoria_id';
        $parametros = ['assessoria_id' => $assessoriaId];
        $busca = self::texto($dados['busca'] ?? '', 'Busca', 255);

        if ($busca !== '') {
            $termo = '%' . strtr($busca, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            $where .= " AND (r.titulo LIKE :busca_titulo ESCAPE '!'
                OR r.assunto LIKE :busca_assunto ESCAPE '!')";
            $parametros['busca_titulo'] = $termo;
            $parametros['busca_assunto'] = $termo;
        }

        foreach (['cliente_id' => 'Cliente', 'criado_por' => 'Responsável'] as $campo => $rotulo) {
            if (isset($dados[$campo]) && $dados[$campo] !== '') {
                $where .= " AND r.{$campo} = :{$campo}";
                $parametros[$campo] = self::id($dados[$campo], $rotulo);
            }
        }

        $status = $dados['status'] ?? '';

        if ($status !== '') {
            if (!in_array($status, self::STATUS, true)) {
                throw new \InvalidArgumentException('Status de release inválido.');
            }

            $where .= ' AND r.status = :status';
            $parametros['status'] = $status;
        }

        foreach (['data_inicio' => 'Data inicial', 'data_fim' => 'Data final'] as $campo => $rotulo) {
            if (isset($dados[$campo]) && $dados[$campo] !== '') {
                $parametros[$campo] = self::data($dados[$campo], $rotulo);
            }
        }

        if (
            isset($parametros['data_inicio'], $parametros['data_fim'])
            && $parametros['data_inicio'] > $parametros['data_fim']
        ) {
            throw new \InvalidArgumentException('A data inicial não pode ser posterior à data final.');
        }

        if (isset($parametros['data_inicio'])) {
            $where .= ' AND ' . self::DATA_LISTAGEM . ' >= :data_inicio';
            $parametros['data_inicio'] .= ' 00:00:00';
        }

        if (isset($parametros['data_fim'])) {
            $where .= ' AND ' . self::DATA_LISTAGEM . ' <= :data_fim';
            $parametros['data_fim'] .= ' 23:59:59';
        }

        $ordem = $dados['ordem'] ?? 'recentes';
        $ordenacoes = [
            'recentes' => self::DATA_LISTAGEM . ' DESC, r.id DESC',
            'antigos' => self::DATA_LISTAGEM . ' ASC, r.id ASC',
            'titulo' => 'r.titulo ASC, r.id ASC',
        ];

        if (!is_string($ordem) || !isset($ordenacoes[$ordem])) {
            throw new \InvalidArgumentException('Ordenação inválida.');
        }

        $total = (int) self::consultar(
            'SELECT COUNT(*)' . self::ORIGEM . $where,
            $parametros
        )->fetchColumn();

        $offset = ($page - 1) * $limit;
        $releases = self::consultar(
            'SELECT ' . self::CAMPOS . ', ' . self::DATA_LISTAGEM . ' AS data_referencia'
                . self::ORIGEM . $where
                . ' ORDER BY ' . $ordenacoes[$ordem] . ' LIMIT :limit OFFSET :offset',
            [...$parametros, 'limit' => $limit, 'offset' => $offset]
        )->fetchAll();

        return [
            'releases' => array_map(self::preparar(...), $releases),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => $offset + count($releases) < $total,
            ],
        ];
    }

    public static function buscar(int $assessoriaId, mixed $id): array
    {
        $releaseId = self::id($id, 'Release');
        $release = self::consultar(
            'SELECT ' . self::CAMPOS
                . ', r.blocos_json, r.primeira_linha, r.nome_remetente, r.responder_para'
                . self::ORIGEM . ' WHERE r.id = :id AND r.assessoria_id = :assessoria_id',
            ['id' => $releaseId, 'assessoria_id' => $assessoriaId]
        )->fetch();

        if (!$release) {
            throw new \OutOfBoundsException('Release não encontrado nesta assessoria.');
        }

        $release = self::preparar($release);
        $release['blocos'] = json_decode($release['blocos_json'], true, 512, JSON_THROW_ON_ERROR);
        unset($release['blocos_json']);

        $destinatarios = self::consultar('
            SELECT d.id, d.jornalista_id, d.email, d.status, d.enviado_em,
                d.erro_mensagem, j.nome AS jornalista_nome, v.nome AS veiculo_nome
            FROM release_destinatarios d
            LEFT JOIN jornalistas j
                ON j.id = d.jornalista_id AND j.assessoria_id = d.assessoria_id
            LEFT JOIN veiculos v
                ON v.id = j.veiculo_id AND v.assessoria_id = d.assessoria_id
            WHERE d.release_id = :release_id AND d.assessoria_id = :assessoria_id
            ORDER BY d.id ASC
        ', ['release_id' => $releaseId, 'assessoria_id' => $assessoriaId])->fetchAll();

        foreach ($destinatarios as &$destinatario) {
            $destinatario['id'] = (int) $destinatario['id'];
            $destinatario['jornalista_id'] = $destinatario['jornalista_id'] === null
                ? null
                : (int) $destinatario['jornalista_id'];
        }
        unset($destinatario);

        $release['destinatarios'] = $destinatarios;

        return $release;
    }

    private static function cadastroExistente(
        int $assessoriaId,
        int $usuarioId,
        ?string $chave,
        string $assinatura
    ): ?array {
        if ($chave === null) {
            return null;
        }

        $existente = self::consultar('
            SELECT id, assinatura_cadastro FROM releases
            WHERE assessoria_id = :assessoria_id AND criado_por = :criado_por
              AND chave_rascunho = :chave
        ', [
            'assessoria_id' => $assessoriaId,
            'criado_por' => $usuarioId,
            'chave' => $chave,
        ])->fetch();

        if (!$existente) {
            return null;
        }

        if (!hash_equals((string) $existente['assinatura_cadastro'], $assinatura)) {
            throw new \DomainException('Esta chave de rascunho já foi usada com outros dados.');
        }

        return self::buscar($assessoriaId, $existente['id']);
    }   

    public static function validarDadosEnvio(mixed $dados): array
    {
        $campos = [
            'assunto' => ['Assunto', 255],
            'primeira_linha' => ['Primeira linha', 150],
            'nome_remetente' => ['Nome do remetente', 100],
            'responder_para' => ['Responder para', 254],
        ];

        if (
            !is_array($dados)
            || array_diff(array_keys($dados), array_keys($campos)) !== []
        ) {
            throw new \InvalidArgumentException('Dados do e-mail inválidos.');
        }

        $resultado = [];

        foreach ($campos as $campo => [$rotulo, $limite]) {
            $valor = self::texto($dados[$campo] ?? '', $rotulo, $limite);

            if (preg_match('/[\x00-\x1F\x7F]/', $valor)) {
                throw new \InvalidArgumentException(
                    "{$rotulo} deve ser preenchido em uma única linha."
                );
            }

            $resultado[$campo] = $valor;
        }

        if (
            $resultado['responder_para'] !== ''
            && !filter_var($resultado['responder_para'], FILTER_VALIDATE_EMAIL)
        ) {
            throw new \InvalidArgumentException(
                'Informe um endereço válido no campo Responder para.'
            );
        }

        return $resultado;
    }

    public static function criar(int $assessoriaId, int $usuarioId, array $dados): array
    {
        $permitidos = [
            'titulo',
            'cliente_id',
            'jornalistas_ids',
            'chave_rascunho',
            'template_id',
            'template_codigo',
            'template_assinatura',
            'blocos',
            'dados_envio',
        ];

        if (array_diff(array_keys($dados), $permitidos) !== []) {
            throw new \InvalidArgumentException(
                'O cadastro contém campos não permitidos.'
            );
        }

        $titulo = self::texto($dados['titulo'] ?? '', 'Título interno', 150);
        $clienteId = null;

        if (isset($dados['cliente_id']) && $dados['cliente_id'] !== '') {
            $clienteId = self::id($dados['cliente_id'], 'Cliente');
        }

        $ids = $dados['jornalistas_ids'] ?? [];

        if (!is_array($ids) || !array_is_list($ids) || count($ids) > 10000) {
            throw new \InvalidArgumentException('Selecione uma lista com até 10.000 jornalistas.');
        }

        $ids = array_map(static fn($id) => self::id($id, 'Jornalista'), $ids);
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_NUMERIC);

        $chave = $dados['chave_rascunho'] ?? null;

        if ($chave !== null) {
            if (
                !is_string($chave)
                || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iD', $chave)
            ) {
                throw new \InvalidArgumentException('A chave do rascunho deve ser um UUID válido.');
            }

            $chave = strtolower($chave);
        }

        $templateId = null;

        if (isset($dados['template_id']) && $dados['template_id'] !== '') {
            $templateId = self::id($dados['template_id'], 'Template');
        }

        $templateCodigo = self::texto(
            $dados['template_codigo'] ?? '',
            'Código do template',
            50
        );

        $templateCodigo = $templateCodigo === ''
            ? null
            : $templateCodigo;

        $templateAssinatura = self::texto(
            $dados['template_assinatura'] ?? '',
            'Assinatura do template',
            64
        );

        if ($templateId !== null && $templateCodigo !== null) {
            throw new \InvalidArgumentException(
                'Escolha apenas um template para o release.'
            );
        }

        $temTemplate = $templateId !== null || $templateCodigo !== null;

        if ($temTemplate && !preg_match('/^[a-f0-9]{64}$/D', $templateAssinatura)) {
            throw new \InvalidArgumentException(
                'Selecione novamente o template do release.'
            );
        }

        if (!$temTemplate && $templateAssinatura !== '') {
            throw new \InvalidArgumentException(
                'Informe o template correspondente à seleção.'
            );
        }

        $temBlocos = array_key_exists('blocos', $dados);

        $blocos = $temBlocos
            ? ReleaseBlocosService::validar($dados['blocos'])
            : null;

        $temDadosEnvio = array_key_exists('dados_envio', $dados);

        $dadosEnvio = self::validarDadosEnvio(
            $temDadosEnvio ? $dados['dados_envio'] : []
        );

        $dadosAssinatura = [$titulo, $clienteId, $ids];

        if ($temTemplate) {
            $dadosAssinatura[] = [
                $templateId,
                $templateCodigo,
                $templateAssinatura,
            ];
        }

        if ($temBlocos) {
            $dadosAssinatura[] = ['blocos' => $blocos];
        }

        if ($temDadosEnvio) {
            $dadosAssinatura[] = ['dados_envio' => $dadosEnvio];
        }

        $assinatura = hash(
            'sha256',
            json_encode($dadosAssinatura, JSON_THROW_ON_ERROR)
        );
        
        $existente = self::cadastroExistente($assessoriaId, $usuarioId, $chave, $assinatura);

        if ($existente !== null) {
            return $existente;
        }

        $db = Connection::get();
        $db->beginTransaction();

        try {
            $modelo = $temTemplate
                ? TemplateService::buscarParaRelease(
                    $assessoriaId,
                    $templateId,
                    $templateCodigo,
                    $templateAssinatura
                )
                : null;

            if ($clienteId !== null && !Cliente::buscarPorId($clienteId, $assessoriaId)) {
                throw new \OutOfBoundsException('Cliente não encontrado nesta assessoria.');
            }

            $jornalistas = [];

            if ($ids !== []) {
                $marcadores = [];
                $parametros = ['assessoria_id' => $assessoriaId];

                foreach ($ids as $indice => $id) {
                    $nome = 'jornalista_' . $indice;
                    $marcadores[] = ':' . $nome;
                    $parametros[$nome] = $id;
                }

                $jornalistas = self::consultar('
                    SELECT id, email, ativo FROM jornalistas
                    WHERE assessoria_id = :assessoria_id AND id IN ('
                        . implode(', ', $marcadores) . ')
                    ORDER BY id ASC LOCK IN SHARE MODE
                ', $parametros)->fetchAll();

                if (count($jornalistas) !== count($ids)) {
                    throw new \InvalidArgumentException(
                        'Há jornalistas que não estão disponíveis nesta assessoria. Revise a seleção.'
                    );
                }
            }

           self::consultar('
                INSERT INTO releases (
                    assessoria_id, cliente_id, template_id, template_codigo,
                    criado_por, titulo, assunto, primeira_linha,
                    nome_remetente, responder_para, blocos_json,
                    status, chave_rascunho, assinatura_cadastro
                ) VALUES (
                    :assessoria_id, :cliente_id, :template_id, :template_codigo,
                    :criado_por, :titulo, :assunto, :primeira_linha,
                    :nome_remetente, :responder_para, :blocos_json,
                    \'RASCUNHO\', :chave_rascunho, :assinatura_cadastro
                )
            ', [
                'assessoria_id' => $assessoriaId,
                'cliente_id' => $clienteId,
                'template_id' => $modelo['id'] ?? null,
                'template_codigo' => $modelo['codigo'] ?? null,
                'criado_por' => $usuarioId,
                'titulo' => $titulo,
                'assunto' => $dadosEnvio['assunto'],
                'primeira_linha' => $dadosEnvio['primeira_linha'],
                'nome_remetente' => $dadosEnvio['nome_remetente'],
                'responder_para' => $dadosEnvio['responder_para'],
                'blocos_json' => json_encode(
                    $blocos ?? $modelo['blocos'] ?? [],
                    JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
                ),
                'chave_rascunho' => $chave,
                'assinatura_cadastro' => $chave === null ? null : $assinatura,
            ]);
            
            $releaseId = (int) $db->lastInsertId();
            $emails = [];

            foreach ($jornalistas as $jornalista) {
                $email = self::emailDestinatario($jornalista);

                if ($email === null) {
                    throw new \InvalidArgumentException(
                        'Selecione jornalistas ativos com e-mail válido. Revise os contatos no Mailing.'
                    );
                }

                if (isset($emails[$email])) {
                    continue;
                }

                self::consultar('
                    INSERT INTO release_destinatarios (
                        assessoria_id, release_id, jornalista_id, email
                    ) VALUES (:assessoria_id, :release_id, :jornalista_id, :email)
                ', [
                    'assessoria_id' => $assessoriaId,
                    'release_id' => $releaseId,
                    'jornalista_id' => (int) $jornalista['id'],
                    'email' => $email,
                ]);

                $emails[$email] = true;
            }

            $release = self::buscar($assessoriaId, $releaseId);
            $db->commit();

            return $release;
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            if ($erro instanceof \PDOException && (int) ($erro->errorInfo[1] ?? 0) === 1062) {
                $existente = self::cadastroExistente($assessoriaId, $usuarioId, $chave, $assinatura);

                if ($existente !== null) {
                    return $existente;
                }
            }

            if ($erro instanceof \PDOException && (int) ($erro->errorInfo[1] ?? 0) === 1452) {
                throw new \InvalidArgumentException('Um vínculo do rascunho foi alterado. Revise os dados.');
            }

            throw $erro;
        }
    }
    
    private static function emailDestinatario(array $contato): ?string
    {
        $email = strtolower(trim($contato['email'] ?? ''));

        return (bool) $contato['ativo'] && filter_var($email, FILTER_VALIDATE_EMAIL)
            ? $email
            : null;
    }

    private static function formatarDestinatario(array $contato): array
    {
        $email = self::emailDestinatario($contato);

        return [
            'id' => (int) $contato['id'],
            'nome' => $contato['nome'],
            'email' => $email ?? $contato['email'],
            'veiculo_nome' => $contato['veiculo_nome'],
            'ativo' => (int) $contato['ativo'],
            'elegivel' => $email !== null,
        ];
    }

    public static function selecionarDestinatarios(
        int $assessoriaId,
        array $dados
    ): array {
        $busca = self::texto($dados['busca'] ?? '', 'Busca', 255);
        $estado = self::texto($dados['estado'] ?? '', 'Estado', 100);
        $cidade = self::texto($dados['cidade'] ?? '', 'Cidade', 100);
        $cargo = self::texto($dados['cargo'] ?? '', 'Cargo', 100);

        $veiculoId = null;
        $ativo = null;

        if (isset($dados['veiculo_id']) && $dados['veiculo_id'] !== '') {
            $veiculoId = self::id($dados['veiculo_id'], 'Veículo');
        }

        if (isset($dados['ativo']) && $dados['ativo'] !== '') {
            if (!in_array($dados['ativo'], [0, 1, '0', '1'], true)) {
                throw new \InvalidArgumentException(
                    'Filtro de situação inválido.'
                );
            }

            $ativo = (int) $dados['ativo'];
        }

        if (isset($dados['page']) || isset($dados['limit'])) {
            $page = self::id($dados['page'] ?? 1, 'Página');
            $limit = self::id($dados['limit'] ?? 30, 'Limite');

            if ($limit > 100 || $page > intdiv(PHP_INT_MAX, $limit)) {
                throw new \InvalidArgumentException('Paginação inválida.');
            }

            $resultado = JornalistaService::listar(
                $assessoriaId,
                $page,
                $limit,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo
            );
            $resultado['jornalistas'] = array_map(
                [self::class, 'formatarDestinatario'],
                $resultado['jornalistas']
            );

            return $resultado;
        }

        $db = Connection::get();
        $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $db->beginTransaction();

        try {
            $jornalistas = [];
            $encontrados = 0;

            foreach (JornalistaService::exportar(
                $assessoriaId,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo
            ) as $contato) {
                $encontrados++;
                $destinatario = self::formatarDestinatario($contato);

                if (!$destinatario['elegivel']) {
                    continue;
                }

                if (count($jornalistas) >= 10000) {
                    throw new \InvalidArgumentException(
                        'O limite por release é 10.000 jornalistas. Refine os filtros.'
                    );
                }

                $jornalistas[] = $destinatario;
            }

            $db->commit();

            return [
                'jornalistas' => $jornalistas,
                'total_encontrados' => $encontrados,
                'total_ignorados' =>
                    $encontrados - count($jornalistas),
            ];
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $erro;
        }
    }
}
