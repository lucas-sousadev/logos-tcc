<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Jornalista;
use Logos\AssessoriaApi\Models\Veiculo;
use Logos\AssessoriaApi\Services\VeiculoService;
use InvalidArgumentException;

class JornalistaService
{   
    private const MAX_NOME = 150;
    private const MAX_EMAIL = 180;
    private const MAX_TELEFONE = 30;
    private const MAX_CARGO = 100;
    private const MAX_ESTADO = 100;
    private const MAX_CIDADE = 100;
    private const MAX_OBSERVACOES = 2000;
    private const LIMITE_EXCLUSAO_EM_LOTE = 100;
    private const LIMITE_LINHAS_IMPORTACAO = 1000;
    private const ALIASES_IMPORTACAO = [
        'nome' => [
            'nome',
            'nome jornalista',
            'nome do contato',
            'nome completo',
            'jornalista',
            'nome contato',
        ],
        'email' => [
            'email',
            'e-mail',
            'email jornalista',
            'e-mail jornalista',
            'email contato',
            'e-mail contato',
        ],
        'telefone' => [
            'telefone',
            'celular',
            'whatsapp',
            'número de telefone',
            'numero de telefone',
        ],
        'veiculo_nome' => [
            'veiculo',
            'veículo',
            'nome do veiculo',
            'nome do veículo',
            'nome do veículo atual',
            'veículo de comunicação',
            'veiculo de comunicacao',
        ],
        'cargo' => [
            'cargo',
            'funcao',
            'função',
            'funcao/cargo',
            'função/cargo',
        ],
        'cidade' => [
            'cidade',
            'municipio',
            'município',
            'cidade do contato',
        ],
        'estado' => [
            'estado',
            'uf',
            'estado uf',
            'estado (uf)',
            'unidade federativa',
        ],
        'observacoes' => [
            'observacoes',
            'observações',
            'observacao',
            'observação',
            'notas',
        ],
        'ativo' => [
            'ativo',
            'status',
            'situacao',
            'situação',
        ],
    ];

    private const CABECALHOS_IGNORADOS_IMPORTACAO = [
        'id',
        'linkedin',
        'linkedin link',
        'link linkedin',
        'resumo do veiculo',
        'resumo do veículo',
    ];
    public static function listar(
        int $assessoriaId,
        int $page = 1,
        int $limit = 50,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $cargo = null,
        ?int $veiculoId = null,
        ?int $ativo = 1,
        string $ordem = 'nome',
        string $direcao = 'ASC'
    ): array {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));

        $offset = ($page - 1) * $limit;

        $jornalistas =
            Jornalista::listarPorAssessoria(
                $assessoriaId,
                $limit,
                $offset,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo,
                $ordem,
                $direcao
            );

        $total =
            Jornalista::contarPorAssessoria(
                $assessoriaId,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo
            );

        return [
            'jornalistas' => $jornalistas,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' =>
                    ($offset + count($jornalistas)) < $total,
            ],
        ];
    }

    public static function exportar(
        int $assessoriaId,
        ?string $busca = null,
        ?string $estado = null,
        ?string $cidade = null,
        ?string $cargo = null,
        ?int $veiculoId = null,
        ?int $ativo = null,
        string $ordem = 'nome',
        string $direcao = 'ASC'
    ): \Generator {
        $limite = 100;
        $offset = 0;

        while (true) {
            $contatos = Jornalista::listarPorAssessoria(
                $assessoriaId,
                $limite,
                $offset,
                $busca,
                $estado,
                $cidade,
                $cargo,
                $veiculoId,
                $ativo,
                $ordem,
                $direcao
            );

            if ($contatos === []) {
                return;
            }

            foreach ($contatos as $contato) {
                yield $contato;
            }

            $offset += count($contatos);

            if (count($contatos) < $limite) {
                return;
            }
        }
    }   
    public static function importarArquivoCsv(
        int $assessoriaId,
        string $caminhoArquivo
    ): array {
        $csv = self::lerArquivoCsv($caminhoArquivo);

        $colunas = self::mapearCabecalhosImportacao(
            $csv['cabecalho'],
            $csv['linhas']
        );

        $erros = $csv['erros'];
        $ignorados = [];
        $preparados = [];
        $emailsNovos = [];

        foreach ($csv['linhas'] as $linhaCsv) {
            $numeroLinha = $linhaCsv['numero'];
            $dados = self::dadosDaLinhaImportacao(
                $linhaCsv['dados'],
                $colunas
            );

            try {
                $campos = self::validarDados($dados);

                $veiculoNome =
                    self::nomeVeiculoImportacao($dados);

                $ativo = self::ativoImportacao($dados);
            } catch (InvalidArgumentException $e) {
                $erros[] = [
                    'linha' => $numeroLinha,
                    'mensagem' => $e->getMessage(),
                ];

                continue;
            }

            $email = $campos['email'];

            if (
                $email !== null &&
                Jornalista::emailExiste(
                    $email,
                    $assessoriaId
                )
            ) {
                $ignorados[] = [
                    'linha' => $numeroLinha,
                    'nome' => $campos['nome'],
                    'email' => $email,
                    'motivo' =>
                        'Já existe um contato com este e-mail no mailing.',
                ];

                continue;
            }

            if (
                $email !== null &&
                isset($emailsNovos[$email])
            ) {
                $ignorados[] = [
                    'linha' => $numeroLinha,
                    'nome' => $campos['nome'],
                    'email' => $email,
                    'motivo' =>
                        'E-mail repetido no próprio arquivo.',
                ];

                continue;
            }

            if ($email !== null) {
                $emailsNovos[$email] = true;
            }

            $preparados[] = [
                ...$campos,
                'veiculo_nome' => $veiculoNome,
                'ativo' => $ativo,
                'linha' => $numeroLinha,
            ];
        }

        if ($erros !== []) {
            return [
                'sucesso' => false,
                'erros' => $erros,
                'ignorados' => $ignorados,
                'resumo' => self::resumoImportacao(
                    $csv['lidos'],
                    0,
                    count($ignorados),
                    count($erros)
                ),
            ];
        }

        if ($preparados === []) {
            return [
                'sucesso' => true,
                'erros' => [],
                'ignorados' => $ignorados,
                'resumo' => self::resumoImportacao(
                    $csv['lidos'],
                    0,
                    count($ignorados),
                    0
                ),
            ];
        }

        $pdo = Connection::get();
        $importados = 0;

        try {
            $pdo->beginTransaction();

            foreach ($preparados as $contato) {
                if (
                    $contato['email'] !== null &&
                    Jornalista::emailExiste(
                        $contato['email'],
                        $assessoriaId
                    )
                ) {
                    $ignorados[] = [
                        'linha' => $contato['linha'],
                        'nome' => $contato['nome'],
                        'email' => $contato['email'],
                        'motivo' =>
                            'Já existe um contato com este e-mail no mailing.',
                    ];

                    continue;
                }

                $veiculoId = self::veiculoId(
                    [
                        'veiculo_nome' =>
                            $contato['veiculo_nome'],
                    ],
                    $assessoriaId
                );

                Jornalista::criar(
                    $assessoriaId,
                    $contato['nome'],
                    $contato['email'],
                    $contato['telefone'],
                    $contato['cargo'],
                    $contato['estado'],
                    $contato['cidade'],
                    $veiculoId,
                    $contato['observacoes'],
                    $contato['ativo']
                );

                $importados++;
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }

        return [
            'sucesso' => true,
            'erros' => [],
            'ignorados' => $ignorados,
            'resumo' => self::resumoImportacao(
                $csv['lidos'],
                $importados,
                count($ignorados),
                0
            ),
        ];
    }

    private static function lerArquivoCsv(
        string $caminhoArquivo
    ): array {
        $conteudo = file_get_contents($caminhoArquivo);

        if ($conteudo === false || $conteudo === '') {
            throw new InvalidArgumentException(
                'Não foi possível ler o arquivo CSV.'
            );
        }

        $conteudo =
            self::converterConteudoParaUtf8($conteudo);

        $arquivo = fopen('php://temp', 'w+b');

        if ($arquivo === false) {
            throw new \RuntimeException(
                'Não foi possível processar o arquivo.'
            );
        }

        try {
            fwrite($arquivo, $conteudo);
            rewind($arquivo);

            $primeiraLinha = fgets($arquivo);

            if ($primeiraLinha === false) {
                throw new InvalidArgumentException(
                    'O arquivo CSV está vazio.'
                );
            }

            $delimitador =
                self::detectarDelimitadorCsv(
                    $primeiraLinha
                );

            rewind($arquivo);

            $cabecalho = fgetcsv(
                $arquivo,
                0,
                $delimitador
            );

            if (!is_array($cabecalho)) {
                throw new InvalidArgumentException(
                    'Não foi possível ler o cabeçalho do CSV.'
                );
            }

            $cabecalho = self::reprocessarLinhaCsv(
                $cabecalho,
                $delimitador
            );

            if (self::linhaCsvVazia($cabecalho)) {
                throw new InvalidArgumentException(
                    'O arquivo CSV não possui cabeçalho.'
                );
            }

            $linhas = [];
            $erros = [];
            $lidos = 0;
            $numeroLinha = 1;

            while (
                (
                    $linha = fgetcsv(
                        $arquivo,
                        0,
                        $delimitador
                    )
                ) !== false
            ) {
                $numeroLinha++;

                $linha = self::reprocessarLinhaCsv(
                    $linha,
                    $delimitador
                );

                if (self::linhaCsvVazia($linha)) {
                    continue;
                }

                $lidos++;

                if ($lidos > self::LIMITE_LINHAS_IMPORTACAO) {
                    throw new InvalidArgumentException(
                        'O arquivo possui mais de 1000 contatos.'
                    );
                }

                if (count($linha) !== count($cabecalho)) {
                    $erros[] = [
                        'linha' => $numeroLinha,
                        'mensagem' =>
                            'A quantidade de colunas não corresponde ao cabeçalho.',
                    ];

                    continue;
                }

                $linhas[] = [
                    'numero' => $numeroLinha,
                    'dados' => $linha,
                ];
            }

            return [
                'cabecalho' => $cabecalho,
                'linhas' => $linhas,
                'erros' => $erros,
                'lidos' => $lidos,
            ];
        } finally {
            fclose($arquivo);
        }
    }

    private static function converterConteudoParaUtf8(
        string $conteudo
    ): string {
        if (
            str_starts_with(
                $conteudo,
                "\xEF\xBB\xBF"
            )
        ) {
            $conteudo = substr($conteudo, 3);
        }

        if (preg_match('//u', $conteudo) === 1) {
            return $conteudo;
        }

        if (function_exists('mb_convert_encoding')) {
            return mb_convert_encoding(
                $conteudo,
                'UTF-8',
                'Windows-1252'
            );
        }

        if (function_exists('iconv')) {
            $convertido = iconv(
                'Windows-1252',
                'UTF-8//IGNORE',
                $conteudo
            );

            if ($convertido !== false) {
                return $convertido;
            }
        }

        throw new InvalidArgumentException(
            'O arquivo deve estar em UTF-8 ou Windows-1252.'
        );
    }

    private static function detectarDelimitadorCsv(
        string $linha
    ): string {
        $virgulas = substr_count($linha, ',');
        $pontoEVirgulas = substr_count($linha, ';');

        return $pontoEVirgulas > $virgulas
            ? ';'
            : ',';
    }

    private static function reprocessarLinhaCsv(
        array $campos,
        string $delimitador
    ): array {
        if (
            count($campos) === 1 &&
            str_contains($campos[0], $delimitador)
        ) {
            return str_getcsv(
                $campos[0],
                $delimitador
            );
        }

        return $campos;
    }

    private static function linhaCsvVazia(
        array $linha
    ): bool {
        foreach ($linha as $valor) {
            if (trim((string) $valor) !== '') {
                return false;
            }
        }

        return true;
    }

    private static function mapearCabecalhosImportacao(
        array $cabecalhos,
        array $linhas
    ): array {
        $aliases = [];

        foreach (
            self::ALIASES_IMPORTACAO as $campo => $nomes
        ) {
            foreach ($nomes as $nome) {
                $aliases[
                    self::normalizarCabecalhoCsv($nome)
                ] = $campo;
            }
        }

        $ignorados = [];
    
        foreach (
            self::CABECALHOS_IGNORADOS_IMPORTACAO
            as $cabecalho
        ) {
            $ignorados[
                self::normalizarCabecalhoCsv($cabecalho)
            ] = true;
        }

        $mapeamento = [];
        $desconhecidos = [];
        $vazios = [];

        foreach ($cabecalhos as $indice => $cabecalho) {
            $original = trim((string) $cabecalho);

            $normalizado =
                self::normalizarCabecalhoCsv($original);

            if ($normalizado === '') {
                $vazios[] = $indice;

                continue;
            }

            if (isset($ignorados[$normalizado])) {
                continue;
            }

            $campo = $aliases[$normalizado] ?? null;

            if ($campo === null) {
                $desconhecidos[] = $original;

                continue;
            }

            if (isset($mapeamento[$campo])) {
                throw new InvalidArgumentException(
                    "Mais de uma coluna corresponde ao campo {$campo}."
                );
            }

            $mapeamento[$campo] = $indice;
        }

        if (
            !isset($mapeamento['email']) &&
            count($vazios) === 1 &&
            self::colunaContemSomenteEmails(
                $linhas,
                $vazios[0]
            )
        ) {
            $mapeamento['email'] = $vazios[0];
            $vazios = [];
        }

        if ($vazios !== []) {
            throw new InvalidArgumentException(
                'Há uma coluna sem nome que não foi possível identificar.'
            );
        }

        if ($desconhecidos !== []) {
            throw new InvalidArgumentException(
                'Colunas não reconhecidas: ' .
                implode(', ', $desconhecidos) .
                '.'
            );
        }

        if (!isset($mapeamento['nome'])) {
            throw new InvalidArgumentException(
                'Não foi encontrada uma coluna de nome.'
            );
        }

        if (
            !isset($mapeamento['email']) &&
            !isset($mapeamento['telefone'])
        ) {
            throw new InvalidArgumentException(
                'Inclua uma coluna de e-mail ou telefone.'
            );
        }

        return $mapeamento;
    }

    private static function colunaContemSomenteEmails(
        array $linhas,
        int $indice
    ): bool {
        $possuiEmail = false;

        foreach ($linhas as $linha) {
            $valor = self::normalizarValorImportacao(
                self::removerProtecaoFormulaCsv(
                    (string) ($linha['dados'][$indice] ?? '')
                )
            );

            if ($valor === '') {
                continue;
            }

            if (
                !filter_var(
                    strtolower($valor),
                    FILTER_VALIDATE_EMAIL
                )
            ) {
                return false;
            }

            $possuiEmail = true;
        }

        return $possuiEmail;
    }

    private static function normalizarCabecalhoCsv(
        string $valor
    ): string {
        $valor = str_replace(
            "\xEF\xBB\xBF",
            '',
            trim($valor)
        );

        if (function_exists('iconv')) {
            $semAcentos = iconv(
                'UTF-8',
                'ASCII//TRANSLIT//IGNORE',
                $valor
            );

            if ($semAcentos !== false) {
                $valor = $semAcentos;
            }
        }

        $valor = strtolower($valor);

        $valor = preg_replace(
            '/[^a-z0-9]+/',
            ' ',
            $valor
        ) ?? '';

        $valor = preg_replace(
            '/\s+/',
            ' ',
            $valor
        ) ?? '';

        return trim($valor);
    }

    private static function dadosDaLinhaImportacao(
        array $linha,
        array $colunas
    ): array {
        $dados = [];

        foreach ($colunas as $campo => $indice) {
            $valor = (string) (
                $linha[$indice] ?? ''
            );

            $dados[$campo] =
                self::normalizarValorImportacao(
                    self::removerProtecaoFormulaCsv($valor)
                );
        }

        return $dados;
    }

    private static function normalizarValorImportacao(
        string $valor
    ): string {
        $valor = trim($valor);

        if (
            in_array(
                $valor,
                ['—', '–', '−'],
                true
            )
        ) {
            return '';
        }

        return $valor;
    }
    
    private static function removerProtecaoFormulaCsv(
        string $valor
    ): string {
        if (
            preg_match(
                "/^'[=+\-@]/u",
                $valor
            ) === 1
        ) {
            return substr($valor, 1);
        }

        return $valor;
    }

    private static function nomeVeiculoImportacao(
        array $dados
    ): ?string {
        $nome = self::campo(
            $dados,
            'veiculo_nome',
            150,
            'O nome do veículo'
        );

        if ($nome === null) {
            return null;
        }

        return VeiculoService::normalizarNome($nome);
    }

    private static function ativoImportacao(
        array $dados
    ): bool {
        $valor = self::campo(
            $dados,
            'ativo',
            20,
            'O status'
        );

        if ($valor === null) {
            return true;
        }

        $normalizado =
            self::normalizarCabecalhoCsv($valor);

        if (
            in_array(
                $normalizado,
                ['1', 'ativo', 'sim', 'true'],
                true
            )
        ) {
            return true;
        }

        if (
            in_array(
                $normalizado,
                ['0', 'inativo', 'nao', 'false'],
                true
            )
        ) {
            return false;
        }

        throw new InvalidArgumentException(
            'O status deve ser Ativo, Inativo, 1 ou 0.'
        );
    }

    private static function resumoImportacao(
        int $lidos,
        int $importados,
        int $ignorados,
        int $erros
    ): array {
        return [
            'lidos' => $lidos,
            'importados' => $importados,
            'ignorados' => $ignorados,
            'erros' => $erros,
        ];
    }
 
    public static function buscar(
        int $id,
        int $assessoriaId
    ): ?array {
        return Jornalista::buscarPorId(
            $id,
            $assessoriaId
        );
    }

    public static function criar(
        int $assessoriaId,
        array $dados
    ): int {
        $campos = self::validarDados($dados);

        $nome = $campos['nome'];
        $email = $campos['email'];

        if (
            Jornalista::emailExiste(
                $email,
                $assessoriaId
            )
        ) {
            throw new InvalidArgumentException(
                'Já existe um contato com este e-mail na assessoria.'
            );
        }

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            $veiculoId = self::veiculoId(
                $dados,
                $assessoriaId
            );


            $id = Jornalista::criar(
                $assessoriaId,
                $nome,
                $email,
                $campos['telefone'],
                $campos['cargo'],
                $campos['estado'],
                $campos['cidade'],
                $veiculoId,
                $campos['observacoes']
            );
            $pdo->commit();

            return $id;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        array $dados
    ): void {
        $existente =
            Jornalista::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$existente) {
            throw new InvalidArgumentException(
                'Jornalista não encontrado.'
            );
        }

        $campos = self::validarDados($dados);

        $nome = $campos['nome'];
        $email = $campos['email'];

        if (
            Jornalista::emailExiste(
                $email,
                $assessoriaId,
                $id
            )
        ) {
            throw new InvalidArgumentException(
                'Já existe um contato com este e-mail na assessoria.'
            );
        }
        $ativo = self::ativo($dados);

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            Jornalista::atualizar(
                $id,
                $assessoriaId,
                $nome,
                $email,
                $campos['telefone'],
                $campos['cargo'],
                $campos['estado'],
                $campos['cidade'],
                self::veiculoId($dados, $assessoriaId),
                $campos['observacoes'],
                $ativo
            );

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): void {
        $existente =
            Jornalista::buscarPorId(
                $id,
                $assessoriaId
            );

        if (!$existente) {
            throw new InvalidArgumentException(
                'Contato não encontrado.'
            );
        }

        Jornalista::excluir(
            $id,
            $assessoriaId
        );
    }

    private static function validarDados(array $dados): array
{
    $email = self::email($dados);
    $telefone = self::telefone($dados);

    if ($email === null && $telefone === null) {
        throw new InvalidArgumentException(
            'Informe ao menos e-mail ou telefone para o contato.'
        );
    }

    return [
        'nome' => self::textoObrigatorio(
            $dados,
            'nome',
            self::MAX_NOME,
            'O nome do contato'
        ),
        'email' => $email,
        'telefone' => $telefone,
        'cargo' => self::campo(
            $dados,
            'cargo',
            self::MAX_CARGO,
            'O cargo'
        ),
        'estado' => self::campo(
            $dados,
            'estado',
            self::MAX_ESTADO,
            'O estado'
        ),
        'cidade' => self::campo(
            $dados,
            'cidade',
            self::MAX_CIDADE,
            'A cidade'
        ),
        'observacoes' => self::campo(
            $dados,
            'observacoes',
            self::MAX_OBSERVACOES,
            'As observações'
        ),
    ];
}

    private static function textoObrigatorio(
        array $dados,
        string $campo,
        int $maximo,
        string $rotulo
    ): string {
        $valor = $dados[$campo] ?? '';

        if (!is_scalar($valor)) {
            throw new InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $texto = trim((string) $valor);

        if ($texto === '') {
            throw new InvalidArgumentException(
                "{$rotulo} é obrigatório."
            );
        }

        if (self::tamanho($texto) > $maximo) {
            throw new InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $texto;
    }

    private static function email(array $dados): ?string
    {
        $email = self::campo(
            $dados,
            'email',
            self::MAX_EMAIL,
            'O e-mail'
        );

        if ($email === null) {
            return null;
        }

        $email = strtolower($email);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException(
                'Informe um e-mail válido.'
            );
        }

        return $email;
    }

    private static function telefone(array $dados): ?string
    {
        $telefone = self::campo(
            $dados,
            'telefone',
            self::MAX_TELEFONE,
            'O telefone'
        );

        if (
            $telefone !== null &&
            !TelefoneService::validar($telefone)
        ) {
            throw new InvalidArgumentException(
                'O telefone deve possuir 10 ou 11 dígitos.'
            );
        }

        return $telefone;
    }

    private static function campo(
        array $dados,
        string $campo,
        int $maximo,
        string $rotulo
    ): ?string {
        if (
            !array_key_exists($campo, $dados) ||
            $dados[$campo] === null
        ) {
            return null;
        }

        if (!is_scalar($dados[$campo])) {
            throw new InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $valor = trim((string) $dados[$campo]);

        if ($valor === '') {
            return null;
        }

        if (self::tamanho($valor) > $maximo) {
            throw new InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $valor;
    }

    private static function ativo(array $dados): ?bool
    {
        if (!array_key_exists('ativo', $dados)) {
            return null;
        }

        $ativo = filter_var(
            $dados['ativo'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($ativo === null) {
            throw new InvalidArgumentException(
                'Status do contato inválido.'
            );
        }

        return $ativo;
    }

    private static function tamanho(string $valor): int
    {
        return function_exists('mb_strlen')
            ? mb_strlen($valor, 'UTF-8')
            : strlen($valor);
    }

    private static function veiculoId(
        array $dados,
        int $assessoriaId
    ): ?int {
        if (
            !array_key_exists(
                'veiculo_id',
                $dados
            ) ||
            $dados['veiculo_id'] === null ||
            $dados['veiculo_id'] === ''
        ) {
            $nome = self::campo(
                $dados,
                'veiculo_nome',
                150,
                'O nome do veículo'
            );

            if ($nome === null) {
                return null;
            }   
            $nome = VeiculoService::normalizarNome($nome);

            $veiculo = Veiculo::buscarPorNome(
                $nome,
                $assessoriaId
            );

            if ($veiculo) {
                return (int) $veiculo['id'];
            }

            try {
                return Veiculo::criar(
                    $assessoriaId,
                    $nome,
                    null,
                    null,
                    null,
                    true
                );
            } catch (\PDOException $e) {
                if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                    throw $e;
                }

                $veiculo = Veiculo::buscarPorNome(
                    $nome,
                    $assessoriaId
                );

                if ($veiculo) {
                    return (int) $veiculo['id'];
                }

                throw $e;
            }
        }

        $id = filter_var(
            $dados['veiculo_id'],
            FILTER_VALIDATE_INT
        );

        if ($id === false || $id <= 0) {
            throw new InvalidArgumentException(
                'Veículo inválido.'
            );
        }

        $veiculo = Veiculo::buscarPorId(
            $id,
            $assessoriaId
        );

        if (!$veiculo) {
            throw new InvalidArgumentException(
                'Veículo inválido.'
            );
        }

        return $id;
    }

    public static function excluirEmLote(
        int $assessoriaId,
        array $ids
    ): int {
        if (
            !array_is_list($ids) ||
            $ids === [] ||
            count($ids) > self::LIMITE_EXCLUSAO_EM_LOTE
        ) {
            throw new InvalidArgumentException(
                'Selecione entre 1 e 100 contatos.'
            );
        }

        $idsValidos = [];

        foreach ($ids as $id) {
            $idValidado = filter_var(
                $id,
                FILTER_VALIDATE_INT
            );

            if (
                $idValidado === false ||
                $idValidado <= 0
            ) {
                throw new InvalidArgumentException(
                    'A seleção de contatos é inválida.'
                );
            }

            $idsValidos[(int) $idValidado] =
                (int) $idValidado;
        }

        $ids = array_values($idsValidos);

        foreach ($ids as $id) {
            $contato = Jornalista::buscarPorId(
                $id,
                $assessoriaId
            );

            if (!$contato) {
                throw new InvalidArgumentException(
                    'Um dos contatos selecionados não foi encontrado.'
                );
            }
        }

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            foreach ($ids as $id) {
                $excluido = Jornalista::excluir(
                    $id,
                    $assessoriaId
                );

                if (!$excluido) {
                    throw new \RuntimeException(
                        'Não foi possível excluir um dos contatos.'
                    );
                }
            }

            $pdo->commit();

            return count($ids);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }
    
}