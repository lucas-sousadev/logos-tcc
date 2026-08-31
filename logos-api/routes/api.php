<?php

$router->get("/", "HomeController:index");

// login e logout 
$router->post("/api/auth/login", "AuthController:login");
$router->get(
    "/api/auth/me",
    "AuthController:me",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);  
$router->post(
    "/api/auth/logout",
    "AuthController:logout"
);

// token refresh
$router->post(
    "/api/auth/refresh",
    "AuthController:refresh"
);

// cadastro assessoria, assessor e funcionario
$router->post(
    "/api/auth/register-assessoria",
    "AuthController:registerAssessoria"
);
$router->post(
    "/api/auth/register-funcionario",
    "AuthController:registerFuncionario"
);
// convites 
$router->post(
    "/api/convites",
    "ConviteController:criar",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);
$router->post(
    "/api/convites/validar",
    "ConviteController:validar"
);
$router->get(
    "/api/convites",
    "ConviteController:listar",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);

//funcionarios e permissoes

$router->get(
    "/api/funcionarios",
    "UsuarioController:listarFuncionarios",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);
$router->get(
    "/api/permissoes",
    "PermissaoController:listarTodas",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);

$router->get(
    "/api/funcionarios/permissoes",
    "PermissaoController:listarDoFuncionario",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);

$router->put(
    "/api/funcionarios/permissoes",
    "PermissaoController:atualizarFuncionario",
    middleware: \Logos\AssessoriaApi\Middleware\AuthMiddleware::class
);

