-- banco do LOGOS 
-- MySQL 8+
-- ============================================================

CREATE DATABASE IF NOT EXISTS logos
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE logos;

-- 1. ASSESSORIAS

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


-- 2. USUÁRIOS

CREATE TABLE usuarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
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


-- ============================================================
-- 3. PERMISSÕES
-- ============================================================

CREATE TABLE permissoes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    modulo VARCHAR(50) NOT NULL,
    acao VARCHAR(50) NOT NULL,
    descricao VARCHAR(150) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_permissao_modulo_acao (modulo, acao)
) ENGINE=InnoDB;


-- 4. PERMISSÕES DOS USUÁRIOS

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


-- 5. CONVITES PARA FUNCIONÁRIOS

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


-- 6. CLIENTES

CREATE TABLE clientes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
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
    
    INDEX idx_clientes_assessoria (assessoria_id),
    INDEX idx_clientes_nome (nome)
) ENGINE=InnoDB;



-- 7. VEÍCULOS
-- Reutilizáveis dentro da assessoria.
-- Não pertencem a clientes.

CREATE TABLE veiculos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    logo_path VARCHAR(500) NULL,

    -- Texto livre para várias redes e diferentes métricas.
    alcance TEXT NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_veiculos_assessoria
        FOREIGN KEY (assessoria_id)
        REFERENCES assessorias(id)
        ON DELETE CASCADE,
        
	UNIQUE KEY uq_veiculo_id_assessoria (id, assessoria_id),
    UNIQUE KEY uq_veiculo_nome_assessoria (assessoria_id, nome),
    INDEX idx_veiculos_assessoria (assessoria_id)
) ENGINE=InnoDB;



-- 8. JORNALISTAS / MAILING
-- Cada assessoria possui seu próprio mailing.

CREATE TABLE jornalistas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,

    nome VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL,
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


-- 9. TEMPLATES DE RELEASE
-- Os blocos são armazenados em JSON.

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


-- 10. RELEASES

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


-- 11. HISTÓRICO DE DESTINATÁRIOS DO RELEASE
-- Um registro para cada jornalista que recebeu/tentou receber.

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

    -- Rastreamento de abertura.
    tracking_token CHAR(64) NULL,
    aberto_em DATETIME NULL,
    aberturas_quantidade INT UNSIGNED NOT NULL DEFAULT 0,

    -- Preparação para rastreamento de clique.
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


-- 12. CLIPPING


CREATE TABLE clippings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    assessoria_id BIGINT UNSIGNED NOT NULL,
    cliente_id BIGINT UNSIGNED NOT NULL,
    veiculo_id BIGINT UNSIGNED NULL,

    data_publicacao DATE NOT NULL,

    -- Permite múltiplas categorias.
    -- Exemplo:
    -- ["Agronegócio", "Economia"]
    categorias JSON NULL,

    programa_secao VARCHAR(150) NULL,

    pauta TEXT NULL,

    tier VARCHAR(50) NULL,

    inicio TIME NULL,
    fim TIME NULL,

    -- Duração em segundos.
    -- Será calculada pela aplicação.
    duracao_segundos INT NULL,

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
        
	UNIQUE KEY uq_clipping_id_assessoria (id, assessoria_id),
    INDEX idx_clippings_assessoria_data (assessoria_id,data_publicacao)
);

-- 13. RELATÓRIOS
-- Um relatório pertence a um cliente e pode possuir
-- vários slides.

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


-- 14. SLIDES DOS RELATÓRIOS
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


-- 15. AUDITORIA
-- Apenas ações gerais, sem registrar cada alteração de campo.

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


-- 16. PERMISSÕES INICIAIS

INSERT INTO permissoes (modulo, acao, descricao) VALUES

-- MAILING
('MAILING', 'VISUALIZAR', 'Visualizar jornalistas do mailing'),
('MAILING', 'CRIAR', 'Cadastrar jornalistas'),
('MAILING', 'EDITAR', 'Editar jornalistas'),
('MAILING', 'EXCLUIR', 'Excluir jornalistas'),

-- CLIENTES
('CLIENTES', 'VISUALIZAR', 'Visualizar clientes'),
('CLIENTES', 'CRIAR', 'Cadastrar clientes'),
('CLIENTES', 'EDITAR', 'Editar clientes'),
('CLIENTES', 'EXCLUIR', 'Excluir clientes'),

-- VEÍCULOS
('VEICULOS', 'VISUALIZAR', 'Visualizar veículos'),
('VEICULOS', 'CRIAR', 'Cadastrar veículos'),
('VEICULOS', 'EDITAR', 'Editar veículos'),
('VEICULOS', 'EXCLUIR', 'Excluir veículos'),

-- RELEASES
('RELEASES', 'VISUALIZAR', 'Visualizar releases'),
('RELEASES', 'CRIAR', 'Criar releases'),
('RELEASES', 'EDITAR', 'Editar releases'),
('RELEASES', 'EXCLUIR', 'Excluir releases'),
('RELEASES', 'ENVIAR', 'Enviar releases'),

-- TEMPLATES
('TEMPLATES', 'VISUALIZAR', 'Visualizar templates'),
('TEMPLATES', 'CRIAR', 'Criar templates'),
('TEMPLATES', 'EDITAR', 'Editar templates'),
('TEMPLATES', 'EXCLUIR', 'Excluir templates'),

-- CLIPPING
('CLIPPING', 'VISUALIZAR', 'Visualizar clippings'),
('CLIPPING', 'CRIAR', 'Criar clippings'),
('CLIPPING', 'EDITAR', 'Editar clippings'),
('CLIPPING', 'EXCLUIR', 'Excluir clippings'),

-- RELATÓRIOS
('RELATORIOS', 'VISUALIZAR', 'Visualizar relatórios'),
('RELATORIOS', 'CRIAR', 'Criar relatórios'),
('RELATORIOS', 'EDITAR', 'Editar relatórios'),
('RELATORIOS', 'EXCLUIR', 'Excluir relatórios'),
('RELATORIOS', 'GERAR', 'Gerar arquivo do relatório');


-- FIM DO BANCO LOGOS