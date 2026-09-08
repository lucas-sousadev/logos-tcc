<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\JornalistaService;

class JornalistaController
{
    public function listar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $page = filter_input(
            INPUT_GET,
            'page',
            FILTER_VALIDATE_INT
        ) ?: 1;

        $limit = filter_input(
            INPUT_GET,
            'limit',
            FILTER_VALIDATE_INT
        ) ?: 50;

        $veiculoId = filter_input(
            INPUT_GET,
            'veiculo_id',
            FILTER_VALIDATE_INT
        );

        $ativo = filter_input(
            INPUT_GET,
            'ativo',
            FILTER_VALIDATE_INT
        );

        if ($ativo === false) {
            $ativo = null;
        }

        try {
            $resultado =
                JornalistaService::listar(
                    (int) $usuario->assessoria_id,
                    $page,
                    $limit,
                    $_GET['busca'] ?? null,
                    $_GET['estado'] ?? null,
                    $_GET['cidade'] ?? null,
                    $_GET['cargo'] ?? null,
                    $veiculoId ?: null,
                    $ativo,
                    $_GET['ordem'] ?? 'nome',
                    $_GET['direcao'] ?? 'ASC'
                );

            echo json_encode([
                'success' => true,
                'jornalistas' =>
                    $resultado['jornalistas'],
                'pagination' =>
                    $resultado['pagination'],
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar o mailing.'
            ]);
        }
    }

    public function exportar(): void
    {
        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.',
            ]);

            return;
        }

        $veiculoId = filter_input(
            INPUT_GET,
            'veiculo_id',
            FILTER_VALIDATE_INT
        );

        if ($veiculoId === false || $veiculoId <= 0) {
            $veiculoId = null;
        }

        $ativo = filter_input(
            INPUT_GET,
            'ativo',
            FILTER_VALIDATE_INT
        );

        if (!in_array($ativo, [0, 1], true)) {
            $ativo = null;
        }

        $arquivo = fopen('php://output', 'wb');

        if ($arquivo === false) {
            http_response_code(500);

            header(
                'Content-Type: application/json; charset=utf-8'
            );

            echo json_encode([
                'success' => false,
                'message' => 'Não foi possível gerar o arquivo.',
            ]);

            return;
        }

        $nomeArquivo =
            'mailing-' . date('Y-m-d-His') . '.csv';

        header('Content-Type: text/csv; charset=UTF-8');
        header(
            'Content-Disposition: attachment; filename="' .
            $nomeArquivo .
            '"'
        );
        header('X-Content-Type-Options: nosniff');

        fwrite($arquivo, "\xEF\xBB\xBF");

        fputcsv(
            $arquivo,
            [
                'Nome',
                'E-mail',
                'Telefone',
                'Cargo',
                'Estado',
                'Cidade',
                'Veículo',
                'Observações',
                'Ativo',
            ],
            ';'
        );

        try {
            foreach (
                JornalistaService::exportar(
                    (int) $usuario->assessoria_id,
                    $_GET['busca'] ?? null,
                    $_GET['estado'] ?? null,
                    $_GET['cidade'] ?? null,
                    $_GET['cargo'] ?? null,
                    $veiculoId,
                    $ativo,
                    $_GET['ordem'] ?? 'nome',
                    $_GET['direcao'] ?? 'ASC'
                ) as $contato
            ) {
                fputcsv(
                    $arquivo,
                    [
                        self::protegerValorCsv(
                            $contato['nome'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['email'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['telefone'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['cargo'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['estado'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['cidade'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['veiculo_nome'] ?? null
                        ),
                        self::protegerValorCsv(
                            $contato['observacoes'] ?? null
                        ),
                        (string) ($contato['ativo'] ?? 1),
                    ],
                    ';'
                );
            }
        } catch (\Throwable $e) {
            error_log(
                'Erro ao exportar mailing: ' .
                $e->getMessage()
            );

            fclose($arquivo);

            return;
        }
    }

    private static function protegerValorCsv(
        mixed $valor
    ): string {
        if ($valor === null) {
            return '';
        }

        $texto = (string) $valor;

        if (
            $texto !== '' &&
            preg_match('/^[=+\-@]/u', $texto)
        ) {
            return "'" . $texto;
        }

        return $texto;
    }

    public function importar(): void
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

        $arquivo = $_FILES['arquivo'] ?? null;

        if (!is_array($arquivo)) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' => 'Selecione um arquivo CSV.',
            ]);

            return;
        }

        $erroUpload = (int) (
            $arquivo['error'] ?? UPLOAD_ERR_NO_FILE
        );

        if ($erroUpload !== UPLOAD_ERR_OK) {
            $mensagem = match ($erroUpload) {
                UPLOAD_ERR_INI_SIZE,
                UPLOAD_ERR_FORM_SIZE =>
                    'O arquivo excede o tamanho permitido.',
                UPLOAD_ERR_NO_FILE =>
                    'Selecione um arquivo CSV.',
                default =>
                    'Não foi possível receber o arquivo.',
            };

            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $mensagem,
            ]);

            return;
        }

        $tamanho = (int) ($arquivo['size'] ?? 0);

        if ($tamanho <= 0) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => 'O arquivo CSV está vazio.',
            ]);

            return;
        }

        if ($tamanho > 5 * 1024 * 1024) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' =>
                    'O arquivo deve possuir no máximo 5 MB.',
            ]);

            return;
        }

        $nomeArquivo = (string) (
            $arquivo['name'] ?? ''
        );

        $extensao = strtolower(
            pathinfo(
                $nomeArquivo,
                PATHINFO_EXTENSION
            )
        );

        if ($extensao !== 'csv') {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Selecione um arquivo no formato CSV.',
            ]);

            return;
        }

        $arquivoTemporario = (string) (
            $arquivo['tmp_name'] ?? ''
        );

        if (
            $arquivoTemporario === '' ||
            !is_uploaded_file($arquivoTemporario)
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível validar o arquivo enviado.',
            ]);

            return;
        }

        try {
            $resultado =
                JornalistaService::importarArquivoCsv(
                    (int) $usuario->assessoria_id,
                    $arquivoTemporario
                );

            if (!$resultado['sucesso']) {
                http_response_code(422);

                echo json_encode([
                    'success' => false,
                    'message' =>
                        'Corrija os erros do arquivo antes de importar.',
                    'resumo' => $resultado['resumo'],
                    'erros' => $resultado['erros'],
                    'ignorados' =>
                        $resultado['ignorados'],
                ]);

                return;
            }

            echo json_encode([
                'success' => true,
                'message' =>
                    'Importação concluída com sucesso.',
                'resumo' => $resultado['resumo'],
                'ignorados' =>
                    $resultado['ignorados'],
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível importar os contatos.',
            ]);
        }
    }

    public function buscar(array $dados): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'ID do contato não informado.'
            ]);

            return;
        }

        try {
            $jornalista =
                JornalistaService::buscar(
                    (int) $id,
                    (int) $usuario->assessoria_id
                );

            if (!$jornalista) {
                http_response_code(404);

                echo json_encode([
                    'success' => false,
                    'message' =>
                        'Contato não encontrado.'
                ]);

                return;
            }

            echo json_encode([
                'success' => true,
                'jornalista' => $jornalista
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível carregar o contato.'
            ]);
        }
    }

    public function criar(): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
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
                'message' => 'JSON inválido.'
            ]);

            return;
        }

        try {
            $id = JornalistaService::criar(
                (int) $usuario->assessoria_id,
                $dados
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contato cadastrado com sucesso.',
                'jornalista_id' => $id,
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível cadastrar o contato.'
            ]);
        }
    }

    public function atualizar(array $dados): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'ID do contato não informado.'
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
            JornalistaService::atualizar(
                (int) $id,
                (int) $usuario->assessoria_id,
                $body
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contato atualizado com sucesso.'
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(500);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível atualizar o contato.'
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

        if (
            !is_array($dados) ||
            !isset($dados['ids']) ||
            !is_array($dados['ids'])
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Selecione os contatos que deseja excluir.',
            ]);

            return;
        }

        try {
            $excluidos =
                JornalistaService::excluirEmLote(
                    (int) $usuario->assessoria_id,
                    $dados['ids']
                );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contatos excluídos com sucesso.',
                'excluidos' => $excluidos,
            ]);
        } catch (\InvalidArgumentException $e) {
            http_response_code(422);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        } catch (\Throwable $e) {
            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível excluir os contatos. ' .
                    'Algum deles pode estar vinculado a outros registros.',
            ]);
        }
    }

    public function excluir(array $dados): void
    {
        header(
            'Content-Type: application/json; charset=utf-8'
        );

        $usuario = AuthContext::get();

        if (!$usuario) {
            http_response_code(401);

            echo json_encode([
                'success' => false,
                'message' => 'Usuário não autenticado.'
            ]);

            return;
        }

        $id = filter_var(
            $dados['id'] ?? null,
            FILTER_VALIDATE_INT
        );

        if (!$id) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'ID do contato não informado.'
            ]);

            return;
        }

        try {
            JornalistaService::excluir(
                (int) $id,
                (int) $usuario->assessoria_id
            );

            echo json_encode([
                'success' => true,
                'message' =>
                    'Contato excluído com sucesso.'
            ]);

        } catch (\InvalidArgumentException $e) {
            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);

        } catch (\Throwable $e) {
            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Não foi possível excluir este contato. Ele pode estar vinculado a registros existentes.'
            ]);
        }
    }   
}