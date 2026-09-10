<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\VeiculoService;
use Logos\AssessoriaApi\Services\LogoVeiculoService;

class VeiculoController
{
    public function listar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $assessoriaId =
            (int) $usuario->assessoria_id;

        try {
            $resultado =
                VeiculoService::listar(
                    $assessoriaId,
                    [
                        'page' => $_GET['page'] ?? 1,
                        'limit' => $_GET['limit'] ?? 50,
                        'busca' => $_GET['busca'] ?? '',
                        'ativo' => $_GET['ativo'] ?? null,
                        'ordem' => $_GET['ordem'] ?? 'nome',
                        'direcao' => $_GET['direcao'] ?? 'ASC',
                        'min_contatos' => $_GET['min_contatos'] ?? null,
                        'max_contatos' => $_GET['max_contatos'] ?? null,
                    ]
                );

            echo json_encode([
                'success' => true,
                ...$resultado
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar os veículos.'
            ]);
        }
    }

    public function buscar(
        array $dados
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.'
            ]);

            return;
        }

        try {
            $veiculo =
                VeiculoService::buscarPorId(
                    $id,
                    (int) $usuario->assessoria_id
                );

            echo json_encode([
                'success' => true,
                'veiculo' => $veiculo
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }

    public function criar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $dados = $this->dadosDaRequisicao();

        if (!is_array($dados)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Dados inválidos.',
            ]);

            return;
        }

        $logoNovo = null;

        try {
            if (isset($_FILES['logo'])) {
                $logoNovo = LogoVeiculoService::salvar(
                    $_FILES['logo'],
                    (int) $usuario->assessoria_id
                );

                $dados['logo_path'] = $logoNovo;
            }

            $veiculo = VeiculoService::criar(
                (int) $usuario->assessoria_id,
                $dados
            );

            http_response_code(201);

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo criado com sucesso.',
                'veiculo' => $veiculo,
            ]);
        } catch (\InvalidArgumentException $e) {
            LogoVeiculoService::excluir($logoNovo);

            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        } catch (\RuntimeException $e) {
            LogoVeiculoService::excluir($logoNovo);

            $mensagem = mb_strtolower($e->getMessage());

            $status = str_contains($mensagem, 'cadastrado')
                ? 409
                : 500;

            http_response_code($status);

            echo json_encode([
                'success' => false,
                'message' => $status === 409
                    ? $e->getMessage()
                    : 'Não foi possível criar o veículo.',
            ]);
        } catch (\Throwable $e) {
            LogoVeiculoService::excluir($logoNovo);

            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível criar o veículo.',
            ]);
        }
    }

    public function atualizar(
        array $dados
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.'
            ]);

            return;
        }

        $body = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (!is_array($body)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'JSON inválido.'
            ]);

            return;
        }

        try {
            $veiculo =
                VeiculoService::atualizar(
                    $id,
                    (int) $usuario->assessoria_id,
                    $body
                );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo atualizado com sucesso.',
                'veiculo' => $veiculo
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(
                str_contains(
                    $e->getMessage(),
                    'não encontrado'
                )
                    ? 404
                    : 409
            );

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível atualizar o veículo.'
            ]);
        }
    }
    
    public function atualizarComLogo(
        array $dadosRota
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dadosRota['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.',
            ]);

            return;
        }

        $dados = $_POST;

        $logoNovo = null;

        try {
            $anterior = VeiculoService::buscarPorId(
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
                isset($_FILES['logo'])
            ) {
                throw new \InvalidArgumentException(
                    'Escolha entre trocar ou remover o logo.'
                );
            }

            if (isset($_FILES['logo'])) {
                $logoNovo = LogoVeiculoService::salvar(
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

            $atualizado = VeiculoService::atualizar(
                $id,
                (int) $usuario->assessoria_id,
                $dados
            );

            if (
                ($anterior['logo_path'] ?? null) !==
                ($atualizado['logo_path'] ?? null)
            ) {
                LogoVeiculoService::excluir(
                    $anterior['logo_path'] ?? null
                );
            }

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo atualizado com sucesso.',
                'veiculo' => $atualizado,
            ]);
        } catch (\InvalidArgumentException $e) {
            LogoVeiculoService::excluir($logoNovo);

            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        } catch (\RuntimeException $e) {
            LogoVeiculoService::excluir($logoNovo);

            $mensagem = mb_strtolower($e->getMessage());

            $status = str_contains(
                $mensagem,
                'não encontrado'
            )
                ? 404
                : (
                    str_contains($mensagem, 'já existe')
                        ? 409
                        : 500
                );

            http_response_code($status);

            echo json_encode([
                'success' => false,
                'message' => $status === 500
                    ? 'Não foi possível atualizar o veículo.'
                    : $e->getMessage(),
            ]);
        } catch (\Throwable $e) {
            LogoVeiculoService::excluir($logoNovo);

            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível atualizar o veículo.',
            ]);
        }
    }

    public function excluirEmLote(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.',
            ]);

            return;
        }

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (!is_array($dados)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'JSON inválido.',
            ]);

            return;
        }

        if (
            !array_key_exists('ids', $dados) ||
            !is_array($dados['ids'])
        ) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => 'Informe os veículos que deseja excluir.',
            ]);

            return;
        }

        try {
            $excluidos = VeiculoService::excluirEmLote(
                (int) $usuario->assessoria_id,
                $dados['ids']
            );

            echo json_encode([
                'success' => true,
                'message' => $excluidos === 1
                    ? 'Veículo excluído com sucesso.'
                    : "{$excluidos} veículos excluídos com sucesso.",
                'excluidos' => $excluidos,
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível excluir os veículos selecionados.',
            ]);
        }
    }

    public function excluir(
        array $dados
    ): void {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'ID de veículo inválido.'
            ]);

            return;
        }

        try {
            VeiculoService::excluir(
                $id,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Veículo excluído com sucesso.'
            ]);
        } catch (\RuntimeException $e) {
            http_response_code(
                str_contains(
                    $e->getMessage(),
                    'não encontrado'
                )
                    ? 404
                    : 409
            );

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível excluir o veículo.'
            ]);
        }
    }


    private function dadosDaRequisicao(): ?array
    {
        if (
            !empty($_POST) ||
            isset($_FILES['logo'])
        ) {
            return $_POST;
        }

        $dados = json_decode(
            file_get_contents('php://input'),
            true
        );

        return is_array($dados)
            ? $dados
            : null;
    }
}