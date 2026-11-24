<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

final class ReleaseEnvioService
{
    private static function bloquearRelease(int $assessoriaId, int $id): array
    {
        $release = self::sql(
            'SELECT * FROM releases WHERE id = :id AND assessoria_id = :a FOR UPDATE',
            ['id' => $id, 'a' => $assessoriaId]
        )->fetch();
        if (!$release || ReleaseService::foiDescartado($release)) {
            throw new \OutOfBoundsException('Release não encontrado nesta assessoria.');
        }
        return $release;
    }

    private static function conferirVersao(
        int $assessoriaId,
        int $id,
        mixed $versao
    ): void
    {
        if (!is_string($versao) || !preg_match('/^[a-f0-9]{64}$/D', $versao)) {
            throw new \InvalidArgumentException('Reabra o release para conferir sua versão.');
        }
        if (!hash_equals(ReleaseService::buscar($assessoriaId, $id)['versao_edicao'], $versao)) {
            throw new \DomainException(
                'O release foi alterado. Atualize a tela antes de continuar.'
            );
        }
    }

    private static function horarioAgendamento(
        mixed $data,
        mixed $hora
    ): \DateTimeImmutable
    {
        if (
            !is_string($data) || !is_string($hora)
            || !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D', $data)
            || !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', $hora)
        ) {
            throw new \InvalidArgumentException('Informe uma data e um horário válidos.');
        }
        $texto = $data . ' ' . $hora;
        $instante = \DateTimeImmutable::createFromFormat(
            '!Y-m-d H:i',
            $texto,
            new \DateTimeZone('America/Sao_Paulo')
        );
        if (!$instante || $instante->format('Y-m-d H:i') !== $texto) {
            throw new \InvalidArgumentException(
                'Informe uma data e um horário válidos em Brasília.'
            );
        }
        return $instante;
    }

    public static function agendar(int $assessoriaId, mixed $id, array $dados): array
    {
        $id = self::numero($id);
        $instante = self::horarioAgendamento(
            $dados['data'] ?? null,
            $dados['hora'] ?? null
        );
        $horario = $instante->format('Y-m-d H:i:s');
        $db = Connection::get();
        $db->beginTransaction();
        try {
            $release = self::bloquearRelease($assessoriaId, $id);
            // Repetir uma solicitação já confirmada não altera nem duplica o envio.
            $repetido = $release['agendado_para'] === $horario
                && in_array(
                    $release['status'],
                    ['AGENDADO', 'NA_FILA', 'ENVIANDO', 'ENVIADO', 'PARCIAL', 'FALHOU'],
                    true
                );
            if (!$repetido) {
                self::conferirVersao($assessoriaId, $id, $dados['versao_edicao'] ?? null);
                if (!in_array($release['status'], ['RASCUNHO', 'AGENDADO'], true)) {
                    throw new \DomainException(
                        'Este release já entrou no processamento e não pode ser agendado.'
                    );
                }
                if ($instante->getTimestamp() < time() + 60) {
                    throw new \InvalidArgumentException(
                        'Escolha um horário com pelo menos um minuto de antecedência.'
                    );
                }
                self::validarPronto($assessoriaId, $id, $release);
                self::sql(
                    "UPDATE releases
                     SET status = 'AGENDADO', agendado_para = :horario,
                         versao_programacao = versao_programacao + 1
                     WHERE id = :id AND assessoria_id = :a",
                    ['horario' => $horario, 'id' => $id, 'a' => $assessoriaId]
                );
            }
            $db->commit();
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $erro;
        }
        return self::situacao($assessoriaId, $id);
    }

    public static function cancelarAgendamento(
        int $assessoriaId,
        mixed $id,
        mixed $versao
    ): array
    {
        $id = self::numero($id);
        $db = Connection::get();
        $db->beginTransaction();
        try {
            $release = self::bloquearRelease($assessoriaId, $id);
            if ($release['status'] !== 'RASCUNHO' || $release['agendado_para'] !== null) {
                self::conferirVersao($assessoriaId, $id, $versao);
                if ($release['status'] !== 'AGENDADO') {
                    throw new \DomainException(
                        'O envio já saiu do agendamento. Atualize a tela e confira a opção de cancelar envio.'
                    );
                }
                self::sql(
                    "UPDATE releases
                     SET status = 'RASCUNHO', agendado_para = NULL,
                         versao_programacao = versao_programacao + 1
                     WHERE id = :id AND assessoria_id = :a",
                    ['id' => $id, 'a' => $assessoriaId]
                );
            }
            $db->commit();
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $erro;
        }
        return self::situacao($assessoriaId, $id);
    }

    public static function cancelarEnvio(
        int $assessoriaId,
        mixed $id,
        mixed $versao
    ): array
    {
        $id = self::numero($id);
        $db = Connection::get();
        $db->beginTransaction();
        try {
            $release = self::bloquearRelease($assessoriaId, $id);
            if ($release['status'] !== 'CANCELADO') {
                self::conferirVersao($assessoriaId, $id, $versao);
                if (!in_array($release['status'], ['NA_FILA', 'ENVIANDO'], true)) {
                    throw new \DomainException('Não há um envio na fila para cancelar.');
                }
                $totais = self::totais($assessoriaId, $id);
                if ($totais['pendentes'] + $totais['processando'] === 0) {
                    throw new \DomainException(
                        'O processamento já terminou. Atualize a tela.'
                    );
                }
                self::sql(
                    "UPDATE releases
                     SET status = 'CANCELADO', versao_programacao = versao_programacao + 1
                     WHERE id = :id AND assessoria_id = :a",
                    ['id' => $id, 'a' => $assessoriaId]
                );
                self::sql(
                    "UPDATE release_destinatarios
                     SET status = 'CANCELADO', proxima_tentativa_em = NULL,
                         erro_tipo = NULL, smtp_codigo = NULL, erro_mensagem = NULL
                     WHERE release_id = :id AND assessoria_id = :a AND status = 'PENDENTE'",
                    ['id' => $id, 'a' => $assessoriaId]
                );
            }
            $db->commit();
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $erro;
        }
        return self::situacao($assessoriaId, $id);
    }

    private static function numero(mixed $valor): int
    {
        if (
            !is_int($valor)
            && (
                !is_string($valor)
                || !preg_match('/^[1-9][0-9]*$/D', $valor)
            )
        ) {
            throw new \InvalidArgumentException(
                'Identificador ou página inválida.'
            );
        }

        $numero = filter_var(
            $valor,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if ($numero === false) {
            throw new \InvalidArgumentException(
                'Identificador ou página inválida.'
            );
        }

        return $numero;
    }

    private static function sql(
        string $sql,
        array $params = []
    ): \PDOStatement {
        $stmt = Connection::get()->prepare($sql);

        foreach ($params as $key => $value) {
            $tipo = match (true) {
                $value === null => PDO::PARAM_NULL,
                is_int($value) => PDO::PARAM_INT,
                default => PDO::PARAM_STR,
            };

            $stmt->bindValue(':' . $key, $value, $tipo);
        }

        $stmt->execute();

        return $stmt;
    }

    public static function enfileirar(
        int $assessoriaId,
        mixed $id,
        mixed $versao = null
    ): array {
        $id = self::numero($id);
        if ($versao !== null && (!is_string($versao) || !preg_match('/^[a-f0-9]{64}$/D', $versao))) {
            throw new \InvalidArgumentException(
                'Reabra o release para conferir sua versão antes de enviar.'
            );
        }
        $db = Connection::get();
        $db->beginTransaction();

        try {
            $release = self::sql(
                'SELECT *
                 FROM releases
                 WHERE id = :id
                   AND assessoria_id = :a
                 FOR UPDATE',
                ['id' => $id, 'a' => $assessoriaId]
            )->fetch();

            if (!$release || ReleaseService::foiDescartado($release)) {
                throw new \OutOfBoundsException(
                    'Release não encontrado nesta assessoria.'
                );
            }

            if ($release['status'] === 'AGENDADO') {
                throw new \DomainException(
                    'Este release está agendado.'
                );
            }

            if ($release['status'] === 'RASCUNHO') {
                if ($versao !== null && !hash_equals(
                    ReleaseService::buscar($assessoriaId, $id)['versao_edicao'],
                    $versao
                )) {
                    throw new \DomainException(
                        'Este release foi alterado após a revisão. Confira o conteúdo atual antes de enviar.'
                    );
                }
                self::validarPronto($assessoriaId, $id, $release);

                self::sql(
                    "UPDATE releases
                     SET status = 'NA_FILA'
                     WHERE id = :id
                       AND assessoria_id = :a",
                    ['id' => $id, 'a' => $assessoriaId]
                );
            }

            $db->commit();
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $erro;
        }

        // Solicitações repetidas consultam o envio existente.
        return self::situacao($assessoriaId, $id);
    }

    private static function validarPronto(
        int $assessoriaId,
        int $id,
        array $release
    ): void
    {
        if (trim($release['titulo']) === '') {
            throw new \InvalidArgumentException(
                'Preencha o título interno antes de enviar.'
            );
        }

        $destinatarios = self::sql(
            'SELECT email, status
             FROM release_destinatarios
             WHERE release_id = :id
               AND assessoria_id = :a
             FOR UPDATE',
            ['id' => $id, 'a' => $assessoriaId]
        )->fetchAll();

        if (!$destinatarios) {
            throw new \InvalidArgumentException(
                'Selecione pelo menos um destinatário.'
            );
        }

        $emails = [];

        foreach ($destinatarios as $d) {
            $email = strtolower(trim($d['email']));

            if (
                $d['status'] !== 'PENDENTE'
                || !filter_var(
                    $email,
                    FILTER_VALIDATE_EMAIL
                )
                || isset($emails[$email])
            ) {
                throw new \InvalidArgumentException(
                    'Revise os destinatários do release.'
                );
            }

            $emails[$email] = true;
        }

        $blocos = json_decode(
            $release['blocos_json'],
            true,
            64,
            JSON_THROW_ON_ERROR
        );

        $blocos = ReleaseBlocosService::validar($blocos);

        $temConteudo = false;

        foreach ($blocos as $bloco) {
            if (
                in_array(
                    $bloco['tipo'],
                    ['imagem', 'botao', 'arquivo'],
                    true
                )
            ) {
                $temConteudo =
                    trim($bloco['url'] ?? '') !== '';
            } elseif (
                !in_array(
                    $bloco['tipo'],
                    ['divisor', 'espacamento'],
                    true
                )
            ) {
                $temConteudo =
                    trim($bloco['texto'] ?? '') !== '';
            }

            if ($temConteudo) {
                break;
            }
        }

        if (!$temConteudo) {
            throw new \InvalidArgumentException(
                'Adicione conteúdo ao release antes de enviar.'
            );
        }

        $mailer = ReleaseEmailService::preparar(
            $assessoriaId,
            array_intersect_key(
                $release,
                array_flip([
                    'assunto',
                    'primeira_linha',
                    'nome_remetente',
                    'responder_para',
                ])
            ),
            $blocos,
            $destinatarios[0]['email']
        );

        // Gera e valida o MIME sem transmitir o e-mail.
        if (!$mailer->preSend()) {
            throw new \RuntimeException(
                'Não foi possível preparar o e-mail.',
                503
            );
        }

    }

    public static function situacao(
        int $assessoriaId,
        mixed $id,
        array $filtros = []
    ): array {
        $id = self::numero($id);
        $page = self::numero($filtros['page'] ?? 1);

        if ($page > intdiv(PHP_INT_MAX, 30)) {
            throw new \InvalidArgumentException(
                'Página inválida.'
            );
        }

        $status = $filtros['status'] ?? 'TODOS';

        if (
            !in_array(
                $status,
                [
                    'TODOS',
                    'PENDENTE',
                    'ENVIANDO',
                    'ENVIADO',
                    'ERRO',
                    'CANCELADO',
                ],
                true
            )
        ) {
            throw new \InvalidArgumentException(
                'Situação de destinatário inválida.'
            );
        }

        $params = ['id' => $id, 'a' => $assessoriaId];

        $release = self::sql(
            'SELECT id, status, agendado_para, iniciado_em, enviado_em, assinatura_cadastro
             FROM releases
             WHERE id = :id
               AND assessoria_id = :a',
            $params
        )->fetch();

        if (!$release || ReleaseService::foiDescartado($release)) {
            throw new \OutOfBoundsException(
                'Release não encontrado nesta assessoria.'
            );
        }

        unset($release['assinatura_cadastro']);
        $release['id'] = (int) $release['id'];
        $release['agendamento_fuso'] = 'America/Sao_Paulo';
        $totais = self::totais($assessoriaId, $id);

        $where =
            'd.release_id = :id AND d.assessoria_id = :a';

        if ($status !== 'TODOS') {
            $where .= ' AND d.status = :status';
            $params['status'] = $status;
        }

        $total = (int) self::sql(
            'SELECT COUNT(*)
             FROM release_destinatarios d
             WHERE ' . $where,
            $params
        )->fetchColumn();

        $destinatarios = self::sql(
            'SELECT
                d.id,
                d.email,
                d.status,
                d.enviado_em,
                d.erro_mensagem,
                d.tentativas,
                d.ultima_tentativa_em,
                d.proxima_tentativa_em,
                d.erro_tipo,
                d.smtp_codigo,
                d.aberto_em,
                d.aberturas_quantidade,
                (d.tracking_token IS NOT NULL) AS rastreamento_abertura,
                j.nome
             FROM release_destinatarios d
             LEFT JOIN jornalistas j
                ON j.id = d.jornalista_id
               AND j.assessoria_id = d.assessoria_id
             WHERE ' . $where . '
             ORDER BY d.id
             LIMIT :limite OFFSET :offset',
            [
                ...$params,
                'limite' => 30,
                'offset' => ($page - 1) * 30,
            ]
        )->fetchAll();

        foreach ($destinatarios as &$d) {
            $d['id'] = (int) $d['id'];
            $d['tentativas'] = (int) $d['tentativas'];
            $d['rastreamento_abertura'] = (bool) $d['rastreamento_abertura'];
            $d['aberturas_quantidade'] = (int) $d['aberturas_quantidade'];
            $d['aberto_em'] = $d['aberto_em'] !== null
                ? str_replace(' ', 'T', $d['aberto_em']) . 'Z'
                : null;

            $d['smtp_codigo'] = $d['smtp_codigo'] !== null
                ? (int) $d['smtp_codigo']
                : null;
        }

        unset($d);

        return [
            'release' => $release,
            'totais' => $totais,
            'aberturas' => ReleaseAberturaService::metricas($assessoriaId, $id),
            'destinatarios' => $destinatarios,
            'pagination' => [
                'page' => $page,
                'limit' => 30,
                'total' => $total,
            ],
        ];
    }

    private static function totais(
        int $assessoriaId,
        int $id
    ): array {
        $linha = self::sql(
            "SELECT
                COUNT(*) AS total,

                COALESCE(SUM(status = 'PENDENTE'), 0)
                    AS pendentes,

                COALESCE(SUM(status = 'ENVIANDO'), 0)
                    AS processando,

                COALESCE(SUM(status = 'ENVIADO'), 0)
                    AS aceitos,

                COALESCE(SUM(status = 'ERRO'), 0)
                    AS falhas,

                COALESCE(SUM(status = 'CANCELADO'), 0) AS cancelados,

                COALESCE(SUM(
                    status = 'ERRO'
                    AND erro_tipo IN ('TEMPORARIA', 'CONFIGURACAO')
                ), 0) AS repetiveis,

                COALESCE(SUM(
                    status = 'ERRO'
                    AND (erro_tipo = 'INCERTA' OR erro_tipo IS NULL)
                ), 0) AS incertos,

                COALESCE(SUM(
                    status = 'PENDENTE'
                    AND proxima_tentativa_em IS NOT NULL
                ), 0) AS aguardando_retentativa

            FROM release_destinatarios
            WHERE release_id = :id
            AND assessoria_id = :a",
            [
                'id' => $id,
                'a' => $assessoriaId,
            ]
        )->fetch();

        return array_map('intval', $linha);
    }

    public static function reenfileirarFalhas(
        int $assessoriaId,
        mixed $id
    ): array {
        $id = self::numero($id);
        $db = Connection::get();
        $db->beginTransaction();

        try {
            $release = self::sql(
                'SELECT *
                FROM releases
                WHERE id = :id
                AND assessoria_id = :a
                FOR UPDATE',
                [
                    'id' => $id,
                    'a' => $assessoriaId,
                ]
            )->fetch();

            if (!$release || ReleaseService::foiDescartado($release)) {
                throw new \OutOfBoundsException(
                    'Release não encontrado nesta assessoria.'
                );
            }

            // Uma repetição da solicitação não duplica a fila.
            if (
                in_array(
                    $release['status'],
                    ['NA_FILA', 'ENVIANDO'],
                    true
                )
            ) {
                $db->commit();

                return self::situacao($assessoriaId, $id);
            }

            if (
                !in_array(
                    $release['status'],
                    ['PARCIAL', 'FALHOU'],
                    true
                )
            ) {
                throw new \DomainException(
                    'Este release não possui um envio encerrado para tentar novamente.'
                );
            }

            $alterados = self::sql(
                "UPDATE release_destinatarios
                SET status = 'PENDENTE',
                    proxima_tentativa_em = NULL
                WHERE release_id = :id
                AND assessoria_id = :a
                AND status = 'ERRO'
                AND erro_tipo IN ('TEMPORARIA', 'CONFIGURACAO')",
                [
                    'id' => $id,
                    'a' => $assessoriaId,
                ]
            )->rowCount();

            if ($alterados === 0) {
                throw new \DomainException(
                    'Não há falhas disponíveis para uma nova tentativa segura.'
                );
            }

            self::sql(
                "UPDATE releases
                SET status = 'NA_FILA',
                    enviado_em = NULL
                WHERE id = :id
                AND assessoria_id = :a",
                [
                    'id' => $id,
                    'a' => $assessoriaId,
                ]
            );

            $db->commit();
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            throw $erro;
        }

        return self::situacao($assessoriaId, $id);
    }

    private static function finalizar(
        int $assessoriaId,
        int $id
    ): void {
        $t = self::totais($assessoriaId, $id);

        if ($t['pendentes'] + $t['processando'] > 0) {
            return;
        }

        $status = $t['aceitos'] === 0
            ? 'FALHOU'
            : ($t['falhas'] > 0 ? 'PARCIAL' : 'ENVIADO');

        self::sql(
            "UPDATE releases
             SET status = :status,
                 enviado_em = NOW()
             WHERE id = :id
               AND assessoria_id = :a
               AND status IN ('NA_FILA', 'ENVIANDO')",
            [
                'status' => $status,
                'id' => $id,
                'a' => $assessoriaId,
            ]
        );
    }

    public static function processar(
        int $limite = 20,
        int $intervaloMs = 1000,
        ?callable $transporte = null
    ): array {
        if (PHP_SAPI !== 'cli') {
            throw new \RuntimeException('Execute pelo terminal.');
        }

        if (
            $limite < 1 ||
            $limite > 1000 ||
            $intervaloMs < 0 ||
            $intervaloMs > 60000
        ) {
            throw new \InvalidArgumentException(
                'Limite ou intervalo inválido.'
            );
        }

        if ($transporte === null) {
            ReleaseEmailService::validarConfiguracao();
        }
        ReleaseAberturaService::validarConfiguracao();
        $rastrearAberturas = ReleaseAberturaService::basePublica() !== null;

        $db = Connection::get();

        $chave = 'logos-envio-' . substr(
            hash(
                'sha256',
                $db->query('SELECT DATABASE()')->fetchColumn()
            ),
            0,
            32
        );

        $lock = (int) self::sql(
            'SELECT GET_LOCK(:chave, 0)',
            ['chave' => $chave]
        )->fetchColumn();

        $resultado = [
            'ocupado' => $lock !== 1,
            'processados' => 0,
            'aceitos' => 0,
            'falhas' => 0,
            'reagendados' => 0,
        ];

        if ($lock !== 1) {
            return $resultado;
        }

        try {
            // Como temos a trava exclusiva, ENVIANDO remanescente
            // pertence a uma execução anterior interrompida.
            self::sql(
                "UPDATE release_destinatarios d
                JOIN releases r
                ON r.id = d.release_id
                AND r.assessoria_id = d.assessoria_id
                SET d.status = 'ERRO',
                    d.erro_tipo = 'INCERTA',
                    d.smtp_codigo = NULL,
                    d.proxima_tentativa_em = NULL,
                    d.erro_mensagem =
                        'A execução foi interrompida sem confirmação. Não houve repetição automática.'
                WHERE r.status IN ('NA_FILA', 'ENVIANDO', 'CANCELADO')
                AND d.status = 'ENVIANDO'"
            );

            self::sql(
                "UPDATE releases SET status = 'NA_FILA'
                 WHERE status = 'AGENDADO' AND agendado_para <= :agora",
                ['agora' => (new \DateTimeImmutable('now', new \DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s')]
            );

            $ativos = self::sql(
                "SELECT id, assessoria_id
                FROM releases
                WHERE status IN ('NA_FILA', 'ENVIANDO')"
            )->fetchAll();

            foreach ($ativos as $r) {
                self::finalizar(
                    (int) $r['assessoria_id'],
                    (int) $r['id']
                );
            }

            for ($i = 0; $i < $limite; $i++) {
                $db->beginTransaction();

                try {
                    $candidato = self::sql(
                        "SELECT d.id, d.release_id, d.assessoria_id
                         FROM release_destinatarios d
                         JOIN releases r ON r.id = d.release_id AND r.assessoria_id = d.assessoria_id
                         WHERE r.status IN ('NA_FILA', 'ENVIANDO') AND d.status = 'PENDENTE'
                           AND (d.proxima_tentativa_em IS NULL OR d.proxima_tentativa_em <= NOW())
                         ORDER BY COALESCE(d.proxima_tentativa_em, d.created_at), d.id LIMIT 1"
                    )->fetch();

                    if (!$candidato) {
                        $db->commit();
                        break;
                    }
                    $r = self::bloquearRelease(
                        (int) $candidato['assessoria_id'],
                        (int) $candidato['release_id']
                    );
                    if (!in_array($r['status'], ['NA_FILA', 'ENVIANDO'], true)) {
                        $db->commit();
                        continue;
                    }
                    $destinatario = self::sql(
                        "SELECT id, release_id, assessoria_id, email, tentativas, tracking_token
                         FROM release_destinatarios
                         WHERE id = :id AND status = 'PENDENTE'
                           AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= NOW()) FOR UPDATE",
                        ['id' => (int) $candidato['id']]
                    )->fetch();
                    if (!$destinatario) {
                        $db->commit();
                        continue;
                    }
                    $tokenAnterior = $destinatario['tracking_token'];
                    $token = $rastrearAberturas
                        ? (ReleaseAberturaService::tokenValido($tokenAnterior)
                            ? $tokenAnterior
                            : bin2hex(random_bytes(32)))
                        : null;
                    $limparAbertura = $token !== $tokenAnterior
                        ? ', aberto_em = NULL, aberturas_quantidade = 0'
                        : '';
                    $destinatario['tracking_token'] = $token;
                    $d = [...$r, ...$destinatario];

                    self::sql(
                        "UPDATE release_destinatarios
                        SET status = 'ENVIANDO',
                            tentativas = tentativas + 1,
                            ultima_tentativa_em = NOW(),
                            proxima_tentativa_em = NULL,
                            tracking_token = :token $limparAbertura
                        WHERE id = :id
                        AND status = 'PENDENTE'",
                        ['id' => (int) $d['id'], 'token' => $token]
                    );

                    self::sql(
                        "UPDATE releases
                        SET status = 'ENVIANDO',
                            iniciado_em = COALESCE(iniciado_em, NOW())
                        WHERE id = :id
                        AND assessoria_id = :a",
                        [
                            'id' => (int) $d['release_id'],
                            'a' => (int) $d['assessoria_id'],
                        ]
                    );

                    $db->commit();
                } catch (\Throwable $erro) {
                    if ($db->inTransaction()) {
                        $db->rollBack();
                    }

                    throw $erro;
                }

                $tentativas = (int) $d['tentativas'] + 1;

                $smtp = new ReleaseSmtpSeguro();
                $smtp->Timelimit = 60;

                $mailer = null;
                $preparado = false;

                try {
                    if ($transporte !== null) {
                        $transporte($d);

                        $situacao = [
                            'tipo' => 'ACEITO',
                            'codigo' => null,
                            'mensagem' => null,
                        ];
                    } else {
                        $mailer = ReleaseEmailService::preparar(
                            (int) $d['assessoria_id'],
                            array_intersect_key(
                                $d,
                                array_flip([
                                    'assunto',
                                    'primeira_linha',
                                    'nome_remetente',
                                    'responder_para',
                                ])
                            ),
                            json_decode(
                                $d['blocos_json'],
                                true,
                                64,
                                JSON_THROW_ON_ERROR
                            ),
                            $d['email'],
                            false,
                            $d['tracking_token']
                        );

                        $mailer->setSMTPInstance($smtp);
                        $mailer->SMTPDebug = 0;
                        $mailer->SMTPKeepAlive = false;
                        $mailer->Timeout = 60;

                        $dominio = substr(
                            strrchr($mailer->From, '@'),
                            1
                        );

                        $mailer->MessageID =
                            '<logos-' .
                            $d['release_id'] . '-' .
                            $d['id'] . '@' .
                            $dominio . '>';

                        if (!$mailer->preSend()) {
                            throw new \RuntimeException(
                                'Não foi possível preparar o e-mail.'
                            );
                        }

                        $preparado = true;

                        if (!$mailer->postSend()) {
                            throw new \RuntimeException(
                                'Envio não confirmado.'
                            );
                        }

                        $situacao = $smtp->resultado($preparado);
                    }
                } catch (\Throwable $erro) {
                    $situacao = $transporte === null
                        ? $smtp->resultado($preparado)
                        : [
                            'tipo' => 'INCERTA',
                            'codigo' => null,
                            'mensagem' =>
                                'O transporte não confirmou o resultado.',
                        ];

                    error_log(
                        'Release ' . $d['release_id'] .
                        ', destinatário ' . $d['id'] .
                        ': ' . $situacao['tipo'] .
                        ', código ' .
                        ($situacao['codigo'] ?? 'ausente')
                    );
                } finally {
                    if ($mailer !== null) {
                        try {
                            $mailer->smtpClose();
                        } catch (\Throwable) {
                            // O encerramento não muda o aceite já recebido.
                        }
                    }
                }

                // Serializa a conclusão com o cancelamento antes de reagendar uma falha.
                $db->beginTransaction();
                $releaseAtual = self::bloquearRelease(
                    (int) $d['assessoria_id'],
                    (int) $d['release_id']
                );
                $aceito = $situacao['tipo'] === 'ACEITO';

                $espera =
                    $situacao['tipo'] === 'TEMPORARIA' &&
                    $releaseAtual['status'] !== 'CANCELADO' &&
                    $tentativas < 3
                        ? ($tentativas === 1 ? 300 : 900)
                        : null;

                $params = ['id' => (int) $d['id']];

                if ($aceito) {
                    self::sql(
                        "UPDATE release_destinatarios
                        SET status = 'ENVIADO',
                            enviado_em = NOW(),
                            erro_tipo = NULL,
                            smtp_codigo = NULL,
                            erro_mensagem = NULL,
                            proxima_tentativa_em = NULL
                        WHERE id = :id
                        AND status = 'ENVIANDO'",
                        $params
                    );
                } else {
                    $params['tipo'] = $situacao['tipo'];
                    $params['mensagem'] = $situacao['mensagem'];
                    $params['codigo'] = $situacao['codigo'];
                    $params['status'] = $espera === null
                        ? 'ERRO'
                        : 'PENDENTE';

                    // $espera vem exclusivamente das constantes acima.
                    $proxima = $espera === null
                        ? 'NULL'
                        : 'DATE_ADD(NOW(), INTERVAL ' .
                            $espera . ' SECOND)';
                    $limparAbertura = $situacao['tipo'] !== 'INCERTA'
                        ? ', aberto_em = NULL, aberturas_quantidade = 0'
                        : '';

                    self::sql(
                        "UPDATE release_destinatarios
                        SET status = :status,
                            erro_tipo = :tipo,
                            smtp_codigo = :codigo,
                            erro_mensagem = :mensagem,
                            proxima_tentativa_em = $proxima $limparAbertura
                        WHERE id = :id
                        AND status = 'ENVIANDO'",
                        $params
                    );
                }

                if ($situacao['tipo'] === 'CONFIGURACAO') {
                    // Interrompe o restante deste release até a correção.
                    self::sql(
                        "UPDATE release_destinatarios
                        SET status = 'ERRO',
                            erro_tipo = 'CONFIGURACAO',
                            smtp_codigo = NULL,
                            proxima_tentativa_em = NULL,
                            erro_mensagem =
                                'O envio deste release foi interrompido. Corrija a configuração ou o conteúdo antes de tentar novamente.'
                        WHERE release_id = :id
                        AND assessoria_id = :a
                        AND status = 'PENDENTE'",
                        [
                            'id' => (int) $d['release_id'],
                            'a' => (int) $d['assessoria_id'],
                        ]
                    );
                }

                $resultado['processados']++;

                $contador = $aceito
                    ? 'aceitos'
                    : ($espera !== null ? 'reagendados' : 'falhas');

                $resultado[$contador]++;

                self::finalizar(
                    (int) $d['assessoria_id'],
                    (int) $d['release_id']
                );

                $db->commit();

                if ($situacao['tipo'] === 'CONFIGURACAO') {
                    break;
                }

                if ($intervaloMs > 0 && $i + 1 < $limite) {
                    usleep($intervaloMs * 1000);
                }
            }

            return $resultado;
        } finally {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            self::sql(
                'SELECT RELEASE_LOCK(:chave)',
                ['chave' => $chave]
            );
        }
    }
}
