# Taxa de abertura dos releases

O LOGOS acompanha **aberturas detectadas** por destinatário usando uma imagem transparente individual no e-mail. O carregamento dessa imagem registra a primeira detecção e incrementa um contador de carregamentos.

## Ativação

Configure no `logos-api/.env` uma URL pública HTTPS da API, acessível pelos clientes de e-mail fora da sua rede:

```dotenv
RELEASE_TRACKING_URL="https://api.seudominio.com/LOGOS/logos-api/public"
```

Use o endereço real do servidor, incluindo a pasta base da API quando existir. O serviço utiliza a rota pública `/api/releases/aberturas/{token}`. A API deve responder diretamente com a imagem, sem exigir login, redirecionar para autenticação ou aplicar cache nessa rota.

O endereço precisa continuar acessível enquanto os destinatários puderem abrir as mensagens. O coletor pode ficar no mesmo servidor da API, mas um IP local `192.168…` não atende destinatários fora dessa rede.

Com a variável vazia, o envio de e-mails continua funcionando e os próximos envios ficam sem rastreamento. Um valor preenchido e inválido impede novos processamentos até ser corrigido, para não enviar mensagens silenciosamente sem a coleta esperada.

A configuração afeta as próximas transmissões. Os e-mails já enviados sem o pixel não podem receber rastreamento retroativamente. Dados de envios anteriormente rastreados continuam disponíveis; retirar a configuração não apaga as métricas existentes nem invalida os tokens já emitidos.

O envio de teste e a prévia do template não recebem pixel e não entram nos indicadores de um release.

Verifique a configuração sem enviar e-mails:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\logos-api\bin\gerenciar-releases.ps1" -Acao Verificar
```

Essa verificação valida a configuração e a estrutura do banco; ela não comprova que o endereço público esteja acessível. Após publicar o servidor, confirme também o acesso pela internet.

## Cálculo

```text
taxa = destinatários rastreados aceitos pelo SMTP com abertura detectada
       ÷ destinatários rastreados aceitos pelo SMTP × 100
```

Cada destinatário participa uma vez da taxa. Novos carregamentos do mesmo pixel não aumentam o número de destinatários únicos.

- Envios aceitos sem rastreamento ficam fora da base; a tela informa essa quantidade.
- Envios ainda em transmissão e envios sem confirmação SMTP ficam fora da taxa. Quando há abertura nesses casos, a tela informa isso separadamente.
- Nenhum envio rastreado aceito: taxa indisponível, em vez de `0%`.
- Há envios rastreados aceitos, mas nenhuma abertura detectada: `0%`.
- A identificação de uma abertura não altera os status de envio, falha ou cancelamento.

Nos detalhes do release, o indicador é atualizado enquanto a tela estiver em uso. A consulta é pausada quando o app vai para segundo plano e retomada ao voltar. O indicador é geral do release, independentemente da página ou do filtro da lista de destinatários.

## Precisão

Uma abertura detectada é o carregamento de uma imagem; ela não comprova leitura humana. Proteções de privacidade e filtros de segurança podem carregar imagens automaticamente, e bloqueios de imagens podem impedir o registro. Encaminhamentos e caches também afetam a contagem.

Requisições `HEAD` e requisições explicitamente identificadas como pré-carregamento não são contabilizadas. Isso reduz alguns eventos automáticos, mas não identifica todos os robôs ou proxies de e-mail.

O indicador representa uma estimativa sobre os e-mails aceitos pelo servidor SMTP. Ele não usa entrega confirmada como base, porque a leitura de devoluções posteriores ainda não foi integrada.

## Dados e acesso

Os tokens são aleatórios, individuais e criados pelo processador ao preparar uma transmissão rastreada. O endereço do pixel não contém nome, e-mail ou número do destinatário. A rota retorna a mesma imagem para tokens válidos, inválidos ou desconhecidos, sem expor as métricas ou o resultado da consulta.

A consulta das métricas exige a permissão de visualizar releases e respeita a assessoria do usuário. O coletor não guarda IP ou identificador do navegador.

Os campos `tracking_token`, `aberto_em` e `aberturas_quantidade` já fazem parte do `LOGOS.sql`. Nenhuma migração adicional é necessária em um banco que já possua esses campos e o índice único de `tracking_token`.

## Referências

- [Apple: proteção de privacidade no Mail](https://support.apple.com/en-ca/guide/mail/mlhlp1205/mac)
- [Twilio: eventos de abertura e clique produzidos por sistemas automáticos](https://help.twilio.com/articles/47346148661403-Non-human-Clicks-and-Open-Engagement-Recorded)
