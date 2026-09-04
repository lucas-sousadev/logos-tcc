<?php
$authMiddleware =
    \Logos\AssessoriaApi\Middleware\AuthMiddleware::class;

$permissionMiddleware =
    \Logos\AssessoriaApi\Middleware\PermissionMiddleware::class;
$router->get("/", "HomeController:index");

// login e logout 
$router->post("/api/auth/login", "AuthController:login");
$router->get(
    "/api/auth/me",
    "AuthController:me",
    middleware: [
        $authMiddleware
    ]
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
    middleware: [
        $authMiddleware
    ]
);
$router->post(
    "/api/convites/validar",
    "ConviteController:validar"
);
$router->get(
    "/api/convites",
    "ConviteController:listar",
    middleware: [
        $authMiddleware
    ]
);

//funcionarios e permissoes

$router->get(
    "/api/funcionarios",
    "UsuarioController:listarFuncionarios",
    middleware: [
        $authMiddleware
    ]
);

$router->get(
    "/api/funcionarios/{id}",
    "UsuarioController:buscarFuncionario",
    middleware: [
        $authMiddleware
    ]
);

$router->get(
    "/api/permissoes",
    "PermissaoController:listarTodas",
    middleware: [
        $authMiddleware
    ]
);

$router->get(
    "/api/funcionarios/permissoes",
    "PermissaoController:listarDoFuncionario",
    middleware: [
        $authMiddleware
    ]
);

$router->put(
    "/api/funcionarios/permissoes",
    "PermissaoController:atualizarFuncionario",
    middleware: [
        $authMiddleware
    ]
);

$router->get(
    "/api/auth/permissoes",
    "AuthController:minhasPermissoes",
    middleware: [$authMiddleware]
);



// mailing

$router->get(
    "/api/jornalistas",
    "JornalistaController:listar",
    "MAILING.VISUALIZAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->get(
    "/api/jornalistas/{id}",
    "JornalistaController:buscar",
    "MAILING.VISUALIZAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->post(
    "/api/jornalistas",
    "JornalistaController:criar",
    "MAILING.CRIAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->put(
    "/api/jornalistas/{id}",
    "JornalistaController:atualizar",
    "MAILING.EDITAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->delete(
    "/api/jornalistas/{id}",
    "JornalistaController:excluir",
    "MAILING.EXCLUIR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

// veiculos 
$router->get(
    "/api/veiculos",
    "VeiculoController:listar",
    "VEICULOS.VISUALIZAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->get(
    "/api/veiculos/{id}",
    "VeiculoController:buscar",
    "VEICULOS.VISUALIZAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->post(
    "/api/veiculos",
    "VeiculoController:criar",
    "VEICULOS.CRIAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->put(
    "/api/veiculos/{id}",
    "VeiculoController:atualizar",
    "VEICULOS.EDITAR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);

$router->delete(
    "/api/veiculos/{id}",
    "VeiculoController:excluir",
    "VEICULOS.EXCLUIR",
    middleware: [
        $authMiddleware,
        $permissionMiddleware
    ]
);