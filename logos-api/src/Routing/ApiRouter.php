<?php

namespace Logos\AssessoriaApi\Routing;

use CoffeeCode\Router\Router;

final class ApiRouter extends Router
{
    public function head(string $rota, callable|string $acao): void
    {
        $this->addRoute('HEAD', $rota, $acao, null, null);
    }
}
