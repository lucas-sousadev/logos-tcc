<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use InvalidArgumentException;
use DomainException;
use OutOfBoundsException;
use RuntimeException;
use PDOException;
use Throwable;

final class PerfilService
{
    public static function buscar(
        int $usuarioId,
        int $assessoriaId
    ): array {
        $stmt = Connection::get()->prepare('
            SELECT u.id, u.assessoria_id, u.nome, u.email, u.telefone,
                   u.foto_path, u.cargo, u.cidade, u.uf, u.perfil, u.ativo,
                   u.email_verificado, u.created_at, a.nome AS assessoria_nome
            FROM usuarios u
            INNER JOIN assessorias a ON a.id = u.assessoria_id
            WHERE u.id = :id AND u.assessoria_id = :assessoria
        ');
        $stmt->execute([
            'id' => $usuarioId,
            'assessoria' => $assessoriaId,
        ]);
        $usuario = $stmt->fetch();
        if (!$usuario) {
            throw new OutOfBoundsException('Perfil não encontrado.');
        }
        if (!$usuario['ativo']) {
            throw new RuntimeException('Sua conta está inativa.', 401);
        }

        $usuario['id'] = (int) $usuario['id'];
        $usuario['assessoria_id'] = (int) $usuario['assessoria_id'];
        $usuario['email_verificado'] = (bool) $usuario['email_verificado'];
        unset($usuario['ativo']);
        $usuario['perfil_versao'] = hash(
            'sha256',
            json_encode($usuario, JSON_THROW_ON_ERROR)
        );

        return $usuario;
    }

    private static function texto(
        mixed $valor,
        int $limite,
        string $rotulo
    ): string {
        if (!is_string($valor) || !mb_check_encoding($valor, 'UTF-8')) {
            throw new InvalidArgumentException('O campo ' . $rotulo . ' é inválido.');
        }

        $valor = trim($valor);
        if (
            mb_strlen($valor, 'UTF-8') > $limite
            || preg_match('/[\x00-\x1f\x7f]/u', $valor)
        ) {
            throw new InvalidArgumentException('O campo ' . $rotulo . ' deve ter até ' . $limite . ' caracteres, sem quebras de linha.');
        }
        return $valor;
    }

    public static function atualizar(
        int $usuarioId,
        int $assessoriaId,
        array $dados,
        ?array $foto = null
    ): array {
        $permitidos = [
            'nome',
            'email',
            'telefone',
            'cargo',
            'cidade',
            'uf',
            'perfil_versao',
            'senha_atual',
            'remover_foto',
        ];
        if (array_diff(array_keys($dados), $permitidos)) {
            throw new InvalidArgumentException('O perfil contém campos que não podem ser alterados.');
        }
        $nome = self::texto($dados['nome'] ?? null, 150, 'nome');
        $email = strtolower(self::texto($dados['email'] ?? null, 150, 'e-mail'));
        $telefoneInformado = self::texto($dados['telefone'] ?? '', 30, 'telefone');
        $telefone = TelefoneService::normalizar($telefoneInformado);
        $cargo = self::texto($dados['cargo'] ?? '', 100, 'cargo');
        $cidade = self::texto($dados['cidade'] ?? '', 100, 'cidade');
        $uf = strtoupper(self::texto($dados['uf'] ?? '', 2, 'UF'));
        if ($nome === '') {
            throw new InvalidArgumentException('Informe seu nome.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Informe um e-mail válido.');
        }
        if ($telefoneInformado !== '' && !TelefoneService::validar($telefone)) {
            throw new InvalidArgumentException('Informe um telefone com DDD válido.');
        }
        $estados = [
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
            'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
            'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
        ];
        if ($uf !== '' && !in_array($uf, $estados, true)) {
            throw new InvalidArgumentException('Selecione uma UF válida.');
        }
        $versao = $dados['perfil_versao'] ?? null;
        if (!is_string($versao) || !preg_match('/^[a-f0-9]{64}$/D', $versao)) {
            throw new InvalidArgumentException('Recarregue o perfil antes de salvar.');
        }
        $senha = $dados['senha_atual'] ?? '';
        if (!is_string($senha)) {
            throw new InvalidArgumentException('A senha atual é inválida.');
        }
        $remover = $dados['remover_foto'] ?? '0';
        if (!in_array($remover, ['0', '1', 'false', 'true'], true)) {
            throw new InvalidArgumentException('A opção de remover foto é inválida.');
        }
        $remover = in_array($remover, ['1', 'true'], true);
        if ($remover && $foto !== null) {
            throw new InvalidArgumentException('Escolha entre enviar ou remover a foto.');
        }

        $db = Connection::get();
        $novaFoto = null;
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('
                SELECT id, senha_hash
                FROM usuarios
                WHERE id = :id AND assessoria_id = :assessoria
                FOR UPDATE
            ');
            $stmt->execute([
                'id' => $usuarioId,
                'assessoria' => $assessoriaId,
            ]);
            $registro = $stmt->fetch();
            if (!$registro) {
                throw new OutOfBoundsException('Perfil não encontrado.');
            }
            $atual = self::buscar($usuarioId, $assessoriaId);
            if (!hash_equals($atual['perfil_versao'], $versao)) {
                throw new DomainException('Seu perfil foi alterado em outra sessão. Confira a versão atual antes de salvar.');
            }
            $mudouEmail = strtolower($atual['email']) !== $email;
            if ($mudouEmail && !password_verify($senha, $registro['senha_hash'])) {
                throw new InvalidArgumentException('Confirme sua senha atual para alterar o e-mail.');
            }

            $caminho = $atual['foto_path'];
            if ($remover) {
                $caminho = null;
            }
            if ($foto !== null) {
                $caminho = $novaFoto = FotoPerfilService::salvar(
                    $foto,
                    $assessoriaId,
                    $usuarioId
                );
            }

            $stmt = $db->prepare('
                UPDATE usuarios
                SET nome = :nome, email = :email, telefone = :telefone,
                    cargo = :cargo, cidade = :cidade, uf = :uf, foto_path = :foto,
                    email_verificado = :verificado
                WHERE id = :id AND assessoria_id = :assessoria
            ');
            $stmt->execute([
                'nome' => $nome,
                'email' => $email,
                'telefone' => $telefone ?: null,
                'cargo' => $cargo ?: null,
                'cidade' => $cidade ?: null,
                'uf' => $uf ?: null,
                'foto' => $caminho,
                'verificado' => $mudouEmail ? 0 : (int) $atual['email_verificado'],
                'id' => $usuarioId,
                'assessoria' => $assessoriaId,
            ]);
            $resultado = self::buscar($usuarioId, $assessoriaId);
            $db->commit();
        } catch (Throwable $erro) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            FotoPerfilService::excluir($novaFoto, $assessoriaId, $usuarioId);
            if ($erro instanceof PDOException && (int) ($erro->errorInfo[1] ?? 0) === 1062) {
                throw new InvalidArgumentException('Já existe uma conta com este e-mail.');
            }
            throw $erro;
        }

        if ($atual['foto_path'] !== $resultado['foto_path']) {
            FotoPerfilService::excluir($atual['foto_path'], $assessoriaId, $usuarioId);
        }
        return $resultado;
    }
}
