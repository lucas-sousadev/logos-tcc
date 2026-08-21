<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Models\Convite;
use Logos\AssessoriaApi\Database\Connection;
use RuntimeException;

class ConviteService
{
    private const DURACAO_DIAS = 7;

    public static function criar(int $assessoriaId, int $usuarioId, ?string $emailDestino): array {
        $pdo = Connection::get();

        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM convites
            WHERE criado_por = :criado_por
            AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        ");

        $stmt->execute([
            'criado_por' => $usuarioId
        ]);

        $quantidade = (int) $stmt->fetchColumn();

        if ($quantidade >= 3) {
            throw new \RuntimeException(
                'Limite de 3 convites a cada 5 minutos atingido. Tente novamente mais tarde.'
            );
        }

        if ($emailDestino !== null) {
            $emailDestino = trim($emailDestino);

            if (
                $emailDestino !== '' &&
                !filter_var($emailDestino, FILTER_VALIDATE_EMAIL)
            ) {
                throw new \InvalidArgumentException(
                    'O e-mail do convite é inválido.'
                );
            }

            if ($emailDestino === '') {
                $emailDestino = null;
            }
        }

        /*
         * Exemplo:
         * LOGOS-7K4M-92PX
         */
        $caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        do {
            $parte1 = '';
            $parte2 = '';

            for ($i = 0; $i < 4; $i++) {
                $parte1 .= $caracteres[
                    random_int(
                        0,
                        strlen($caracteres) - 1
                    )
                ];
            }

            for ($i = 0; $i < 4; $i++) {
                $parte2 .= $caracteres[
                    random_int(
                        0,
                        strlen($caracteres) - 1
                    )
                ];
            }

            $codigo = "LOGOS-{$parte1}-{$parte2}";

            $existente = Convite::buscarPorCodigo($codigo);

        } while ($existente !== null);

        $expiraEm = date(
            'Y-m-d H:i:s',
            strtotime('+' . self::DURACAO_DIAS . ' days')
        );

        $id = Convite::criar(
            $assessoriaId,
            $usuarioId,
            $codigo,
            $emailDestino,
            $expiraEm
        );

        return [
            'id' => $id,
            'codigo' => $codigo,
            'email_destino' => $emailDestino,
            'expira_em' => $expiraEm
        ];
    }
    public static function listarPorAssessoria( int $assessoriaId,int $page = 1, int $limit = 20
    ): array {
        if ($page < 1) {
            $page = 1;
        }

        if ($limit < 1) {
            $limit = 20;
        }

        if ($limit > 20) {
            $limit = 20;
        }

        $offset = ($page - 1) * $limit;

        $convites = Convite::listarPorAssessoria(
            $assessoriaId,
            $limit,
            $offset
        );

        $total = Convite::contarPorAssessoria(
            $assessoriaId
        );

        $agora = time();

        $convites = array_map(
            function (array $convite) use ($agora) {
                if ($convite['utilizado_em'] !== null) {
                    $status = 'UTILIZADO';
                } elseif (
                    strtotime($convite['expira_em']) <= $agora
                ) {
                    $status = 'EXPIRADO';
                } else {
                    $status = 'ATIVO';
                }

                return [
                    'id' => (int) $convite['id'],
                    'codigo' => $convite['codigo'],
                    'email_destino' => $convite['email_destino'],
                    'expira_em' => $convite['expira_em'],
                    'utilizado_em' => $convite['utilizado_em'],
                    'created_at' => $convite['created_at'],
                    'criado_por' => $convite['criado_por_nome'],
                    'utilizado_por' => $convite['utilizado_por_nome'],
                    'status' => $status
                ];
            },
            $convites
        );

        return [
            'convites' => $convites,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => ($offset + count($convites)) < $total
            ]
        ];
    }
    public static function validar(string $codigo): array
    {
        $codigo = strtoupper(trim($codigo));

        if ($codigo === '') {
            throw new \InvalidArgumentException(
                'O código do convite é obrigatório.'
            );
        }

        $convite = Convite::buscarPorCodigo($codigo);

        if (!$convite) {
            throw new RuntimeException(
                'Convite não encontrado.'
            );
        }

        if ($convite['utilizado_em'] !== null) {
            throw new RuntimeException(
                'Este convite já foi utilizado.'
            );
        }

        if (strtotime($convite['expira_em']) <= time()) {
            throw new RuntimeException(
                'Este convite expirou.'
            );
        }

        return [
            'id' => (int) $convite['id'],
            'assessoria_id' => (int) $convite['assessoria_id'],
            'codigo' => $convite['codigo'],
            'email_destino' => $convite['email_destino'],
            'expira_em' => $convite['expira_em']
        ];
    }
}