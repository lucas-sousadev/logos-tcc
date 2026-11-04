<?php

namespace Logos\AssessoriaApi\Exceptions;

final class ConsultaLinkIndisponivelException extends \RuntimeException
{
    public function __construct(bool $ocupado = false)
    {
        parent::__construct(
            $ocupado
                ? 'A busca de dados está ocupada no momento. Tente novamente em instantes.'
                : 'A busca de dados está indisponível no momento. ' .
                    'Tente novamente ou preencha os campos manualmente.'
        );
    }
}
