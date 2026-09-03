<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Services\ConviteService;
use Logos\AssessoriaApi\Services\RefreshTokenService;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Services\CnpjService;
use Logos\AssessoriaApi\Services\TelefoneService;
use Logos\AssessoriaApi\Database\Connection;
use PDO;
use Throwable;

class AuthService
{
    public static function registrarAssessoria(array $dados): array
    {
        $pdo = Connection::get();

        $cnpj = trim($dados['cnpj'] ?? '');
        
        if ($cnpj !== '') {
            $cnpj = CnpjService::normalizar($cnpj);

            if (!CnpjService::validar($cnpj)) {
                throw new \InvalidArgumentException(
                    'O CNPJ informado é inválido.'
                );
            }
        }

        $assessoriaEmail = trim($dados['assessoria_email'] ?? '');
        $assessorEmail = trim($dados['assessor_email'] ?? '');

        if (
            $assessoriaEmail !== '' &&
            !filter_var($assessoriaEmail, FILTER_VALIDATE_EMAIL)
        ) {
            throw new \InvalidArgumentException(
                'O e-mail da assessoria é inválido.'
            );
        }

        if (!filter_var($assessorEmail, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException(
                'O e-mail do assessor é inválido.'
            );
        }

        $telefone = trim($dados['telefone'] ?? '');

        if ($telefone !== '') {
            $telefone = TelefoneService::normalizar($telefone);

            if (!TelefoneService::validar($telefone)) {
                throw new \InvalidArgumentException(
                    'O telefone informado é inválido.'
                );
            }
        }
        $assessorTelefone = trim($dados['assessor_telefone'] ?? '');

        if ($assessorTelefone !== '') {
            $assessorTelefone = TelefoneService::normalizar($assessorTelefone);

            if (!TelefoneService::validar($assessorTelefone)) {
                throw new \InvalidArgumentException(
                    'O telefone do assessor é inválido.'
                );
            }
        }
        try {
            $pdo->beginTransaction();

            /*
             Verifica se já existe um usuário com esse e-mail.
              a tabela usuarios possui UNIQUE(email).
             */
            $stmt = $pdo->prepare("
                SELECT id
                FROM usuarios
                WHERE email = :email
                LIMIT 1
            ");

            $stmt->execute([
                'email' => $dados['assessor_email']
            ]);

            if ($stmt->fetch()) {
                throw new \RuntimeException(
                    'O e-mail do assessor já está cadastrado.'
                );
            }

            /*
            cria a assessoria
             */
            $stmt = $pdo->prepare("
                INSERT INTO assessorias (
                    nome,
                    cnpj,
                    email,
                    telefone
                ) VALUES (
                    :nome,
                    :cnpj,
                    :email,
                    :telefone
                )
            ");

            $stmt->execute([
                'nome' => $dados['assessoria_nome'],
                'cnpj' => $cnpj !== '' ? $cnpj : null,
                'email' => $assessoriaEmail !== '' ? $assessoriaEmail : null,                
                'telefone' => $telefone !== '' ? $telefone : null
            ]);

            $assessoriaId = (int) $pdo->lastInsertId();

            /*
             cria o assessor da assessoria
             */
            $senhaHash = password_hash(
                $dados['senha'],
                PASSWORD_DEFAULT
            );

            $stmt = $pdo->prepare("
                INSERT INTO usuarios (
                    assessoria_id,
                    nome,
                    email,
                    telefone,
                    senha_hash,
                    perfil,
                    ativo,
                    email_verificado
                ) VALUES (
                    :assessoria_id,
                    :nome,
                    :email,
                    :telefone,
                    :senha_hash,
                    'ASSESSOR',
                    TRUE,
                    FALSE
                )
            ");

            $stmt->execute([
                'assessoria_id' => $assessoriaId,
                'nome' => $dados['assessor_nome'],
                'email' => $assessorEmail,
                'telefone' => $assessorTelefone !== '' ? $assessorTelefone : null,
                'senha_hash' => $senhaHash
            ]);

            $usuarioId = (int) $pdo->lastInsertId();

            $pdo->commit();

            $usuario = [
                'id' => $usuarioId,
                'assessoria_id' => $assessoriaId,
                'nome' => $dados['assessor_nome'],
                'email' => $dados['assessor_email'],
                'telefone' => $assessorTelefone !== '' ? $assessorTelefone : null,
                'perfil' => 'ASSESSOR',
                'email_verificado' => false
            ];

            $token = JwtService::gerar($usuario);

            $refreshToken = RefreshTokenService::criar(
                $usuarioId
            );

            return [
                'assessoria_id' => $assessoriaId,
                'usuario' => $usuario,
                'token' => $token,
                'refresh_token' => $refreshToken
            ];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function registrarFuncionario(array $dados): array
    {
        $pdo = Connection::get();

        $codigo = strtoupper(
            trim($dados['codigo'] ?? '')
        );

        $nome = trim(
            $dados['nome'] ?? ''
        );

        $email = trim(
            $dados['email'] ?? ''
        );

        $senha = $dados['senha'] ?? '';

        $telefone = trim(
            $dados['telefone'] ?? ''
        );

        if ($telefone !== '') {
            $telefone = TelefoneService::normalizar($telefone);

            if (!TelefoneService::validar($telefone)) {
                throw new \InvalidArgumentException(
                    'O telefone informado é inválido.'
                );
            }
        }

        if ($codigo === '') {
            throw new \InvalidArgumentException(
                'O código do convite é obrigatório.'
            );
        }

        if ($nome === '') {
            throw new \InvalidArgumentException(
                'O nome é obrigatório.'
            );
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException(
                'O e-mail informado é inválido.'
            );
        }

        if (strlen($senha) < 6) {
            throw new \InvalidArgumentException(
                'A senha deve possuir pelo menos 6 caracteres.'
            );
        }

        try {
            $pdo->beginTransaction();

            /*
            * Bloqueia o convite durante a transação.
            * Isso evita que duas pessoas utilizem o mesmo
            * convite simultaneamente.
            */
            $stmt = $pdo->prepare("
                SELECT
                    id,
                    assessoria_id,
                    codigo,
                    expira_em,
                    utilizado_em
                FROM convites
                WHERE codigo = :codigo
                LIMIT 1
                FOR UPDATE
            ");

            $stmt->execute([
                'codigo' => $codigo
            ]);

            $convite = $stmt->fetch();

            if (!$convite) {
                throw new \RuntimeException(
                    'Convite não encontrado.'
                );
            }

            if ($convite['utilizado_em'] !== null) {
                throw new \RuntimeException(
                    'Este convite já foi utilizado.'
                );
            }

            if (
                strtotime($convite['expira_em']) <= time()
            ) {
                throw new \RuntimeException(
                    'Este convite expirou.'
                );
            }

            /*
            * O e-mail precisa ser único no sistema.
            */
            $stmt = $pdo->prepare("
                SELECT id
                FROM usuarios
                WHERE email = :email
                LIMIT 1
            ");

            $stmt->execute([
                'email' => $email
            ]);

            if ($stmt->fetch()) {
                throw new \RuntimeException(
                    'O e-mail informado já está cadastrado.'
                );
            }

            $senhaHash = password_hash(
                $senha,
                PASSWORD_DEFAULT
            );

            /*
            * Cria o funcionário na mesma assessoria
            * vinculada ao convite.
            */
            $stmt = $pdo->prepare("
                INSERT INTO usuarios (
                    assessoria_id,
                    nome,
                    email,
                    telefone,
                    senha_hash,
                    perfil,
                    ativo,
                    email_verificado
                ) VALUES (
                    :assessoria_id,
                    :nome,
                    :email,
                    :telefone,
                    :senha_hash,
                    'FUNCIONARIO',
                    TRUE,
                    FALSE
                )
            ");

            $stmt->execute([
                'assessoria_id' => (int) $convite['assessoria_id'],
                'nome' => $nome,
                'email' => $email,
                'telefone' => $telefone !== '' ? $telefone : null,
                'senha_hash' => $senhaHash
            ]);

            $usuarioId = (int) $pdo->lastInsertId();

            /*
            * Permissões iniciais do novo funcionário.
            */
            $stmt = $pdo->prepare("
                INSERT INTO usuario_permissoes (
                    usuario_id,
                    permissao_id
                )
                SELECT
                    :usuario_id,
                    id
                FROM permissoes
                WHERE
                    (modulo = 'MAILING' AND acao = 'VISUALIZAR')
                    OR (modulo = 'CLIPPING' AND acao = 'VISUALIZAR')
                    OR (modulo = 'VEICULOS' AND acao = 'VISUALIZAR')
                    OR (modulo = 'RELATORIOS' AND acao = 'VISUALIZAR')
            ");

            $stmt->execute([
                'usuario_id' => $usuarioId
            ]);

            /*
            * Marca o convite como utilizado.
            */
            $stmt = $pdo->prepare("
                UPDATE convites
                SET
                    utilizado_em = NOW(),
                    utilizado_por = :usuario_id
                WHERE id = :id
            ");

            $stmt->execute([
                'usuario_id' => $usuarioId,
                'id' => (int) $convite['id']
            ]);

            $pdo->commit();

            $usuario = [
                'id' => $usuarioId,
                'assessoria_id' => (int) $convite['assessoria_id'],
                'nome' => $nome,
                'email' => $email,
                'telefone' => $telefone !== '' ? $telefone : null,
                'perfil' => 'FUNCIONARIO',
                'email_verificado' => false
            ];

            /*
            * A conta já foi criada.
            * Agora geramos a sessão normalmente.
            */
            $token = JwtService::gerar($usuario);

            $refreshToken = RefreshTokenService::criar(
                $usuarioId
            );

            return [
                'usuario' => $usuario,
                'token' => $token,
                'refresh_token' => $refreshToken
            ];

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }
}