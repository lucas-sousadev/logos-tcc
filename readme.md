instruções passo a passo para executar o app em outro pc
(abrir o xampp e mysql workbench)
-- baixar xampp
-- baixar node.js
-- baixar npm
-- baixar mysql workbench
-- baixar composer setup
1. pegar IPV4 no ipconfig e colocar no API_URL do constants/api.ts
2. executar logos.sql
3. criar .env / remover .example do .env.example
4. configurar e colocar JWT_SECRET no env, usando o terminal - C:\xampp\php .\php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
5. composer install
6. npm install
7. iniciar API (xampp)
8. iniciar app

