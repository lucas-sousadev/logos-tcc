instruções passo a passo para executar o app em outro pc
(abrir o xampp e mysql workbench)
-- baixar xampp
-- baixar node.js
-- baixar npm
-- baixar mysql workbench
-- baixar composer setup
1. pegar IPV4 no ipconfig e colocar no API_URL do auth.ts
2. criar banco logos
3. executar logos.sql
4. criar .env / remover .example do .env.example
5. configurar e colocar JWT_SECRET no env, usando o terminal - C:\xampp\php .\php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
6. composer install
7. npm install
8. iniciar API
9. iniciar app