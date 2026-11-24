<?php

namespace Logos\AssessoriaApi\Controllers;

use Logos\AssessoriaApi\Services\AuthContext;
use Logos\AssessoriaApi\Services\PermissaoService;
use Logos\AssessoriaApi\Services\ReleaseService;
use Logos\AssessoriaApi\Services\TemplateService;
use Logos\AssessoriaApi\Services\ReleaseEnvioTesteService;
use Logos\AssessoriaApi\Services\ReleaseImagemService;
use Logos\AssessoriaApi\Services\ReleaseEnvioService;

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
        $this->executar(function (
            int $assessoriaId,
            int $usuarioId,
            string $perfil
        ): array {
            $this->exigirCriacaoOuEdicao($usuarioId, $perfil);

            return TemplateService::listar($assessoriaId, $_GET);
        });
    }

    public function carregarImagem(): void
    {
        $this->executar(function (
            int $assessoriaId,
            int $usuarioId,
            string $perfil
        ): array {
            $this->exigirCriacaoOuEdicao($usuarioId, $perfil);

            return [
                'caminho' => ReleaseImagemService::salvar($assessoriaId),
            ];
        }, 201);
    }

    public function enviar(array $rota): void
    {
        $this->executar(
            function (
                int $assessoriaId,
                int $usuarioId,
                string $perfil
            ) use ($rota): array {
                $dados = $this->corpo();
                if (array_diff(array_keys($dados), ['versao_edicao']) !== []) {
                    throw new \InvalidArgumentException(
                        'O envio usa os dados do release salvo.'
                    );
                }

                if (
                    !PermissaoService::usuarioTemPermissao(
                        $usuarioId,
                        $perfil,
                        'RELEASES',
                        'VISUALIZAR'
                    )
                ) {
                    throw new \RuntimeException(
                        'Você precisa da permissão de visualizar releases.',
                        403
                    );
                }

                return [
                    'envio' => ReleaseEnvioService::enfileirar(
                        $assessoriaId,
                        $rota['id'] ?? null,
                        $dados['versao_edicao'] ?? null
                    ),
                ];
            },
            202
        );
    }

    private function alterarProgramacao(array $rota, string $acao): void
    {
        $this->executar(function (
            int $assessoriaId,
            int $usuarioId,
            string $perfil
        ) use ($rota, $acao): array {
            if (!PermissaoService::usuarioTemPermissao(
                $usuarioId,
                $perfil,
                'RELEASES',
                'VISUALIZAR'
            )) {
                throw new \RuntimeException(
                    'Você precisa da permissão de visualizar releases.',
                    403
                );
            }
            $dados = $this->corpo();
            $campos = $acao === 'agendar'
                ? ['data', 'hora', 'versao_edicao']
                : ['versao_edicao'];
            if (array_diff(array_keys($dados), $campos) !== []) {
                throw new \InvalidArgumentException(
                    'A operação usa os dados do release salvo.'
                );
            }
            $id = $rota['id'] ?? null;
            $versao = $dados['versao_edicao'] ?? null;
            if (!is_string($versao) || !preg_match('/^[a-f0-9]{64}$/D', $versao)) {
                throw new \InvalidArgumentException(
                    'Reabra o release para conferir sua versão.'
                );
            }
            $envio = match ($acao) {
                'agendar' => ReleaseEnvioService::agendar(
                    $assessoriaId, $id, $dados
                ),
                'cancelar-agendamento' => ReleaseEnvioService::cancelarAgendamento(
                    $assessoriaId, $id, $versao
                ),
                'cancelar-envio' => ReleaseEnvioService::cancelarEnvio(
                    $assessoriaId, $id, $versao
                ),
            };

            return [
                'envio' => $envio,
                'release' => ReleaseService::buscar($assessoriaId, $id),
            ];
        });
    }

    public function agendar(array $rota): void
    {
        $this->alterarProgramacao($rota, 'agendar');
    }

    public function cancelarAgendamento(array $rota): void
    {
        $this->alterarProgramacao($rota, 'cancelar-agendamento');
    }

    public function cancelarEnvio(array $rota): void
    {
        $this->alterarProgramacao($rota, 'cancelar-envio');
    }

    public function situacaoEnvio(array $rota): void
    {
        $this->executar(
            fn(int $assessoriaId) => [
                'envio' => ReleaseEnvioService::situacao(
                    $assessoriaId,
                    $rota['id'] ?? null,
                    $_GET
                ),
            ]
        );
    }

    public function enviarTeste(): void
    {
        $this->executar(function (int $assessoriaId): array {
            ReleaseEnvioTesteService::enviar($assessoriaId, $this->corpo());

            return ['message' => 'Teste enviado.'];
        });
    }

    public function exibirImagem(array $rota): void
    {
        $this->executar(function (int $assessoriaId, int $usuarioId, string $perfil) use ($rota): never {
            if (
                !PermissaoService::usuarioTemPermissao(
                    $usuarioId,
                    $perfil,
                    'RELEASES',
                    'CRIAR'
                )
                && !PermissaoService::usuarioTemPermissao(
                    $usuarioId,
                    $perfil,
                    'RELEASES',
                    'VISUALIZAR'
                )
                && !PermissaoService::usuarioTemPermissao(
                    $usuarioId,
                    $perfil,
                    'TEMPLATES',
                    'VISUALIZAR'
                )
                && !PermissaoService::usuarioTemPermissao(
                    $usuarioId,
                    $perfil,
                    'TEMPLATES',
                    'CRIAR'
                )
                && !PermissaoService::usuarioTemPermissao(
                    $usuarioId,
                    $perfil,
                    'TEMPLATES',
                    'EDITAR'
                )
            ) {
                throw new \RuntimeException(
                    'Você não possui permissão para visualizar a imagem.',
                    403
                );
            }

            ReleaseImagemService::exibir(
                $assessoriaId,
                $rota['assessoria_id'] ?? null,
                $rota['arquivo'] ?? null
            );
        });
    }

    private function exigirCriacaoOuEdicao(
        int $usuarioId,
        string $perfil
    ): void {
        if (
            !PermissaoService::usuarioTemPermissao(
                $usuarioId,
                $perfil,
                'RELEASES',
                'CRIAR'
            )
            && !PermissaoService::usuarioTemPermissao(
                $usuarioId,
                $perfil,
                'RELEASES',
                'EDITAR'
            )
        ) {
            throw new \RuntimeException(
                'Você não possui permissão para criar ou editar releases.',
                403
            );
        }
    }

    public function atualizar(array $rota): void
    {
        $this->executar(function (
            int $assessoriaId,
            int $usuarioId,
            string $perfil
        ) use ($rota): array {
            return [
                'message' => 'Rascunho atualizado.',
                'release' => ReleaseService::atualizar(
                    $assessoriaId,
                    $rota['id'] ?? null,
                    $this->corpo(),
                    PermissaoService::usuarioTemPermissao(
                        $usuarioId,
                        $perfil,
                        'MAILING',
                        'VISUALIZAR'
                    ),
                    PermissaoService::usuarioTemPermissao(
                        $usuarioId,
                        $perfil,
                        'CLIENTES',
                        'VISUALIZAR'
                    )
                ),
            ];
        });
    }

    public function excluir(array $rota): void
    {
        $this->executar(function (
            int $assessoriaId
        ) use ($rota): array {
            $dados = $this->corpo();

            if (array_keys($dados) !== ['versao_edicao']) {
                throw new \InvalidArgumentException(
                    'Informe apenas a versão do release para excluir.'
                );
            }

            ReleaseService::excluir(
                $assessoriaId,
                $rota['id'] ?? null,
                $dados['versao_edicao']
            );

            return ['message' => 'Release excluído.'];
        });
    }

    public function repetirFalhas(array $rota): void
    {
        $this->executar(
            function (
                int $assessoriaId,
                int $usuarioId,
                string $perfil
            ) use ($rota): array {
                if ($this->corpo() !== []) {
                    throw new \InvalidArgumentException(
                        'A nova tentativa usa os destinatários do release salvo.'
                    );
                }

                if (
                    !PermissaoService::usuarioTemPermissao(
                        $usuarioId,
                        $perfil,
                        'RELEASES',
                        'VISUALIZAR'
                    )
                ) {
                    throw new \RuntimeException(
                        'Você precisa da permissão de visualizar releases.',
                        403
                    );
                }

                return [
                    'envio' => ReleaseEnvioService::reenfileirarFalhas(
                        $assessoriaId,
                        $rota['id'] ?? null
                    ),
                ];
            },
            202
        );
    }

    public function descartarCriacao(): void
    {
        $this->executar(function (int $a, int $u): array {
            $dados = $this->corpo();
            if (($dados['conta'] ?? null) !== $a . '-' . $u) {
                throw new \RuntimeException('A conta foi alterada. O descarte será retomado na conta original.', 403);
            }
            unset($dados['conta']);
            return ReleaseService::descartarCriacao($a, $u, $dados);
        });
    }

    public function salvarAutomaticamente(): void
    {
        $this->executar(function (
            int $assessoriaId,
            int $usuarioId,
            string $perfil
        ): array {
            $pode = static fn(
                string $modulo,
                string $acao
            ): bool => PermissaoService::usuarioTemPermissao(
                $usuarioId,
                $perfil,
                $modulo,
                $acao
            );

            return [
                'release' => ReleaseService::salvarAutomaticamente(
                    $assessoriaId,
                    $usuarioId,
                    $this->corpo(),
                    $pode('RELEASES', 'CRIAR'),
                    $pode('RELEASES', 'EDITAR')
                        && $pode('RELEASES', 'VISUALIZAR'),
                    $pode('MAILING', 'VISUALIZAR'),
                    $pode('CLIENTES', 'VISUALIZAR')
                ),
            ];
        });
    }
}