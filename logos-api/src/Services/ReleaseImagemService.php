<?php

namespace Logos\AssessoriaApi\Services;

final class ReleaseImagemService
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const NOME_ARQUIVO = '[a-f0-9]{64}\.(jpg|png|webp)';
    private const MIME = [
        'jpg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
    ];

    private static function diretorio(int $assessoriaId): string
    {
        return ArquivoClippingService::baseArmazenamento()
            . '/imagens-releases/' . $assessoriaId;
    }

    public static function salvar(int $assessoriaId): string
    {
        if (self::basePublica() === null) {
            throw new \RuntimeException(
                'Configure RELEASE_API_URL com a URL base da API do LOGOS.',
                503
            );
        }

        $arquivo = ArquivoClippingService::validarUpload();

        if ($arquivo['tipo'] !== 'IMAGEM') {
            throw new \InvalidArgumentException('Selecione uma imagem JPG, PNG ou WEBP.');
        }

        if ($arquivo['tamanho_bytes'] > self::MAX_BYTES) {
            throw new \LengthException('A imagem deve ter até 5 MB.');
        }

        $hash = hash_file('sha256', $arquivo['temporario']);

        if ($hash === false) {
            throw new \RuntimeException('Não foi possível identificar a imagem.');
        }

        $pasta = self::diretorio($assessoriaId);

        if (!is_dir($pasta) && !@mkdir($pasta, 0750, true) && !is_dir($pasta)) {
            throw new \RuntimeException('Não foi possível criar a pasta de imagens.');
        }

        $nome = $hash . '.' . $arquivo['extensao'];
        $destino = $pasta . '/' . $nome;

        if (
            !is_file($destino) &&
            !@move_uploaded_file($arquivo['temporario'], $destino) &&
            !is_file($destino)
        ) {
            throw new \RuntimeException('Não foi possível guardar a imagem.');
        }

        return "/api/releases/imagens/{$assessoriaId}/{$nome}";
    }

    private static function encontrar(int $assessoriaId, string $nome): ?string
    {
        if (!preg_match('~^' . self::NOME_ARQUIVO . '$~D', $nome)) {
            return null;
        }

        $arquivo = self::diretorio($assessoriaId) . '/' . $nome;

        if (is_file($arquivo)) {
            return $arquivo;
        }

        $legado = dirname(__DIR__, 2)
            . "/public/uploads/releases/{$assessoriaId}/{$nome}";

        return is_file($legado) ? $legado : null;
    }

    private static function basePublica(): ?array
    {
        $url = parse_url(trim($_ENV['RELEASE_API_URL'] ?? ''));

        if (
            !is_array($url) ||
            !in_array(strtolower($url['scheme'] ?? ''), ['http', 'https'], true) ||
            empty($url['host']) ||
            isset($url['user']) || isset($url['pass']) ||
            isset($url['query']) || isset($url['fragment'])
        ) {
            return null;
        }

        return $url;
    }

    public static function localizar(int $assessoriaId, string $url): ?string
    {
        $config = self::basePublica();
        $imagem = parse_url($url);

        if (
            $config === null ||
            !is_array($imagem) ||
            isset($imagem['user']) ||
            isset($imagem['pass'])
        ) {
            return null;
        }

        $protocolo = strtolower($imagem['scheme'] ?? '');
        $portaPadrao = $protocolo === 'https' ? 443 : 80;
        $prefixo = rtrim($config['path'] ?? '', '/');
        $path = $imagem['path'] ?? '';

        if (
            $protocolo !== strtolower($config['scheme']) ||
            strcasecmp($imagem['host'] ?? '', $config['host']) !== 0 ||
            ($imagem['port'] ?? $portaPadrao) !== ($config['port'] ?? $portaPadrao) ||
            !str_starts_with($path, $prefixo . '/')
        ) {
            return null;
        }

        $caminho = substr($path, strlen($prefixo));
        $formato = '~^/(?:api/releases/imagens|uploads/releases)/([1-9][0-9]*)/('
            . self::NOME_ARQUIVO . ')$~D';

        if (!preg_match($formato, $caminho, $partes)) {
            return null;
        }

        $arquivo = $partes[1] === (string) $assessoriaId
            ? self::encontrar($assessoriaId, $partes[2])
            : null;

        if ($arquivo === null) {
            throw new \InvalidArgumentException(
                'Uma imagem do LOGOS não está disponível para este release. Troque a imagem e tente novamente.'
            );
        }

        return $arquivo;
    }

    public static function exibir(int $assessoriaId, mixed $dono, mixed $nome): never
    {
        $arquivo = $dono === (string) $assessoriaId && is_string($nome)
            ? self::encontrar($assessoriaId, $nome)
            : null;

        $stream = $arquivo === null ? false : @fopen($arquivo, 'rb');

        if ($stream === false) {
            throw new \OutOfBoundsException('Imagem não encontrada.');
        }

        header('Content-Type: ' . self::MIME[pathinfo($arquivo, PATHINFO_EXTENSION)]);
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');

        fpassthru($stream);
        fclose($stream);
        exit;
    }
}