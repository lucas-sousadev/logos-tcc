<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Clipping;
use PDO;

final class DuplicacaoCadastroService
{
    private static function id(mixed $valor): int
    {
        if (
            (!is_int($valor) && !is_string($valor))
            || !preg_match('/^[1-9][0-9]*$/D', (string) $valor)
            || filter_var($valor, FILTER_VALIDATE_INT) === false
        ) {
            throw new \InvalidArgumentException('Registro inválido.');
        }

        return (int) $valor;
    }

    private static function permitir(int $usuarioId, string $perfil, string $modulo): void
    {
        foreach (['VISUALIZAR', 'CRIAR'] as $acao) {
            if (!PermissaoService::usuarioTemPermissao($usuarioId, $perfil, $modulo, $acao)) {
                throw new \RuntimeException('Você precisa das permissões de visualizar e criar para duplicar este registro.', 403);
            }
        }
    }

    private static function executar(PDO $db, string $sql, array $parametros): \PDOStatement
    {
        $stmt = $db->prepare($sql);
        $stmt->execute($parametros);
        return $stmt;
    }

    public static function clipping(
        int $assessoriaId,
        int $usuarioId,
        string $perfil,
        mixed $origemId,
        bool $incluirAnexos
    ): array {
        self::permitir($usuarioId, $perfil, 'CLIPPING');
        if (
            $incluirAnexos
            && !PermissaoService::usuarioTemPermissao($usuarioId, $perfil, 'CLIPPING', 'ANEXAR')
        ) {
            throw new \RuntimeException('Você precisa da permissão de anexar para copiar os arquivos do clipping.', 403);
        }

        $origemId = self::id($origemId);
        $db = Connection::get();
        $arquivos = [];
        $db->beginTransaction();

        try {
            if (!Clipping::buscarPorId($origemId, $assessoriaId, true)) {
                throw new \OutOfBoundsException('Clipping não encontrado nesta assessoria.');
            }

            self::executar($db, '
                INSERT INTO clippings (
                    assessoria_id, cliente_id, veiculo_id, veiculo_nome_informado,
                    ano_referencia, data_publicacao, categorias, programa_secao,
                    pauta, tier, inicio_segundos, fim_segundos, duracao_segundos,
                    link, observacoes, criado_por
                ) SELECT assessoria_id, cliente_id, veiculo_id, veiculo_nome_informado,
                    ano_referencia, data_publicacao, categorias, programa_secao,
                    pauta, tier, inicio_segundos, fim_segundos, duracao_segundos,
                    link, observacoes, :usuario
                FROM clippings WHERE id = :id AND assessoria_id = :assessoria
            ', ['usuario' => $usuarioId, 'id' => $origemId, 'assessoria' => $assessoriaId]);
            $novoId = (int) $db->lastInsertId();
            $mapa = [];
            $anexos = $incluirAnexos ? self::executar($db, '
                SELECT * FROM clipping_anexos
                WHERE clipping_id = :id AND assessoria_id = :assessoria
                ORDER BY ordem, id
            ', ['id' => $origemId, 'assessoria' => $assessoriaId])->fetchAll() : [];

            foreach ($anexos as $anexo) {
                $caminho = ArquivoClippingService::copiar($anexo, $novoId);
                $arquivos[] = [
                    'assessoria_id' => $assessoriaId,
                    'clipping_id' => $novoId,
                    'arquivo_path' => $caminho,
                ];
                self::executar($db, '
                    INSERT INTO clipping_anexos (
                        assessoria_id, clipping_id, criado_por, tipo, origem,
                        nome_original, arquivo_path, mime_type, tamanho_bytes, ordem,
                        principal, imagem_relatorio, url_origem, capturado_em, metadados_json
                    ) VALUES (
                        :assessoria, :clipping, :usuario, :tipo, :origem,
                        :nome, :caminho, :mime, :tamanho, :ordem,
                        :principal, :imagem, :url, :captura, :metadados
                    )
                ', [
                    'assessoria' => $assessoriaId,
                    'clipping' => $novoId,
                    'usuario' => $usuarioId,
                    'tipo' => $anexo['tipo'],
                    'origem' => $anexo['origem'],
                    'nome' => $anexo['nome_original'],
                    'caminho' => $caminho,
                    'mime' => $anexo['mime_type'],
                    'tamanho' => $anexo['tamanho_bytes'],
                    'ordem' => $anexo['ordem'],
                    'principal' => $anexo['principal'],
                    'imagem' => $anexo['imagem_relatorio'],
                    'url' => $anexo['url_origem'],
                    'captura' => $anexo['capturado_em'],
                    'metadados' => $anexo['metadados_json'],
                ]);
                $mapa[(int) $anexo['id']] = (int) $db->lastInsertId();
            }

            foreach ($anexos as $anexo) {
                if ($anexo['anexo_origem_id'] === null) {
                    continue;
                }
                $pai = $mapa[(int) $anexo['anexo_origem_id']] ?? null;
                if ($pai === null) {
                    throw new \DomainException('Um anexo de origem não está disponível para duplicação.');
                }
                self::executar($db, '
                    UPDATE clipping_anexos SET anexo_origem_id = :pai
                    WHERE id = :id AND clipping_id = :clipping AND assessoria_id = :assessoria
                ', [
                    'pai' => $pai,
                    'id' => $mapa[(int) $anexo['id']],
                    'clipping' => $novoId,
                    'assessoria' => $assessoriaId,
                ]);
            }

            RelatorioService::sincronizarNovoClipping($assessoriaId, $novoId);
            $clipping = ClippingService::buscar($novoId, $assessoriaId);
            $db->commit();
            return ['clipping' => $clipping, 'anexos_copiados' => count($anexos)];
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            foreach ($arquivos as $arquivo) {
                ArquivoClippingService::remover($arquivo);
            }
            throw $erro;
        }
    }

    public static function release(
        int $assessoriaId,
        int $usuarioId,
        string $perfil,
        mixed $origemId,
        mixed $chave
    ): array {
        self::permitir($usuarioId, $perfil, 'RELEASES');
        $origemId = self::id($origemId);
        if (!is_string($chave) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iD', $chave)) {
            throw new \InvalidArgumentException('A chave da duplicação deve ser um UUID válido.');
        }
        $chave = strtolower($chave);
        $assinatura = hash('sha256', 'duplicar-release:' . $origemId);
        $db = Connection::get();
        $db->beginTransaction();

        try {
            $origem = self::executar($db, '
                SELECT * FROM releases WHERE id = :id AND assessoria_id = :assessoria FOR UPDATE
            ', ['id' => $origemId, 'assessoria' => $assessoriaId])->fetch();
            if (!$origem || ReleaseService::foiDescartado($origem)) {
                throw new \OutOfBoundsException('Release não encontrado nesta assessoria.');
            }

            $existente = self::executar($db, '
                SELECT * FROM releases
                WHERE assessoria_id = :assessoria AND criado_por = :usuario AND chave_rascunho = :chave
                FOR UPDATE
            ', ['assessoria' => $assessoriaId, 'usuario' => $usuarioId, 'chave' => $chave])->fetch();
            if ($existente) {
                if (ReleaseService::foiDescartado($existente) || !hash_equals($assinatura, (string) $existente['assinatura_cadastro'])) {
                    throw new \DomainException('Esta chave já foi usada em outra operação. Inicie uma nova duplicação.');
                }
                $release = ReleaseService::buscar($assessoriaId, $existente['id']);
                $db->commit();
                return ['release' => $release, 'destinatarios_nao_copiados' => 0, 'cadastro_repetido' => true];
            }

            self::executar($db, '
                INSERT INTO releases (
                    assessoria_id, cliente_id, template_id, template_codigo, criado_por,
                    titulo, chave_rascunho, assinatura_cadastro, assunto, primeira_linha,
                    nome_remetente, responder_para, blocos_json
                ) VALUES (
                    :assessoria, :cliente, :template, :codigo, :usuario,
                    :titulo, :chave, :assinatura, :assunto, :linha,
                    :remetente, :responder, :blocos
                )
            ', [
                'assessoria' => $assessoriaId,
                'cliente' => $origem['cliente_id'],
                'template' => $origem['template_id'],
                'codigo' => $origem['template_codigo'],
                'usuario' => $usuarioId,
                'titulo' => mb_substr('Cópia de ' . (trim($origem['titulo']) ?: 'Release sem título'), 0, 150),
                'chave' => $chave,
                'assinatura' => $assinatura,
                'assunto' => $origem['assunto'],
                'linha' => $origem['primeira_linha'],
                'remetente' => $origem['nome_remetente'],
                'responder' => $origem['responder_para'],
                'blocos' => $origem['blocos_json'],
            ]);
            $novoId = (int) $db->lastInsertId();
            $contatos = self::executar($db, '
                SELECT j.id, j.email, j.ativo FROM release_destinatarios d
                LEFT JOIN jornalistas j ON j.id = d.jornalista_id AND j.assessoria_id = d.assessoria_id
                WHERE d.release_id = :id AND d.assessoria_id = :assessoria
                ORDER BY d.id LOCK IN SHARE MODE
            ', ['id' => $origemId, 'assessoria' => $assessoriaId])->fetchAll();
            $emails = [];
            foreach ($contatos as $contato) {
                $email = strtolower(trim($contato['email'] ?? ''));
                if (!$contato['id'] || !$contato['ativo'] || !filter_var($email, FILTER_VALIDATE_EMAIL) || isset($emails[$email])) {
                    continue;
                }
                self::executar($db, '
                    INSERT INTO release_destinatarios (assessoria_id, release_id, jornalista_id, email)
                    VALUES (:assessoria, :release, :jornalista, :email)
                ', ['assessoria' => $assessoriaId, 'release' => $novoId, 'jornalista' => $contato['id'], 'email' => $email]);
                $emails[$email] = true;
            }

            $release = ReleaseService::buscar($assessoriaId, $novoId);
            $db->commit();
            return ['release' => $release, 'destinatarios_nao_copiados' => count($contatos) - count($emails)];
        } catch (\Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if ($erro instanceof \PDOException && in_array((int) ($erro->errorInfo[1] ?? 0), [1062, 1213, 1452], true)) {
                throw new \DomainException('Um registro foi alterado durante a duplicação. Confira os dados e tente novamente.', 0, $erro);
            }
            throw $erro;
        }
    }
}
