<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\ClienteService;
use Logos\AssessoriaApi\Services\LogoClienteService;

class ClienteController
{
    public function listar(): void
    {
        $this->json();

        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responderErro(
                401,
                'Usuário não autenticado.'
            );

            return;
        }

        try {
            $resultado = ClienteService::listar(
                (int) $usuario->assessoria_id,
                [
                    'page' => $_GET['page'] ?? 1,
                    'limit' => $_GET['limit'] ?? 50,
                    'busca' => $_GET['busca'] ?? null,
                    'estado' => $_GET['estado'] ?? null,
                    'cidade' => $_GET['cidade'] ?? null,
                    'segmento' => $_GET['segmento'] ?? null,
                    'ativo' => $_GET['ativo'] ?? null,
                ]
            );

            echo json_encode([
                'success' => true,
                ...$resultado,
            ]);
        } catch (\InvalidArgumentException $e) {
            $this->responderErro(422, $e->getMessage());
        } catch (\Throwable $e) {
            $this->responderErro(
                500,
                'Não foi possível carregar os clientes.'
            );
        }
    }

    public function buscar(
        array $dadosRota
    ): void {
        $this->json();

        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responderErro(
                401,
                'Usuário não autenticado.'
            );

            return;
        }

        $id = $this->idValido($dadosRota['id'] ?? null);

        if ($id === null) {
            $this->responderErro(
                400,
                'ID de cliente inválido.'
            );

            return;
        }

        try {
            $cliente = ClienteService::buscarPorId(
                $id,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'cliente' => $cliente,
            ]);
        } catch (\RuntimeException $e) {
            $this->responderErro(404, $e->getMessage());
        } catch (\Throwable $e) {
            $this->responderErro(
                500,
                'Não foi possível carregar o cliente.'
            );
        }
    }

    public function criar(): void
    {
        $this->json();

        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responderErro(
                401,
                'Usuário não autenticado.'
            );

            return;
        }

        $dados = $_POST;
        /*
         o caminho da logo só pode ser definido pelo servidor
        */
        unset($dados['logo_path']);

        $logoNovo = null;

        try {
            if ($this->temNovoLogo()) {
                $logoNovo = LogoClienteService::salvar(
                    $_FILES['logo'],
                    (int) $usuario->assessoria_id
                );

                $dados['logo_path'] = $logoNovo;
            }

            $cliente = ClienteService::criar(
                (int) $usuario->assessoria_id,
                $dados
            );

            http_response_code(201);

            echo json_encode([
                'success' => true,
                'message' => 'Cliente cadastrado com sucesso.',
                'cliente' => $cliente,
            ]);
        } catch (\InvalidArgumentException $e) {
            LogoClienteService::excluir($logoNovo);

            $this->responderErro(422, $e->getMessage());
        } catch (\RuntimeException $e) {
            LogoClienteService::excluir($logoNovo);

            $duplicado = str_contains(
                mb_strtolower($e->getMessage()),
                'cnpj'
            );

            $this->responderErro(
                $duplicado ? 409 : 500,
                $duplicado
                    ? $e->getMessage()
                    : 'Não foi possível cadastrar o cliente.'
            );
        } catch (\Throwable $e) {
            LogoClienteService::excluir($logoNovo);

            $this->responderErro(
                500,
                'Não foi possível cadastrar o cliente.'
            );
        }
    } 

    public function atualizarComLogo(
        array $dadosRota
    ): void {
        $this->json();

        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responderErro(
                401,
                'Usuário não autenticado.'
            );

            return;
        }

        $id = $this->idValido($dadosRota['id'] ?? null);

        if ($id === null) {
            $this->responderErro(
                400,
                'ID de cliente inválido.'
            );

            return;
        }

        $dados = $_POST;

        /*
    pra impedir que alguém injete manualmente um caminho de arquivo
        */
        unset($dados['logo_path']);

        $logoNovo = null;

        try {
            $anterior = ClienteService::buscarPorId(
                $id,
                (int) $usuario->assessoria_id
            );

            $removerLogo = filter_var(
                $dados['remover_logo'] ?? false,
                FILTER_VALIDATE_BOOLEAN,
                FILTER_NULL_ON_FAILURE
            );

            if ($removerLogo === null) {
                throw new \InvalidArgumentException(
                    'Opção de remoção do logo inválida.'
                );
            }

            if (
                $removerLogo &&
                $this->temNovoLogo()
            ) {
                throw new \InvalidArgumentException(
                    'Escolha entre trocar ou remover o logo.'
                );
            }

            if ($this->temNovoLogo()) {
                $logoNovo = LogoClienteService::salvar(
                    $_FILES['logo'],
                    (int) $usuario->assessoria_id
                );

                $dados['logo_path'] = $logoNovo;
            } elseif ($removerLogo) {
                $dados['logo_path'] = null;
            } else {
                $dados['logo_path'] =
                    $anterior['logo_path'] ?? null;
            }

            $cliente = ClienteService::atualizar(
                $id,
                (int) $usuario->assessoria_id,
                $dados
            );

            if (
                ($anterior['logo_path'] ?? null) !==
                ($cliente['logo_path'] ?? null)
            ) {
                LogoClienteService::excluir(
                    $anterior['logo_path'] ?? null
                );
            }

            echo json_encode([
                'success' => true,
                'message' => 'Cliente atualizado com sucesso.',
                'cliente' => $cliente,
            ]);
        } catch (\InvalidArgumentException $e) {
            LogoClienteService::excluir($logoNovo);

            $this->responderErro(422, $e->getMessage());
        } catch (\RuntimeException $e) {
            LogoClienteService::excluir($logoNovo);

            $mensagem = mb_strtolower($e->getMessage());

            $status = str_contains(
                $mensagem,
                'não encontrado'
            )
                ? 404
                : (
                    str_contains($mensagem, 'cnpj')
                        ? 409
                        : 500
                );

            $this->responderErro(
                $status,
                $status === 500
                    ? 'Não foi possível atualizar o cliente.'
                    : $e->getMessage()
            );
        } catch (\Throwable $e) {
            LogoClienteService::excluir($logoNovo);

            $this->responderErro(
                500,
                'Não foi possível atualizar o cliente.'
            );
        }
    }

    public function excluir(
        array $dadosRota
    ): void {
        $this->json();

        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responderErro(
                401,
                'Usuário não autenticado.'
            );

            return;
        }

        $id = $this->idValido($dadosRota['id'] ?? null);

        if ($id === null) {
            $this->responderErro(
                400,
                'ID de cliente inválido.'
            );

            return;
        }

        try {
            ClienteService::excluir(
                $id,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'message' => 'Cliente excluído com sucesso.',
            ]);
        } catch (\RuntimeException $e) {
            $status = str_contains(
                $e->getMessage(),
                'não encontrado'
            )
                ? 404
                : 409;

            $this->responderErro($status, $e->getMessage());
        } catch (\Throwable $e) {
            $this->responderErro(
                500,
                'Não foi possível excluir o cliente.'
            );
        }
    }

    public function excluirEmLote(): void
    {
        $this->json();

        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responderErro(
                401,
                'Usuário não autenticado.'
            );

            return;
        }

        $dados = $this->dadosJson();

        if ($dados === null) {
            $this->responderErro(
                400,
                'JSON inválido.'
            );

            return;
        }

        if (
            !array_key_exists('ids', $dados) ||
            !is_array($dados['ids'])
        ) {
            $this->responderErro(
                422,
                'Informe os clientes que deseja excluir.'
            );

            return;
        }

        try {
            $excluidos = ClienteService::excluirEmLote(
                (int) $usuario->assessoria_id,
                $dados['ids']
            );

            echo json_encode([
                'success' => true,
                'message' => $excluidos === 1
                    ? 'Cliente excluído com sucesso.'
                    : "{$excluidos} clientes excluídos com sucesso.",
                'excluidos' => $excluidos,
            ]);
        } catch (\InvalidArgumentException $e) {
            $this->responderErro(422, $e->getMessage());
        } catch (\RuntimeException $e) {
            $this->responderErro(409, $e->getMessage());
        } catch (\Throwable $e) {
            $this->responderErro(
                500,
                'Não foi possível excluir os clientes selecionados.'
            );
        }
    }

    private function temNovoLogo(): bool
    {
        $arquivo = $_FILES['logo'] ?? null;

        return is_array($arquivo) &&
            (int) (
                $arquivo['error'] ??
                UPLOAD_ERR_NO_FILE
            ) !== UPLOAD_ERR_NO_FILE;
    }
    
    private function dadosJson(): ?array
    {
        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        return is_array($dados)
            ? $dados
            : null;
    }

    private function idValido(
        mixed $valor
    ): ?int {
        $id = filter_var(
            $valor,
            FILTER_VALIDATE_INT
        );

        if ($id === false || $id <= 0) {
            return null;
        }

        return $id;
    }

    private function json(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );
    }

    private function responderErro(
        int $status,
        string $mensagem
    ): void {
        http_response_code($status);

        echo json_encode([
            'success' => false,
            'message' => $mensagem,
        ]);
    }
}