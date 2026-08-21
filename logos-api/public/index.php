<?php

require_once __DIR__ . '/../vendor/autoload.php';

header('Access-Control-Allow-Origin: http://localhost:8081');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

use CoffeeCode\Router\Router;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

$router = new Router("http://localhost/LOGOS/logos-api/public");

$router->namespace("Logos\\AssessoriaApi\\Controllers");

require_once __DIR__ . '/../routes/api.php';

$router->dispatch();

if ($router->error()) {
    http_response_code($router->error());

    header('Content-Type: application/json');

    echo json_encode([
        'success' => false,
        'error' => $router->error()
    ]);
}