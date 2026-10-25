<?php

namespace Logos\AssessoriaApi\Services;

use DOMDocument;
use Logos\AssessoriaApi\Database\Connection;
use PDO;

final class ExtracaoLinkService
{
    private const LIMITE_HTML = 2_000_000;
    private const MAX_REDIRECIONAMENTOS = 3;

    public static function extrair(int $assessoriaId, mixed $link): array
    {   
        if (!is_string($link) || trim($link) === '') {
            throw new \InvalidArgumentException(
                'Informe um link HTTP ou HTTPS válido.'
            );
        }

        $link = trim($link);
        $hostDoLink = strtolower((string) parse_url($link, PHP_URL_HOST));
        $hostDoLink = preg_replace('/^(www|m)\./', '', $hostDoLink);

        if (in_array($hostDoLink, ['youtube.com', 'youtu.be', 'instagram.com'], true)) {
            return ['extracao' => self::extrairLinkSocial($assessoriaId, $link)];
        }

        [$urlFinal, $html] = self::baixar($link);

        [$titulo, $data, $duracao, $nomePortal] =
            self::lerMetadados($html);

        $host = strtolower(
            (string) parse_url($urlFinal, PHP_URL_HOST)
        );

        $hostCadastro = preg_replace(
            '/^www\./',
            '',
            $host
        );

        [$veiculo, $ambiguo] = self::sugerirVeiculo(
            $assessoriaId,
            $urlFinal
        );

        if ($veiculo !== null) {
            $nomePortal = $veiculo['nome'];
            $portalConfiavel = true;
        } else {
            [$nomePortal, $portalConfiavel] = self::resolverNomePortal(
                $urlFinal,
                $hostCadastro,
                $nomePortal
            );
        }

        $nomePortal = mb_substr($nomePortal, 0, 150, 'UTF-8');

        $sugestoes = $portalConfiavel
            ? self::buscarVeiculosSemelhantes(
                $assessoriaId,
                $nomePortal
            )
            : [];

        if ($veiculo !== null) {
            $sugestoes = array_values(array_filter(
                $sugestoes,
                static fn(array $item): bool =>
                    $item['id'] !== $veiculo['id']
            ));

            array_unshift($sugestoes, $veiculo);
            $sugestoes = array_slice($sugestoes, 0, 5);
        }

        $hostOriginal = strtolower(
            (string) parse_url($link, PHP_URL_HOST)
        );

        $hostOriginal = preg_replace(
            '/^www\./',
            '',
            $hostOriginal
        );

        return [
            'extracao' => [
                'url_consultada' => $urlFinal,
                'pauta' => $titulo,
                'data_publicacao' => $data,
                'duracao_segundos' => $duracao,
                'veiculo_sugerido' => $veiculo,
                'veiculo_ambiguo' => $ambiguo,
                'nome_portal' => $nomePortal,
                'portal_confiavel' => $portalConfiavel,
                'endereco_sugerido' => [
                    'host' => $hostCadastro,
                    'caminho_prefixo' => '',
                    'incluir_subdominios' => false,
                ],
                'endereco_associavel' =>
                    $hostOriginal === $hostCadastro,
                'sugestoes_veiculos' => $sugestoes,
            ],
        ];
    }

    private static function validarUrl(string $url): array
    {
        if (
            strlen($url) > 2048 ||
            str_contains($url, '\\') ||
            preg_match('/[\x00-\x20\x7F]/', $url) === 1 ||
            filter_var($url, FILTER_VALIDATE_URL) === false
        ) {
            throw new \InvalidArgumentException(
                'Informe um link HTTP ou HTTPS válido.'
            );
        }

        $partes = parse_url($url);

        if (
            !is_array($partes) ||
            !isset($partes['scheme'], $partes['host'])
        ) {
            throw new \InvalidArgumentException(
                'O endereço não contém protocolo e domínio válidos.'
            );
        }

        if (isset($partes['user']) || isset($partes['pass'])) {
            throw new \InvalidArgumentException(
                'Links com usuário ou senha não podem ser consultados.'
            );
        }

        $esquema = strtolower($partes['scheme']);
        $host = strtolower($partes['host']);

        if (!in_array($esquema, ['http', 'https'], true)) {
            throw new \InvalidArgumentException(
                'Informe um link HTTP ou HTTPS válido.'
            );
        }

        $portaPadrao = $esquema === 'https' ? 443 : 80;

        if (
            isset($partes['port']) &&
            $partes['port'] !== $portaPadrao
        ) {
            throw new \InvalidArgumentException(
                'Links com portas não padrão não podem ser consultados.'
            );
        }

        if (
            str_ends_with($host, '.') ||
            filter_var($host, FILTER_VALIDATE_IP) !== false ||
            filter_var(
                $host,
                FILTER_VALIDATE_DOMAIN,
                FILTER_FLAG_HOSTNAME
            ) === false ||
            !str_contains($host, '.')
        ) {
            throw new \InvalidArgumentException(
                'O endereço do site não é válido.'
            );
        }

        return [$esquema, $host];
    }

    private static function baixar(
        string $url,
        ?int $prazoMs = null,
        bool $somenteCabecalho = false
    ): array {
        $inicio = microtime(true);
        $maxSaltos = $somenteCabecalho
            ? 1
            : self::MAX_REDIRECIONAMENTOS;

        for ($salto = 0; $salto <= $maxSaltos; $salto++) {
            try {
                [$esquema, $host] = self::validarUrl($url);
            } catch (\InvalidArgumentException $erro) {
                if ($salto === 0) {
                    throw $erro;
                }

                throw new \InvalidArgumentException(
                    'O site redirecionou para um endereço não permitido: ' .
                    $erro->getMessage(),
                    0,
                    $erro
                );
            }

            // Nesta primeira versão usamos IPv4. Todos os IPs resolvidos
            // precisam ser públicos; o IP aprovado é fixado no cURL.
            $ips = gethostbynamel($host);

            if (!$ips) {
                throw new \InvalidArgumentException(
                    'Não foi possível localizar o site.'
                );
            }

            foreach ($ips as $ip) {
                if (
                    filter_var(
                        $ip,
                        FILTER_VALIDATE_IP,
                        FILTER_FLAG_IPV4 |
                            FILTER_FLAG_NO_PRIV_RANGE |
                            FILTER_FLAG_NO_RES_RANGE
                    ) === false
                ) {
                    throw new \InvalidArgumentException(
                        'Este endereço não pode ser consultado.'
                    );
                }
            }

            $restanteMs = $prazoMs === null
                ? 10000
                : $prazoMs - (int) (
                    (microtime(true) - $inicio) * 1000
                );

            if ($restanteMs <= 0) {
                throw new \RuntimeException(
                    'Tempo limite da consulta atingido.'
                );
            }

            $limiteBytes = $somenteCabecalho
                ? 160_000
                : self::LIMITE_HTML;

            $corpo = '';
            $excedeuLimite = false;
            $localizacao = null;
            $tipo = null;
            $cabecalhoCompleto = false;
            $curl = curl_init($url);

            if ($curl === false) {
                throw new \RuntimeException(
                    'Não foi possível iniciar a consulta.'
                );
            }

            curl_setopt_array($curl, [
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_CONNECTTIMEOUT_MS => min(4000, $restanteMs),
                CURLOPT_TIMEOUT_MS => min(10000, $restanteMs),
                CURLOPT_PROXY => '',
                CURLOPT_NOPROXY => '*',
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_PROTOCOLS =>
                    CURLPROTO_HTTP | CURLPROTO_HTTPS,
                CURLOPT_USERAGENT =>
                    'Mozilla/5.0 (compatible; LOGOSMetadata/1.0)',
                CURLOPT_HTTPHEADER => [
                    'Accept: text/html,application/xhtml+xml',
                ],
                CURLOPT_RESOLVE => [
                    $host . ':' .
                    ($esquema === 'https' ? '443' : '80') .
                    ':' . $ips[0],
                ],
                CURLOPT_HEADERFUNCTION =>
                    static function ($ch, string $linha) use (
                        &$localizacao,
                        &$tipo
                    ): int {
                        if (preg_match('~^HTTP/~i', $linha)) {
                            $localizacao = null;
                            $tipo = null;
                        } elseif (
                            stripos($linha, 'Location:') === 0
                        ) {
                            $localizacao = trim(substr($linha, 9));
                        } elseif (
                            stripos($linha, 'Content-Type:') === 0
                        ) {
                            $tipo = strtolower(
                                trim(substr($linha, 13))
                            );
                        }

                        return strlen($linha);
                    },
                CURLOPT_WRITEFUNCTION =>
                    static function ($ch, string $trecho) use (
                        &$corpo,
                        &$excedeuLimite,
                        &$cabecalhoCompleto,
                        $somenteCabecalho,
                        $limiteBytes
                    ): int {
                        $novoCorpo = $corpo . $trecho;

                        if ($somenteCabecalho) {
                            $fim = stripos($novoCorpo, '</head>');

                            if ($fim !== false) {
                                if ($fim + 7 > $limiteBytes) {
                                    $excedeuLimite = true;
                                    return 0;
                                }

                                $corpo = substr($novoCorpo, 0, $fim + 7);
                                $cabecalhoCompleto = true;

                                // Interrompe o download após os metadados.
                                return 0;
                            }
                        }

                        if (strlen($novoCorpo) > $limiteBytes) {
                            $excedeuLimite = true;
                            return 0;
                        }

                        $corpo = $novoCorpo;
                        return strlen($trecho);
                    },
            ]);

            $ok = curl_exec($curl);
            $status = (int) curl_getinfo(
                $curl,
                CURLINFO_RESPONSE_CODE
            );
            curl_close($curl);

            if ($excedeuLimite) {
                throw new \LengthException(
                    'A página é grande demais para análise.'
                );
            }

            if ($ok === false && !$cabecalhoCompleto) {
                throw new \InvalidArgumentException(
                    'Não foi possível carregar esta página.'
                );
            }

            if ($status >= 300 && $status < 400) {
                if ($localizacao === null || $localizacao === '') {
                    throw new \InvalidArgumentException(
                        'O site redirecionou sem informar o destino.'
                    );
                }

                $url = self::resolverRedirecionamento(
                    $url,
                    $localizacao
                );
                continue;
            }

            if ($status < 200 || $status >= 300) {
                throw new \InvalidArgumentException(
                    "O site respondeu com HTTP {$status}."
                );
            }

            if (
                $tipo !== null &&
                !str_contains($tipo, 'text/html') &&
                !str_contains($tipo, 'application/xhtml+xml')
            ) {
                throw new \InvalidArgumentException(
                    'O link não aponta para uma página HTML.'
                );
            }

            return [$url, $corpo];
        }

        throw new \InvalidArgumentException(
            'O site fez redirecionamentos demais.'
        );
    }

    private static function resolverRedirecionamento(
        string $base,
        string $destino
    ): string {
        $destino = trim($destino);

        if (
            preg_match('~^[a-z][a-z0-9+.-]*:~i', $destino)
        ) {
            return $destino;
        }

        $partes = parse_url($base);
        $origem = $partes['scheme'] . '://' . $partes['host'];

        if (str_starts_with($destino, '//')) {
            return $partes['scheme'] . ':' . $destino;
        }

        if (str_starts_with($destino, '/')) {
            return $origem . $destino;
        }

        $caminho = $partes['path'] ?? '/';

        if (str_starts_with($destino, '?')) {
            return $origem . $caminho . $destino;
        }

        $barra = strrpos($caminho, '/');
        $diretorio = substr($caminho, 0, $barra + 1);

        return $origem . $diretorio . $destino;
    }

    private static function lerMetadados(
        string $html
    ): array {
        $codificacao = mb_detect_encoding(
            $html,
            ['UTF-8', 'Windows-1252', 'ISO-8859-1'],
            true
        ) ?: 'UTF-8';

        $html = mb_convert_encoding(
            $html,
            'UTF-8',
            $codificacao
        );

        $anterior = libxml_use_internal_errors(true);
        $documento = new DOMDocument();

        try {
            $documento->loadHTML(
                '<?xml encoding="UTF-8"?>' . $html,
                LIBXML_NONET |
                    LIBXML_NOERROR |
                    LIBXML_NOWARNING
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($anterior);
        }

        $metas = [];

        foreach (
            $documento->getElementsByTagName('meta') as $meta
        ) {
            $chave = strtolower(trim(
                $meta->getAttribute('property') ?:
                $meta->getAttribute('name') ?:
                $meta->getAttribute('itemprop')
            ));
            $valor = trim($meta->getAttribute('content'));

            if (
                $chave !== '' &&
                $valor !== '' &&
                !isset($metas[$chave])
            ) {
                $metas[$chave] = $valor;
            }
        }

        $estruturados = [
            'titulo' => null,
            'data' => null,
            'duracao' => null,
            'portal' => null,
        ];

        foreach (
            $documento->getElementsByTagName('script') as $script
        ) {
            if (
                !str_contains(
                    strtolower($script->getAttribute('type')),
                    'application/ld+json'
                )
            ) {
                continue;
            }

            $json = json_decode(
                $script->textContent,
                true,
                64
            );

            if (is_array($json)) {
                self::lerJsonLd($json, $estruturados);
                
            }
        }

        $tituloDocumento =
            $documento->getElementsByTagName('title')
                ->item(0)?->textContent;

        $titulo = self::texto(
            $estruturados['titulo'] ??
            $metas['og:title'] ??
            $metas['twitter:title'] ??
            $tituloDocumento
        );

        $data = self::data(
            $estruturados['data'] ??
            $metas['article:published_time'] ??
            $metas['datepublished'] ??
            $metas['pubdate'] ??
            $metas['date'] ??
            null
        );

        $duracao = self::duracao(
            $estruturados['duracao'] ??
            $metas['video:duration'] ??
            $metas['duration'] ??
            null
        );

        $nomePortal = self::texto(
            $metas['og:site_name'] ??
            $metas['application-name'] ??
            $estruturados['portal'] ??
            null
        );

        return [$titulo, $data, $duracao, $nomePortal];
    }

    private static function lerJsonLd(
        array $no,
        array &$resultado
    ): void {
        if (
            $resultado['portal'] === null &&
            isset($no['publisher']['name']) &&
            is_string($no['publisher']['name'])
        ) {
            $resultado['portal'] = $no['publisher']['name'];
        }

        if (
            $resultado['titulo'] === null &&
            isset($no['headline']) &&
            is_string($no['headline'])
        ) {
            $resultado['titulo'] = $no['headline'];
        }

        if (
            $resultado['data'] === null &&
            isset($no['datePublished']) &&
            is_string($no['datePublished'])
        ) {
            $resultado['data'] = $no['datePublished'];
        }

        $tipo = $no['@type'] ?? '';
        $tipos = is_array($tipo) ? $tipo : [$tipo];
        $ehVideo = false;

        foreach ($tipos as $item) {
            if (
                is_string($item) &&
                str_contains(
                    strtolower($item),
                    'videoobject'
                )
            ) {
                $ehVideo = true;
            }
        }

        if (
            $ehVideo &&
            $resultado['duracao'] === null &&
            isset($no['duration'])
        ) {
            $resultado['duracao'] = $no['duration'];
        }

        foreach ($no as $filho) {
            if (is_array($filho)) {
                self::lerJsonLd($filho, $resultado);
            }
        }
    }

    private static function texto(mixed $valor): ?string
    {
        if (!is_string($valor)) {
            return null;
        }

        $texto = trim(preg_replace(
            '/\s+/u',
            ' ',
            html_entity_decode(
                strip_tags($valor),
                ENT_QUOTES | ENT_HTML5,
                'UTF-8'
            )
        ) ?? '');

        return $texto === '' ? null : mb_substr(
            $texto,
            0,
            500,
            'UTF-8'
        );
    }

    private static function data(mixed $valor): ?string
    {
        if (
            !is_string($valor) ||
            !preg_match(
                '/^(\d{4})-(\d{2})-(\d{2})/',
                $valor,
                $partes
            )
        ) {
            return null;
        }

        return checkdate(
            (int) $partes[2],
            (int) $partes[3],
            (int) $partes[1]
        ) ? $partes[0] : null;
    }

    private static function duracao(mixed $valor): ?int
    {
        if (is_numeric($valor)) {
            $segundos = (int) $valor;
            return $segundos > 0 ? $segundos : null;
        }

        if (
            !is_string($valor) ||
            !preg_match(
                '/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i',
                $valor,
                $partes
            )
        ) {
            return null;
        }

        $segundos =
            ((int) ($partes[1] ?? 0) * 3600) +
            ((int) ($partes[2] ?? 0) * 60) +
            (int) ($partes[3] ?? 0);

        return $segundos > 0 ? $segundos : null;
    }

    private static function extrairLinkSocial(
        int $assessoriaId,
        string $link
    ): array {
        self::validarUrl($link);

        $host = strtolower((string) parse_url($link, PHP_URL_HOST));
        $host = preg_replace('/^(www|m)\./', '', $host);
        
        $titulo = null;
        $data = null;
        $duracao = null;
        $nomePortal = '';
        $urlConta = null;
        $endereco = [
            'host' => '',
            'caminho_prefixo' => '',
            'incluir_subdominios' => false,
        ];
        $avisoMetadados = null;

        if (in_array($host, ['youtube.com', 'youtu.be'], true)) {
            $videoId = self::idVideoYoutube($link);
            $dados = $videoId === null
                ? null
                : self::consultarOEmbedYoutube($videoId);

            if ($dados !== null) {
                $titulo = self::texto($dados['title'] ?? null);
                $conta = self::contaYoutube($dados['author_url'] ?? null);
                $autor = self::texto($dados['author_name'] ?? null);

                if ($conta !== null && $autor !== null) {
                    $nomePortal = mb_substr($autor, 0, 150, 'UTF-8');
                    $urlConta = $conta['url'];
                    $endereco = [
                        'host' => 'youtube.com',
                        'caminho_prefixo' => $conta['caminho'],
                        'incluir_subdominios' => false,
                    ];
                }
            }
            // complementa o oEmbed com data e duração da página. Mantem o título e o canal já confirmados pelo oEmbed
            try {
                [$urlPagina, $html] = self::baixar($link, 5000);

                $hostPagina = strtolower(
                    (string) parse_url($urlPagina, PHP_URL_HOST)
                );
                $hostPagina = preg_replace(
                    '/^(www|m)\./',
                    '',
                    $hostPagina
                );

                if (in_array($hostPagina, ['youtube.com', 'youtu.be'], true)) {
                    [$tituloPagina, $dataPagina, $duracaoPagina] =
                        self::lerMetadados($html);

                    if ($titulo === null) {
                        $titulo = $tituloPagina;
                    }
                    if ($data === null) {
                        $data = $dataPagina;
                    }
                    if ($duracao === null) {
                        $duracao = $duracaoPagina;
                    }
                }
            } catch (\Exception $erro) {
                $avisoMetadados = 'Não foi possível consultar a página para obter data e duração.';
            }
        } else {
            try {
                [$urlFinal, $html] = self::baixar($link, 5000);
                $hostFinal = strtolower(
                    (string) parse_url($urlFinal, PHP_URL_HOST)
                );
                $hostFinal = preg_replace(
                    '/^(www|m)\./',
                    '',
                    $hostFinal
                );

                if (
                    $hostFinal === 'instagram.com' &&
                    !str_starts_with(
                        (string) parse_url($urlFinal, PHP_URL_PATH),
                        '/accounts/'
                    )
                ) {
                    [$titulo, $data, $duracao] =
                        self::lerMetadados($html);

                    if (
                        $titulo !== null &&
                        mb_strtolower(trim($titulo), 'UTF-8') ===
                            'instagram'
                    ) {
                        $titulo = null;
                    }

                    // Apenas uma URL direta de perfil identifica a conta.
                    // /reel/CODIGO e /p/CODIGO não identificam o autor.
                    $perfil = self::perfilInstagram($link);

                    if ($perfil !== null) {
                        $nomePortal = $perfil;
                        $urlConta =
                            'https://www.instagram.com/' . $perfil;
                        $endereco = [
                            'host' => 'instagram.com',
                            'caminho_prefixo' => '/' . $perfil,
                            'incluir_subdominios' => false,
                        ];
                    }
                }
            } catch (\Exception $erro) {
                // Página bloqueada ou indisponível: resultado incerto.
            }
        }

        if ($avisoMetadados === null && ($data === null || $duracao === null)) {
            $faltando = [];
            if ($data === null) $faltando[] = 'data';
            if ($duracao === null) $faltando[] = 'duração';

            $avisoMetadados =
                'Não foi possível identificar automaticamente: ' .
                implode(' e ', $faltando) . '.';
        }

        $veiculo = null;
        $ambiguo = false;
        $sugestoes = [];

        if ($urlConta !== null) {
            [$veiculo, $ambiguo] = self::sugerirVeiculo(
                $assessoriaId,
                $urlConta,
                true
            );

            $sugestoes = self::buscarVeiculosSemelhantes(
                $assessoriaId,
                $nomePortal
            );

            if ($veiculo !== null) {
                $sugestoes = array_values(array_filter(
                    $sugestoes,
                    static fn(array $item): bool =>
                        $item['id'] !== $veiculo['id']
                ));
                array_unshift($sugestoes, $veiculo);
                $sugestoes = array_slice($sugestoes, 0, 5);
                $nomePortal = $veiculo['nome'];
            }
        }

        return [
            'url_consultada' => $link,
            'pauta' => $titulo,
            'data_publicacao' => $data,
            'duracao_segundos' => $duracao,
            'veiculo_sugerido' => $veiculo,
            'veiculo_ambiguo' => $ambiguo,
            'nome_portal' => $nomePortal,
            'portal_confiavel' => $nomePortal !== '',
            'endereco_sugerido' => $endereco,
            // O salvamento atual compara o endereço à URL do post/vídeo.
            // Não pode associar automaticamente uma URL de conta aqui.
            'endereco_associavel' =>
                in_array($host, ['youtube.com', 'youtu.be'], true) &&
                $urlConta !== null &&
                $veiculo === null,
            'sugestoes_veiculos' => $sugestoes,
            'aviso_metadados' => $avisoMetadados
        ];
    }

    private static function idVideoYoutube(string $link): ?string
    {
        $partes = parse_url($link);
        $host = strtolower((string) ($partes['host'] ?? ''));
        $host = preg_replace('/^(www|m)\./', '', $host);
        $caminho = trim((string) ($partes['path'] ?? ''), '/');
        $id = null;

        if ($host === 'youtu.be') {
            $id = $caminho;
        } elseif ($host === 'youtube.com') {
            if ($caminho === 'watch') {
                parse_str((string) ($partes['query'] ?? ''), $consulta);
                $id = $consulta['v'] ?? null;
            } elseif (
                preg_match(
                    '~^(?:shorts|live|embed)/([^/]+)$~D',
                    $caminho,
                    $encontrado
                ) === 1
            ) {
                $id = $encontrado[1];
            }
        }

        return is_string($id) &&
            preg_match('/^[A-Za-z0-9_-]{11}$/D', $id) === 1
            ? $id
            : null;
    }

    public static function ehVideoYoutube(string $link): bool
    {
        return self::idVideoYoutube($link) !== null;
    }

    private static function consultarOEmbedYoutube(
        string $videoId
    ): ?array {
        $videoUrl = 'https://www.youtube.com/watch?v=' . $videoId;
        $url = 'https://www.youtube.com/oembed?format=json&url=' .
            rawurlencode($videoUrl);

        $corpo = '';
        $curl = curl_init($url);

        if ($curl === false) {
            return null;
        }

        curl_setopt_array($curl, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_CONNECTTIMEOUT_MS => 1500,
            CURLOPT_TIMEOUT_MS => 3500,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROXY => '',
            CURLOPT_NOPROXY => '*',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_WRITEFUNCTION =>
                static function ($curl, string $trecho) use (&$corpo): int {
                    if (strlen($corpo) + strlen($trecho) > 64_000) {
                        return 0;
                    }

                    $corpo .= $trecho;
                    return strlen($trecho);
                },
        ]);

        $ok = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if ($ok === false || $status !== 200) {
            return null;
        }

        $dados = json_decode($corpo, true, 16);
        return is_array($dados) ? $dados : null;
    }

    private static function contaYoutube(mixed $valor): ?array
    {
        if (!is_string($valor)) {
            return null;
        }

        $partes = parse_url($valor);
        if (!is_array($partes)) {
            return null;
        }

        $host = strtolower((string) ($partes['host'] ?? ''));
        $host = preg_replace('/^(www|m)\./', '', $host);

        if (
            $host !== 'youtube.com' ||
            !in_array(
                strtolower((string) ($partes['scheme'] ?? '')),
                ['http', 'https'],
                true
            ) ||
            isset($partes['user']) ||
            isset($partes['pass']) ||
            isset($partes['port'])
        ) {
            return null;
        }

        $caminho = rtrim(
            rawurldecode((string) ($partes['path'] ?? '')),
            '/'
        );

        if (
            preg_match(
                '~^/(?:channel/UC[A-Za-z0-9_-]{22}|@[\pL\pN._-]{1,100}|user/[A-Za-z0-9._-]{1,100}|c/[A-Za-z0-9._-]{1,100})$~uD',
                $caminho
            ) !== 1
        ) {
            return null;
        }

        return [
            'url' => 'https://www.youtube.com' . $caminho,
            'caminho' => $caminho,
        ];
    }

    private static function perfilInstagram(string $link): ?string
    {
        $caminho = trim(
            (string) parse_url($link, PHP_URL_PATH),
            '/'
        );

        if (
            preg_match('/^[A-Za-z0-9._]{1,30}$/D', $caminho) !== 1 ||
            in_array(
                strtolower($caminho),
                [
                    'p', 'reel', 'reels', 'tv', 'stories',
                    'explore', 'accounts', 'direct',
                ],
                true
            )
        ) {
            return null;
        }

        return strtolower($caminho);
    }

    private static function sugerirVeiculo(
        int $assessoriaId,
        string $url,
        bool $exigirCaminho = false
    ): array {
        $host = strtolower((string) parse_url(
            $url,
            PHP_URL_HOST
        ));
        $caminho = rawurldecode(
            (string) (parse_url($url, PHP_URL_PATH) ?: '/')
        );

        $stmt = Connection::get()->prepare("
            SELECT v.id, v.nome, v.descricao, v.alcance,
                   v.logo_path, v.tier, v.ativo,
                   e.host, e.caminho_prefixo,
                   e.incluir_subdominios
            FROM veiculo_enderecos e
            JOIN veiculos v
              ON v.id = e.veiculo_id
             AND v.assessoria_id = e.assessoria_id
            WHERE e.assessoria_id = :assessoria_id
              AND v.ativo = 1
        ");
        $stmt->execute([
            'assessoria_id' => $assessoriaId,
        ]);

        $melhor = null;
        $pontuacao = null;
        $empatou = false;

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $linha) {
            $hostExato =
                preg_replace('/^www\./', '', $host) ===
                preg_replace('/^www\./', '', $linha['host']);
            $subdominio =
                (bool) $linha['incluir_subdominios'] &&
                str_ends_with(
                    $host,
                    '.' . $linha['host']
                );

            if (!$hostExato && !$subdominio) {
                continue;
            }

            $prefixo = $linha['caminho_prefixo'];

            if ($exigirCaminho && $prefixo === '') {
                continue;
            }
            
            if (
                $prefixo !== '' &&
                $caminho !== $prefixo &&
                !str_starts_with(
                    $caminho,
                    $prefixo . '/'
                )
            ) {
                continue;
            }

            $atual = [
                strlen($prefixo),
                $hostExato ? 1 : 0,
            ];

            if (
                $pontuacao === null ||
                $atual > $pontuacao
            ) {
                $pontuacao = $atual;
                $melhor = $linha;
                $empatou = false;
            } elseif (
                $atual === $pontuacao &&
                (int) $linha['id'] !==
                (int) $melhor['id']
            ) {
                $empatou = true;
            }
        }

        if ($melhor === null || $empatou) {
            return [null, $empatou];
        }

        return [[
            'id' => (int) $melhor['id'],
            'nome' => $melhor['nome'],
            'descricao' => $melhor['descricao'],
            'alcance' => $melhor['alcance'],
            'logo_path' => $melhor['logo_path'],
            'tier' => $melhor['tier'] === null
                ? null
                : (int) $melhor['tier'],
            'ativo' => 1,
        ], false];
    }

    private static function chaveNome(string $nome): string
    {
        $ascii = iconv(
            'UTF-8',
            'ASCII//TRANSLIT//IGNORE',
            $nome
        );

        $texto = strtolower(
            $ascii === false ? $nome : $ascii
        );

        return preg_replace(
            '/[^a-z0-9]/',
            '',
            $texto
        ) ?? '';
    }

    private static function nomePrincipalDoPortal(
        string $nomePortal,
        string $host
    ): string {
        $partesHost = explode(
            '.',
            strtolower(
                preg_replace('/^www\./', '', $host)
            )
        );

        $indice = count($partesHost) - 2;

        if (
            $indice > 0 &&
            ($partesHost[$indice + 1] ?? '') === 'br' &&
            in_array(
                $partesHost[$indice],
                ['com', 'net', 'org', 'gov', 'edu'],
                true
            )
        ) {
            $indice--;
        }

        $dominio = self::chaveNome(
            $partesHost[max(0, $indice)] ?? ''
        );

        if (strlen($dominio) < 4) {
            return $nomePortal;
        }

        $trechos = preg_split(
            '/\s+[-–—]\s+|[|;,!?]+|\.\s+/u',
            $nomePortal,
            -1,
            PREG_SPLIT_NO_EMPTY
        );

        if (!is_array($trechos)) {
            return $nomePortal;
        }

        $melhor = null;
        $maiorPontuacao = 0.0;

        foreach ($trechos as $trecho) {
            $trecho = trim($trecho);
            $chave = self::chaveNome($trecho);

            if (strlen($chave) < 4) {
                continue;
            }

            $pontuacao = 1 - (
                levenshtein($chave, $dominio) /
                max(strlen($chave), strlen($dominio))
            );

            if (
                strlen($chave) >= 8 &&
                str_contains($dominio, $chave)
            ) {
                $pontuacao = max($pontuacao, 0.9);
            }

            if ($pontuacao > $maiorPontuacao) {
                $maiorPontuacao = $pontuacao;
                $melhor = $trecho;
            }
        }

        return $maiorPontuacao >= 0.78 && $melhor !== null
            ? $melhor
            : $nomePortal;
    }

    private static function buscarVeiculosSemelhantes(
        int $assessoriaId,
        string $nomePortal
    ): array {
        $partesNome = preg_split(
            '/\s+[-–—|·]\s+/u',
            $nomePortal,
            2
        );

        $nomePrincipal = is_array($partesNome)
            ? trim($partesNome[0] ?? '')
            : '';

        $alvo = self::chaveNome(
            $nomePrincipal !== ''
                ? $nomePrincipal
                : $nomePortal
        );

        if (strlen($alvo) < 3) {
            $alvo = self::chaveNome($nomePortal);
        }

        $stmt = Connection::get()->prepare("
            SELECT id, nome, descricao, alcance,
                logo_path, tier, ativo
            FROM veiculos
            WHERE assessoria_id = :assessoria_id
            AND ativo = 1
        ");

        $stmt->execute([
            'assessoria_id' => $assessoriaId,
        ]);

        $candidatos = [];

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $linha) {
            $nome = self::chaveNome($linha['nome']);

            if ($nome === '') {
                continue;
            }

            $maior = max(strlen($alvo), strlen($nome));
            $pontuacao = 1 -
                levenshtein($alvo, $nome) / $maior;

            if ($pontuacao < 0.55) {
                continue;
            }

            $candidatos[] = [
                'pontuacao' => $pontuacao,
                'veiculo' => [
                    'id' => (int) $linha['id'],
                    'nome' => $linha['nome'],
                    'descricao' => $linha['descricao'],
                    'alcance' => $linha['alcance'],
                    'logo_path' => $linha['logo_path'],
                    'tier' => $linha['tier'] === null
                        ? null
                        : (int) $linha['tier'],
                    'ativo' => 1,
                ],
            ];
        }

        usort(
            $candidatos,
            static fn(array $a, array $b): int =>
                $b['pontuacao'] <=> $a['pontuacao']
        );

        return array_map(
            static fn(array $item): array =>
                $item['veiculo'],
            array_slice($candidatos, 0, 5)
        );
    }

    private static function resolverNomePortal(
        string $url,
        string $host,
        ?string $nomeArtigo
    ): array {
        $nomeArtigo = $nomeArtigo
            ? self::nomePrincipalDoPortal($nomeArtigo, $host)
            : '';

        if (
            $nomeArtigo !== '' &&
            self::nomeCombinaComHost($nomeArtigo, $host)
        ) {
            return [$nomeArtigo, true];
        }

        try {
            $partes = parse_url($url);
            [$urlInicial, $htmlInicial] = self::baixar(
                $partes['scheme'] . '://' . $partes['host'] . '/',
                2500,
                true
            );

            $hostInicial = preg_replace(
                '/^www\./',
                '',
                strtolower((string) parse_url($urlInicial, PHP_URL_HOST))
            );

            if ($hostInicial === $host) {
                [$tituloInicial, , , $portalInicial] =
                    self::lerMetadados($htmlInicial);

                foreach ([$portalInicial, $tituloInicial] as $candidato) {
                    if (!$candidato) {
                        continue;
                    }

                    $candidato = self::nomePrincipalDoPortal(
                        $candidato,
                        $host
                    );

                    if (self::nomeCombinaComHost($candidato, $host)) {
                        return [$candidato, true];
                    }
                }
            }
        } catch (\Exception $erro) {
            // A matéria permanece disponível se a consulta extra falhar.
        }

        return [
            $nomeArtigo !== ''
                ? $nomeArtigo
                : ucfirst(explode('.', $host)[0]),
            false,
        ];
    }

    private static function nomeCombinaComHost(
        string $nome,
        string $host
    ): bool {
        $rotulos = explode(
            '.',
            preg_replace('/^www\./', '', strtolower($host))
        );

        $marca = $rotulos[0] ?? '';

        if (strlen($marca) < 4) {
            $marca = $rotulos[1] ?? '';
        }

        $marca = self::chaveNome($marca);
        $nome = self::chaveNome($nome);

        return strlen($marca) >= 4 &&
            str_contains($nome, $marca) &&
            strlen($nome) <= strlen($marca) + 16;
    }
}