<?php

namespace Logos\AssessoriaApi\Services;

class ArquivoClippingService
{
    public const MAX_BYTES = 30 * 1024 * 1024;

    private const FORMATOS = [
        'image/jpeg' => ['jpg', 'IMAGEM'],
        'image/png' => ['png', 'IMAGEM'],
        'image/webp' => ['webp', 'IMAGEM'],

        'application/pdf' => ['pdf', 'DOCUMENTO'],

        'video/mp4' => ['mp4', 'VIDEO'],
        'video/webm' => ['webm', 'VIDEO'],
        'video/quicktime' => ['mov', 'VIDEO'],

        'audio/mpeg' => ['mp3', 'AUDIO'],
        'audio/wav' => ['wav', 'AUDIO'],
        'audio/x-wav' => ['wav', 'AUDIO'],
        'audio/vnd.wave' => ['wav', 'AUDIO'],
    ];

    public static function validarUpload(): array
    {
        $limitePost = ini_parse_quantity(
            (string) ini_get('post_max_size')
        );

        if (
            $limitePost > 0
            && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $limitePost
        ) {
            throw new \LengthException(
                'O envio excedeu o limite do servidor. Envie um arquivo de até 30 MB.'
            );
        }

        $contentType = strtolower(
            trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])
        );

        if ($contentType !== 'multipart/form-data') {
            throw new \InvalidArgumentException(
                'Envie o arquivo usando multipart/form-data.'
            );
        }

        if ($_POST || count($_FILES) !== 1 || !isset($_FILES['arquivo'])) {
            throw new \InvalidArgumentException(
                'Envie somente um arquivo no campo arquivo.'
            );
        }

        $arquivo = $_FILES['arquivo'];

        if (
            !is_array($arquivo)
            || !isset($arquivo['error'])
            || !is_int($arquivo['error'])
        ) {
            throw new \InvalidArgumentException(
                'Estrutura de upload inválida.'
            );
        }

        switch ($arquivo['error']) {
            case UPLOAD_ERR_OK:
                break;

            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                throw new \LengthException(
                    'O arquivo deve possuir no máximo 30 MB.'
                );

            case UPLOAD_ERR_NO_FILE:
                throw new \InvalidArgumentException(
                    'Selecione um arquivo.'
                );

            case UPLOAD_ERR_PARTIAL:
                throw new \InvalidArgumentException(
                    'O envio ficou incompleto. Tente novamente.'
                );

            default:
                throw new \RuntimeException(
                    'Falha no armazenamento temporário do upload.'
                );
        }

        $tmp = $arquivo['tmp_name'] ?? null;

        if (!is_string($tmp) || !is_uploaded_file($tmp)) {
            throw new \InvalidArgumentException(
                'Arquivo de upload inválido.'
            );
        }

        $tamanho = filesize($tmp);

        if ($tamanho === false || $tamanho <= 0) {
            throw new \InvalidArgumentException(
                'O arquivo está vazio ou não pôde ser lido.'
            );
        }

        if ($tamanho > self::MAX_BYTES) {
            throw new \LengthException(
                'O arquivo deve possuir no máximo 30 MB.'
            );
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp);

        if (!is_string($mime) || !isset(self::FORMATOS[$mime])) {
            throw new \InvalidArgumentException(
                'Formato não permitido. Use JPG, PNG, WEBP, PDF, MP4, WEBM, MOV, MP3 ou WAV.'
            );
        }

        [$extensao, $tipo] = self::FORMATOS[$mime];
        $metadados = null;

        if ($tipo === 'IMAGEM') {
            $dimensoes = @getimagesize($tmp);

            if (
                !$dimensoes
                || ($dimensoes['mime'] ?? '') !== $mime
                || $dimensoes[0] <= 0
                || $dimensoes[1] <= 0
                || $dimensoes[0] > 16000
                || $dimensoes[1] > 30000
                || $dimensoes[0] * $dimensoes[1] > 40000000
            ) {
                throw new \InvalidArgumentException(
                    'Imagem inválida ou muito grande. Limites: 16.000 × 30.000 pixels e 40 megapixels.'
                );
            }

            $metadados = json_encode(
                [
                    'largura' => $dimensoes[0],
                    'altura' => $dimensoes[1],
                ],
                JSON_THROW_ON_ERROR
            );
        }

        $nome = $arquivo['name'] ?? '';

        if (!is_string($nome) || !mb_check_encoding($nome, 'UTF-8')) {
            $nome = 'arquivo.' . $extensao;
        }

        $nome = basename(str_replace('\\', '/', $nome));

        $nome = trim(
            preg_replace('/[\x00-\x1F\x7F]/u', '', $nome) ?? ''
        );

        $nome = mb_substr($nome, 0, 255);

        return [
            'temporario' => $tmp,
            'extensao' => $extensao,
            'tipo' => $tipo,

            'nome_original' =>
                $nome !== '' ? $nome : 'arquivo.' . $extensao,

            'mime_type' => $mime,
            'tamanho_bytes' => $tamanho,
            'metadados_json' => $metadados,
        ];
    }

    private static function normalizar(string $path): string
    {
        $path = rtrim(str_replace('\\', '/', $path), '/');

        return PHP_OS_FAMILY === 'Windows'
            ? strtolower($path)
            : $path;
    }

    private static function dentro(string $path, string $base): bool
    {
        return str_starts_with(
            self::normalizar($path),
            self::normalizar($base) . '/'
        );
    }

    private static function base(bool $criar = false): string
    {
        $config = $_ENV['CLIPPING_STORAGE_PATH'] ?? '';

        if (
            !is_string($config)
            || !preg_match('~^(?:[A-Za-z]:[\\\\/]|/)~', $config)
        ) {
            throw new \RuntimeException(
                'Configure CLIPPING_STORAGE_PATH com um caminho absoluto.'
            );
        }

        if (
            $criar
            && !is_dir($config)
            && !@mkdir($config, 0750, true)
            && !is_dir($config)
        ) {
            throw new \RuntimeException(
                'Não foi possível preparar o armazenamento dos anexos.'
            );
        }

        $base = realpath($config);

        if ($base === false || !is_dir($base)) {
            throw new \RuntimeException(
                'Armazenamento dos anexos indisponível.'
            );
        }

        $raizWeb = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');

        if (
            $raizWeb
            && (
                self::normalizar($base) === self::normalizar($raizWeb)
                || self::dentro($base, $raizWeb)
            )
        ) {
            throw new \RuntimeException(
                'O armazenamento deve ficar fora da pasta pública do servidor.'
            );
        }

        return $base;
    }

    public static function salvar(array $arquivo, int $a, int $c): array
    {
        $base = self::base(true);
        $pasta = $base . '/' . $a . '/' . $c;

        if (
            !is_dir($pasta)
            && !@mkdir($pasta, 0750, true)
            && !is_dir($pasta)
        ) {
            throw new \RuntimeException(
                'Não foi possível criar a pasta do clipping.'
            );
        }

        $pastaReal = realpath($pasta);

        if ($pastaReal === false || !self::dentro($pastaReal, $base)) {
            throw new \RuntimeException(
                'Pasta de armazenamento inválida.'
            );
        }

        $nome = bin2hex(random_bytes(16)) . '.' . $arquivo['extensao'];

        if (
            !move_uploaded_file(
                $arquivo['temporario'],
                $pastaReal . '/' . $nome
            )
        ) {
            throw new \RuntimeException(
                'Não foi possível salvar o anexo.'
            );
        }

        unset($arquivo['temporario'], $arquivo['extensao']);

        $arquivo['arquivo_path'] = $a . '/' . $c . '/' . $nome;

        return $arquivo;
    }

    private static function caminho(array $anexo): string
    {
        $prefixo =
            (int) $anexo['assessoria_id'] . '/'
            . (int) $anexo['clipping_id'] . '/';

        $padrao = '~\A' . preg_quote($prefixo, '~')
            . '[a-f0-9]{32}\.(?:jpg|png|webp|pdf|mp4|webm|mov|mp3|wav)\z~';

        if (
            !is_string($anexo['arquivo_path'])
            || !preg_match($padrao, $anexo['arquivo_path'])
        ) {
            throw new \RuntimeException(
                'Referência de arquivo inválida.'
            );
        }

        $base = self::base();
        $path = realpath($base . '/' . $anexo['arquivo_path']);

        if ($path === false) {
            throw new \OutOfBoundsException(
                'Arquivo não encontrado no armazenamento.'
            );
        }

        if (!self::dentro($path, $base) || !is_file($path)) {
            throw new \RuntimeException(
                'Caminho de arquivo inválido.'
            );
        }

        return $path;
    }

    public static function remover(array $anexo): bool
    {
        try {
            $path = self::caminho($anexo);

            if (!@unlink($path)) {
                throw new \RuntimeException(
                    'Não foi possível remover o arquivo físico.'
                );
            }

            return true;
        } catch (\OutOfBoundsException) {
            return true;
        } catch (\Throwable $e) {
            error_log(
                'Limpeza pendente de anexo '
                . ($anexo['arquivo_path'] ?? '')
                . ': '
                . $e->getMessage()
            );

            return false;
        }
    }

    private static function intervalo(?string $range, int $total): ?array
    {
        if (
            $range === null
            || !preg_match('/\Abytes=(\d*)-(\d*)\z/', $range, $m)
            || ($m[1] === '' && $m[2] === '')
        ) {
            return [0, $total - 1, 200];
        }

        $numero = static function (string $valor): int {
            $valor = ltrim($valor, '0');

            if ($valor === '') {
                return 0;
            }

            return filter_var($valor, FILTER_VALIDATE_INT) !== false
                ? (int) $valor
                : PHP_INT_MAX;
        };

        if ($m[1] === '') {
            $sufixo = $numero($m[2]);

            return $sufixo === 0
                ? null
                : [max(0, $total - $sufixo), $total - 1, 206];
        }

        $inicio = $numero($m[1]);

        $fim = $m[2] === ''
            ? $total - 1
            : min($numero($m[2]), $total - 1);

        return $inicio >= $total || $fim < $inicio
            ? null
            : [$inicio, $fim, 206];
    }

    public static function enviar(array $anexo, bool $download): never
    {
        $path = self::caminho($anexo);

        if (!isset(self::FORMATOS[$anexo['mime_type']])) {
            throw new \RuntimeException(
                'Tipo de arquivo armazenado inválido.'
            );
        }

        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            throw new \RuntimeException(
                'Não foi possível abrir o arquivo.'
            );
        }

        $total = (int) (fstat($handle)['size'] ?? 0);

        if ($total <= 0) {
            fclose($handle);

            throw new \RuntimeException(
                'Arquivo armazenado vazio.'
            );
        }

        // Sem validadores de cache, If-Range recebe o arquivo completo.
        $range = isset($_SERVER['HTTP_IF_RANGE'])
            ? null
            : ($_SERVER['HTTP_RANGE'] ?? null);

        $intervalo = self::intervalo($range, $total);

        if ($intervalo !== null && fseek($handle, $intervalo[0]) !== 0) {
            fclose($handle);

            throw new \RuntimeException(
                'Não foi possível posicionar a leitura do arquivo.'
            );
        }

        @ini_set('zlib.output_compression', '0');

        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        header('Accept-Ranges: bytes');

        if ($intervalo === null) {
            fclose($handle);

            http_response_code(416);

            header('Content-Range: bytes */' . $total);
            header('Content-Length: 0');

            exit;
        }

        [$inicio, $fim, $status] = $intervalo;

        $quantidade = $fim - $inicio + 1;

        $disposicao =
            $download || $anexo['tipo'] === 'DOCUMENTO'
                ? 'attachment'
                : 'inline';

        $fallback = 'anexo-' . (int) $anexo['id']
            . '.' . pathinfo($path, PATHINFO_EXTENSION);

        http_response_code($status);

        header('Content-Type: ' . $anexo['mime_type']);
        header('Content-Length: ' . $quantidade);

        header(
            "Content-Disposition: {$disposicao}; filename=\"{$fallback}\"; filename*=UTF-8''"
            . rawurlencode($anexo['nome_original'])
        );

        if ($status === 206) {
            header("Content-Range: bytes {$inicio}-{$fim}/{$total}");
        }

        @set_time_limit(0);

        while ($quantidade > 0 && !connection_aborted()) {
            $parte = fread($handle, min(65536, $quantidade));

            if ($parte === false || $parte === '') {
                error_log(
                    'Leitura incompleta do anexo ' . (int) $anexo['id']
                );

                break;
            }

            echo $parte;

            $quantidade -= strlen($parte);

            flush();
        }

        fclose($handle);

        exit;
    }
}