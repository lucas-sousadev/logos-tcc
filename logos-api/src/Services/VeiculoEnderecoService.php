<?php

namespace Logos\AssessoriaApi\Services;

use DomainException;
use InvalidArgumentException;
use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Veiculo;
use OutOfBoundsException;
use PDO;
use PDOException;

class VeiculoEnderecoService
{
    public static function listar(
        int $assessoriaId,
        int $veiculoId
    ): array {
        self::verificarVeiculo($assessoriaId, $veiculoId);

        $stmt = Connection::get()->prepare("
            SELECT id, assessoria_id, veiculo_id, host, protocolo,
                   caminho_prefixo, incluir_subdominios, created_at
            FROM veiculo_enderecos
            WHERE assessoria_id = :assessoria_id
              AND veiculo_id = :veiculo_id
            ORDER BY host, caminho_prefixo
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
            'veiculo_id' => $veiculoId,
        ]);

        return array_map(
            self::formatar(...),
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    public static function adicionar(
        int $assessoriaId,
        int $veiculoId,
        array $dados
    ): array {
        self::verificarVeiculo($assessoriaId, $veiculoId);

        $hostInformado = $dados['host'] ?? null;
        $host = self::normalizarHost($hostInformado);
        $protocolo = self::protocoloDoHost($hostInformado);
        $caminho = self::normalizarCaminho(
            $dados['caminho_prefixo'] ?? ''
        );

        $incluirSubdominios = filter_var(
            $dados['incluir_subdominios'] ?? false,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($incluirSubdominios === null) {
            throw new InvalidArgumentException(
                'A opção de incluir subdomínios é inválida.'
            );
        }

        $pdo = Connection::get();

        try {
            $stmt = $pdo->prepare("
                INSERT INTO veiculo_enderecos
                    (assessoria_id, veiculo_id, host, protocolo,
                    caminho_prefixo, incluir_subdominios)
                VALUES
                    (:assessoria_id, :veiculo_id, :host, :protocolo,
                    :caminho_prefixo, :incluir_subdominios)
            ");

            $stmt->execute([
                'assessoria_id' => $assessoriaId,
                'veiculo_id' => $veiculoId,
                'host' => $host,
                'protocolo' => $protocolo,
                'caminho_prefixo' => $caminho,
                'incluir_subdominios' =>
                    $incluirSubdominios ? 1 : 0,
            ]);
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                throw new DomainException(
                    'Este endereço já está associado a um veículo.'
                );
            }

            throw $e;
        }

        $consulta = $pdo->prepare("
            SELECT id, assessoria_id, veiculo_id, host, protocolo,
                   caminho_prefixo, incluir_subdominios, created_at
            FROM veiculo_enderecos
            WHERE id = :id
              AND assessoria_id = :assessoria_id
              AND veiculo_id = :veiculo_id
        ");

        $consulta->execute([
            'id' => (int) $pdo->lastInsertId(),
            'assessoria_id' => $assessoriaId,
            'veiculo_id' => $veiculoId,
        ]);

        return self::formatar($consulta->fetch(PDO::FETCH_ASSOC));
    }

    public static function atualizar(
        int $assessoriaId,
        int $veiculoId,
        int $enderecoId,
        array $dados
    ): array {
        self::verificarVeiculo($assessoriaId, $veiculoId);

        $hostInformado = $dados['host'] ?? null;
        $host = self::normalizarHost($hostInformado);
        $protocolo = self::protocoloDoHost($hostInformado);
        $caminho = self::normalizarCaminho(
            $dados['caminho_prefixo'] ?? ''
        );

        $incluirSubdominios = filter_var(
            $dados['incluir_subdominios'] ?? false,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($incluirSubdominios === null) {
            throw new InvalidArgumentException(
                'A opção de incluir subdomínios é inválida.'
            );
        }

        $pdo = Connection::get();

        try {
            $stmt = $pdo->prepare("
                UPDATE veiculo_enderecos
                SET host = :host,
                    protocolo = :protocolo,
                    caminho_prefixo = :caminho_prefixo,
                    incluir_subdominios = :incluir_subdominios
                WHERE id = :id
                AND assessoria_id = :assessoria_id
                AND veiculo_id = :veiculo_id
            ");

            $stmt->execute([
                'host' => $host,
                'protocolo' => $protocolo,
                'caminho_prefixo' => $caminho,
                'incluir_subdominios' =>
                    $incluirSubdominios ? 1 : 0,
                'id' => $enderecoId,
                'assessoria_id' => $assessoriaId,
                'veiculo_id' => $veiculoId,
            ]);
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                throw new DomainException(
                    'Este endereço já está associado a um veículo.'
                );
            }

            throw $e;
        }

        $consulta = $pdo->prepare("
            SELECT id, assessoria_id, veiculo_id, host, protocolo,
                caminho_prefixo, incluir_subdominios, created_at
            FROM veiculo_enderecos
            WHERE id = :id
            AND assessoria_id = :assessoria_id
            AND veiculo_id = :veiculo_id
        ");

        $consulta->execute([
            'id' => $enderecoId,
            'assessoria_id' => $assessoriaId,
            'veiculo_id' => $veiculoId,
        ]);

        $registro = $consulta->fetch(PDO::FETCH_ASSOC);

        if (!$registro) {
            throw new OutOfBoundsException(
                'Endereço não encontrado.'
            );
        }

        return self::formatar($registro);
    }   

    public static function sincronizar(
        int $assessoriaId,
        int $veiculoId,
        array $enderecos
    ): void {
        if (
            !array_is_list($enderecos) ||
            count($enderecos) > 20
        ) {
            throw new InvalidArgumentException(
                'Informe uma lista de até 20 endereços.'
            );
        }

        self::verificarVeiculo($assessoriaId, $veiculoId);

        $atuais = self::listar($assessoriaId, $veiculoId);
        $atuaisPorId = [];

        foreach ($atuais as $atual) {
            $atuaisPorId[$atual['id']] = $atual;
        }

        $desejados = [];
        $idsRecebidos = [];
        $chavesRecebidas = [];

        foreach ($enderecos as $indice => $linha) {
            if (!is_array($linha)) {
                throw new InvalidArgumentException(
                    'Endereço ' . ($indice + 1) . ': dados inválidos.'
                );
            }

            $id = $linha['id'] ?? null;

            if ($id !== null) {
                if (
                    !is_int($id) ||
                    $id <= 0 ||
                    isset($idsRecebidos[$id]) ||
                    !isset($atuaisPorId[$id])
                ) {
                    throw new InvalidArgumentException(
                        'Endereço ' . ($indice + 1) .
                        ': registro inválido para este veículo.'
                    );
                }

                $idsRecebidos[$id] = true;
            }

            try {
                $hostInformado = $linha['host'] ?? null;
                $host = self::normalizarHost($hostInformado);
                $protocolo = self::protocoloDoHost(
                    $hostInformado
                );
                $caminho = self::normalizarCaminho(
                    $linha['caminho_prefixo'] ?? ''
                );

                $incluirSubdominios = filter_var(
                    $linha['incluir_subdominios'] ?? false,
                    FILTER_VALIDATE_BOOLEAN,
                    FILTER_NULL_ON_FAILURE
                );

                if ($incluirSubdominios === null) {
                    throw new InvalidArgumentException(
                        'A opção de incluir subdomínios é inválida.'
                    );
                }
            } catch (InvalidArgumentException $e) {
                throw new InvalidArgumentException(
                    'Endereço ' . ($indice + 1) . ': ' .
                    $e->getMessage(),
                    0,
                    $e
                );
            }

            $chave = $host . "\0" . $caminho;

            if (isset($chavesRecebidas[$chave])) {
                throw new InvalidArgumentException(
                    'Endereço ' . ($indice + 1) .
                    ': domínio e seção repetidos.'
                );
            }

            $chavesRecebidas[$chave] = true;

            $desejados[] = [
                'id' => $id,
                'host' => $host,
                'protocolo' => $protocolo,
                'caminho_prefixo' => $caminho,
                'incluir_subdominios' => $incluirSubdominios,
            ];
        }

        $idsMantidos = [];

        foreach ($desejados as $desejado) {
            $id = $desejado['id'];

            if ($id === null) {
                continue;
            }

            $atual = $atuaisPorId[$id];

            if (
                $atual['host'] === $desejado['host'] &&
                $atual['caminho_prefixo'] ===
                    $desejado['caminho_prefixo']
            ) {
                $idsMantidos[$id] = true;
            }
        }

        // remove endereços excluídos e aqueles cuja identidade (domínio ou seção) mudou
        foreach ($atuais as $atual) {
            if (!isset($idsMantidos[$atual['id']])) {
                self::remover(
                    $assessoriaId,
                    $veiculoId,
                    $atual['id']
                );
            }
        }

        foreach ($desejados as $indice => $desejado) {
            $dados = [
                'host' =>
                    $desejado['protocolo'] . '://' .
                    $desejado['host'],
                'caminho_prefixo' =>
                    $desejado['caminho_prefixo'],
                'incluir_subdominios' =>
                    $desejado['incluir_subdominios'],
            ];

            try {
                if (
                    $desejado['id'] !== null &&
                    isset($idsMantidos[$desejado['id']])
                ) {
                    self::atualizar(
                        $assessoriaId,
                        $veiculoId,
                        $desejado['id'],
                        $dados
                    );
                } else {
                    self::adicionar(
                        $assessoriaId,
                        $veiculoId,
                        $dados
                    );
                }
            } catch (DomainException $e) {
                throw new \RuntimeException(
                    'Já existe um endereço igual no cadastro ' .
                    'ou associado a outro veículo.',
                    0,
                    $e
                );
            }
        }
    }

    public static function remover(
        int $assessoriaId,
        int $veiculoId,
        int $enderecoId
    ): void {
        self::verificarVeiculo($assessoriaId, $veiculoId);

        $stmt = Connection::get()->prepare("
            DELETE FROM veiculo_enderecos
            WHERE id = :id
              AND assessoria_id = :assessoria_id
              AND veiculo_id = :veiculo_id
        ");

        $stmt->execute([
            'id' => $enderecoId,
            'assessoria_id' => $assessoriaId,
            'veiculo_id' => $veiculoId,
        ]);

        if ($stmt->rowCount() === 0) {
            throw new OutOfBoundsException(
                'Endereço não encontrado.'
            );
        }
    }

    private static function verificarVeiculo(
        int $assessoriaId,
        int $veiculoId
    ): void {
        if (!Veiculo::buscarPorId($veiculoId, $assessoriaId)) {
            throw new OutOfBoundsException(
                'Veículo não encontrado.'
            );
        }
    }

    private static function protocoloDoHost(mixed $valor): string
    {
        return is_string($valor) &&
            preg_match('~^http://~i', trim($valor)) === 1
            ? 'http'
            : 'https';
    }
    
    private static function normalizarHost(mixed $valor): string
    {
        if (!is_string($valor) || trim($valor) === '') {
            throw new InvalidArgumentException(
                'Informe o endereço do site.'
            );
        }

        $entrada = trim($valor);

        if (!preg_match('~^https?://~i', $entrada)) {
            $entrada = 'https://' . $entrada;
        }

        $partes = parse_url($entrada);

        if (
            !is_array($partes) ||
            empty($partes['host']) ||
            isset($partes['user']) ||
            isset($partes['pass']) ||
            isset($partes['port']) ||
            isset($partes['query']) ||
            isset($partes['fragment']) ||
            !in_array(
                strtolower($partes['scheme'] ?? ''),
                ['http', 'https'],
                true
            ) ||
            !in_array($partes['path'] ?? '', ['', '/'], true)
        ) {
            throw new InvalidArgumentException(
                'Informe apenas o domínio do site. A seção deve ser preenchida no campo separado.'
            );
        }

        $host = strtolower(rtrim($partes['host'], '.'));

        if (
            strlen($host) > 253 ||
            !str_contains($host, '.') ||
            preg_match('/^[a-z0-9.-]+$/D', $host) !== 1 ||
            filter_var(
                $host,
                FILTER_VALIDATE_DOMAIN,
                FILTER_FLAG_HOSTNAME
            ) === false ||
            filter_var($host, FILTER_VALIDATE_IP) !== false
        ) {
            throw new InvalidArgumentException(
                'O domínio informado é inválido.'
            );
        }

        return $host;
    }

    private static function normalizarCaminho(
        mixed $valor
    ): string {
        if (!is_string($valor)) {
            throw new InvalidArgumentException(
                'A seção do site é inválida.'
            );
        }

        $caminho = trim($valor);

        if ($caminho === '' || $caminho === '/') {
            return '';
        }

        if (
            !str_starts_with($caminho, '/') ||
            str_contains($caminho, '//') ||
            str_contains($caminho, '\\') ||
            strpbrk($caminho, '?#') !== false ||
            preg_match('/\s/u', $caminho) ||
            preg_match(
                '~(?:^|/)\.{1,2}(?:/|$)~',
                $caminho
            )
        ) {
            throw new InvalidArgumentException(
                'A seção deve ser um caminho como /agro, sem parâmetros.'
            );
        }

        $caminho = rtrim($caminho, '/');

        if (mb_strlen($caminho, 'UTF-8') > 300) {
            throw new InvalidArgumentException(
                'A seção do site pode ter no máximo 300 caracteres.'
            );
        }

        return $caminho;
    }

    private static function formatar(array $registro): array
    {
        $registro['id'] = (int) $registro['id'];
        $registro['assessoria_id'] =
            (int) $registro['assessoria_id'];
        $registro['veiculo_id'] =
            (int) $registro['veiculo_id'];
        $registro['incluir_subdominios'] =
            (bool) $registro['incluir_subdominios'];

        return $registro;
    }

    public static function transferirDoClipping(
        int $assessoriaId,
        ?int $veiculoDestinoId,
        ?string $link,
        mixed $transferencia
    ): void {
        if ($transferencia instanceof \stdClass) {
            $transferencia = get_object_vars($transferencia);
        }

        if (!is_array($transferencia)) {
            throw new InvalidArgumentException(
                'A correção da associação é inválida.'
            );
        }

        $enderecoId = $transferencia['endereco_id'] ?? null;
        $veiculoOrigemId = $transferencia['veiculo_origem_id'] ?? null;
        $versaoOrigem = $transferencia['versao_origem'] ?? null;

        if (
            !is_int($enderecoId) || $enderecoId <= 0 ||
            !is_int($veiculoOrigemId) || $veiculoOrigemId <= 0 ||
            !is_int($versaoOrigem) || $versaoOrigem < 0 ||
            $veiculoDestinoId === null || $veiculoDestinoId <= 0 ||
            $veiculoOrigemId === $veiculoDestinoId ||
            !$link
        ) {
            throw new InvalidArgumentException(
                'Confira o endereço e os veículos da correção.'
            );
        }

        $usuario = AuthContext::get();

        if (
            !$usuario ||
            (int) $usuario->assessoria_id !== $assessoriaId ||
            !PermissaoService::usuarioTemPermissao(
                (int) $usuario->sub,
                (string) $usuario->perfil,
                'VEICULOS',
                'EDITAR'
            )
        ) {
            throw new \LogicException(
                'Você não possui permissão para corrigir a associação do endereço.'
            );
        }

        $db = Connection::get();
        $transacaoPropria = !$db->inTransaction();

        if ($transacaoPropria) {
            $db->beginTransaction();
        }

        try {
            // bloqueia na mesma ordem pra duas correções não disputarem os veículos ao contrário
            $veiculos = [$veiculoOrigemId, $veiculoDestinoId];
            sort($veiculos, SORT_NUMERIC);
            $versoes = [];

            foreach ($veiculos as $veiculoId) {
                $versoes[$veiculoId] = self::bloquearVersao(
                    $assessoriaId,
                    $veiculoId
                );
            }

            if ($versoes[$veiculoOrigemId] !== $versaoOrigem) {
                throw new DomainException(
                    'Os endereços foram alterados em outra sessão. ' .
                    'Busque os dados do link novamente antes de corrigir a associação.'
                );
            }

            $destino = $db->prepare("
                SELECT ativo
                FROM veiculos
                WHERE id = :id
                AND assessoria_id = :assessoria_id
                FOR UPDATE
            ");
            $destino->execute([
                'id' => $veiculoDestinoId,
                'assessoria_id' => $assessoriaId,
            ]);

            if ((int) $destino->fetchColumn() !== 1) {
                throw new InvalidArgumentException(
                    'Selecione um veículo ativo para receber o endereço.'
                );
            }

            $consulta = $db->prepare("
                SELECT id, veiculo_id, host, caminho_prefixo,
                       incluir_subdominios
                FROM veiculo_enderecos
                WHERE id = :id
                AND assessoria_id = :assessoria_id
                FOR UPDATE
            ");
            $consulta->execute([
                'id' => $enderecoId,
                'assessoria_id' => $assessoriaId,
            ]);
            $endereco = $consulta->fetch(PDO::FETCH_ASSOC);

            if (
                !$endereco ||
                (int) $endereco['veiculo_id'] !== $veiculoOrigemId
            ) {
                throw new DomainException(
                    'Esta associação mudou desde a consulta. ' .
                    'Busque os dados do link novamente.'
                );
            }

            self::conferirEnderecoDoLink($endereco, $link);

            // confere a lista atual com o destino bloqueado pra não passar de 20 endereços
            $enderecosDestino = $db->prepare("
                SELECT id
                FROM veiculo_enderecos
                WHERE assessoria_id = :assessoria_id
                AND veiculo_id = :veiculo_id
                ORDER BY id
                LIMIT 20
                FOR UPDATE
            ");

            $enderecosDestino->execute([
                'assessoria_id' => $assessoriaId,
                'veiculo_id' => $veiculoDestinoId,
            ]);

            if (
                count(
                    $enderecosDestino->fetchAll(PDO::FETCH_COLUMN)
                ) >= 20
            ) {
                throw new DomainException(
                    'Este veículo já possui 20 endereços. ' .
                    'Remova um endereço do cadastro dele antes de transferir esta associação.'
                );
            }
            
            // muda só o dono desse endereço e mantém domínio, seção e demais opções
            $alterar = $db->prepare("
                UPDATE veiculo_enderecos
                SET veiculo_id = :destino_id
                WHERE id = :id
                AND assessoria_id = :assessoria_id
                AND veiculo_id = :origem_id
            ");
            $alterar->execute([
                'destino_id' => $veiculoDestinoId,
                'id' => $enderecoId,
                'assessoria_id' => $assessoriaId,
                'origem_id' => $veiculoOrigemId,
            ]);

            if ($alterar->rowCount() !== 1) {
                throw new DomainException(
                    'A associação mudou. Busque os dados do link novamente.'
                );
            }

            foreach ($veiculos as $veiculoId) {
                self::incrementarVersao($assessoriaId, $veiculoId);
            }

            if ($transacaoPropria) {
                $db->commit();
            }
        } catch (\Throwable $e) {
            if ($transacaoPropria && $db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }

    private static function conferirEnderecoDoLink(
        array $endereco,
        string $link
    ): void {
        $host = strtolower($endereco['host']);
        $hostLink = strtolower((string) parse_url($link, PHP_URL_HOST));
        $prefixo = rawurldecode($endereco['caminho_prefixo']);

        $semWww = static fn(string $valor): string =>
            preg_replace('/^www\./', '', $valor);

        if (in_array($semWww($host), ['youtube.com', 'youtu.be', 'instagram.com'], true)) {
            if (
                $semWww($host) === 'youtube.com' &&
                !(bool) $endereco['incluir_subdominios'] &&
                ExtracaoLinkService::ehVideoYoutube($link) &&
                preg_match(
                    '~^/(?:channel/UC[A-Za-z0-9_-]{22}|@[\pL\pN._-]{1,100}|user/[A-Za-z0-9._-]{1,100}|c/[A-Za-z0-9._-]{1,100})$~uD',
                    $prefixo
                ) === 1
            ) {
                return;
            }

            throw new InvalidArgumentException(
                'Corrija apenas a associação do canal, nunca da plataforma inteira.'
            );
        }

        $hostExato = $semWww($host) === $semWww($hostLink);
        $subdominio = (bool) $endereco['incluir_subdominios'] &&
            str_ends_with($hostLink, '.' . $host);

        $caminho = rawurldecode(
            (string) (parse_url($link, PHP_URL_PATH) ?: '/')
        );

        if (
            (!$hostExato && !$subdominio) ||
            (
                $prefixo !== '' &&
                $caminho !== $prefixo &&
                !str_starts_with($caminho, $prefixo . '/')
            )
        ) {
            throw new InvalidArgumentException(
                'O endereço da correção não corresponde ao link do clipping.'
            );
        }
    }

    public static function bloquearVersao(
        int $assessoriaId,
        int $veiculoId
    ): int {
        $stmt = Connection::get()->prepare("
            SELECT enderecos_versao
            FROM veiculos
            WHERE id = :id
            AND assessoria_id = :assessoria_id
            FOR UPDATE
        ");

        $stmt->execute([
            'id' => $veiculoId,
            'assessoria_id' => $assessoriaId,
        ]);

        $versao = $stmt->fetchColumn();

        if ($versao === false) {
            throw new OutOfBoundsException(
                'Veículo não encontrado.'
            );
        }

        return (int) $versao;
    }

    public static function incrementarVersao(
        int $assessoriaId,
        int $veiculoId
    ): void {
        $stmt = Connection::get()->prepare("
            UPDATE veiculos
            SET enderecos_versao = enderecos_versao + 1
            WHERE id = :id
            AND assessoria_id = :assessoria_id
        ");

        $stmt->execute([
            'id' => $veiculoId,
            'assessoria_id' => $assessoriaId,
        ]);
    }

    public static function listarComVersao(
        int $assessoriaId,
        int $veiculoId
    ): array {
        $db = Connection::get();
        $transacaoPropria = !$db->inTransaction();

        if ($transacaoPropria) {
            $db->beginTransaction();
        }

        try {
            $versao = self::bloquearVersao(
                $assessoriaId,
                $veiculoId
            );

            $enderecos = self::listar(
                $assessoriaId,
                $veiculoId
            );

            if ($transacaoPropria) {
                $db->commit();
            }

            return [
                'enderecos' => $enderecos,
                'versao' => $versao,
            ];
        } catch (\Throwable $e) {
            if ($transacaoPropria && $db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }

    public static function alterarDiretamente(
        int $assessoriaId,
        int $veiculoId,
        callable $alteracao
    ): mixed {
        $db = Connection::get();
        $transacaoPropria = !$db->inTransaction();

        if ($transacaoPropria) {
            $db->beginTransaction();
        }

        try {
            self::bloquearVersao(
                $assessoriaId,
                $veiculoId
            );

            $resultado = $alteracao();

            self::incrementarVersao(
                $assessoriaId,
                $veiculoId
            );

            if ($transacaoPropria) {
                $db->commit();
            }

            return $resultado;
        } catch (\Throwable $e) {
            if ($transacaoPropria && $db->inTransaction()) {
                $db->rollBack();
            }

            throw $e;
        }
    }
} 