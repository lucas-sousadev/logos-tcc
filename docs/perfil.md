# Perfil do usuário

O próprio usuário pode editar nome, telefone, cargo/função, cidade e UF, além de enviar, trocar ou remover a foto. Para trocar o e-mail de acesso, precisa confirmar a senha atual. A alteração do e-mail remove a confirmação anterior.

Assessoria, tipo de acesso e data de entrada são informações de consulta. O cargo é descritivo e não concede permissões. A edição administrativa do cargo e sua inclusão no cadastro ficam para uma etapa posterior.

A foto aparece no cabeçalho, nas configurações, nos cards de funcionários, nos detalhes e na tela de permissões. Sem uma foto válida, o avatar mostra as iniciais. Os detalhes de funcionários também exibem cargo, cidade e UF.

A foto aceita JPG, PNG e WEBP até 2 MB, até 4000 pixels por lado e até 12 milhões de pixels. Os arquivos usam nomes aleatórios em uploads/perfis. As imagens de avatar têm URLs acessíveis a quem possuir o endereço; os diretórios não podem ser listados.

## Banco existente em outro computador

O banco local já recebeu os novos campos. O arquivo LOGOS.sql contém a estrutura para instalações novas.

Em outro banco existente, confira primeiro:

```sql
SHOW COLUMNS FROM usuarios;
```

Adicione apenas as colunas que estiverem ausentes. Para um banco que já tem foto_path e ainda não tem os novos campos:

```sql
ALTER TABLE usuarios
    ADD COLUMN cargo VARCHAR(100) NULL AFTER foto_path,
    ADD COLUMN cidade VARCHAR(100) NULL AFTER cargo,
    ADD COLUMN uf CHAR(2) NULL AFTER cidade;
```

Se foto_path ainda não existir, adicione essa coluna antes:

```sql
ALTER TABLE usuarios
    ADD COLUMN foto_path VARCHAR(500) NULL AFTER telefone;
```

Copie também o conteúdo de uploads/perfis ao transferir os dados existentes. Preserve o .htaccess da pasta.

## Validação

O teste logos-api/tests/perfil.php usa um banco descartável, duas assessorias, funcionário sem permissões administrativas e uploads HTTP. Não altera usuários reais nem envia e-mails.
