<?php

namespace Logos\AssessoriaApi\Services;

use Logos\AssessoriaApi\Database\Connection;
use PHPMailer\PHPMailer\Exception as ErroMailer;
use PHPMailer\PHPMailer\PHPMailer;

final class ReleaseEnvioTesteService
{
    public static function enviar(int $assessoriaId, array $dados): void
    {
        if (array_diff(array_keys($dados), ['email', 'dados_envio', 'blocos']) !== []) {
            throw new \InvalidArgumentException('O envio de teste contém campos não permitidos.');
        }

        $email = is_string($dados['email'] ?? null) ? trim($dados['email']) : '';

        if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Informe um e-mail válido para receber o teste.');
        }

        $envio = ReleaseService::validarDadosEnvio($dados['dados_envio'] ?? null);

        if ($envio['assunto'] === '') {
            throw new \InvalidArgumentException('Preencha o assunto em Dados do e-mail.');
        }

        $blocos = ReleaseBlocosService::validar($dados['blocos'] ?? null);
        $mailer = self::criarMailer();

        try {
            $imagens = self::incorporarImagens($mailer, $assessoriaId, $blocos);
            [$html, $texto] = self::renderizar($blocos, $envio['primeira_linha'], $imagens);

            $mailer->setFrom(
                trim($_ENV['RELEASE_SMTP_FROM']),
                $envio['nome_remetente'] === '' ? 'LOGOS' : $envio['nome_remetente']
            );
            $mailer->addAddress($email);

            if ($envio['responder_para'] !== '') {
                $mailer->addReplyTo($envio['responder_para']);
            }

            $mailer->isHTML(true);
            $mailer->Subject = '[TESTE] ' . $envio['assunto'];
            $mailer->Body = $html;
            $mailer->AltBody = $texto;

            self::reservarTentativa($assessoriaId);
            $mailer->send();
        } catch (ErroMailer $erro) {
            throw new \RuntimeException(
                'O servidor de e-mail não confirmou o teste. Confira a caixa de entrada antes de tentar novamente.',
                502,
                $erro
            );
        }
    }

    private static function criarMailer(): PHPMailer
    {
        $host = trim($_ENV['RELEASE_SMTP_HOST'] ?? '');
        $porta = filter_var($_ENV['RELEASE_SMTP_PORT'] ?? '', FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 65535],
        ]);
        $usuario = $_ENV['RELEASE_SMTP_USER'] ?? '';
        $senha = $_ENV['RELEASE_SMTP_PASSWORD'] ?? '';
        $remetente = trim($_ENV['RELEASE_SMTP_FROM'] ?? '');
        $seguranca = match ($_ENV['RELEASE_SMTP_SECURITY'] ?? 'starttls') {
            'starttls' => PHPMailer::ENCRYPTION_STARTTLS,
            'smtps' => PHPMailer::ENCRYPTION_SMTPS,
            default => null,
        };

        if (
            $host === '' || $porta === false || $usuario === '' || $senha === '' ||
            $seguranca === null || !filter_var($remetente, FILTER_VALIDATE_EMAIL)
        ) {
            throw new \RuntimeException(
                'O envio de teste ainda precisa da configuração SMTP do LOGOS.',
                503
            );
        }

        $mailer = new PHPMailer(true);
        $mailer->isSMTP();
        $mailer->Host = $host;
        $mailer->Port = $porta;
        $mailer->SMTPAuth = true;
        $mailer->Username = $usuario;
        $mailer->Password = $senha;
        $mailer->SMTPSecure = $seguranca;
        $mailer->Timeout = 10;
        $mailer->getSMTPInstance()->Timelimit = 10;
        $mailer->CharSet = 'UTF-8';

        return $mailer;
    }

    private static function reservarTentativa(int $assessoriaId): void
    {
        $stmt = Connection::get()->prepare("
            INSERT INTO tentativas_autenticacao
                (acao, chave_hash, tentativas, janela_iniciada_em)
            VALUES ('RELEASE_TESTE', :chave, 1, NOW())
            ON DUPLICATE KEY UPDATE
                tentativas = CASE
                    WHEN janela_iniciada_em <= NOW() - INTERVAL 10 MINUTE THEN 1
                    ELSE LEAST(tentativas + 1, 10)
                END,
                janela_iniciada_em = CASE
                    WHEN janela_iniciada_em <= NOW() - INTERVAL 10 MINUTE THEN NOW()
                    ELSE janela_iniciada_em
                END
        ");
        $stmt->execute(['chave' => hash('sha256', 'RELEASE_TESTE|' . $assessoriaId)]);

        if ($stmt->rowCount() === 0) {
            throw new \RuntimeException(
                'A assessoria atingiu o limite de 10 testes em 10 minutos. Tente novamente em alguns minutos.',
                429
            );
        }
    }

    private static function escapar(string $valor): string
    {
        return htmlspecialchars($valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function incorporarImagens(
        PHPMailer $mailer,
        int $assessoriaId,
        array $blocos
    ): array {
        $imagens = [];
        $total = 0;

        foreach ($blocos as $bloco) {
            $url = $bloco['url'] ?? '';

            if ($bloco['tipo'] !== 'imagem' || $url === '') {
                continue;
            }

            $arquivo = ReleaseImagemService::localizar($assessoriaId, $url);

            if ($arquivo === null) {
                continue;
            }

            $cid = basename($arquivo) . '@logos';

            if (!in_array('cid:' . $cid, $imagens, true)) {
                $bytes = filesize($arquivo);

                if ($bytes === false) {
                    throw new \RuntimeException('Não foi possível ler a imagem do release.');
                }

                $total += $bytes;

                if ($total > 15 * 1024 * 1024) {
                    throw new \LengthException(
                        'As imagens carregadas devem somar até 15 MB no e-mail.'
                    );
                }

                $mailer->addEmbeddedImage($arquivo, $cid);
            }

            $imagens[$url] = 'cid:' . $cid;
        }

        return $imagens;
    }

    private static function renderizar(array $blocos, string $primeiraLinha, array $imagens): array
    {
        $html = [];
        $texto = [];

        foreach ($blocos as $bloco) {
            $tipo = $bloco['tipo'];
            $valor = trim($bloco['texto'] ?? '');
            $url = $bloco['url'] ?? '';

            if ($tipo === 'divisor' || $tipo === 'espacamento') {
                $html[] = $tipo === 'divisor'
                    ? '<hr style="margin:16px 0;border:0;border-top:1px solid #d1d5db">'
                    : '<div style="height:12px;line-height:12px">&nbsp;</div>';
                continue;
            }

            if (in_array($tipo, ['imagem', 'botao', 'arquivo'], true)) {
                if ($url === '') {
                    continue;
                }

                $rotulo = $valor !== '' ? $valor : match ($tipo) {
                    'imagem' => 'Imagem da matéria',
                    'arquivo' => 'Arquivo para download',
                    default => 'Saiba mais',
                };
                $link = self::escapar($url);
                $rotuloHtml = self::escapar($rotulo);
                $legenda = trim($bloco['legenda'] ?? '');

                if ($tipo === 'imagem') {
                    $legendaHtml = nl2br(self::escapar($legenda));
                    $src = self::escapar($imagens[$url] ?? $url);
                    $html[] = "<div style=\"margin-bottom:16px\">
                        <img src=\"{$src}\" alt=\"{$rotuloHtml}\" width=\"552\"
                            style=\"display:block;width:100%;max-width:552px;height:auto;border:0\">
                        <div style=\"font-size:12px;color:#475569\">{$legendaHtml}</div>
                    </div>";
                } else {
                    $html[] = "<p style=\"margin:0 0 16px\">
                        <a href=\"{$link}\" style=\"color:#203c99;text-decoration:underline\">{$rotuloHtml}</a>
                    </p>";
                }

                
                $referencia = $tipo === 'imagem' && isset($imagens[$url]) ? '' : "\n" . $url;
                $texto[] = ($legenda === '' ? $rotulo : $legenda) . $referencia;
                continue;
            }

            if ($valor === '') {
                continue;
            }

            $conteudo = nl2br(self::escapar($valor));
            $html[] = match ($tipo) {
                'titulo' => "<h1 style=\"font-size:26px;line-height:1.25;margin:0 0 14px\">{$conteudo}</h1>",
                'linha_fina' => "<p style=\"font-size:17px;color:#475569;margin:0 0 16px\">{$conteudo}</p>",
                default => "<p style=\"margin:0 0 16px\">{$conteudo}</p>",
            };
            $texto[] = $valor;
        }

        if ($texto === []) {
            throw new \InvalidArgumentException('Preencha o conteúdo do release antes de enviar o teste.');
        }

        $preheader = self::escapar($primeiraLinha);
        $conteudo = implode("\n", $html);

        return [
            <<<HTML
            <!doctype html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;background:#f3f4f6">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">{$preheader}</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td align="center" style="padding:16px 0">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                      style="max-width:600px;background:#ffffff">
                    <tr><td style="padding:24px;font:16px/1.6 Arial,sans-serif;color:#172033">
                      {$conteudo}
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            HTML,
            implode("\n\n", $texto),
        ];
    }
}