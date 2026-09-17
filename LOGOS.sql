-- banco de dados do Logos 
-- MySQL 8.0.16+ (CHECK aplicado) / MariaDB 10.4+

CREATE DATABASE IF NOT EXISTS logos
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE logos;

-- 1. Assessrias

CREATE TABLE assessorias (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(18) NULL,
    email VARCHAR(150) NULL,
    telefone VARCHAR(30) NULL,
    logo_path VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_assessoria_cnpj (cnpj)
) ENGINE=InnoDB;


-- 2. Usuários

CREATE TABLE usuarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    telefone VARCHAR(30) NULL,
    senha_hash VARCHAR(255) NOT NULL,

    perfil ENUM('ASSESSOR', 'FUNCIONARIO')
        NOT NULL DEFAULT 'FUNCIONARIO',

    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    email_verificado BOOLEAN NOT NULL DEFAULT FALSE,

    ultimo_login DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuarios_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,
        
	UNIQUE KEY uq_usuario_id_assessoria (id, assessoria_id),
    UNIQUE KEY uq_usuario_email (email),
    INDEX idx_usuarios_assessoria (assessoria_id)
) ENGINE=InnoDB;


-- 3. Permissões

CREATE TABLE permissoes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    modulo VARCHAR(50) NOT NULL,
    acao VARCHAR(50) NOT NULL,
    descricao VARCHAR(150) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_permissao_modulo_acao (modulo, acao)
) ENGINE=InnoDB;


-- 4. Permissões para os usuarios em específico

CREATE TABLE usuario_permissoes (
    usuario_id BIGINT UNSIGNED NOT NULL,
    permissao_id BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (usuario_id, permissao_id),

    CONSTRAINT fk_usuario_permissoes_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_permissoes_permissao
        FOREIGN KEY (permissao_id)
        REFERENCES permissoes(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;


-- 5. Convites

CREATE TABLE convites (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    criado_por BIGINT UNSIGNED NOT NULL,

    codigo VARCHAR(20) NOT NULL,
    email_destino VARCHAR(150) NULL,

    expira_em DATETIME NOT NULL,
    utilizado_em DATETIME NULL,
    utilizado_por BIGINT UNSIGNED NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_convites_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_convites_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_convites_utilizado_por
        FOREIGN KEY (utilizado_por)
        REFERENCES usuarios(id)
        ON DELETE SET NULL,

    UNIQUE KEY uq_convite_codigo (codigo),
    INDEX idx_convites_assessoria (assessoria_id)
) ENGINE=InnoDB;


-- 6. Clientes

CREATE TABLE clientes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NULL,
    telefone VARCHAR(30) NULL,
    CNPJ VARCHAR(18) NULL,
    site VARCHAR(500) NULL,
    cidade VARCHAR(100) NULL,
    estado VARCHAR(100) NULL,
    descricao TEXT NULL,
    segmento VARCHAR(100) NULL,
    responsavel VARCHAR(100) NULL,
    logo_path VARCHAR(500) NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_clientes_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,
        
    UNIQUE KEY uq_cliente_id_assessoria (id, assessoria_id),
    UNIQUE KEY uq_clientes_assessoria_cnpj (assessoria_id, cnpj),
    
    INDEX idx_clientes_filtros (assessoria_id, ativo, estado, cidade, segmento),
    INDEX idx_clientes_assessoria (assessoria_id),
    INDEX idx_clientes_nome (nome)
) ENGINE=InnoDB;

-- 7. Veículos

CREATE TABLE veiculos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    logo_path VARCHAR(500) NULL,
    -- Texto livre para várias redes e diferentes métricas.
    alcance TEXT NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    tier TINYINT UNSIGNED NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_veiculos_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_veiculos_tier
        CHECK (tier IS NULL OR tier BETWEEN 1 AND 3),
        
	UNIQUE KEY uq_veiculo_id_assessoria (id, assessoria_id),
    UNIQUE KEY uq_veiculo_nome_assessoria (assessoria_id, nome),
    INDEX idx_veiculos_assessoria (assessoria_id)
) ENGINE=InnoDB;

-- 8. Contatos / mailing

CREATE TABLE jornalistas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    email VARCHAR(180) NULL,
    telefone VARCHAR(30) NULL,
    cargo VARCHAR(100) NULL,
    estado VARCHAR(100) NULL,
    cidade VARCHAR(100) NULL,

    -- Veículo em que o jornalista trabalha, quando cadastrado.
    veiculo_id BIGINT UNSIGNED NULL,

    observacoes TEXT NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_jornalistas_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_jornalistas_veiculo_assessoria
		FOREIGN KEY (veiculo_id, assessoria_id)
		REFERENCES veiculos(id, assessoria_id)
		ON DELETE RESTRICT,

    UNIQUE KEY uq_jornalista_email_assessoria
        (assessoria_id, email),
	UNIQUE KEY uq_jornalista_id_assessoria (id, assessoria_id),
    
    INDEX idx_jornalistas_assessoria (assessoria_id),
    INDEX idx_jornalistas_nome (nome),
    INDEX idx_jornalistas_veiculo (veiculo_id)
) ENGINE=InnoDB;


-- 9. Templates 

CREATE TABLE templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    criado_por BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,

    -- Estrutura dos blocos do construtor visual.
    blocos_json JSON NOT NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_templates_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_templates_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,
        
    UNIQUE KEY uq_template_id_assessoria (id, assessoria_id),
    INDEX idx_templates_assessoria (assessoria_id)
) ENGINE=InnoDB;


-- 10. Releases

CREATE TABLE releases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    cliente_id BIGINT UNSIGNED NOT NULL,

    template_id BIGINT UNSIGNED NULL,
    criado_por BIGINT UNSIGNED NOT NULL,

    assunto VARCHAR(255) NOT NULL,

    -- Snapshot do template utilizado neste release.
    -- Isso impede que futuras alterações no template
    -- modifiquem releases antigos.
    blocos_json JSON NOT NULL,

    status ENUM(
        'RASCUNHO',
        'AGENDADO',
        'ENVIANDO',
        'ENVIADO'
    ) NOT NULL DEFAULT 'RASCUNHO',

    agendado_para DATETIME NULL,
    iniciado_em DATETIME NULL,
    enviado_em DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_releases_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

	CONSTRAINT fk_releases_cliente_assessoria
		FOREIGN KEY (cliente_id, assessoria_id)
		REFERENCES clientes(id, assessoria_id)
		ON DELETE RESTRICT,
        
	CONSTRAINT fk_releases_template_assessoria
		FOREIGN KEY (template_id, assessoria_id)
		REFERENCES templates(id, assessoria_id)
		ON DELETE RESTRICT,

	CONSTRAINT fk_releases_criado_por_assessoria
		FOREIGN KEY (criado_por, assessoria_id)
		REFERENCES usuarios(id, assessoria_id)
		ON DELETE RESTRICT,
        
	UNIQUE KEY uq_release_id_assessoria (id, assessoria_id),
    
   INDEX idx_releases_assessoria (assessoria_id),
    INDEX idx_releases_cliente (cliente_id),
    INDEX idx_releases_template (template_id),
    INDEX idx_releases_criado_por (criado_por),
    INDEX idx_releases_status (status),
    INDEX idx_releases_agendamento (agendado_para)
) ENGINE=InnoDB;


-- 11. Histórico de destinatários do release

CREATE TABLE release_destinatarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

	assessoria_id BIGINT UNSIGNED NOT NULL,
    release_id BIGINT UNSIGNED NOT NULL,
    jornalista_id BIGINT UNSIGNED NULL,

    -- Snapshot do e-mail utilizado no momento do envio.
    email VARCHAR(180) NOT NULL,

    status ENUM(
        'PENDENTE',
        'ENVIANDO',
        'ENVIADO',
        'ERRO'
    ) NOT NULL DEFAULT 'PENDENTE',

    enviado_em DATETIME NULL,

    erro_mensagem TEXT NULL,

    -- rastreamento de abertura
    tracking_token CHAR(64) NULL,
    aberto_em DATETIME NULL,
    aberturas_quantidade INT UNSIGNED NOT NULL DEFAULT 0,

    -- preparação para rastreamento de clique
    clicado_em DATETIME NULL,
    cliques_quantidade INT UNSIGNED NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_release_destinatarios_release_assessoria
		FOREIGN KEY (release_id, assessoria_id)
		REFERENCES releases(id, assessoria_id)
		ON DELETE CASCADE,

	CONSTRAINT fk_release_destinatarios_jornalista_assessoria
		FOREIGN KEY (jornalista_id, assessoria_id)
		REFERENCES jornalistas(id, assessoria_id)
		ON DELETE RESTRICT,
        
    UNIQUE KEY uq_release_jornalista
        (release_id, jornalista_id),

    UNIQUE KEY uq_tracking_token
        (tracking_token),

    INDEX idx_release_destinatarios_release (release_id),
    INDEX idx_release_destinatarios_jornalista (jornalista_id),
    INDEX idx_release_destinatarios_status (status)
) ENGINE=InnoDB;

-- 12. Clippings

CREATE TABLE clippings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    cliente_id BIGINT UNSIGNED NOT NULL,
    veiculo_id BIGINT UNSIGNED NULL,
    ano_referencia SMALLINT UNSIGNED NOT NULL,

    data_publicacao DATE NULL,

    -- Valores livres; as sugestões da interface não limitam a lista.
    -- Ex.: ["Site", "TV", "Canal do produtor"]
    categorias JSON NULL,
    programa_secao VARCHAR(150) NULL,

    pauta TEXT NULL,

    tier TINYINT UNSIGNED NULL,

    inicio_segundos INT UNSIGNED NULL,
    fim_segundos INT UNSIGNED NULL,
    link VARCHAR(2048) NULL,
    observacoes TEXT NULL,

    criado_por BIGINT UNSIGNED NOT NULL,

    -- Preencher data e responsável juntos ao arquivar; limpar ao restaurar.
    arquivado_em DATETIME NULL DEFAULT NULL,
    arquivado_por BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- informada ou calculada pelo intervalo completo
    duracao_segundos INT UNSIGNED NULL,

    CONSTRAINT fk_clippings_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_clippings_cliente_assessoria
		FOREIGN KEY (cliente_id, assessoria_id)
		REFERENCES clientes(id, assessoria_id)
		ON DELETE RESTRICT,

    CONSTRAINT fk_clippings_veiculo_assessoria
		FOREIGN KEY (veiculo_id, assessoria_id)
		REFERENCES veiculos(id, assessoria_id)
		ON DELETE RESTRICT,

    CONSTRAINT fk_clippings_criado_por_assessoria
        FOREIGN KEY (criado_por, assessoria_id)
        REFERENCES usuarios(id, assessoria_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_clippings_arquivado_por_assessoria
        FOREIGN KEY (arquivado_por, assessoria_id)
        REFERENCES usuarios(id, assessoria_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_clippings_tier
        CHECK (tier IS NULL OR tier BETWEEN 1 AND 3),

    CONSTRAINT chk_clippings_ano_referencia
        CHECK (ano_referencia BETWEEN 1000 AND 9999),

    CONSTRAINT chk_clippings_data_ano
        CHECK (
            data_publicacao IS NULL
            OR YEAR(data_publicacao) = ano_referencia
        ),

    -- A API valida também os textos e elimina categorias repetidas.
    CONSTRAINT chk_clippings_categorias_lista
        CHECK (categorias IS NULL OR JSON_TYPE(categorias) = 'ARRAY'),

    -- Sem o intervalo completo, a duração pode ser informada.
    -- Com início e fim preenchidos, deve corresponder à diferença.
    CONSTRAINT chk_clippings_duracao
        CHECK (
            inicio_segundos IS NULL
            OR fim_segundos IS NULL
            OR (
                fim_segundos > inicio_segundos
                AND duracao_segundos IS NOT NULL
                AND duracao_segundos =
                    CAST(fim_segundos AS SIGNED)
                    - CAST(inicio_segundos AS SIGNED)
            )
        ),
        
	UNIQUE KEY uq_clipping_id_assessoria (id, assessoria_id),
    INDEX idx_clippings_assessoria_data (assessoria_id, data_publicacao),
    INDEX idx_clippings_cliente_ano (
        assessoria_id, cliente_id, ano_referencia, arquivado_em, data_publicacao, id
    )
) ENGINE=InnoDB;

-- 12.1 Materiais e imagens dos clippings
-- os arquivos ficam no armazenamento; essa tabela guarda suas referencias
CREATE TABLE clipping_anexos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    clipping_id BIGINT UNSIGNED NOT NULL,
    criado_por BIGINT UNSIGNED NOT NULL,

    -- Original que deu origem ao recorte, página ou quadro de vídeo
    -- A API deve impedir ciclos e alterações indevidas nessa relação
    anexo_origem_id BIGINT UNSIGNED NULL,

    tipo ENUM('IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO') NOT NULL,
    origem ENUM(
        'UPLOAD', 'CAPTURA', 'RECORTE', 'PAGINA_PDF', 'QUADRO_VIDEO'
    ) NOT NULL DEFAULT 'UPLOAD',

    nome_original VARCHAR(255) NOT NULL,
    arquivo_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    tamanho_bytes BIGINT UNSIGNED NOT NULL,
    ordem INT UNSIGNED NOT NULL DEFAULT 0,

    -- 1 = selecionado; NULL = não selecionado (não usar 0)
    -- Os índices únicos permitem vários NULL, mas só um 1 por clipping
    -- Uma imagem pode ser simultaneamente principal e imagem do relatório
    principal TINYINT UNSIGNED NULL DEFAULT NULL,
    imagem_relatorio TINYINT UNSIGNED NULL DEFAULT NULL,

    -- Preserva a origem da captura mesmo se o link do clipping mudar.
    url_origem VARCHAR(2048) NULL,
    capturado_em DATETIME NULL,
    -- Ex.: dimensões, coordenadas do recorte, página ou posição do quadro.
    metadados_json JSON NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    -- Remover anexos exige tratamento explícito dos arquivos e derivados.
    -- Relatórios/versionamento deverão preservar ou referenciar esses materiais.
    CONSTRAINT fk_clipping_anexos_clipping_assessoria
        FOREIGN KEY (clipping_id, assessoria_id)
        REFERENCES clippings(id, assessoria_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_clipping_anexos_criado_por_assessoria
        FOREIGN KEY (criado_por, assessoria_id)
        REFERENCES usuarios(id, assessoria_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_clipping_anexos_origem
        FOREIGN KEY (anexo_origem_id, clipping_id, assessoria_id)
        REFERENCES clipping_anexos(id, clipping_id, assessoria_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_clipping_anexos_tamanho
        CHECK (tamanho_bytes > 0),

    CONSTRAINT chk_clipping_anexos_principal
        CHECK (principal IS NULL OR principal = 1),

    CONSTRAINT chk_clipping_anexos_imagem_relatorio
        CHECK (
            imagem_relatorio IS NULL
            OR (imagem_relatorio = 1 AND tipo = 'IMAGEM')
        ),

    CONSTRAINT chk_clipping_anexos_metadados
        CHECK (metadados_json IS NULL OR JSON_TYPE(metadados_json) = 'OBJECT'),

    UNIQUE KEY uq_clipping_anexo_contexto (id, clipping_id, assessoria_id),
    UNIQUE KEY uq_clipping_anexo_principal (assessoria_id, clipping_id, principal),
    UNIQUE KEY uq_clipping_anexo_imagem (assessoria_id, clipping_id, imagem_relatorio),
    INDEX idx_clipping_anexos_ordem (assessoria_id, clipping_id, ordem, id)
) ENGINE=InnoDB;

-- 12.2 testes importacao
CREATE TABLE clipping_importacoes (
    token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NOT NULL,

    previa JSON NOT NULL,
    resultado JSON NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em DATETIME NOT NULL,
    confirmado_em DATETIME NULL,

    CONSTRAINT fk_clipping_importacoes_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_clipping_importacoes_usuario
        FOREIGN KEY (usuario_id, assessoria_id)
        REFERENCES usuarios(id, assessoria_id)
        ON DELETE CASCADE,

    INDEX idx_clipping_importacoes_expiracao (
        assessoria_id,
        expira_em
    )
) ENGINE=InnoDB;

-- 13. Relatórios
-- Um relatório pertence a um cliente e pode possuir vários slides

CREATE TABLE relatorios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    cliente_id BIGINT UNSIGNED NOT NULL,
    criado_por BIGINT UNSIGNED NOT NULL,

    titulo VARCHAR(200) NOT NULL,

    periodo_inicio DATE NULL,
    periodo_fim DATE NULL,

    -- Caminho do arquivo gerado (PPTX/PDF/etc.).
    arquivo_path VARCHAR(500) NULL,

    gerado_em DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_relatorios_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_relatorios_cliente_assessoria
		FOREIGN KEY (cliente_id, assessoria_id)
		REFERENCES clientes(id, assessoria_id)
		ON DELETE RESTRICT,

    CONSTRAINT fk_relatorios_criado_por_assessoria
		FOREIGN KEY (criado_por, assessoria_id)
		REFERENCES usuarios(id, assessoria_id)
		ON DELETE RESTRICT,
        
	UNIQUE KEY uq_relatorio_id_assessoria (id, assessoria_id),

    INDEX idx_relatorios_assessoria (assessoria_id),
    INDEX idx_relatorios_cliente (cliente_id),
    INDEX idx_relatorios_periodo (periodo_inicio, periodo_fim)
) ENGINE=InnoDB;


-- 14. Slides dos relatórios
--
-- Cada slide representa uma matéria/clipping.
-- Os dados existentes são puxados do clipping/veículo,
-- enquanto dados específicos do relatório podem ser adicionados.

CREATE TABLE relatorio_slides (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    relatorio_id BIGINT UNSIGNED NOT NULL,
	assessoria_id BIGINT UNSIGNED NOT NULL,
    -- Clipping que originou este slide.
    clipping_id BIGINT UNSIGNED NULL,

    ordem INT UNSIGNED NOT NULL,

    titulo VARCHAR(255) NULL,

    -- Imagem/print da matéria utilizada no slide.
    imagem_path VARCHAR(500) NULL,

    -- Link utilizado/exibido no slide.
    link VARCHAR(2048) NULL,

    observacoes TEXT NULL,

    -- Guarda informações específicas adicionadas ao slide
    -- sem obrigar a criação de novas colunas toda vez.
    dados_json JSON NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

	 CONSTRAINT fk_relatorio_slides_relatorio_assessoria
		FOREIGN KEY (relatorio_id, assessoria_id)
		REFERENCES relatorios(id, assessoria_id)
		ON DELETE CASCADE,
        
	CONSTRAINT fk_relatorio_slides_clipping_assessoria
		FOREIGN KEY (clipping_id, assessoria_id)
		REFERENCES clippings(id, assessoria_id)
		ON DELETE RESTRICT,

    UNIQUE KEY uq_relatorio_ordem (relatorio_id, ordem),

    INDEX idx_relatorio_slides_relatorio (relatorio_id),
    INDEX idx_relatorio_slides_clipping (clipping_id)
) ENGINE=InnoDB;


-- 15. Auditoria

CREATE TABLE auditoria (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NULL,

    acao ENUM(
        'CRIAR',
        'EDITAR',
        'EXCLUIR',
        'ENVIAR'
    ) NOT NULL,

    entidade VARCHAR(80) NOT NULL,
    entidade_id BIGINT UNSIGNED NULL,

    descricao VARCHAR(255) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auditoria_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL,

    INDEX idx_auditoria_assessoria (assessoria_id),
    INDEX idx_auditoria_usuario (usuario_id),
    INDEX idx_auditoria_entidade (entidade),
    INDEX idx_auditoria_data (created_at)
) ENGINE=InnoDB;


-- 16. Permissões Iniciais

INSERT INTO permissoes (modulo, acao, descricao) VALUES

-- Mailing
('MAILING', 'VISUALIZAR', 'Visualizar contatos do mailing'),
('MAILING', 'CRIAR', 'Cadastrar contatos'),
('MAILING', 'EDITAR', 'Editar contatos'),
('MAILING', 'EXCLUIR', 'Excluir contatos'),
('MAILING', 'IMPORTAR', 'Importar contatos para o mailing.'),
('MAILING','EXPORTAR','Exportar contatos do mailing.'),

-- Clientes
('CLIENTES', 'VISUALIZAR', 'Visualizar clientes'),
('CLIENTES', 'CRIAR', 'Cadastrar clientes'),
('CLIENTES', 'EDITAR', 'Editar clientes'),
('CLIENTES', 'EXCLUIR', 'Excluir clientes'),

-- Veículos
('VEICULOS', 'VISUALIZAR', 'Visualizar veículos'),
('VEICULOS', 'CRIAR', 'Cadastrar veículos'),
('VEICULOS', 'EDITAR', 'Editar veículos'),
('VEICULOS', 'EXCLUIR', 'Excluir veículos'),

-- Releases
('RELEASES', 'VISUALIZAR', 'Visualizar releases'),
('RELEASES', 'CRIAR', 'Criar releases'),
('RELEASES', 'EDITAR', 'Editar releases'),
('RELEASES', 'EXCLUIR', 'Excluir releases'),
('RELEASES', 'ENVIAR', 'Enviar releases'),

-- Templates
('TEMPLATES', 'VISUALIZAR', 'Visualizar templates'),
('TEMPLATES', 'CRIAR', 'Criar templates'),
('TEMPLATES', 'EDITAR', 'Editar templates'),
('TEMPLATES', 'EXCLUIR', 'Excluir templates'),

-- Clipping
('CLIPPING', 'VISUALIZAR', 'Visualizar clippings'),
('CLIPPING', 'CRIAR', 'Criar clippings'),
('CLIPPING', 'EDITAR', 'Editar clippings'),
('CLIPPING', 'EXCLUIR', 'Excluir clippings'),
('CLIPPING', 'ANEXAR', 'Enviar e gerenciar anexos dos clippings.'),
('CLIPPING', 'IMPORTAR', 'Importar clippings em lote.'),
('CLIPPING', 'EXPORTAR', 'Exportar clippings.'),

-- Relatorios
('RELATORIOS', 'VISUALIZAR', 'Visualizar relatórios'),
('RELATORIOS', 'CRIAR', 'Criar relatórios'),
('RELATORIOS', 'EDITAR', 'Editar relatórios'),
('RELATORIOS', 'EXCLUIR', 'Excluir relatórios'),
('RELATORIOS', 'GERAR', 'Gerar arquivo do relatório'),

-- Auditoria
('AUDITORIA', 'VISUALIZAR', 'Visualizar o histórico de ações da assessoria.'),

-- Usuários
('USUARIOS', 'VISUALIZAR', 'Visualizar funcionários da assessoria.'),
('USUARIOS', 'EDITAR', 'Editar dados e status de funcionários da assessoria.'),
('USUARIOS', 'CRIAR', 'Cadastrar funcionários da assessoria.'),
('USUARIOS', 'GERENCIAR_PERMISSOES', 'Gerenciar permissões de funcionários.'),

-- Convites
('CONVITES', 'VISUALIZAR', 'Visualizar histórico de convites.'),
('CONVITES', 'CRIAR','Criar convites para funcionários.');

-- 17. Refresh tokens

CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    usuario_id BIGINT UNSIGNED NOT NULL,

    token_hash VARCHAR(64) NOT NULL,

    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_tokens_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    UNIQUE KEY uq_refresh_token_hash (token_hash),
    INDEX idx_refresh_tokens_usuario (usuario_id),
    INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE=InnoDB;

-- 18. Validaçao de tentativas

CREATE TABLE tentativas_autenticacao (
    acao VARCHAR(40) NOT NULL,
    chave_hash CHAR(64) NOT NULL,
    tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    janela_iniciada_em DATETIME NOT NULL,
    bloqueado_ate DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (acao, chave_hash),
    KEY idx_tentativas_autenticacao_bloqueio (bloqueado_ate)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
