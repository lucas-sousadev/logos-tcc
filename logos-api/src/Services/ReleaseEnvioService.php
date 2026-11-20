<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

final class ReleaseEnvioService
{
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
            $stmt->bindValue(
                ':' . $key,
                $value,
                is_int($value)
                    ? PDO::PARAM_INT
                    : PDO::PARAM_STR
            );
        }

        $stmt->execute();

        return $stmt;
    }

    public static function enfileirar(
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
                ['id' => $id, 'a' => $assessoriaId]
            )->fetch();

            if (!$release) {
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
            'SELECT id, status, iniciado_em, enviado_em
             FROM releases
             WHERE id = :id
               AND assessoria_id = :a',
            $params
        )->fetch();

        if (!$release) {
            throw new \OutOfBoundsException(
                'Release não encontrado nesta assessoria.'
            );
        }

        $release['id'] = (int) $release['id'];
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
        }

        return [
            'release' => $release,
            'totais' => $totais,
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
                    AS falhas
             FROM release_destinatarios
             WHERE release_id = :id
               AND assessoria_id = :a",
            ['id' => $id, 'a' => $assessoriaId]
        )->fetch();

        return array_map('intval', $linha);
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
            throw new \RuntimeException(
                'Execute o processamento pelo terminal.'
            );
        }

        if (
            $limite < 1
            || $limite > 1000
            || $intervaloMs < 0
            || $intervaloMs > 60000
        ) {
            throw new \InvalidArgumentException(
                'Limite ou intervalo inválido.'
            );
        }

        if ($transporte === null) {
            ReleaseEmailService::validarConfiguracao();
        }

        $db = Connection::get();

        $chave = 'logos-envio-' . substr(
            hash(
                'sha256',
                $db->query('SELECT DATABASE()')->fetchColumn()
            ),
            0,
            32
        );

        $lock = self::sql(
            'SELECT GET_LOCK(:chave, 0)',
            ['chave' => $chave]
        )->fetchColumn();

        $resultado = [
            'ocupado' => (int) $lock !== 1,
            'processados' => 0,
            'aceitos' => 0,
            'falhas' => 0,
        ];

        if ($resultado['ocupado']) {
            return $resultado;
        }

        try {
            $ativos = self::sql(
                "SELECT id, assessoria_id
                 FROM releases
                 WHERE status IN ('NA_FILA', 'ENVIANDO')"
            )->fetchAll();

            foreach ($ativos as $r) {
                self::sql(
                    "UPDATE release_destinatarios
                     SET status = 'ERRO',
                         erro_mensagem =
                         'A execução anterior terminou sem confirmar o envio. Não houve repetição automática.'
                     WHERE release_id = :id
                       AND assessoria_id = :a
                       AND status = 'ENVIANDO'",
                    [
                        'id' => (int) $r['id'],
                        'a' => (int) $r['assessoria_id'],
                    ]
                );

                self::finalizar(
                    (int) $r['assessoria_id'],
                    (int) $r['id']
                );
            }

            for ($i = 0; $i < $limite; $i++) {
                $db->beginTransaction();

                try {
                    $d = self::sql(
                        "SELECT
                            d.id,
                            d.release_id,
                            d.assessoria_id,
                            d.email,
                            r.assunto,
                            r.primeira_linha,
                            r.nome_remetente,
                            r.responder_para,
                            r.blocos_json
                         FROM release_destinatarios d
                         JOIN releases r
                            ON r.id = d.release_id
                           AND r.assessoria_id = d.assessoria_id
                         WHERE r.status IN (
                            'NA_FILA',
                            'ENVIANDO'
                         )
                           AND d.status = 'PENDENTE'
                         ORDER BY r.id, d.id
                         LIMIT 1
                         FOR UPDATE"
                    )->fetch();

                    if (!$d) {
                        $db->commit();
                        break;
                    }

                    self::sql(
                        "UPDATE release_destinatarios
                         SET status = 'ENVIANDO'
                         WHERE id = :id",
                        ['id' => (int) $d['id']]
                    );

                    self::sql(
                        "UPDATE releases
                         SET status = 'ENVIANDO',
                             iniciado_em =
                                COALESCE(iniciado_em, NOW())
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

                $falhou = false;

                try {
                    if ($transporte !== null) {
                        $transporte($d);
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
                            $d['email']
                        );

                        $dominio = substr(
                            strrchr($mailer->From, '@'),
                            1
                        );

                        $mailer->MessageID =
                            '<logos-' .
                            $d['release_id'] . '-' .
                            $d['id'] . '@' .
                            $dominio . '>';

                        if (!$mailer->send()) {
                            throw new \RuntimeException(
                                'SMTP não confirmou o envio.'
                            );
                        }
                    }
                } catch (\Throwable $erro) {
                    $falhou = true;

                    error_log(
                        'Falha ao enviar destinatário ' .
                        $d['id'] . ': ' .
                        $erro->getMessage()
                    );
                } finally {
                    if (isset($mailer)) {
                        $mailer->smtpClose();
                        unset($mailer);
                    }
                }

                // Uma falha no banco depois do aceite não deve
                // disparar uma segunda tentativa de transmissão.
                self::sql(
                    $falhou
                        ? "UPDATE release_destinatarios
                           SET status = 'ERRO',
                               erro_mensagem =
                               'O servidor não confirmou o resultado do envio. Confira antes de reenviar.'
                           WHERE id = :id
                             AND status = 'ENVIANDO'"
                        : "UPDATE release_destinatarios
                           SET status = 'ENVIADO',
                               enviado_em = NOW(),
                               erro_mensagem = NULL
                           WHERE id = :id
                             AND status = 'ENVIANDO'",
                    ['id' => (int) $d['id']]
                );

                $resultado['processados']++;
                $resultado[
                    $falhou ? 'falhas' : 'aceitos'
                ]++;

                self::finalizar(
                    (int) $d['assessoria_id'],
                    (int) $d['release_id']
                );

                if ($falhou) {
                    break;
                }

                if (
                    $i + 1 < $limite
                    && $intervaloMs > 0
                ) {
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