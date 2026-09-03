<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\PermissaoService;
use Logos\AssessoriaApi\Services\RefreshTokenService;
use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\JwtService;
use Logos\AssessoriaApi\Models\Usuario;
use Logos\AssessoriaApi\Services\AuthService;
use Throwable;

class AuthController
{
    public function login(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $email = trim($dados['email'] ?? '');
        $senha = $dados['senha'] ?? '';

        if ($email === '' || $senha === '') {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'E-mail e senha são obrigatórios.'
            ]);

            return;
        }

        $usuario = Usuario::verificarSenha($email, $senha);

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'E-mail ou senha inválidos.'
            ]);

            return;
        }

        Usuario::atualizarUltimoLogin((int) $usuario['id']);

        $token = JwtService::gerar($usuario);
        $refreshToken = RefreshTokenService::criar(
            (int) $usuario['id']
        );

        echo json_encode([
            'success' => true,
            'message' => 'Login realizado com sucesso.',
            'token' => $token,
            'refresh_token' => $refreshToken,
            'usuario' => [
                'id' => $usuario['id'],
                'assessoria_id' => $usuario['assessoria_id'],
                'nome' => $usuario['nome'],
                'email' => $usuario['email'],
                'perfil' => $usuario['perfil']
            ]
        ]);
    }
    public function logout(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $refreshToken = trim(
            $dados['refresh_token'] ?? ''
        );

        if ($refreshToken === '') {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Refresh token não informado.'
            ]);

            return;
        }

        try {
            RefreshTokenService::revogar($refreshToken);

            echo json_encode([
                'success' => true,
                'message' => 'Logout realizado com sucesso.'
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível realizar o logout.'
            ]);
        }
    }

    public function me(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $usuarioToken = AuthContext::get();

        if (!$usuarioToken) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $usuario = Usuario::buscarPorId((int) $usuarioToken->sub);

        if (!$usuario || !$usuario['ativo']) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não encontrado ou inativo.'
            ]);

            return;
        }

        echo json_encode([
            'success' => true,
            'usuario' => [
                'id' => (int) $usuario['id'],
                'assessoria_id' => (int) $usuario['assessoria_id'],
                'nome' => $usuario['nome'],
                'email' => $usuario['email'],
                'telefone' => $usuario['telefone'],
                'perfil' => $usuario['perfil'],
                'email_verificado' => (bool) $usuario['email_verificado']
            ]
        ]);
    }
    public function registerAssessoria(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $assessoriaNome = trim($dados['assessoria_nome'] ?? '');
        $assessoriaEmail = trim($dados['assessoria_email'] ?? '');
        $cnpj = trim($dados['cnpj'] ?? '');
        $telefone = trim($dados['telefone'] ?? '');

        $assessorNome = trim($dados['assessor_nome'] ?? '');
        $assessorEmail = trim($dados['assessor_email'] ?? '');
        $senha = $dados['senha'] ?? '';

        if (
            $assessoriaNome === '' ||
            $assessorNome === '' ||
            $assessorEmail === '' ||
            $senha === ''
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Preencha os campos obrigatórios.'
            ]);

            return;
        }

        if (!filter_var($assessorEmail, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'O e-mail do assessor é inválido.'
            ]);

            return;
        }

        if (strlen($senha) < 6) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'A senha deve possuir pelo menos 6 caracteres.'
            ]);

            return;
        }

        try {
            $resultado = AuthService::registrarAssessoria([
                'assessoria_nome' => $assessoriaNome,
                'assessoria_email' => $assessoriaEmail,
                'cnpj' => $cnpj,
                'telefone' => $telefone,
                'assessor_nome' => $assessorNome,
                'assessor_email' => $assessorEmail,
                'assessor_telefone' => trim($dados['assessor_telefone'] ?? ''),
                'senha' => $senha
            ]);

            http_response_code(201);

            echo json_encode([
                'success' => true,
                'message' => 'Assessoria criada com sucesso.',
                'token' => $resultado['token'],
                'refresh_token' => $resultado['refresh_token'],
                'usuario' => $resultado['usuario']
            ]);
            } catch (\InvalidArgumentException $e) {
                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'message' => $e->getMessage()
            ]);
            } catch (\RuntimeException $e) {
                http_response_code(409);

                echo json_encode([
                    'success' => false,
                    'message' => $e->getMessage()
            ]);
            } catch (\Throwable $e) {
                http_response_code(500);

                echo json_encode([
                    'success' => false,
                    'message' => 'Não foi possível criar a assessoria.'
            ]);
        }
    }

    public function registerFuncionario(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $codigo = trim(
            $dados['codigo'] ?? ''
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

        if (
            $codigo === '' ||
            $nome === '' ||
            $email === '' ||
            $senha === ''
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Preencha todos os campos obrigatórios.'
            ]);

            return;
        }

        try {
            $resultado = AuthService::registrarFuncionario([
                'codigo' => $codigo,
                'nome' => $nome,
                'email' => $email,
                'telefone' => $telefone,
                'senha' => $senha,
            ]);

            http_response_code(201);

            echo json_encode([
                'success' => true,
                'message' => 'Funcionário cadastrado com sucesso.',
                'token' => $resultado['token'],
                'refresh_token' => $resultado['refresh_token'],
                'usuario' => $resultado['usuario']
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\RuntimeException $e) {
            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível cadastrar o funcionário.'
            ]);
        }
    }

    public function refresh(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        $refreshToken = trim(
            $dados['refresh_token'] ?? ''
        );

        if ($refreshToken === '') {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Refresh token não informado.'
            ]);

            return;
        }

        try {
            $resultado = RefreshTokenService::renovar(
                $refreshToken
            );

           echo json_encode([
                'success' => true,
                'message' => 'Token renovado com sucesso.',
                'token' => $resultado['token'],
                'refresh_token' => $resultado['refresh_token'],
                'usuario' => $resultado['usuario']
            ]);

        } catch (\RuntimeException $e) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível renovar a sessão.'
            ]);
        }
    }


    public function minhasPermissoes(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        try {
            $permissoes =
                PermissaoService::listarDoUsuario(
                    (int) $usuario->sub
                );

            echo json_encode([
                'success' => true,
                'permissoes' => $permissoes
            ]);
        } catch (Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível carregar suas permissões.'
            ]);
        }
    }
}

