instruções passo a passo para executar o app em outro pc
(abrir o xampp e mysql workbench)
-- baixar xampp
-- baixar node.js
-- baixar npm
-- baixar mysql workbench
-- baixar composer setup
NÃO ESQUEÇA DE lIGAR O AUTO SAVE NO VSCODE
1. Nomeie a pasta raiz do projeto como LOGOS (é a pasta que contém todos arquivos do projeto, como por exemplo assessoria-app, logos-api e etc)
2. abrir prompt de comando, digitar ipconfig, pegar IPV4 da sua rede atual e colocar no API_URL do assessoria-app/src/constants/api.ts
3. Em uma instalação nova, importar LOGOS.sql no MySQL Workbench. Ao transferir um servidor existente, importar o backup do banco para manter os dados e agendamentos.
4. Copiar logos-api/.env.example para logos-api/.env e preencher a configuração, mantendo o arquivo .env.example no projeto.
5. abrir o terminal, escrever: "cd C:\xampp\php", depois escreva: .\php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"     -- Cole os números e letras aleatórios no JWT_SECRET no .env 
6. agora abra outro terminal ou digite "cd .." no terminal atual, depois digite: "cd LOGOS/logos-api", depois execute o comando "composer install" no terminal
7. agora abra outro terminal, digite "cd assessoria-app" e execute o comando "npm install"
8. no xampp, inicie os módulos MySQL e Apache
9. digite "cd assessoria-app" se não estiver nessa pasta, depois digite npx expo start para iniciar o app, depois aperte W para abrir na web.

para o webscraping funcionar, execute na pasta do capture-worker:
- npm install
- npm i playwright-chromium

((se der erro ainda, execute também npm install chromium))

## Processamento e envio de releases

Para configurar o processamento automático em outro PC, consulte [o guia de processamento de releases](docs/release-processamento.md).

O projeto inclui `logos-api/bin/gerenciar-releases.ps1`, com as ações `Verificar`, `Instalar`, `Iniciar`, `Status` e `Pausar`. Os caminhos são obtidos a partir da instalação atual. O arquivo `.env`, o banco e os arquivos enviados precisam ser configurados ou transferidos separadamente.
