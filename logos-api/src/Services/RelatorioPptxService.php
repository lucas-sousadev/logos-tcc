<?php

namespace Logos\AssessoriaApi\Services;

use PhpOffice\PhpPresentation\DocumentLayout;
use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\PhpPresentation;
use PhpOffice\PhpPresentation\Shape\RichText;
use PhpOffice\PhpPresentation\Shape\RichText\Paragraph;
use PhpOffice\PhpPresentation\Slide;
use PhpOffice\PhpPresentation\Style\Color;
use PhpOffice\PhpPresentation\Style\Alignment;

final class RelatorioPptxService
{
    private static function texto(
        Slide $slide,
        string $valor,
        int $x,
        int $y,
        int $largura,
        int $altura,
        int $tamanho,
        string $cor,
        bool $negrito = false,
        ?string $url = null,
        bool $alinharEmbaixo = false
    ): void {
        $valor = trim($valor);

        if ($valor === '') {
            return;
        }

        $forma = $slide->createRichTextShape()
            ->setOffsetX($x)
            ->setOffsetY($y)
            ->setWidth($largura)
            ->setHeight($altura);

        $forma
            ->setAutoFit(RichText::AUTOFIT_NORMAL)
            ->setInsetTop(0)
            ->setInsetBottom(0)
            ->setInsetLeft(0)
            ->setInsetRight(0);

        if ($alinharEmbaixo) {
            $forma->getActiveParagraph()
                ->getAlignment()
                ->setVertical(Alignment::VERTICAL_BOTTOM);
        }

        if ($url !== null) {
            $forma->setHorizontalOverflow(RichText::OVERFLOW_CLIP)
                ->setVerticalOverflow(RichText::OVERFLOW_CLIP);
        }

        $trecho = $forma->createTextRun($valor);

        $trecho->getFont()
            ->setName('Arial')
            ->setSize($tamanho)
            ->setBold($negrito)
            ->setColor(new Color('FF' . $cor));

        if (
            $url !== null
            && filter_var($url, FILTER_VALIDATE_URL)
            && in_array(
                strtolower((string) parse_url($url, PHP_URL_SCHEME)),
                ['http', 'https'],
                true
            )
        ) {
            $forma->getHyperlink()->setUrl($url);
        }
    }

    private static function campo(
        RichText $forma,
        string $rotulo,
        string $valor
    ): void {
        $nome = $forma->createTextRun($rotulo . ': ');
        $nome->getFont()
            ->setName('Arial')
            ->setSize(12)
            ->setBold(true)
            ->setColor(new Color('FF172033'));

        $conteudo = $forma->createTextRun($valor);
        $conteudo->getFont()
            ->setName('Arial')
            ->setSize(12)
            ->setBold(false)
            ->setColor(new Color('FF172033'));
    }

    private static function data(?string $valor): string
    {
        if (!$valor) {
            return '';
        }

        $data = \DateTimeImmutable::createFromFormat('!Y-m-d', $valor);

        return $data ? $data->format('d/m/Y') : $valor;
    }

    private static function adicionarImagem(
        Slide $slide,
        array $registro,
        int $assessoriaId,
        int $relatorioId,
        array &$arquivosTemporarios,
        array $layoutImagem
    ): void {
        $midiaId = (int) ($registro['imagem_midia_id'] ?? 0);

        try {
            if ($midiaId > 0) {
                $arquivo = RelatorioMidiaService::localizar(
                    $assessoriaId,
                    $relatorioId,
                    $midiaId
                )['arquivo'];
            } else {
                $clippingId = (int) ($registro['clipping_id'] ?? 0);
                $imagemPath = $registro['imagem_path'] ?? null;

                if ($clippingId < 1 || !is_string($imagemPath)) {
                    throw new \DomainException(
                        'A imagem escolhida para o slide não está disponível.'
                    );
                }

                $arquivo = ArquivoClippingService::caminhoImagemRelatorio(
                    $assessoriaId,
                    $clippingId,
                    $imagemPath
                );
            }
        } catch (\Throwable $e) {
            throw new \DomainException(
                'A imagem do slide ' . $registro['ordem']
                . ' não está disponível. Confira o anexo antes de exportar.',
                0,
                $e
            );
        }

        // O PowerPoint recebe PNG para anexos WebP.
        if (
            strtolower(pathinfo($arquivo, PATHINFO_EXTENSION))
            === 'webp'
        ) {
            $imagem = @imagecreatefromwebp($arquivo);

            if ($imagem === false) {
                throw new \DomainException(
                    'Não foi possível converter a imagem do slide '
                    . $registro['ordem'] . '.'
                );
            }

            $png = sys_get_temp_dir()
                . DIRECTORY_SEPARATOR
                . 'logos-slide-'
                . bin2hex(random_bytes(16))
                . '.png';

            $arquivosTemporarios[] = $png;
            $convertido = imagepng($imagem, $png);
            imagedestroy($imagem);

            if (!$convertido) {
                throw new \DomainException(
                    'Não foi possível converter a imagem do slide '
                    . $registro['ordem'] . '.'
                );
            }

            $arquivo = $png;
        }

        $dimensoes = @getimagesize($arquivo);

        if (
            $dimensoes === false
            || $dimensoes[0] < 1
            || $dimensoes[1] < 1
        ) {
            throw new \DomainException(
                'A imagem do slide ' . $registro['ordem']
                . ' não pôde ser lida.'
            );
        }

        $caixaX = 430;
        $caixaY = $layoutImagem['topoImagem'];
        $caixaLargura = 480;
        $caixaAltura = $layoutImagem['alturaImagem'];

        $porcentagem = RelatorioSlideLayout::escalaImagem(
            $registro['dados_json']['imagem']['escala'] ?? null
        );
        $escala = min(
            $caixaLargura / $dimensoes[0],
            $caixaAltura / $dimensoes[1]
        ) * $porcentagem / 100;

        $largura = max(1, (int) round($dimensoes[0] * $escala));
        $altura = max(1, (int) round($dimensoes[1] * $escala));

        $slide->createDrawingShape()
            ->setPath($arquivo)
            ->setOffsetX(
                $caixaX + (int) round(($caixaLargura - $largura) / 2)
            )
            ->setOffsetY(
                $caixaY + (int) round(($caixaAltura - $altura) / 2)
            )
            ->setWidth($largura)
            ->setHeight($altura);
    }

    private static function adicionarLogo(
        Slide $slide,
        array $registro,
        int $assessoriaId,
        int $relatorioId,
        array &$arquivosTemporarios
    ): bool {
        $midiaId = (int) ($registro['logo_midia_id'] ?? 0);

        if ($midiaId > 0) {
            $arquivo = RelatorioMidiaService::localizar(
                $assessoriaId,
                $relatorioId,
                $midiaId
            )['arquivo'];
        } else {
            $logoPath = $registro['dados_json']['veiculo']['logo_path'] ?? null;

            if (
                !is_string($logoPath)
                || !preg_match(
                    '~\Auploads/veiculos/'
                    . $assessoriaId
                    . '/[a-f0-9]{32}\.(?:jpg|png|webp)\z~',
                    $logoPath
                )
            ) {
                return false;
            }

            $base = realpath(
                dirname(__DIR__, 2)
                . '/public/uploads/veiculos/'
                . $assessoriaId
            );

            $arquivo = realpath(
                dirname(__DIR__, 2) . '/public/' . $logoPath
            );

            if (
                $base === false
                || $arquivo === false
                || !is_file($arquivo)
                || strcasecmp(
                    str_replace('\\', '/', dirname($arquivo)),
                    str_replace('\\', '/', $base)
                ) !== 0
            ) {
                return false;
            }
        }

        if (
            strtolower(pathinfo($arquivo, PATHINFO_EXTENSION))
            === 'webp'
        ) {
            $imagem = @imagecreatefromwebp($arquivo);

            if ($imagem === false) {
                return false;
            }

            $png = sys_get_temp_dir()
                . DIRECTORY_SEPARATOR
                . 'logos-veiculo-'
                . bin2hex(random_bytes(16))
                . '.png';

            $arquivosTemporarios[] = $png;
            $convertido = imagepng($imagem, $png);
            imagedestroy($imagem);

            if (!$convertido) {
                return false;
            }

            $arquivo = $png;
        }

        $dimensoes = @getimagesize($arquivo);

        if (
            $dimensoes === false
            || $dimensoes[0] < 1
            || $dimensoes[1] < 1
        ) {
            return false;
        }

        $escala = min(
            300 / $dimensoes[0],
            90 / $dimensoes[1],
            1
        );

        $largura = max(1, (int) round($dimensoes[0] * $escala));
        $altura = max(1, (int) round($dimensoes[1] * $escala));

        $slide->createDrawingShape()
            ->setPath($arquivo)
            ->setOffsetX(42)
            ->setOffsetY(40 + (int) round((90 - $altura) / 2))
            ->setWidth($largura)
            ->setHeight($altura);

        return true;
    }

    private static function materia(
        Slide $slide,
        array $registro,
        int $assessoriaId,
        int $relatorioId,
        array &$arquivosTemporarios
    ): void {
        $dados = $registro['dados_json'] ?? [];
        $clipping = $dados['clipping'] ?? [];
        $veiculo = $dados['veiculo'] ?? [];

        $nomeVeiculo = trim((string) ($veiculo['nome'] ?? ''));
        if ($nomeVeiculo === '') {
            $nomeVeiculo = 'Veículo não informado';
        }

        $descricao = RelatorioSlideLayout::descricao($veiculo['descricao'] ?? null);
        $alcance = trim((string) ($veiculo['alcance'] ?? ''));

        self::adicionarLogo(
            $slide,
            $registro,
            $assessoriaId,
            $relatorioId,
            $arquivosTemporarios
        );

        $data = self::data($clipping['data_publicacao'] ?? null);

        $campos = RelatorioSlideLayout::dados(
            $nomeVeiculo,
            $descricao,
            $alcance,
            $data !== ''
        );
        foreach ($campos as $campo) {
            $forma = $slide->createRichTextShape()
                ->setOffsetX(42)
                ->setOffsetY($campo['topo'])
                ->setWidth(350)
                ->setHeight($campo['altura'])
                ->setAutoFit(RichText::AUTOFIT_NORMAL)
                ->setWrap(RichText::WRAP_SQUARE)
                ->setVerticalOverflow(RichText::OVERFLOW_CLIP)
                ->setHorizontalOverflow(RichText::OVERFLOW_CLIP)
                ->setInsetTop(0)
                ->setInsetBottom(0)
                ->setInsetLeft(0)
                ->setInsetRight(0);
            $paragrafo = $forma->getActiveParagraph();
            $paragrafo->setLineSpacingMode(Paragraph::LINE_SPACING_MODE_POINT)
                ->setLineSpacing(16)
                ->setSpacingBefore(0)
                ->setSpacingAfter(0);
            $paragrafo->getAlignment()->setVertical(Alignment::VERTICAL_TOP);
            self::campo(
                $forma,
                $campo['rotulo'],
                mb_substr($campo['linhas'][0], mb_strlen($campo['rotulo']) + 2)
            );
            foreach (array_slice($campo['linhas'], 1) as $linha) {
                $forma->createBreak();
                $forma->createTextRun($linha)->getFont()
                    ->setName('Arial')
                    ->setSize(12)
                    ->setColor(new Color('FF172033'));
            }
        }

        if ($data !== '') {
            self::texto(
                $slide,
                $data,
                42, 430, 350, 60,
                10, '526073', false, null, true
            );
        }

        $link = trim((string) ($registro['link'] ?? ''));
        $layoutLink = RelatorioSlideLayout::link($link);

        if (
            !empty($registro['imagem_midia_id'])
            || !empty($registro['imagem_anexo_id'])
            || !empty($registro['imagem_path'])
        ) {
            self::adicionarImagem(
                $slide,
                $registro,
                $assessoriaId,
                $relatorioId,
                $arquivosTemporarios,
                $layoutLink
            );
        } else {
            self::texto(
                $slide,
                'Sem imagem para o slide',
                500, $layoutLink['topoImagem'] + (int) (($layoutLink['alturaImagem'] - 35) / 2),
                340, 35,
                10, '697587'
            );
        }

        self::texto(
            $slide,
            $layoutLink['texto'],
            430, $layoutLink['topoLink'], 480, $layoutLink['alturaLink'],
            10, '008C95', false, $link, true
        );
    }

    private static function slideEstrutural(
        Slide $slide,
        array $registro,
        array $relatorio
    ): void {
        $tipo = $registro['tipo'];

        $titulo = match ($tipo) {
            'CAPA' => (string) $relatorio['titulo'],
            'ENCERRAMENTO' => 'Fim do relatório',
            default => trim((string) ($registro['titulo'] ?? ''))
                ?: 'Slide complementar',
        };

        self::texto(
            $slide,
            (string) $relatorio['cliente_nome'],
            70, 90, 820, 75,
            44, '1742BD', true
        );

        self::texto(
            $slide,
            $titulo,
            70, 220, 820, 120,
            34, '172033', true
        );

        if ($tipo === 'CAPA') {
            $periodo =
                self::data($relatorio['periodo_inicio'])
                . ' a '
                . self::data($relatorio['periodo_fim']);

            self::texto(
                $slide, $periodo, 70, 375, 820, 45,
                22, '526073'
            );
        }
    }

    /**
     * Gera um arquivo temporário. Não registra uma versão definitiva.
     */
    public static function gerar(
        int $assessoriaId,
        mixed $relatorioId
    ): string {
        $pagina = 1;
        $slides = [];
        $relatorio = null;

        do {
            $resposta = RelatorioService::buscar(
                $assessoriaId,
                $relatorioId,
                ['page' => $pagina, 'limit' => 100]
            );

            $relatorio = $resposta['relatorio'];
            array_push($slides, ...$resposta['slides']);

            $temProxima = $resposta['pagination']['has_next'];
            $pagina++;
        } while ($temProxima);

        if (!$slides || $relatorio === null) {
            throw new \DomainException(
                'Este relatório ainda não possui slides para exportar.'
            );
        }

        $apresentacao = new PhpPresentation();

        $layout = new DocumentLayout();
        $layout->setDocumentLayout(
            DocumentLayout::LAYOUT_SCREEN_16X9
        );

        $apresentacao->setLayout($layout);
        $apresentacao->getDocumentProperties()
            ->setTitle((string) $relatorio['titulo'])
            ->setCreator('LOGOS');

        $arquivo = sys_get_temp_dir()
            . DIRECTORY_SEPARATOR
            . 'logos-relatorio-'
            . bin2hex(random_bytes(16))
            . '.pptx';

        $arquivosTemporarios = [];

        try {
            foreach ($slides as $indice => $registro) {
                $slide = $indice === 0
                    ? $apresentacao->getActiveSlide()
                    : $apresentacao->createSlide();

                if ($registro['tipo'] === 'CLIPPING') {
                    self::materia(
                        $slide,
                        $registro,
                        $assessoriaId,
                        (int) $relatorio['id'],
                        $arquivosTemporarios
                    );
                } else {
                    self::slideEstrutural(
                        $slide,
                        $registro,
                        $relatorio
                    );
                }
            }

            IOFactory::createWriter(
                $apresentacao,
                'PowerPoint2007'
            )->save($arquivo);

            if (!is_file($arquivo) || filesize($arquivo) < 1) {
                throw new \RuntimeException(
                    'O PPTX gerado está vazio.'
                );
            }

            return $arquivo;
        } catch (\Throwable $e) {
            if (is_file($arquivo)) {
                @unlink($arquivo);
            }

            throw $e;
        } finally {
            foreach ($arquivosTemporarios as $temporario) {
                if (is_file($temporario)) {
                    @unlink($temporario);
                }
            }
        }
    }
}
