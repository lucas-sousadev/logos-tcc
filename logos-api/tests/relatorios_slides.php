<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

use Logos\AssessoriaApi\Services\ArquivoClippingService;
use Logos\AssessoriaApi\Services\RelatorioPptxService;
use Logos\AssessoriaApi\Services\RelatorioService;
use Logos\AssessoriaApi\Services\RelatorioSlideLayout;
use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\PhpPresentation;

$links = [
    '',
    'https://example.com/noticia',
    'https://example.com/' . str_repeat('uma-noticia-longa/', 12),
    'https://example.com/' . str_repeat('W', 2000),
    'https://example.com/' . str_repeat('ação-新聞/', 250),
];

if (in_array('--layouts', $argv, true)) {
    echo json_encode(array_map(
        fn ($link) => RelatorioSlideLayout::link($link),
        $links
    ), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

$verificacoes = 0;
$diretorio = null;
$arquivo = null;
$pptx = null;
$zip = null;
$armazenamento = sys_get_temp_dir() . '/logos-slides-' . bin2hex(random_bytes(8));
$_ENV['CLIPPING_STORAGE_PATH'] = $armazenamento;

function conferirSlide(bool $condicao, string $mensagem): void
{
    global $verificacoes;
    if (!$condicao) {
        throw new RuntimeException($mensagem);
    }
    $verificacoes++;
}

try {
    foreach (['H', '=', '?', '_'] as $caractereLargo) {
        $campos = RelatorioSlideLayout::dados('Jornal', str_repeat($caractereLargo, 80), null, true);
        $descricao = $campos[1];
        conferirSlide(!$descricao['abreviado'], 'Descrição válida mantém todos os caracteres largos.');
        conferirSlide(substr_count(implode('', $descricao['linhas']), $caractereLargo) === 80, 'Quebras não descartam caracteres.');
    }
    foreach ([0, 24, 101, '50', 50.5, null] as $escalaInvalida) {
        $rejeitou = false;
        try {
            RelatorioService::atualizarSlide(1, 1, 1, ['imagem_escala' => $escalaInvalida]);
        } catch (InvalidArgumentException $erro) {
            $rejeitou = str_contains($erro->getMessage(), '25% e 100%');
        }
        conferirSlide($rejeitou, 'API rejeita escala inválida.');
    }
    foreach ([true, false] as $temData) {
        $campos = RelatorioSlideLayout::dados(str_repeat('W', 255), str_repeat('ç', 200), str_repeat('Alcance ', 150), $temData);
        conferirSlide(count($campos) === 3, 'Metadados usam três caixas.');
        conferirSlide($campos[0]['topo'] >= 145, 'Metadados não invadem a logo.');
        foreach ($campos as $indice => $campo) {
            if ($indice > 0) {
                $anterior = $campos[$indice - 1];
                conferirSlide($campo['topo'] >= $anterior['topo'] + $anterior['altura'] + 8, 'Metadados mantêm distância física entre caixas.');
            }
        }
        $ultimo = $campos[count($campos) - 1];
        conferirSlide($ultimo['topo'] + $ultimo['altura'] === ($temData ? 455 : 500), 'Grupo mantém a base do slide.');
    }
    foreach ([str_repeat('A', 201), str_repeat('ç', 201)] as $descricaoLonga) {
        $rejeitou = false;
        try {
            RelatorioService::atualizarSlide(1, 1, 1, [
                'veiculo_descricao' => $descricaoLonga,
            ]);
        } catch (InvalidArgumentException $erro) {
            $rejeitou = str_contains($erro->getMessage(), '200 caracteres');
        }
        conferirSlide($rejeitou, 'API rejeita descrição acima de 200 caracteres.');
        $descricaoLimitada = RelatorioSlideLayout::descricao($descricaoLonga);
        conferirSlide(mb_strlen($descricaoLimitada) === 200, 'Descrição antiga cabe no slide.');
        conferirSlide(str_ends_with($descricaoLimitada, '…'), 'Descrição antiga indica abreviação.');
    }
    conferirSlide(
        RelatorioSlideLayout::descricao("  Notícias\n\n   da região  ") === 'Notícias da região',
        'Quebras e espaços da descrição não estouram o slide.'
    );
    conferirSlide(
        RelatorioSlideLayout::descricao(str_repeat('A', 200)) === str_repeat('A', 200),
        'Descrição no limite é preservada.'
    );

    $assessoriaId = random_int(100000000, 999999999);
    $diretorio = ArquivoClippingService::baseParaRelatorios()
        . '/' . $assessoriaId . '/1';
    mkdir($diretorio, 0775, true);
    $nome = bin2hex(random_bytes(16)) . '.png';
    $arquivo = $diretorio . '/' . $nome;
    $imagem = imagecreatetruecolor(1200, 900);
    imagepng($imagem, $arquivo);
    imagedestroy($imagem);

    $apresentacao = new PhpPresentation();
    $metodo = new ReflectionMethod(RelatorioPptxService::class, 'materia');
    $temporarios = [];

    foreach ($links as $indice => $link) {
        $layout = RelatorioSlideLayout::link($link);
        conferirSlide($layout['alturaImagem'] >= 308, 'Imagem mantém a área ampliada.');
        conferirSlide($layout['topoLink'] + $layout['alturaLink'] === 490, 'Link ancorado na base.');
        conferirSlide($layout['topoImagem'] + $layout['alturaImagem'] + 12 <= $layout['topoLink'], 'Link separado da imagem.');
        conferirSlide($layout['alturaLink'] <= 100, 'Link limitado a cinco linhas.');
        conferirSlide($layout['abreviado'] === ($indice >= 3), 'Abreviação apenas para links extensos.');

        $slide = $indice === 0 ? $apresentacao->getActiveSlide() : $apresentacao->createSlide();
        $registro = [
            'clipping_id' => 1,
            'imagem_path' => $assessoriaId . '/1/' . $nome,
            'link' => $link,
            'dados_json' => [
                'imagem' => ['escala' => $indice % 2 === 0 ? 100 : 50],
                'clipping' => ['data_publicacao' => '2026-11-27'],
                'veiculo' => [
                    'nome' => 'Veículo de teste',
                    'descricao' => str_repeat('A', 3000),
                    'alcance' => '100 mil leitores',
                ],
            ],
        ];
        $metodo->invokeArgs(null, [$slide, $registro, $assessoriaId, 1, &$temporarios]);

        $imagens = array_values(array_filter(
            iterator_to_array($slide->getShapeCollection()),
            fn ($forma) => $forma instanceof \PhpOffice\PhpPresentation\Shape\Drawing\File
        ));
        conferirSlide(count($imagens) === 1, 'Imagem real incluída no slide.');
        $fator = min(480 / 1200, $layout['alturaImagem'] / 900) * ($indice % 2 === 0 ? 1 : 0.5);
        conferirSlide(abs($imagens[0]->getWidth() - round(1200 * $fator)) <= 1, 'Escala altera a largura exportada.');
        conferirSlide(abs($imagens[0]->getHeight() - round(900 * $fator)) <= 1, 'Escala preserva a proporção da imagem.');
        conferirSlide(
            $imagens[0]->getOffsetY() + $imagens[0]->getHeight() + 11 <= $layout['topoLink'],
            'Imagem exportada não invade o link.'
        );
    }

    $pptx = tempnam(sys_get_temp_dir(), 'logos-slide-');
    IOFactory::createWriter($apresentacao, 'PowerPoint2007')->save($pptx);
    $zip = new ZipArchive();
    conferirSlide($zip->open($pptx) === true, 'PPTX válido.');

    foreach ($links as $indice => $link) {
        $numero = $indice + 1;
        $xml = new DOMDocument();
        $xml->loadXML($zip->getFromName('ppt/slides/slide' . $numero . '.xml'));
        $xpath = new DOMXPath($xml);
        $xpath->registerNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main');
        $xpath->registerNamespace('p', 'http://schemas.openxmlformats.org/presentationml/2006/main');
        $formas = $xpath->query('//p:sp');
        conferirSlide($formas->length > 0, 'Texto presente no PPTX.');
        $metadados = $xpath->query('//p:sp[p:txBody/a:p/a:r/a:t[starts-with(., "Veículo:") or starts-with(., "Descrição:") or starts-with(., "Alcance:")]]');
        conferirSlide($metadados->length === 3, 'Metadados mantêm caixas separadas com altura explícita.');
        foreach ($metadados as $forma) {
            conferirSlide($xpath->query('p:txBody/a:bodyPr[not(@wrap) or @wrap="square"]/a:normAutofit', $forma)->length === 1, 'Fonte e quebra podem se ajustar a fontes substituídas no PowerPoint.');
            conferirSlide($xpath->query('p:txBody/a:p', $forma)->length === 1, 'Campo não depende de espaçamento entre parágrafos.');
        }
        conferirSlide($xpath->query('//a:br')->length > 0, 'Linhas dos metadados usam quebras explícitas.');
        conferirSlide(
            !str_contains($xml->textContent, str_repeat('A', 201)),
            'Descrição antiga acima do limite não vaza para o PPTX.'
        );

        if ($link === '') {
            conferirSlide($xpath->query('//a:hlinkClick')->length === 0, 'Sem hiperlink vazio.');
            continue;
        }

        $rels = new DOMDocument();
        $rels->loadXML($zip->getFromName('ppt/slides/_rels/slide' . $numero . '.xml.rels'));
        $destinos = array_map(
            fn ($relacao) => $relacao->getAttribute('Target'),
            iterator_to_array($rels->getElementsByTagName('Relationship'))
        );
        if (filter_var($link, FILTER_VALIDATE_URL)) {
            conferirSlide(in_array($link, $destinos, true), 'Destino completo preservado no hiperlink ' . $numero . '.');
        } else {
            conferirSlide($xpath->query('//a:hlinkClick')->length === 0, 'Endereço inválido não vira hiperlink.');
        }
        conferirSlide($xpath->query('//a:bodyPr[@vertOverflow="clip"]')->length === 4, 'Link e metadados contidos em suas caixas.');
    }

    $zip->close();
    $zip = null;
    echo $verificacoes . " verificações de layout e PPTX passaram.\n";
} finally {
    if ($zip instanceof ZipArchive) {
        $zip->close();
    }
    if ($pptx && is_file($pptx)) {
        unlink($pptx);
    }
    if ($arquivo && is_file($arquivo)) {
        unlink($arquivo);
    }
    if ($diretorio && is_dir($diretorio)) {
        rmdir($diretorio);
        rmdir(dirname($diretorio));
    }
    if (is_dir($armazenamento)) {
        rmdir($armazenamento);
    }
}
