<?php

namespace Logos\AssessoriaApi\Services;

use InvalidArgumentException;
use RuntimeException;

final class FotoPerfilService
{
    public static function salvar(
        array $arquivo,
        int $assessoriaId,
        int $usuarioId
    ): string {
        if (($arquivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Selecione uma imagem JPG, PNG ou WEBP de até 2 MB.');
        }

        $temporario = $arquivo['tmp_name'] ?? '';
        if (!is_string($temporario) || !is_uploaded_file($temporario)) {
            throw new InvalidArgumentException('O arquivo da foto é inválido.');
        }

        $tamanho = filesize($temporario);
        if ($tamanho === false || $tamanho <= 0 || $tamanho > 2 * 1024 * 1024) {
            throw new InvalidArgumentException('A foto deve possuir no máximo 2 MB.');
        }

        $tipos = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ];
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporario);
        if (!is_string($mime) || !isset($tipos[$mime])) {
            throw new InvalidArgumentException('Envie uma imagem JPG, PNG ou WEBP válida.');
        }
        $dimensoes = @getimagesize($temporario);
        if (
            !isset($tipos[$mime]) || !$dimensoes
            || ($dimensoes['mime'] ?? '') !== $mime
            || $dimensoes[0] <= 0 || $dimensoes[1] <= 0
            || $dimensoes[0] > 4000 || $dimensoes[1] > 4000
            || $dimensoes[0] * $dimensoes[1] > 12_000_000
        ) {
            throw new InvalidArgumentException('Envie uma imagem JPG, PNG ou WEBP válida, com até 4000 pixels por lado.');
        }

        $caminho = 'uploads/perfis/' . $assessoriaId . '/' . $usuarioId;
        $diretorio = dirname(__DIR__, 2) . '/public/' . $caminho;
        if (!is_dir($diretorio) && !mkdir($diretorio, 0755, true) && !is_dir($diretorio)) {
            throw new RuntimeException('Não foi possível preparar o armazenamento da foto.');
        }

        $caminho .= '/' . bin2hex(random_bytes(16)) . '.' . $tipos[$mime];
        if (!move_uploaded_file($temporario, dirname(__DIR__, 2) . '/public/' . $caminho)) {
            throw new RuntimeException('Não foi possível salvar a foto.');
        }

        return $caminho;
    }

    public static function excluir(
        ?string $caminho,
        int $assessoriaId,
        int $usuarioId
    ): void {
        $prefixo = preg_quote('uploads/perfis/' . $assessoriaId . '/' . $usuarioId . '/', '#');
        if (!$caminho || !preg_match('#\A' . $prefixo . '[a-f0-9]{32}\.(?:jpg|png|webp)\z#D', $caminho)) {
            return;
        }

        $arquivo = dirname(__DIR__, 2) . '/public/' . $caminho;
        clearstatcache(true, $arquivo);
        if (is_file($arquivo) && !@unlink($arquivo)) {
            error_log('Não foi possível remover uma foto de perfil substituída.');
        }
    }
}
