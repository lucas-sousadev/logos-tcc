<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use Logos\AssessoriaApi\Models\Cliente;

class ClienteService
{
    private const MAX_NOME = 150;
    private const MAX_EMAIL = 150;
    private const MAX_TELEFONE = 30;
    private const MAX_CNPJ = 18;
    private const MAX_SITE = 500;
    private const MAX_CIDADE = 100;
    private const MAX_ESTADO = 100;
    private const MAX_DESCRICAO = 2000;
    private const MAX_SEGMENTO = 100;
    private const MAX_RESPONSAVEL = 100;
    private const MAX_LOGO_PATH = 500;

    private const LIMITE_EXCLUSAO_EM_LOTE = 100;

    public static function listar(
        int $assessoriaId,
        array $filtros = []
    ): array {
        $page = max(
            1,
            (int) ($filtros['page'] ?? 1)
        );

        $limit = min(
            100,
            max(
                1,
                (int) ($filtros['limit'] ?? 50)
            )
        );

        $busca = self::filtroTexto(
            $filtros['busca'] ?? null,
            'A busca'
        );

        $estado = self::filtroTexto(
            $filtros['estado'] ?? null,
            'O estado'
        );

        $cidade = self::filtroTexto(
            $filtros['cidade'] ?? null,
            'A cidade'
        );

        $segmento = self::filtroTexto(
            $filtros['segmento'] ?? null,
            'O segmento'
        );

        $ativo = self::filtroAtivo(
            $filtros['ativo'] ?? null
        );

        $offset = ($page - 1) * $limit;

        $clientes = Cliente::listarPorAssessoria(
            $assessoriaId,
            $limit,
            $offset,
            $busca,
            $estado,
            $cidade,
            $segmento,
            $ativo
        );

        $total = Cliente::contarPorAssessoria(
            $assessoriaId,
            $busca,
            $estado,
            $cidade,
            $segmento,
            $ativo
        );

        return [
            'clientes' => $clientes,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'has_next' => ($offset + count($clientes)) < $total,
            ],
        ];
    }

    public static function buscarPorId(
        int $id,
        int $assessoriaId
    ): array {
        $cliente = Cliente::buscarPorId(
            $id,
            $assessoriaId
        );

        if (!$cliente) {
            throw new \RuntimeException(
                'Cliente não encontrado.'
            );
        }

        return $cliente;
    }

    public static function criar(
        int $assessoriaId,
        array $dados
    ): array {
        $campos = self::validarDados($dados);

        self::validarCnpjDuplicado(
            $campos['cnpj'],
            $assessoriaId
        );

        try {
            $id = Cliente::criar(
                $assessoriaId,
                $campos['nome'],
                $campos['email'],
                $campos['telefone'],
                $campos['cnpj'],
                $campos['site'],
                $campos['cidade'],
                $campos['estado'],
                $campos['descricao'],
                $campos['segmento'],
                $campos['responsavel'],
                $campos['logo_path'],
                self::ativo($dados, true)
            );
        } catch (\PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                throw new \RuntimeException(
                    'Já existe um cliente cadastrado com este CNPJ.'
                );
            }

            throw $e;
        }

        return self::buscarPorId($id, $assessoriaId);
    }

    public static function atualizar(
        int $id,
        int $assessoriaId,
        array $dados
    ): array {
        $cliente = self::buscarPorId(
            $id,
            $assessoriaId
        );

        $campos = self::validarDados($dados);

        /*
         * Permite que uma atualização comum preserve a logo.
         * A futura rota multipart substituirá logo_path quando
         * houver envio ou remoção de arquivo.
         */
        if (!array_key_exists('logo_path', $dados)) {
            $campos['logo_path'] =
                $cliente['logo_path'] ?? null;
        }

        self::validarCnpjDuplicado(
            $campos['cnpj'],
            $assessoriaId,
            $id
        );

        try {
            Cliente::atualizar(
                $id,
                $assessoriaId,
                $campos['nome'],
                $campos['email'],
                $campos['telefone'],
                $campos['cnpj'],
                $campos['site'],
                $campos['cidade'],
                $campos['estado'],
                $campos['descricao'],
                $campos['segmento'],
                $campos['responsavel'],
                $campos['logo_path'],
                self::ativo(
                    $dados,
                    (bool) $cliente['ativo']
                )
            );
        } catch (\PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
                throw new \RuntimeException(
                    'Já existe outro cliente cadastrado com este CNPJ.'
                );
            }

            throw $e;
        }

        return self::buscarPorId($id, $assessoriaId);
    }

    public static function excluir(
        int $id,
        int $assessoriaId
    ): void {
        self::buscarPorId($id, $assessoriaId);

        try {
            Cliente::excluir($id, $assessoriaId);
        } catch (\PDOException $e) {
            /*
             * Quando Releases ou Clippings forem vinculados
             * ao cliente por chave estrangeira, este tratamento
             * bloqueará sua exclusão de forma compreensível.
             */
            if ((int) ($e->errorInfo[1] ?? 0) === 1451) {
                throw new \RuntimeException(
                    'Este cliente possui registros vinculados e não pode ser excluído.'
                );
            }

            throw $e;
        }
    }

    public static function excluirEmLote(
        int $assessoriaId,
        array $ids
    ): int {
        if (
            !array_is_list($ids) ||
            count($ids) === 0 ||
            count($ids) > self::LIMITE_EXCLUSAO_EM_LOTE
        ) {
            throw new \InvalidArgumentException(
                'Selecione entre 1 e ' .
                self::LIMITE_EXCLUSAO_EM_LOTE .
                ' clientes.'
            );
        }

        $idsValidos = [];

        foreach ($ids as $valor) {
            if (
                !is_int($valor) &&
                !(
                    is_string($valor) &&
                    ctype_digit($valor)
                )
            ) {
                throw new \InvalidArgumentException(
                    'Há clientes inválidos na seleção.'
                );
            }

            $id = (int) $valor;

            if ($id <= 0) {
                throw new \InvalidArgumentException(
                    'Há clientes inválidos na seleção.'
                );
            }

            $idsValidos[] = $id;
        }

        if (
            count($idsValidos) !==
            count(array_unique($idsValidos))
        ) {
            throw new \InvalidArgumentException(
                'Há clientes duplicados na seleção.'
            );
        }

        $pdo = Connection::get();

        try {
            $pdo->beginTransaction();

            foreach ($idsValidos as $id) {
                self::buscarPorId($id, $assessoriaId);
            }

            foreach ($idsValidos as $id) {
                self::excluir($id, $assessoriaId);
            }

            $pdo->commit();

            return count($idsValidos);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }

    private static function validarDados(
        array $dados
    ): array {
        return [
            'nome' => self::nome($dados),
            'email' => self::email($dados),
            'telefone' => self::telefone($dados),
            'cnpj' => self::cnpj($dados),
            'site' => self::site($dados),
            'cidade' => self::campo(
                $dados,
                'cidade',
                self::MAX_CIDADE,
                'A cidade'
            ),
            'estado' => self::campo(
                $dados,
                'estado',
                self::MAX_ESTADO,
                'O estado'
            ),
            'descricao' => self::campo(
                $dados,
                'descricao',
                self::MAX_DESCRICAO,
                'A descrição'
            ),
            'segmento' => self::campo(
                $dados,
                'segmento',
                self::MAX_SEGMENTO,
                'O segmento'
            ),
            'responsavel' => self::campo(
                $dados,
                'responsavel',
                self::MAX_RESPONSAVEL,
                'O responsável'
            ),
            'logo_path' => self::campo(
                $dados,
                'logo_path',
                self::MAX_LOGO_PATH,
                'O caminho da logo'
            ),
        ];
    }

    private static function nome(
        array $dados
    ): string {
        $valor = $dados['nome'] ?? '';

        if (!is_scalar($valor)) {
            throw new \InvalidArgumentException(
                'O nome do cliente é inválido.'
            );
        }

        $nome = trim((string) $valor);

        if ($nome === '') {
            throw new \InvalidArgumentException(
                'O nome do cliente é obrigatório.'
            );
        }

        if (self::tamanho($nome) > self::MAX_NOME) {
            throw new \InvalidArgumentException(
                'O nome do cliente deve possuir no máximo ' .
                self::MAX_NOME .
                ' caracteres.'
            );
        }

        return $nome;
    }

    private static function email(
        array $dados
    ): ?string {
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
            throw new \InvalidArgumentException(
                'Informe um e-mail válido.'
            );
        }

        return $email;
    }

    private static function telefone(
        array $dados
    ): ?string {
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
            throw new \InvalidArgumentException(
                'O telefone deve possuir 10 ou 11 dígitos.'
            );
        }

        return $telefone;
    }

    private static function cnpj(
        array $dados
    ): ?string {
        $cnpj = self::campo(
            $dados,
            'cnpj',
            self::MAX_CNPJ,
            'O CNPJ'
        );

        if ($cnpj === null) {
            return null;
        }

        $cnpj = CnpjService::normalizar($cnpj);

        if (!CnpjService::validar($cnpj)) {
            throw new \InvalidArgumentException(
                'Informe um CNPJ válido.'
            );
        }

        return $cnpj;
    }

    private static function site(
        array $dados
    ): ?string {
        $site = self::campo(
            $dados,
            'site',
            self::MAX_SITE,
            'O site'
        );

        if ($site === null) {
            return null;
        }

        $partes = parse_url($site);

        if (
            !filter_var($site, FILTER_VALIDATE_URL) ||
            $partes === false ||
            empty($partes['host']) ||
            !in_array(
                strtolower($partes['scheme'] ?? ''),
                ['http', 'https'],
                true
            )
        ) {
            throw new \InvalidArgumentException(
                'Informe um site válido, iniciando com http:// ou https://.'
            );
        }

        return $site;
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
            throw new \InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $valor = trim((string) $dados[$campo]);

        if ($valor === '') {
            return null;
        }

        if (self::tamanho($valor) > $maximo) {
            throw new \InvalidArgumentException(
                "{$rotulo} deve possuir no máximo {$maximo} caracteres."
            );
        }

        return $valor;
    }

    private static function ativo(
        array $dados,
        bool $padrao
    ): bool {
        if (!array_key_exists('ativo', $dados)) {
            return $padrao;
        }

        if (!is_scalar($dados['ativo'])) {
            throw new \InvalidArgumentException(
                'Status do cliente inválido.'
            );
        }

        $ativo = filter_var(
            $dados['ativo'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($ativo === null) {
            throw new \InvalidArgumentException(
                'Status do cliente inválido.'
            );
        }

        return $ativo;
    }

    private static function filtroAtivo(
        mixed $valor
    ): ?int {
        if ($valor === null || $valor === '') {
            return null;
        }

        if (!is_scalar($valor)) {
            throw new \InvalidArgumentException(
                'Filtro de status inválido.'
            );
        }

        $ativo = filter_var(
            $valor,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($ativo === null) {
            throw new \InvalidArgumentException(
                'Filtro de status inválido.'
            );
        }

        return $ativo ? 1 : 0;
    }

    private static function filtroTexto(
        mixed $valor,
        string $rotulo
    ): ?string {
        if ($valor === null) {
            return null;
        }

        if (!is_scalar($valor)) {
            throw new \InvalidArgumentException(
                "{$rotulo} é inválido."
            );
        }

        $texto = trim((string) $valor);

        return $texto === '' ? null : $texto;
    }

    private static function validarCnpjDuplicado(
        ?string $cnpj,
        int $assessoriaId,
        ?int $clienteIdAtual = null
    ): void {
        if ($cnpj === null) {
            return;
        }

        $existente = Cliente::buscarPorCnpj(
            $cnpj,
            $assessoriaId
        );

        if (
            $existente &&
            (int) $existente['id'] !== $clienteIdAtual
        ) {
            throw new \RuntimeException(
                'Já existe um cliente cadastrado com este CNPJ.'
            );
        }
    }

    private static function tamanho(
        string $valor
    ): int {
        return function_exists('mb_strlen')
            ? mb_strlen($valor, 'UTF-8')
            : strlen($valor);
    }
}