<?php

namespace Logos\AssessoriaApi\Controllers;

class HomeController
{
    public function index(): void
    {
        header('Content-Type: application/json');

        echo json_encode([
            'success' => true,
            'message' => 'API LOGOS funcionando!',
        ]);
    }
}