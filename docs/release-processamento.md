# Processamento de releases em outro PC

O processamento roda no computador que hospeda a API e o banco de dados. Celulares e outros computadores acessam esse servidor; não precisam de uma tarefa de processamento própria.

O script `logos-api/bin/gerenciar-releases.ps1` acompanha o projeto e encontra os caminhos a partir da instalação atual. Ele configura o Agendador de Tarefas do Windows para processar a fila a cada minuto, sem precisar manter um terminal aberto ou uma sessão de usuário conectada.

## 1. Preparar o servidor

1. Leve a versão atual do projeto para o PC, incluindo este script. No XAMPP, o caminho habitual é `C:\xampp\htdocs\LOGOS`.
2. Inicie Apache e MySQL no XAMPP.
3. Para uma instalação nova, importe o `LOGOS.sql` atual. Para transferir um servidor existente, exporte e importe o banco dele, com a estrutura atualizada: releases, destinatários e agendamentos ficam nesse banco. Não substitua um banco em uso por um schema vazio.
4. Transfira também os arquivos de `logos-api/public/uploads` e os diretórios de armazenamento configurados no `.env`, como `CLIPPING_STORAGE_PATH`. Eles não são levados automaticamente pelo Git.
5. Na pasta `logos-api`, execute `composer install`.
6. Crie o arquivo `logos-api/.env` a partir de `.env.example` ou transfira a configuração existente, adaptando os caminhos e os endereços deste PC. O `.env` fica fora do Git.

Confira no `.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`: devem apontar para o banco que este servidor vai usar.
- `JWT_SECRET`: necessário para a autenticação da API.
- `RELEASE_SMTP_HOST`, `RELEASE_SMTP_PORT`, `RELEASE_SMTP_SECURITY`, `RELEASE_SMTP_USER`, `RELEASE_SMTP_PASSWORD` e `RELEASE_SMTP_FROM`: use a configuração de envio que já funcionou, incluindo a senha de app.
- `RELEASE_API_URL`: endereço da API acessível pelos dispositivos, por exemplo `http://192.168.0.15/LOGOS/logos-api/public`.
- `RELEASE_WORKER_LOG_DIR`: uma pasta de logs fora da pasta pública, por exemplo `C:/xampp/logos-storage/releases`.
- `RELEASE_TRACKING_URL`: opcional; URL pública HTTPS da API para registrar aberturas. Deixe vazio enquanto esse endereço não existir. Veja [taxa de abertura dos releases](release-aberturas.md).

Se o servidor mudou de endereço, atualize também `API_URL` em `assessoria-app/src/constants/api.ts` e reinicie o app/Expo para carregar a configuração nova. Os dois endereços devem apontar para a API escolhida. Confira o IPv4 da rede com `ipconfig`.

Se o aplicativo já estiver compilado com o endereço antigo, gere uma nova versão com a configuração atualizada. Reiniciar um aplicativo compilado não troca o endereço que foi incluído nele.

Ao transferir o servidor para outro PC com um banco copiado, pause o processador antigo e aguarde seu lote terminar antes da transferência final. Dois bancos separados têm filas independentes; a proteção contra duplicação não é compartilhada entre eles.

## 2. Verificar a configuração sem enviar e-mails

Na pasta raiz do projeto, execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Verificar
```

A verificação confere o PHP, as dependências, os campos de configuração, a conexão e a estrutura do banco. Não transmite e-mails nem altera os releases. Ela não testa a autenticação no Gmail nem garante a entrega: para isso, use o envio de teste do aplicativo.

Se o banco já existe e o script informar uma coluna ou status ausente, atualize essa estrutura antes de instalar a tarefa. Não é necessário recriar os dados.

## 3. Instalar o processamento automático uma vez

Abra o PowerShell **como administrador**, entre na pasta raiz do projeto e execute:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Instalar
```

O script cria ou atualiza a tarefa `LOGOS - Fila de releases`, usando os caminhos deste PC. A primeira execução começa aproximadamente um minuto depois. A tarefa continua configurada após reiniciar o Windows e não precisa de um usuário conectado.

O PC precisa estar ligado, sem suspensão, com internet e MySQL funcionando. Para também iniciar Apache/MySQL após reiniciar o Windows, configure esses serviços no XAMPP. A tarefa de releases não instala nem inicia esses serviços.

Se o PHP estiver em um local diferente, informe o caminho:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Instalar -PhpExe "D:\xampp\php\php.exe"
```

Para conferir o que seria instalado, acrescente `-WhatIf`. Esse modo verifica a configuração, mas não registra nem inicia a tarefa.

## 4. Consultar, iniciar ou pausar

No PowerShell como administrador, na pasta raiz do projeto:

```powershell
# Consultar a tarefa
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Status

# Retomar a tarefa e solicitar um lote agora
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Iniciar

# Impedir novas execuções; um lote em andamento poderá terminar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Pausar
```

Para cancelar um release específico, use a ação de cancelamento dentro do aplicativo. Pausar o servidor não cancela os releases salvos.

`UltimoResultado: 0` indica que o último lote terminou sem erro de execução. Isso não significa que todos os e-mails foram entregues: os resultados por destinatário aparecem nos detalhes do release.

Os registros do processador ficam na pasta definida em `RELEASE_WORKER_LOG_DIR`, no arquivo `processamento-AAAA-MM.log`. Se essa variável não estiver definida, será usada a pasta temporária da conta que executa a tarefa; na instalação automática, essa conta é `SYSTEM`.

## Agendamentos e troca de dispositivo

- Trocar de celular ou navegador não exige configurar outro processador. Basta acessar a mesma API e a mesma conta.
- Se o servidor ficar desligado, os agendamentos permanecem no banco e entram na fila quando o processador voltar e identificar que o horário já chegou.
- Se apenas o código for copiado para outro PC com um banco vazio, os agendamentos antigos não estarão lá. Eles continuam no banco original.

## Devoluções de e-mail

O status de aceite no LOGOS registra a resposta do servidor SMTP. O Gmail pode aceitar o envio e, depois, devolver uma mensagem de falha, como no caso de um endereço terminado em `gmail.co`. A leitura automática dessas devoluções ainda não está integrada ao LOGOS.

## Referências

- [Gatilhos do Agendador de Tarefas](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasktrigger)
- [Conta de execução da tarefa](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtaskprincipal)
- [Repetição contínua da tarefa](https://learn.microsoft.com/en-us/windows/win32/taskschd/repetitionpattern-duration)
