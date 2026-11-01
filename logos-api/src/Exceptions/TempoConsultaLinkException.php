<?php

namespace Logos\AssessoriaApi\Exceptions;

final class TempoConsultaLinkException extends \InvalidArgumentException
{
    public function __construct(
        public readonly bool $prazoTotal,
        int $limiteTotalMs
    ) {
        $segundos = (int) ceil($limiteTotalMs / 1000);

        parent::__construct(
            $prazoTotal
                ? "A busca atingiu o limite de {$segundos} segundos. " .
                    'Tente novamente ou preencha os dados manualmente.'
                : 'O site demorou para responder e a consulta foi interrompida. ' .
                    'Tente novamente ou preencha os dados manualmente.'
        );
    }
}
