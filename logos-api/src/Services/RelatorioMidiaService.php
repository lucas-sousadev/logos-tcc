<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use PDO;

class RelatorioMidiaService
{
    private const EXTENSOES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private static function pasta(
        int $assessoriaId,
        int $relatorioId,
        string $tipo
    ): string {
        $base = ArquivoClippingService::baseParaRelatorios()
            . '/relatorios';

        if (!is_dir($base) && !mkdir($base, 0750, true) && !is_dir($base)) {
            throw new \RuntimeException(
                'Não foi possível preparar as mídias dos relatórios.'
            );
        }

        $baseReal = realpath($base);
        $pasta = $baseReal . '/'
            . $assessoriaId . '/'
            . $relatorioId . '/'
            . $tipo;

        if (
            !is_dir($pasta)
            && !mkdir($pasta, 0750, true)
            && !is_dir($pasta)
        ) {
            throw new \RuntimeException(
                'Não foi possível preparar a pasta do relatório.'
            );
        }

        $pastaReal = realpath($pasta);
        $baseNormal = strtolower(str_replace('\\', '/', $baseReal));
        $pastaNormal = $pastaReal === false
            ? ''
            : strtolower(str_replace('\\', '/', $pastaReal));

        if (
            $pastaReal === false
            || !str_starts_with($pastaNormal, $baseNormal . '/')
        ) {
            throw new \RuntimeException(
                'Pasta de mídia do relatório inválida.'
            );
        }

        return $pastaReal;
    }

    private static function copiar(
        int $assessoriaId,
        int $relatorioId,
        string $tipo,
        string $origem
    ): int {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($origem);
        $extensao = is_string($mime)
            ? (self::EXTENSOES[$mime] ?? null)
            : null;

        if ($extensao === null || @getimagesize($origem) === false) {
            throw new \DomainException(
                'A mídia do relatório não é uma imagem válida.'
            );
        }

        $tamanho = filesize($origem);
        $hash = hash_file('sha256', $origem);

        if ($tamanho === false || $tamanho < 1 || $hash === false) {
            throw new \RuntimeException(
                'Não foi possível ler a mídia do relatório.'
            );
        }

        $pasta = self::pasta($assessoriaId, $relatorioId, $tipo);
        $nome = $hash . '.' . $extensao;
        $destino = $pasta . '/' . $nome;

        if (!is_file($destino)) {
            $temporario = tempnam($pasta, 'midia-');

            if ($temporario === false) {
                throw new \RuntimeException(
                    'Não foi possível preparar a cópia da mídia.'
                );
            }

            try {
                if (!copy($origem, $temporario)) {
                    throw new \RuntimeException(
                        'Não foi possível copiar a mídia do relatório.'
                    );
                }

                if (!rename($temporario, $destino) && !is_file($destino)) {
                    throw new \RuntimeException(
                        'Não foi possível salvar a mídia do relatório.'
                    );
                }
            } finally {
                if (is_file($temporario)) {
                    unlink($temporario);
                }
            }
        }

        if (hash_file('sha256', $destino) !== $hash) {
            throw new \RuntimeException(
                'A cópia da mídia do relatório está inconsistente.'
            );
        }

        $db = Connection::get();
        $stmt = $db->prepare(
            "
                INSERT INTO relatorio_midias (
                    relatorio_id,
                    assessoria_id,
                    tipo,
                    arquivo_path,
                    mime_type,
                    tamanho_bytes,
                    sha256
                ) VALUES (
                    :relatorio_id,
                    :assessoria_id,
                    :tipo,
                    :arquivo_path,
                    :mime_type,
                    :tamanho_bytes,
                    :sha256
                )
                ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
            "
        );

        $stmt->execute([
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
            'tipo' => $tipo,
            'arquivo_path' => 'relatorios/'
                . $assessoriaId . '/'
                . $relatorioId . '/'
                . $tipo . '/'
                . $nome,
            'mime_type' => $mime,
            'tamanho_bytes' => $tamanho,
            'sha256' => $hash,
        ]);

        return (int) $db->lastInsertId();
    }

    public static function copiarLogo(
        int $assessoriaId,
        int $relatorioId,
        ?string $logoPath
    ): ?int {
        if (
            !$logoPath
            || !preg_match(
                '~\Auploads/veiculos/'
                    . $assessoriaId
                    . '/[a-f0-9]{32}\.(?:jpg|png|webp)\z~',
                $logoPath
            )
        ) {
            return null;
        }

        $base = realpath(
            dirname(__DIR__, 2)
                . '/public/uploads/veiculos/'
                . $assessoriaId
        );
        $origem = realpath(
            dirname(__DIR__, 2) . '/public/' . $logoPath
        );

        if (
            $base === false
            || $origem === false
            || !is_file($origem)
            || strcasecmp(
                str_replace('\\', '/', dirname($origem)),
                str_replace('\\', '/', $base)
            ) !== 0
        ) {
            return null;
        }

        return self::copiar(
            $assessoriaId,
            $relatorioId,
            'LOGO_VEICULO',
            $origem
        );
    }

    public static function copiarImagem(
        int $assessoriaId,
        int $relatorioId,
        int $clippingId,
        ?string $imagemPath
    ): ?int {
        if (!$imagemPath) {
            return null;
        }

        try {
            $origem = ArquivoClippingService::caminhoImagemRelatorio(
                $assessoriaId,
                $clippingId,
                $imagemPath
            );
        } catch (\OutOfBoundsException) {
            return null;
        }

        return self::copiar(
            $assessoriaId,
            $relatorioId,
            'IMAGEM_CLIPPING',
            $origem
        );
    }

    public static function salvarUpload(
        int $assessoriaId,
        int $relatorioId,
        string $tipo
    ): int {
        if (!in_array($tipo, ['LOGO_VEICULO', 'IMAGEM_CLIPPING'], true)) {
            throw new \InvalidArgumentException('Tipo de imagem inválido.');
        }

        $arquivo = ArquivoClippingService::validarUpload();

        if ($arquivo['tipo'] !== 'IMAGEM') {
            throw new \InvalidArgumentException(
                'Selecione uma imagem JPG, PNG ou WEBP.'
            );
        }

        if ($arquivo['tamanho_bytes'] > 10 * 1024 * 1024) {
            throw new \LengthException(
                'A imagem do slide deve possuir no máximo 10 MB.'
            );
        }

        return self::copiar(
            $assessoriaId,
            $relatorioId,
            $tipo,
            $arquivo['temporario']
        );
    }

    public static function validarTipo(
        int $assessoriaId,
        int $relatorioId,
        int $midiaId,
        string $tipo
    ): void {
        $stmt = Connection::get()->prepare(
            'SELECT 1 FROM relatorio_midias
             WHERE id = :midia_id
             AND relatorio_id = :relatorio_id
             AND assessoria_id = :assessoria_id
             AND tipo = :tipo'
        );
        $stmt->execute([
            'midia_id' => $midiaId,
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
            'tipo' => $tipo,
        ]);

        if ($stmt->fetchColumn() === false) {
            throw new \InvalidArgumentException(
                'A imagem escolhida não pertence a este relatório.'
            );
        }
    }

    public static function preencherExistentes(
        int $assessoriaId,
        int $relatorioId
    ): array {
        $db = Connection::get();

        $existe = $db->prepare(
            'SELECT 1 FROM relatorios
             WHERE id = :relatorio_id AND assessoria_id = :assessoria_id'
        );
        $existe->execute([
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
        ]);

        if ($existe->fetchColumn() === false) {
            throw new \OutOfBoundsException(
                'Relatório não encontrado nesta assessoria.'
            );
        }

        $consulta = $db->prepare(
            "
                SELECT id, clipping_id, imagem_path, dados_json,
                       logo_midia_id, imagem_midia_id
                FROM relatorio_slides
                WHERE relatorio_id = :relatorio_id
                  AND assessoria_id = :assessoria_id
                  AND tipo = 'CLIPPING'
                ORDER BY id
            "
        );
        $consulta->execute([
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
        ]);

        $atualizar = $db->prepare(
            "
                UPDATE relatorio_slides
                SET logo_midia_id = COALESCE(logo_midia_id, :logo_id),
                    imagem_midia_id = COALESCE(imagem_midia_id, :imagem_id)
                WHERE id = :slide_id
                  AND relatorio_id = :relatorio_id
                  AND assessoria_id = :assessoria_id
            "
        );

        $resultado = [
            'logos_vinculados' => 0,
            'imagens_vinculadas' => 0,
            'slides_com_logo_indisponivel' => [],
            'slides_com_imagem_indisponivel' => [],
        ];

        foreach ($consulta as $slide) {
            $dados = json_decode(
                $slide['dados_json'] ?? '{}',
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            $logoPath = $dados['veiculo']['logo_path'] ?? null;
            $imagemPath = $slide['imagem_path'];
            $logoAtual = $slide['logo_midia_id'];
            $imagemAtual = $slide['imagem_midia_id'];

            $logoId = $logoAtual ?: self::copiarLogo(
                $assessoriaId,
                $relatorioId,
                is_string($logoPath) ? $logoPath : null
            );

            $imagemId = $imagemAtual ?: self::copiarImagem(
                $assessoriaId,
                $relatorioId,
                (int) $slide['clipping_id'],
                $imagemPath
            );

            if ($logoPath && !$logoId) {
                $resultado['slides_com_logo_indisponivel'][] =
                    (int) $slide['id'];
            }

            if ($imagemPath && !$imagemId) {
                $resultado['slides_com_imagem_indisponivel'][] =
                    (int) $slide['id'];
            }

            if (!$logoAtual && $logoId) {
                $resultado['logos_vinculados']++;
            }

            if (!$imagemAtual && $imagemId) {
                $resultado['imagens_vinculadas']++;
            }

            if (
                (!$logoAtual && $logoId)
                || (!$imagemAtual && $imagemId)
            ) {
                $atualizar->execute([
                    'logo_id' => $logoId,
                    'imagem_id' => $imagemId,
                    'slide_id' => $slide['id'],
                    'relatorio_id' => $relatorioId,
                    'assessoria_id' => $assessoriaId,
                ]);
            }
        }

        return $resultado;
    }
    
    public static function localizar(
        int $assessoriaId,
        int $relatorioId,
        int $midiaId
    ): array {
        $db = Connection::get();
        $stmt = $db->prepare(
            "
                SELECT arquivo_path, mime_type
                FROM relatorio_midias
                WHERE id = :midia_id
                AND relatorio_id = :relatorio_id
                AND assessoria_id = :assessoria_id
                LIMIT 1
            "
        );
        $stmt->execute([
            'midia_id' => $midiaId,
            'relatorio_id' => $relatorioId,
            'assessoria_id' => $assessoriaId,
        ]);

        $midia = $stmt->fetch();

        if (!$midia) {
            throw new \OutOfBoundsException(
                'Mídia não encontrada neste relatório.'
            );
        }

        $path = $midia['arquivo_path'];

        if (!preg_match(
            '~\Arelatorios/'
                . $assessoriaId . '/'
                . $relatorioId
                . '/(?:LOGO_VEICULO|IMAGEM_CLIPPING)'
                . '/[a-f0-9]{64}\.(?:jpg|png|webp)\z~',
            $path
        )) {
            throw new \RuntimeException(
                'Referência de mídia inválida.'
            );
        }

        $base = ArquivoClippingService::baseParaRelatorios();
        $raiz = realpath($base . '/relatorios');
        $arquivo = realpath($base . '/' . $path);

        if ($raiz === false || $arquivo === false || !is_file($arquivo)) {
            throw new \OutOfBoundsException(
                'Arquivo da mídia não encontrado.'
            );
        }

        $raizNormal = strtolower(str_replace('\\', '/', $raiz));
        $arquivoNormal = strtolower(str_replace('\\', '/', $arquivo));

        if (!str_starts_with($arquivoNormal, $raizNormal . '/')) {
            throw new \RuntimeException(
                'Caminho da mídia inválido.'
            );
        }

        $mime = $midia['mime_type'];

        if (
            !array_key_exists($mime, self::EXTENSOES)
            || (new \finfo(FILEINFO_MIME_TYPE))->file($arquivo) !== $mime
        ) {
            throw new \RuntimeException(
                'Formato da mídia inconsistente.'
            );
        }

        return [
            'arquivo' => $arquivo,
            'mime_type' => $mime,
        ];
    }

}
