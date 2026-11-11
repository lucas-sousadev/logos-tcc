<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\PermissaoService;
use Logos\AssessoriaApi\Services\ReleaseService;
use Logos\AssessoriaApi\Services\TemplateService;
use Logos\AssessoriaApi\Services\ReleaseEnvioTesteService;
use Logos\AssessoriaApi\Services\ReleaseImagemService;

class ReleaseController
{
    private function responder(array $dados, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private function corpo(): array
    {
        $corpo = file_get_contents('php://input', false, null, 0, 1048577);

        if ($corpo === false) {
            throw new \UnexpectedValueException('Não foi possível ler a requisição.');
        }

        if (strlen($corpo) > 1048576) {
            throw new \LengthException('A requisição ultrapassou o limite de 1 MB.');
        }

        try {
            $dados = json_decode($corpo, false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $erro) {
            throw new \UnexpectedValueException('JSON inválido.');
        }

        if (!$dados instanceof \stdClass) {
            throw new \UnexpectedValueException('Envie um objeto JSON no corpo da requisição.');
        }
    
        return json_decode($corpo, true, 512, JSON_THROW_ON_ERROR);
    }

    private function executar(callable $acao, int $status = 200): void
    {
        $usuario = AuthContext::get();

        if (!$usuario) {
            $this->responder(['success' => false, 'message' => 'Usuário não autenticado.'], 401);
            return;
        }

        try {
            $resultado = $acao((int) $usuario->assessoria_id, (int) $usuario->sub, $usuario->perfil);
            $this->responder(['success' => true, ...$resultado], $status);
        } catch (\OutOfBoundsException $erro) {
            $this->responder(['success' => false, 'message' => $erro->getMessage()], 404);
        } catch (\InvalidArgumentException $erro) {
            $this->responder(['success' => false, 'message' => $erro->getMessage()], 422);
        } catch (\LengthException $erro) {
            $this->responder(['success' => false, 'message' => $erro->getMessage()], 413);
        } catch (\UnexpectedValueException $erro) {
            $this->responder(['success' => false, 'message' => $erro->getMessage()], 400);
        } catch (\DomainException $erro) {
            $this->responder(['success' => false, 'message' => $erro->getMessage()], 409);
        } catch (\Throwable $erro) {
            if (
                $erro instanceof \RuntimeException &&
                in_array($erro->getCode(), [403, 429, 502, 503], true)
            ) {
                $this->responder(
                    ['success' => false, 'message' => $erro->getMessage()],
                    $erro->getCode()
                );
                return;
            }

            error_log('Erro no módulo Releases: ' . $erro->getMessage());
            $this->responder(['success' => false, 'message' => 'Não foi possível concluir a operação.'], 500);
        }
    }

    public function listar(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) => ReleaseService::listar($assessoriaId, $_GET)
        );
    }

    public function buscar(array $rota): void
    {
        $this->executar(fn(int $assessoriaId, int $usuarioId) => [
            'release' => ReleaseService::buscar($assessoriaId, $rota['id'] ?? null),
        ]);
    }

    public function criar(): void
    {
        $this->executar(function (int $assessoriaId, int $usuarioId, string $perfil): array {
            $dados = $this->corpo();

            if (
                ($dados['jornalistas_ids'] ?? []) !== []
                && !PermissaoService::usuarioTemPermissao($usuarioId, $perfil, 'MAILING', 'VISUALIZAR')
            ) {
                throw new \RuntimeException('Você precisa da permissão de visualizar o Mailing para adicionar destinatários.', 403);
            }

            if (
                isset($dados['cliente_id']) && $dados['cliente_id'] !== ''
                && !PermissaoService::usuarioTemPermissao($usuarioId, $perfil, 'CLIENTES', 'VISUALIZAR')
            ) {
                throw new \RuntimeException('Você precisa da permissão de visualizar clientes para vincular um cliente.', 403);
            }

            return [
                'message' => 'Rascunho de release cadastrado com sucesso.',
                'release' => ReleaseService::criar($assessoriaId, $usuarioId, $dados),
            ];
        }, 201);
    }

    public function destinatarios(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                ReleaseService::selecionarDestinatarios(
                    $assessoriaId,
                    $_GET
                )
        );
    }

    public function templates(): void
    {
        $this->executar(
            fn(int $assessoriaId, int $usuarioId) =>
                TemplateService::listar($assessoriaId, $_GET)
        );
    }

    public function carregarImagem(): void
    {
        $this->executar(fn(int $assessoriaId) => [
            'caminho' => ReleaseImagemService::salvar($assessoriaId),
        ], 201);
    }
    
    public function enviarTeste(): void
    {
        $this->executar(function (int $assessoriaId): array {
            ReleaseEnvioTesteService::enviar($assessoriaId, $this->corpo());

            return ['message' => 'Teste enviado.'];
        });
    }
}
