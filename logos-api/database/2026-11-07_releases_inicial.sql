ALTER TABLE releases
    MODIFY COLUMN cliente_id BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS template_codigo VARCHAR(50) NULL AFTER template_id,
    ADD COLUMN IF NOT EXISTS titulo VARCHAR(150) NOT NULL DEFAULT '' AFTER criado_por,
    ADD COLUMN IF NOT EXISTS chave_rascunho CHAR(36) NULL AFTER titulo,
    ADD COLUMN IF NOT EXISTS assinatura_cadastro CHAR(64) NULL AFTER chave_rascunho,
    ADD COLUMN IF NOT EXISTS primeira_linha VARCHAR(150) NOT NULL DEFAULT '' AFTER assunto,
    ADD COLUMN IF NOT EXISTS nome_remetente VARCHAR(100) NOT NULL DEFAULT '' AFTER primeira_linha,
    ADD COLUMN IF NOT EXISTS responder_para VARCHAR(254) NOT NULL DEFAULT '' AFTER nome_remetente,
    ADD UNIQUE INDEX IF NOT EXISTS uq_release_rascunho
        (assessoria_id, criado_por, chave_rascunho);
