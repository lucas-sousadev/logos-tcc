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

        $nomePortal = $nomePortal
            ? mb_substr(
                self::nomePrincipalDoPortal(
                    $nomePortal,
                    $hostCadastro
                ),
                0,
                150,
                'UTF-8'
            )
            : ucfirst(explode('.', $hostCadastro)[0]);

        [$veiculo, $ambiguo] = self::sugerirVeiculo(
            $assessoriaId,
            $urlFinal
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

    private static function baixar(string $url): array
    {
        for ($salto = 0; $salto <= self::MAX_REDIRECIONAMENTOS; $salto++) {
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

            $corpo = '';
            $excedeuLimite = false;
            $localizacao = null;
            $tipo = null;
            $curl = curl_init($url);

            if ($curl === false) {
                throw new \RuntimeException(
                    'Não foi possível iniciar a consulta.'
                );
            }

            curl_setopt_array($curl, [
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_TIMEOUT => 10,
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
                        &$excedeuLimite
                    ): int {
                        if (
                            strlen($corpo) + strlen($trecho) >
                            self::LIMITE_HTML
                        ) {
                            $excedeuLimite = true;
                            return 0;
                        }

                        $corpo .= $trecho;
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

            if ($ok === false) {
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

    private static function sugerirVeiculo(
        int $assessoriaId,
        string $url
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
}