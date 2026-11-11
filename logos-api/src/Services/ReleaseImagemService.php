<?php

namespace Logos\AssessoriaApi\Services;

final class ReleaseImagemService
{
    private const MAX_BYTES = 5 * 1024 * 1024;

    private static function diretorio(int $assessoriaId): string
    {
        return dirname(__DIR__, 2) . '/public/uploads/releases/' . $assessoriaId;
    }

    public static function salvar(int $assessoriaId): string
    {
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

        if (!is_dir($pasta) && !@mkdir($pasta, 0755, true) && !is_dir($pasta)) {
            throw new \RuntimeException('Não foi possível criar a pasta de imagens.');
        }

        $nome = $hash . '.' . $arquivo['extensao'];
        $destino = $pasta . '/' . $nome;

        if (
            !is_file($destino) &&
            !move_uploaded_file($arquivo['temporario'], $destino) &&
            !is_file($destino)
        ) {
            throw new \RuntimeException('Não foi possível guardar a imagem.');
        }

        return "/uploads/releases/{$assessoriaId}/{$nome}";
    }

    public static function localizar(int $assessoriaId, string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);
        $formato = "~(?:^|/)uploads/releases/{$assessoriaId}/([a-f0-9]{64}\.(?:jpg|png|webp))$~D";

        if (!is_string($path) || !preg_match($formato, $path, $partes)) {
            return null;
        }

        $arquivo = self::diretorio($assessoriaId) . '/' . $partes[1];

        return is_file($arquivo) ? $arquivo : null;
    }
}