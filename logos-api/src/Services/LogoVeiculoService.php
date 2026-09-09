<?php

namespace Logos\AssessoriaApi\Services;

use InvalidArgumentException;
use RuntimeException;

class LogoVeiculoService
{
    private const MAX_TAMANHO = 2 * 1024 * 1024;
    private const MAX_LARGURA = 4000;
    private const MAX_ALTURA = 4000;
    private const MAX_PIXELS = 12_000_000;

    private const EXTENSOES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public static function salvar(
        array $arquivo,
        int $assessoriaId
    ): string {
        if ($assessoriaId <= 0) {
            throw new RuntimeException(
                'Não foi possível armazenar o logo.'
            );
        }

        $erro = $arquivo['error'] ?? UPLOAD_ERR_NO_FILE;

        if ($erro !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException(
                self::mensagemErroUpload((int) $erro)
            );
        }

        $temporario = $arquivo['tmp_name'] ?? '';

        if (
            !is_string($temporario) ||
            $temporario === '' ||
            !is_uploaded_file($temporario)
        ) {
            throw new InvalidArgumentException(
                'Arquivo de logo inválido.'
            );
        }

        $tamanho = (int) ($arquivo['size'] ?? 0);

        if ($tamanho <= 0) {
            throw new InvalidArgumentException(
                'O arquivo de logo está vazio.'
            );
        }

        if ($tamanho > self::MAX_TAMANHO) {
            throw new InvalidArgumentException(
                'O logo deve possuir no máximo 2 MB.'
            );
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($temporario);

        if (
            !is_string($mime) ||
            !array_key_exists($mime, self::EXTENSOES)
        ) {
            throw new InvalidArgumentException(
                'Envie uma imagem JPG, PNG ou WEBP.'
            );
        }

        $dimensoes = @getimagesize($temporario);

        if ($dimensoes === false) {
            throw new InvalidArgumentException(
                'O arquivo enviado não é uma imagem válida.'
            );
        }

        $largura = (int) ($dimensoes[0] ?? 0);
        $altura = (int) ($dimensoes[1] ?? 0);
        $mimeImagem = $dimensoes['mime'] ?? '';

        if (
            $mimeImagem !== $mime ||
            $largura <= 0 ||
            $altura <= 0 ||
            $largura > self::MAX_LARGURA ||
            $altura > self::MAX_ALTURA ||
            ($largura * $altura) > self::MAX_PIXELS
        ) {
            throw new InvalidArgumentException(
                'A imagem possui dimensões inválidas.'
            );
        }

        $diretorioBase =
            dirname(__DIR__, 2) .
            '/public/uploads/veiculos';

        $diretorio =
            $diretorioBase .
            '/' .
            $assessoriaId;

        if (
            !is_dir($diretorio) &&
            !mkdir($diretorio, 0755, true) &&
            !is_dir($diretorio)
        ) {
            throw new RuntimeException(
                'Não foi possível preparar o armazenamento do logo.'
            );
        }

        try {
            $nomeArquivo =
                bin2hex(random_bytes(16)) .
                '.' .
                self::EXTENSOES[$mime];
        } catch (\Throwable) {
            throw new RuntimeException(
                'Não foi possível preparar o logo.'
            );
        }

        $destino =
            $diretorio .
            DIRECTORY_SEPARATOR .
            $nomeArquivo;

        if (!move_uploaded_file($temporario, $destino)) {
            throw new RuntimeException(
                'Não foi possível salvar o logo.'
            );
        }

        return
            'uploads/veiculos/' .
            $assessoriaId .
            '/' .
            $nomeArquivo;
    }

    public static function excluir(
        ?string $logoPath
    ): void {
        if (
            !is_string($logoPath) ||
            !preg_match(
                '#\Auploads/veiculos/\d+/[a-f0-9]{32}\.(?:jpg|png|webp)\z#',
                $logoPath
            )
        ) {
            return;
        }

        $arquivo =
            dirname(__DIR__, 2) .
            '/public/' .
            $logoPath;

        if (
            is_file($arquivo) &&
            !@unlink($arquivo)
        ) {
            error_log(
                'Não foi possível remover um logo de veículo substituído.'
            );
        }
    }

    private static function mensagemErroUpload(
        int $erro
    ): string {
        return match ($erro) {
            UPLOAD_ERR_NO_FILE =>
                'Selecione uma imagem para o logo.',

            UPLOAD_ERR_INI_SIZE,
            UPLOAD_ERR_FORM_SIZE =>
                'O logo deve possuir no máximo 2 MB.',

            default =>
                'Não foi possível enviar o logo.',
        };
    }
}