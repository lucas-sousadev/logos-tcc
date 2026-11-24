[CmdletBinding(SupportsShouldProcess = $true)]
param (
    [ValidateSet('Verificar', 'Instalar', 'Iniciar', 'Status', 'Pausar')]
    [string] $Acao = 'Verificar',

    [string] $PhpExe = '',
    [string] $NomeTarefa = 'LOGOS - Fila de releases',

    [ValidateRange(1, 1000)]
    [int] $Limite = 20,

    [ValidateRange(0, 60000)]
    [int] $IntervaloMs = 1000
)

$ErrorActionPreference = 'Stop'
$diretorioApi = Split-Path -Parent $PSScriptRoot
$diretorioProjeto = Split-Path -Parent $diretorioApi
$processador = Join-Path $PSScriptRoot 'processar-releases.php'

function Confirmar-Administrador {
    $identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identidade)

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Abra o PowerShell como administrador para instalar, iniciar ou pausar a tarefa.'
    }
}

function Obter-Php {
    if ($PhpExe) {
        if (-not (Test-Path -LiteralPath $PhpExe -PathType Leaf)) {
            throw 'O caminho informado em -PhpExe nao foi encontrado.'
        }
        return (Resolve-Path -LiteralPath $PhpExe).Path
    }

    $raizServidor = Split-Path -Parent (Split-Path -Parent $diretorioProjeto)
    $candidatos = @(
        (Join-Path $raizServidor 'php\php.exe'),
        'C:\xampp\php\php.exe'
    )
    $phpNoPath = Get-Command php.exe -ErrorAction SilentlyContinue
    if ($phpNoPath) {
        $candidatos += $phpNoPath.Source
    }

    foreach ($candidato in $candidatos) {
        if (Test-Path -LiteralPath $candidato -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidato).Path
        }
    }
    throw 'PHP nao encontrado. Instale o XAMPP ou informe -PhpExe "D:\xampp\php\php.exe".'
}

function Confirmar-Configuracao {
    if (-not (Test-Path -LiteralPath (Join-Path $diretorioApi '.env') -PathType Leaf)) {
        throw 'Crie logos-api/.env a partir de .env.example e preencha o banco e o SMTP.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $diretorioApi 'vendor\autoload.php') -PathType Leaf)) {
        throw 'Execute composer install na pasta logos-api antes de configurar o processamento.'
    }
    if (-not (Test-Path -LiteralPath $processador -PathType Leaf)) {
        throw 'O processador nao foi encontrado. Atualize os arquivos do projeto.'
    }

    $php = Obter-Php
    & $php $processador '--verificar' | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        throw 'A verificacao falhou. Corrija o aviso acima antes de continuar.'
    }
    return $php
}

function Obter-Tarefa {
    $tarefa = Get-ScheduledTask -TaskName $NomeTarefa -TaskPath '\' -ErrorAction SilentlyContinue
    if (-not $tarefa) {
        throw 'Tarefa nao encontrada ou sem acesso. Abra o PowerShell como administrador e use -Acao Instalar se ainda nao a configurou.'
    }
    return $tarefa
}

function Confirmar-OrigemTarefa($Tarefa) {
    $corresponde = @($Tarefa.Actions | Where-Object {
        $_.Arguments -and $_.Arguments.IndexOf($processador, [StringComparison]::OrdinalIgnoreCase) -ge 0
    }).Count -gt 0

    if (-not $corresponde) {
        throw 'Essa tarefa aponta para outra pasta. Use -Acao Instalar para atualizar o caminho ou escolha outro -NomeTarefa.'
    }
}

try {
    switch ($Acao) {
        'Verificar' {
            $php = Confirmar-Configuracao
            Write-Host ('Configuracao verificada. PHP: ' + $php)
            Write-Host 'Nenhum e-mail foi enviado por esta verificacao.'
        }
        'Instalar' {
            $php = Confirmar-Configuracao
            Write-Host ('Processador: ' + $processador)
            Write-Host ('PHP: ' + $php)

            if ($PSCmdlet.ShouldProcess($NomeTarefa, 'Instalar processamento automatico a cada minuto')) {
                Confirmar-Administrador
                $argumentos = '"{0}" --limite={1} --intervalo-ms={2}' -f $processador, $Limite, $IntervaloMs
                $execucao = New-ScheduledTaskAction -Execute $php -Argument $argumentos -WorkingDirectory $diretorioApi
                $gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
                $conta = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
                $ajustes = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
                    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

                Register-ScheduledTask -TaskName $NomeTarefa -TaskPath '\' -Action $execucao -Trigger $gatilho `
                    -Principal $conta -Settings $ajustes -Force `
                    -Description 'Processa a fila e os agendamentos de releases do LOGOS.' | Out-Null

                Write-Host 'Tarefa instalada. A primeira execucao ocorrera em aproximadamente um minuto.'
                Write-Host 'Voce pode fechar este terminal. Mantenha o PC e o MySQL ligados.'
            }
        }
        'Iniciar' {
            $php = Confirmar-Configuracao
            $tarefa = Obter-Tarefa
            Confirmar-OrigemTarefa $tarefa

            if ($PSCmdlet.ShouldProcess($NomeTarefa, 'Habilitar e iniciar o processamento da fila')) {
                Confirmar-Administrador
                Enable-ScheduledTask -TaskName $NomeTarefa -TaskPath '\' | Out-Null
                Start-ScheduledTask -TaskName $NomeTarefa -TaskPath '\'
                Write-Host 'Processamento solicitado. As proximas execucoes continuarao automaticas.'
            }
        }
        'Status' {
            $tarefa = Obter-Tarefa
            Confirmar-OrigemTarefa $tarefa
            $informacoes = Get-ScheduledTaskInfo -TaskName $NomeTarefa -TaskPath '\'

            [pscustomobject]@{
                Tarefa = $NomeTarefa
                Estado = $tarefa.State.ToString()
                Habilitada = $tarefa.Settings.Enabled
                UltimaExecucao = $informacoes.LastRunTime
                ProximaExecucao = $informacoes.NextRunTime
                UltimoResultado = $informacoes.LastTaskResult
            } | Format-List
            Write-Host 'UltimoResultado 0 indica que o ultimo lote terminou sem erro de execucao.'
            Write-Host 'O resultado de cada destinatario deve ser conferido na tela do release.'
        }
        'Pausar' {
            $tarefa = Obter-Tarefa
            Confirmar-OrigemTarefa $tarefa

            if ($PSCmdlet.ShouldProcess($NomeTarefa, 'Pausar as proximas execucoes da fila')) {
                Confirmar-Administrador
                Disable-ScheduledTask -TaskName $NomeTarefa -TaskPath '\' | Out-Null
                Write-Host 'Proximas execucoes pausadas. Um lote ja iniciado podera terminar.'
            }
        }
    }
} catch {
    Write-Error ($_.Exception.Message + ' Consulte docs/release-processamento.md para configurar outro PC.')
    exit 1
}
