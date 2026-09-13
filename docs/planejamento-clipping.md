**LOGOS — proposta de fluxo e dados do módulo Clipping**

Data: 11/09/2026. Estado: planejamento consolidado; definições de Veículos, Clipping e Anexos revisadas em LOGOS.sql e verificadas em base temporária. A aplicação dessas alterações ao banco principal, a API e as telas permanecem etapas próprias.

**1. Direção informada pelo usuário**

- Releases será a última grande etapa do sistema.
- Clipping seguirá os componentes e padrões visuais de mailing, veículos e clientes.
- A organização preferida é ano → cliente → clippings, com até dois atalhos de clientes na entrada.
- A listagem do grupo reunirá cadastro, pesquisa, filtros, contagem, importação, exportação, detalhes, edição e seleção em lote.
- Categorias representam mídias, como Site e TV, com múltiplos valores permitidos.
- Categorias são livres, com sugestões de mídias padronizadas. O usuário pode adicionar uma sugestão ou escrever outro valor, acumulando itens sem apagar os já selecionados.
- O veículo terá Tier e ajudará a preencher o clipping.
- Relatórios deverão reutilizar dados do clipping e do veículo. A captura futura de páginas terá escolha humana da área da imagem.
- O acesso aos clippings pelo perfil do cliente será incorporado depois que o módulo estiver pronto.
- Cada clipping pertence a um único cliente nesta versão.
- Início e fim são posições dentro de áudio/vídeo, não horários de exibição.
- Tier usa escala de 1 a 3: 1 para veículos mais conhecidos, 2 intermediário e 3 menos conhecidos.
- Após escolher o ano, a tela lista clientes e permite pesquisá-los.
- A listagem oferece escolha entre tabela compacta e cartões compactos em qualquer tamanho de tela, com expansão do item e acesso separado aos detalhes.
- Pauta cumpre o papel de identificação principal. Não acrescentar campo de título ao clipping.
- Link é opcional. Vídeos, imagens e outros arquivos podem ser o material da publicação, enviados manualmente.
- Salvar e adicionar outro preserva cliente/data e limpa veículo/mídias nesta versão. Preferências adicionais ficam para depois.
- Cadastro rápido de veículo pelo clipping inclui descrição e alcance sempre disponíveis, sem preferência para ocultá-los nesta versão. Esses campos continuam opcionais.
- Selecionar todos considera somente registros já carregados pela paginação e respeita o limite de 100.
- O cadastro pode ser salvo com informações pendentes e completado depois, inclusive sem data da publicação, conforme confirmado pelo usuário.
- Pauta oferece sugestões de textos já usados para agilizar novas publicações com pautas repetidas, seguindo o padrão de interação dos seletores existentes.
- A tela de anos inclui “+ Novo clipping”, com escolha de cliente e ano no formulário. O cadastro organiza automaticamente o registro no grupo correspondente.
- Segundo o usuário, Clipping ainda não tem registros e os dados existentes de Veículos e Mailing são descartáveis, podendo ser excluídos caso necessário à implementação. Essa autorização é específica dessas tabelas; não pressupõe descarte dos demais dados do sistema.

**2. Navegação proposta**

Clipping → anos → clientes do ano → listagem do cliente no ano → cadastro ou detalhes.

Atalho adicional: Clipping → “+ Novo clipping” → escolher cliente/ano → preencher o disponível → salvar no grupo correspondente.

- Entrada: ano atual em primeiro lugar, anos anteriores com registros, totais de clippings e clientes com publicações. Os totais devem indicar claramente o que contam.
- Até dois atalhos de acesso recente, com o ano identificado. Preferência por atalhos úteis em vez de clientes escolhidos aleatoriamente para decoração.
- A entrada oferece “+ Novo clipping”, respeitando CLIPPING.CRIAR, e mantém a barra completa de pesquisa, filtros e operações na listagem. A tela intermediária lista e pesquisa clientes, conforme definido pelo usuário.
- O atalho abre o mesmo formulário de cadastro usado dentro dos grupos, com seleção pesquisável de cliente e ano atual sugerido, editável. Se a data da publicação for preenchida, seu ano determina o agrupamento, com indicação de qualquer mudança.
- Permitir escolher/informar um ano ainda sem registros. Ao salvar o primeiro clipping, o agrupamento aparece automaticamente na entrada; não é necessário cadastrar uma pasta separadamente nem copiar clientes para ela. Apenas abrir/cancelar o formulário não cria registros ou grupos persistentes.
- Após salvar pelo atalho, abrir a listagem do cliente/ano de destino. “Salvar e adicionar outro” mantém o formulário com cliente/data e ano de referência correspondentes, pronto para outra publicação.
- Não criar tabelas ou pastas anuais. Guardar ano_referencia em cada clipping: vem do grupo escolhido enquanto a data_publicacao estiver vazia; quando a data é informada, seu ano passa a determinar a referência. Uma correção que mudar o ano avisa sobre o novo grupo antes de salvar e oferece acesso a ele.
- Permitir escolher um ano ainda vazio. O ano atual deve estar acessível mesmo sem registros.
- A tela de clientes de cada ano é preenchida a partir dos clientes já cadastrados. Incluir os ativos com zero registros, permitindo iniciar um grupo, e indicar a quantidade de clippings naquele ano. Clientes com registros podem ser destacados; o usuário nunca precisa criar outra cópia do cliente para um ano diferente.
- Clientes inativos com histórico continuam consultáveis, identificados como inativos. Não perder publicações antigas ao inativar clientes ou veículos.
- Na listagem, mostrar cliente e ano com controles para trocá-los sem retornar por todas as telas.
- Manter busca, filtros, ordenação, página carregada e posição ao retornar dos detalhes. Após uma edição, atualizar dados e contagens sem perder o contexto.
- No futuro, o perfil do cliente abrirá essa mesma listagem com o cliente preenchido. O perfil do veículo poderá abrir uma consulta filtrada, exibindo também o cliente de cada item.

**3. Tela de listagem e seleção**

- Reutilizar Header, SearchBar, feedback, filtros, confirmação de exclusão e os padrões de carregamento e telas vazias.
- Pesquisa em pauta, veículo, programa/seção, mídias, rótulo de Tier, link, observações e nomes dos anexos. Interpretar datas digitadas em formatos reconhecidos quando aplicável. Não prometer pesquisa no conteúdo dos arquivos sem implementar extração de texto.
- Filtros iniciais de mês ou intervalo, veículo, mídia, Tier, existência de link e existência de imagem selecionada para relatório. Incluir “Sem data” para localizar publicações ainda não datadas. Outros filtros poderão ser avaliados no uso.
- Cliente e ano são o contexto visível. Filtros por mês ou intervalo abrangem publicações com data nesse período; registros sem data permanecem acessíveis no grupo anual ou pelo filtro “Sem data”. Limpar filtros de período incompatíveis ao ativar “Sem data”, sem criar uma data fictícia.
- Ordenação inicial por publicação mais recente, com ID como desempate e registros sem data ao final, identificados. Permitir ordenar por veículo e Tier de 1 a 3, deixando os não definidos ao final.
- Mostrar total encontrado e quantidade carregada. Carregar por páginas e usar lista virtualizada para volumes altos; não depender de carregar todos os registros para contar, filtrar ou exportar.
- Cada item mostra data, veículo, pauta, mídias e Tier. Programa/seção e duração aparecem quando preenchidos. Indicar link e materiais com acesso rápido. Se a pauta estiver vazia, usar um rótulo como “Clipping #123 — pauta pendente”, sem criar outro campo de título.
- No contexto de um único cliente, seu nome fica no cabeçalho. Em consultas que misturam clientes, cada item identifica o cliente.
- Oferecer controle explícito para expandir/recolher todas as informações do item e um alvo separado para abrir detalhes, como a pauta ou “Ver detalhes”. Em modo seleção, o checkbox seleciona sem confundir com navegação ou expansão.
- Disponibilizar seletor Tabela / Cartões em celular e telas largas, mantendo os mesmos dados, filtros, seleção e ações. Ambos são compactos; a escolha pode ser lembrada por usuário/dispositivo.
- A tabela em telas estreitas pode usar rolagem horizontal e expansão para campos secundários, preservando tamanho legível. A troca de visualização não reinicia a consulta. A tabela não implica edição de células na primeira versão.
- Seleção é uma capacidade independente da exclusão. Ações aparecem conforme suas próprias permissões: exportar selecionados e excluir agora; adicionar a relatório depois.
- Selecionar todos abrange os registros já carregados pela paginação, até 100 IDs, conforme definido. Não carregar páginas adicionais só para selecionar nem incluir resultados ainda não exibidos. Mostrar a quantidade selecionada e o limite.
- Troca de cliente/ano ou aplicação de nova busca/filtro limpa a seleção com indicação visível; carregamento de mais páginas pode preservar os IDs já selecionados.
- Uma indicação como “sem imagem selecionada” representa uma pendência específica, não uma garantia de que todo clipping com imagem já esteja pronto para relatório.

**4. Cadastro e edição com menos repetição**

- Cliente vem preenchido quando o cadastro é aberto por um grupo; no atalho da tela de anos, é escolhido em um seletor pesquisável. Assessoria, autoria e datas do registro são preenchidas pelo sistema. A data da publicação, quando sugerida, fica visível e editável; em anos históricos não inventar uma data atual fora do período.
- Data da publicação, pauta, veículo, mídias, Tier, programa/seção, posições, link, materiais e observações podem ficar pendentes. Cliente e ano de referência permanecem necessários, recebidos da navegação ou escolhidos no atalho; a assessoria vem da sessão.
- Campos vazios não invalidam o cadastro; valores preenchidos precisam ser válidos. Um link malformado, por exemplo, deve ser corrigido ou removido antes de salvar.
- Separar o formulário visualmente em publicação, veículo/classificação e materiais/detalhes complementares. Descrição e alcance do cadastro rápido do veículo ficam disponíveis sem configuração de ocultação.
- Pauta é o único campo para identificar textualmente a matéria. Não criar título adicional. Clippings incompletos recebem identificação visual pelo ID e indicação das pendências; não gravar um clipping apenas por abrir o formulário.
- Ao focar a pauta, sugerir textos usados recentemente pelo cliente selecionado; ao digitar, filtrar as sugestões. Consultar o histórico autorizado da mesma assessoria/cliente, inclusive de outros anos, com uma lista curta e sem repetições equivalentes.
- Selecionar uma sugestão copia somente o texto da pauta para o novo registro, ainda editável. Não cria vínculo entre pautas nem reaproveita veículo, mídia, datas ou materiais de outro clipping. Alterar o texto de um registro não altera os anteriores.
- Pauta permanece livre e opcional: o usuário pode escrever algo novo, adaptar uma sugestão ou deixar para depois. Se o cliente ainda não foi escolhido no cadastro rápido, permitir digitar, mas apresentar sugestões do histórico somente depois de sua seleção.
- No “Salvar e adicionar outro”, limpar o campo de pauta como os demais dados da matéria. A pauta recém-salva aparece entre as sugestões recentes, permitindo repeti-la com um toque sem copiá-la automaticamente para toda publicação.
- As sugestões podem ser obtidas dos próprios clippings, sem cadastro separado de pautas nesta etapa. Ignorar pautas vazias, agrupar repetições para exibição e manter o texto completo original ao selecionar. Usar consultas limitadas e o mesmo padrão de atraso/cancelamento dos seletores, descartando respostas de outro cliente após uma troca.
- Selecionar veículo preenche Tier; mostra logo, descrição e alcance em um resumo. O formulário de clipping não deve exigir redigitar o cadastro do veículo.
- Tier é uma classificação manual de 1 a 3, com 1 para os mais conhecidos e 3 para os menos conhecidos. Tier vazio permanece “Não definido”. Ao salvar, o clipping registra o valor aplicado; mudanças posteriores no veículo não alteram automaticamente o histórico.
- Se o usuário trocar o veículo durante a edição, apresentar o Tier correspondente e preservar a clareza sobre a alteração antes de salvar.
- Tipos de mídia do veículo, caso implementados, são sugestões para o clipping; não presumir que toda matéria saiu em todos os canais do veículo.
- Programa/seção recebe sugestões de registros anteriores daquele veículo na mesma assessoria. Categorias usam um campo de seleção múltipla livre, com sugestões iniciais como Site, TV, Rádio, Jornal, Revista, Podcast e Redes sociais; essas sugestões não limitam os valores aceitos.
- Cada categoria aparece como um item removível. Selecionar uma sugestão ou confirmar um texto novo adiciona um item, preservando todos os anteriores e limpando apenas o termo usado para procurar/adicionar. O usuário pode continuar digitando e adicionando valores próprios.
- Combinar sugestões iniciais com categorias já usadas no histórico autorizado da assessoria. Remover espaços externos e duplicatas equivalentes, preservando a escrita escolhida. Validar formato, quantidade e tamanho dos itens, sem exigir que pertençam a uma lista fechada.
- Um veículo novo pode ser cadastrado em um fluxo curto sem perder o formulário, respeitando VEICULOS.CRIAR. Disponibilizar nome, descrição, alcance e Tier nesse fluxo. Descrição e alcance continuam opcionais, mas sempre acessíveis, como solicitado. Se o usuário não possui permissão de criar, pode selecionar os existentes ou salvar a pendência permitida.
- Descrição e alcance inseridos para um veículo novo são dados daquele veículo. Ao selecionar um existente, mostrar os valores cadastrados; uma alteração compartilhada exige ação identificada de editar o veículo e VEICULOS.EDITAR. Isso evita alterar o cadastro global de forma implícita ao salvar um clipping.
- O VeiculoSelector atual retorna apenas ID/nome e contém texto específico sobre salvar contatos. Generalizá-lo para o novo contexto, carregando os dados necessários ao preenchimento.
- Mostrar início/fim nos casos de áudio/vídeo como posições no formato HH:MM:SS. Armazenar em segundos e calcular duração no servidor. Permitir salvar apenas uma posição preenchida como informação pendente; duração fica nula até existirem as duas. Quando ambas estiverem preenchidas, início deve ser não negativo e fim maior que início. Se a duração do arquivo for conhecida, o trecho deve caber nela. Não existe virada de dia nesse cálculo.
- Oferecer “Salvar” e “Salvar e adicionar outro”. Na segunda opção, preservar somente cliente e data no contexto do ano. Limpar veículo, mídias, Tier, programa/seção, pauta, posições, link, anexos, observações e o rascunho do cadastro de veículo. Preferências para preservar veículo ou mídia ficam para uma evolução posterior.
- Materiais podem ser enviados sem link, ou complementar um link existente. Manter o original e a imagem de apresentação como papéis distintos; o campo de link não recebe caminho interno de arquivo.
- Não alterar datas silenciosamente: se a data salva pertencer a outro ano, explicar o novo agrupamento e oferecer acesso a ele.
- Preservar alterações não salvas e indicar falhas com os dados do formulário mantidos. Evitar dois cadastros por duplo acionamento de salvar.

**5. Ajustes propostos no banco**

A estrutura existente já relaciona assessoria, cliente e veículo. As chaves compostas mantêm os vínculos dentro da assessoria. Sua execução e integridade deverão ser verificadas no ambiente de desenvolvimento quando houver implementação.

| Local | Proposta | Finalidade |
| --- | --- | --- |
| veiculos | tier numérico, opcional, validado em 1, 2 ou 3 | Valor sugerido no cadastro de clipping. |
| clippings | pauta existente, opcional e pesquisável | Única identificação textual da matéria; não acrescentar título. |
| clippings | data_publicacao opcional e ano_referencia obrigatório | Permitir cadastro sem data, preservando o grupo anual escolhido e mantendo o ano consistente com uma data conhecida. |
| clippings | link, opcional | URL original da publicação. Publicações de TV, rádio ou impressas podem existir sem URL. |
| clippings | observacoes, opcional | Notas internas, separadas da descrição pública do veículo e do conteúdo do relatório. |
| clippings | criado_por, created_at, updated_at | Autoria e datas do registro; data_publicacao continua independente. |
| clippings | tier convertido para a mesma escala numérica | Cópia do Tier usado no registro, sem atualização retroativa automática. |
| clippings | inicio_segundos e fim_segundos, inteiros não negativos opcionais | Substituir os campos TIME por posições de áudio/vídeo; duração é fim menos início, calculada no servidor. |
| clippings | categorias JSON existente | Lista de valores livres, com sugestões padronizadas e inclusão cumulativa; não restringir a um ENUM. |
| clipping_anexos, nova tabela | clipping, assessoria, arquivo, tipo, nome, tamanho, ordem e autoria | Imagens, vídeos, áudios e documentos, inclusive quando a publicação não tem link. |
| clipping_anexos.principal | Marcação opcional 1/NULL com unicidade por clipping | Identifica um material principal, mantendo vários anexos não selecionados. |
| clipping_anexos.imagem_relatorio | Marcação opcional 1/NULL, somente para IMAGEM, única por clipping | Imagem enviada, recorte, página de PDF ou quadro de vídeo escolhido para o slide; pode coincidir com o material principal. |
| clippings | arquivado_em e arquivado_por, opcionais | Retirar da listagem cotidiana preservando referências dos relatórios. Novos registros começam com ambos vazios. |

- Categorias em JSON devem ser uma lista, por exemplo ["Site", "TV", "Canal do produtor"]. O exemplo ["Site, TV, etc"] contém apenas uma string. Validar estrutura, limites e remover repetições, aceitando categorias personalizadas no cadastro e na importação.
- Para consultas por ano e cliente, prever índice iniciado por assessoria_id, cliente_id, ano_referencia e data_publicacao, com desempate por ID conforme a consulta. Avaliar também a consulta por veículo quando esse acesso for criado.
- Proposta: data_publicacao DATE NULL e ano_referencia SMALLINT UNSIGNED NOT NULL. A API usa o ano do contexto quando a data está vazia e sempre deriva o ano da data quando ela é preenchida. Manter essa regra em todas as gravações, incluindo importação e edição; impedir valores contraditórios também no banco, conforme os recursos do ambiente.
- Ao retirar a data de um registro, preservar seu último ano de referência. Ao preencher/corrigir uma data de outro ano, avisar sobre a mudança de grupo e salvar data/ano juntos. O usuário informou que Clipping está vazio; se houver registros quando a alteração for aplicada, conferir o estado e derivar a referência das datas conhecidas.
- Manter cliente_id na tabela: um cliente por clipping foi a prioridade confirmada. Se futuramente a mesma publicação precisar atender a vários clientes, avaliar a separação entre publicação e seus vínculos com clientes nessa etapa.
- Início/fim representam posições de mídia, conforme confirmado. Proposta de tipo: INT UNSIGNED para as posições e duração; a interface converte entre segundos e HH:MM:SS.
- Tier pode usar TINYINT UNSIGNED opcional, com validação de domínio 1 a 3 na API e restrição equivalente no banco compatível com o ambiente. Não preencher registros antigos com Tier 1 por padrão.
- A ausência de clippings informada pelo usuário permite ajustar os tipos antes de iniciar os cadastros. Conferir o estado do banco na execução para evitar usar uma suposição que tenha deixado de valer.
- Gravar alterações de clipping e anexos de forma consistente; um erro de upload deve permitir nova tentativa sem perder o cadastro.
- Manter LOGOS.sql atualizado como referência e preparar a alteração do banco existente. Os dados de Veículos/Mailing podem ser descartados se necessário, conforme autorizado; a exclusão não é obrigatória para acrescentar Tier. Preservar as edições existentes no SQL e os dados dos demais módulos.

**6. Importação, exportação e duplicatas**

- Primeira entrega: CSV com modelo para download e prévia antes de importar. Importação direta de XLSX pode ser adicionada depois se houver necessidade concreta.
- Cliente pode vir do contexto atual. Datas conhecidas do arquivo definem os anos. Sem data, usar ano de referência explícito no arquivo ou o ano selecionado, indicando isso na prévia; avisar quando o arquivo contém publicações fora do ano selecionado e permitir revisar antes de importar.
- Mostrar linhas válidas, campos faltantes, possíveis duplicatas e veículos não encontrados. Oferecer resolução explícita dos vínculos em vez de criar nomes incorretos silenciosamente.
- Importar usa as mesmas validações e regras de Tier do cadastro manual. Tier informado no arquivo preserva o histórico; na ausência dele, o Tier atual do veículo só deve ser aplicado mediante regra visível na prévia.
- Primeiro sinal de possível duplicidade: mesmo cliente e link normalizado, dentro da assessoria. Sem link, comparar data, veículo e pauta como alerta aproximado, somente quando houver informação suficiente. Dados ausentes ou nomes semelhantes não bastam para excluir uma linha automaticamente.
- Pautas repetidas são parte do fluxo esperado. A repetição isolada da pauta não representa clipping duplicado nem deve bloquear cadastro ou importação; permitir revisar alertas que combinem vários indícios.
- Não usar URL globalmente única: uma publicação pode ser relevante para mais de um cliente, e links de programas podem servir a trechos distintos.
- Normalização de links deve preservar parâmetros que identificam conteúdo. Manter o endereço original para navegação e rastreabilidade.
- Na exportação, distinguir “Exportar selecionados”, limitado à seleção de até 100 IDs carregados, de “Exportar resultados”, que consulta todos os registros do filtro no servidor. O limite da seleção não equivale ao tamanho total de uma exportação por filtro.
- Conferência do código atual: exportarMailing limpa o modo seleção e envia busca/filtros para a API, sem os IDs selecionados. Exportação de selecionados e prévia de importação ficam registradas como melhorias futuras do mailing, fora da implementação de Clipping.
- CSV exporta dados tabulares e referências aos materiais. Uma exportação com os arquivos de imagem requer um pacote próprio em etapa posterior.
- Categorias e datas devem manter formatos documentados na ida e volta do CSV. Diferenciar ausência de informação de valor zero, inclusive duração.
- Categorias personalizadas devem ser mantidas na exportação/reimportação e aparecer nos filtros; não rejeitar uma mídia somente por estar fora das sugestões iniciais.
- Exportar ano_referencia junto da data para que clippings sem data retornem ao grupo correto em uma reimportação.

**7. Origem dos dados do slide apresentado**

| Elemento do slide | Origem proposta |
| --- | --- |
| Logo do veículo | Cadastro do veículo. |
| Nome do veículo | Cadastro do veículo associado ao clipping. |
| Descrição | Cadastro do veículo. |
| Alcance em texto | Cadastro do veículo. |
| Link da publicação | Clipping. |
| Print, recorte ou imagem enviada | Anexo do clipping escolhido para o relatório. |
| Página de documento ou quadro de vídeo | Prévia gerada do arquivo original e escolhida pelo usuário. |
| Logo da assessoria | Cadastro da assessoria, caso este seja o papel da marca no modelo. |
| Data, Tier e outros dados de identificação | Clipping, quando necessários ao modelo. |

- Ao criar um slide, copiar os dados usados para o relatório. O usuário pode ajustar texto, link, imagem e enquadramento daquele slide sem alterar o cadastro do veículo nem outros relatórios.
- Preservar também as imagens usadas. Guardar só o caminho do logo atual é insuficiente se a atualização do veículo apagar o arquivo anterior.
- Relatórios salvos não mudam silenciosamente quando o veículo ou clipping é editado. Uma atualização a partir da origem deve ser explícita, com prévia.
- Editar um clipping permanece permitido mesmo quando ele já é usado em relatórios. O vínculo protege o histórico e não bloqueia a correção do cadastro.
- Quando a edição começar dentro de um relatório, oferecer “Salvar clipping” e “Salvar clipping e atualizar este relatório”, respeitando as permissões de ambas as operações.
- Quando a edição começar nos detalhes gerais, “Salvar” atualiza a origem; “Atualizar relatórios vinculados” permite escolher quais relatórios e campos receberão a alteração. Não atualizar todos automaticamente.
- Na atualização de relatório, comparar campos e preservar por padrão recortes, textos personalizados e organização do slide. Exibir a prévia das substituições antes de aplicar.
- Guardar revisão anterior dos dados e das imagens do relatório e gerar nova versão do arquivo exportado. Um PDF ou PPTX já baixado não é alterado; o usuário recebe uma nova versão para baixar.
- Informar o resultado de cada etapa. Se o clipping foi salvo e a atualização/geração do relatório falhou, manter a versão anterior do relatório e permitir tentar novamente, sem anunciar atualização completa.
- O mesmo clipping pode aparecer em vários relatórios e, se necessário, gerar mais de um slide com recortes diferentes.
- Alcance atual é texto com métricas diversas, como seguidores por rede. Reutilizar o texto; não apresentar a soma de métricas diferentes como audiência total.
- Definir uma área de imagem no modelo e oferecer prévia para evitar deformação, corte involuntário e texto ilegível. Links longos podem aparecer como “Acessar publicação”, mantendo o endereço clicável, conforme a preferência do relatório.
- Para o modelo estático apresentado: imagem pode entrar diretamente; PDF precisa de página/recorte escolhido; vídeo pode fornecer um quadro escolhido e referência ao arquivo/trecho; outros arquivos permanecem acessíveis por referência com uma representação visual apropriada. Incorporar vídeo reproduzível no PPTX é uma opção específica de formato para avaliar posteriormente, não um comportamento prometido para todo relatório.
- Vídeos e documentos grandes devem ser enviados separadamente dos campos de texto, com progresso, limites definidos na implementação e prévias leves. A listagem não baixa nem reproduz arquivos inteiros automaticamente.

**8. Captura assistida de páginas — evolução posterior**

Fluxo proposto: link salvo no clipping → solicitar captura → visualizar a página capturada → selecionar a área desejada → salvar recorte → escolher imagem para relatório.

- O material pertence ao clipping. A mesma ação poderá ser acionada na criação/edição do clipping ou durante a montagem de um relatório, reaproveitando o recorte já salvo. É opcional e sua implementação fica para o final do módulo ou para a etapa de relatórios, conforme fizer mais sentido.
- A captura pode usar um navegador de processamento para renderizar a página e devolver uma imagem. Playwright documenta capturas completas, de elementos e com área recortada: https://playwright.dev/docs/screenshots.
- A seleção humana atua sobre a prévia capturada, preservando a intenção do usuário de excluir anúncios e conteúdo irrelevante da imagem.
- Não depender de incorporar qualquer jornal diretamente em um iframe: sites podem restringir incorporação pelo navegador. Referência: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options.
- Validar a solução em veículos reais antes de prometer cobertura. Falhas de carregamento, acesso restrito e páginas alteradas devem permitir nova tentativa, acesso à origem e upload manual de print.
- Não contornar login, assinaturas ou bloqueios de acesso. A captura automatizada não é condição para salvar o clipping.
- Na implantação dessa função, limitar o serviço a URLs públicas permitidas, revalidar redirecionamentos, limitar tempo/tamanho e isolar o navegador da rede interna e de credenciais do sistema.
- Guardar origem, data da captura, dimensões e relação entre original e recorte para permitir novo enquadramento. Definir retenção para imagens grandes.
- Sugestões de pauta, veículo e data extraídas da página são uma evolução separada, sempre revisáveis e sem substituir dados digitados silenciosamente.

Consumo e otimizações propostas:

- Capturar envolve carregar uma página e renderizá-la em um navegador: há uso de rede, CPU, memória e armazenamento. O custo real depende dos sites, dimensões e simultaneidade; não há medição de carga neste planejamento.
- Executar somente após pedido do usuário, nunca ao abrir a listagem ou automaticamente a cada salvamento. Recortar novamente uma imagem já salva não exige outra visita ao site.
- Processar em fila, com baixa concorrência inicial e limites de tempo, dimensões e tamanho. Medir para ajustar a quantidade de capturas simultâneas.
- Separar o processamento de captura das requisições normais da API. Se ambos rodarem no mesmo computador XAMPP, continuam compartilhando CPU e memória; hospedar o processador em outra máquina pode isolar esse consumo quando necessário.
- Reutilizar captura existente do clipping e permitir atualização explícita, registrando data e origem. Nunca tratar arquivos referenciados por relatórios como cache descartável.
- Interceptar requisições para bloquear anúncios/rastreadores conhecidos ou mídia desnecessária, preservando imagens e recursos que compõem a matéria. Validar por veículo e permitir nova tentativa sem essas otimizações se a página ficar incompleta. Playwright oferece controle de requisições: https://playwright.dev/docs/network.
- Controlar resolução, área e compressão da captura, mantendo legibilidade do texto; essas opções estão documentadas em https://playwright.dev/docs/api/class-page#page-screenshot. Evitar páginas de altura ilimitada e disponibilizar ampliação da área quando necessário.
- Entregar miniaturas na listagem e prévias adequadas ao recorte; carregar originais somente quando necessários. Medir duração, bytes transferidos, memória e taxa de falhas antes de definir capacidade.

**9. Regras de integração e histórico**

- Contagens, pesquisas, sugestões, arquivos e ações em lote respeitam a assessoria autenticada e as permissões do usuário.
- O usuário com CLIPPING.CRIAR precisa conseguir selecionar clientes/veículos autorizados para esse fluxo, mesmo sem acesso ao CRUD completo desses módulos. Definir consultas de seleção com dados mínimos; isso não concede permissões administrativas.
- As permissões CLIPPING.VISUALIZAR, CRIAR, EDITAR, EXCLUIR, IMPORTAR e EXPORTAR já estão previstas. Relatórios continuam exigindo suas próprias permissões.
- Veículos e clientes vinculados a clippings mantêm proteção de exclusão. A mensagem atual de veículos menciona só contatos e precisará incluir clippings quando aplicável.
- Proposta de exclusão protegida: um clipping sem vínculos que exijam preservação pode ser excluído após confirmação. Se for usado por um relatório ou versão preservada, bloquear a exclusão física e informar os relatórios dependentes; isso já é compatível com a proteção RESTRICT prevista no vínculo dos slides.
- Recomenda-se oferecer “Arquivar” para retirar um clipping protegido da listagem padrão, mantendo-o nos relatórios, com acesso por filtro de arquivados e possibilidade de restauração. Arquivar não altera os slides nem apaga seus arquivos. Aplicar permissões explícitas a arquivamento e restauração.
- Exemplo de lote: de 10 selecionados, 7 sem vínculos podem ser excluídos e 3 usados em relatórios permanecem protegidos. Apresentar essa divisão antes da confirmação e permitir arquivar os protegidos como ação própria, nunca automaticamente.
- Conferir as dependências novamente ao gravar, inclusive em situações concorrentes. Se um novo relatório vinculou o registro após a prévia, informar o bloqueio real no resultado.
- Arquivos são removidos fisicamente somente quando não forem necessários por nenhum clipping, slide ou versão preservada. Retirar um anexo do cadastro atual não pode quebrar uma versão anterior do relatório.
- Edições concorrentes devem detectar registro alterado desde a abertura, usando sua versão/data de atualização, e permitir recarregar sem sobrescrever o trabalho de outra pessoa inadvertidamente.
- Registros sem pauta, anexos, veículo ou outros campos continuam visíveis com identificação pelo ID e pendências específicas. Salvar o cadastro não exige preencher todos os dados do futuro relatório. A montagem usa o disponível e mostra os elementos ainda pendentes.

**10. Sequência recomendada de entrega**

1. Aplicar ao desenho de dados as definições confirmadas: um cliente por clipping, posições em segundos, Tier de 1 a 3 e data opcional com ano de referência; preparar migração incremental.
2. Implementar consultas de agrupamento, seleção de clientes/veículos, sugestões de pautas por cliente e operações de clipping com permissões.
3. Construir navegação por ano/cliente, atalho “+ Novo clipping” na entrada, pesquisa de clientes, visualizações Tabela/Cartões, expansão, cadastro com pendências, detalhes, edição e preenchimento automático.
4. Completar envio manual de materiais, imagem padrão, importação/exportação e seleção em lote de até 100 carregados; validar volumes e salvar/adicionar outro preservando somente cliente/data.
5. Integrar o acesso pelo cliente/veículo e a preparação dos materiais para relatórios.
6. Implementar geração e edição dos relatórios; validar o modelo visual com dados reais.
7. Incorporar captura assistida e sugestões extraídas de páginas como evolução que não bloqueia o fluxo manual.

O desenho das telas seguirá o fluxo consolidado nesta conversa. Cargo do usuário permanece uma melhoria independente, sem bloquear Clipping.

**11. Critérios de aceitação para a implementação**

- Criar o primeiro clipping de um cliente e de um ano sem registros anteriores.
- Criar pelo atalho da tela de anos, selecionar um cliente já cadastrado e um ano sem registros, salvar e encontrar o clipping no agrupamento correto, com contagens atualizadas. Cancelar o formulário sem criar registros.
- Listar clientes automaticamente em cada ano, inclusive ativos sem clippings, sem cadastrar novamente os clientes.
- Salvar sem data em um ano escolhido, exibir “Data pendente”, localizar pelo filtro “Sem data” e manter o ano ao exportar/importar. Preencher uma data de outro ano e mover o agrupamento de forma explícita e consistente.
- Importar publicações antigas e vê-las no ano correto; corrigir data e atualizar grupos e contagens.
- Usar busca, filtros, paginação e retorno dos detalhes sem perder contexto.
- Registrar vários clippings seguidos preservando somente cliente/data e limpando pauta, veículo, mídias, Tier, link, anexos e demais dados específicos.
- Sugerir pautas recentes do cliente escolhido, inclusive de outros anos; repetir uma delas, editar o texto e verificar que os outros registros permanecem iguais. Não mostrar histórico de outro cliente/assessoria nem copiar dados adicionais.
- Após salvar e adicionar outro, apresentar a pauta anterior como sugestão, com campo inicialmente limpo. A troca de cliente atualiza as sugestões e mantém textos já digitados pelo usuário.
- Aplicar Tier do veículo no cadastro e preservar Tier histórico após reclassificação.
- Adicionar Site, TV e uma categoria personalizada em sequência, remover somente um item e salvar os restantes. Reimportar os mesmos valores sem restringi-los às sugestões iniciais.
- Calcular duração por posições em segundos: por exemplo, 00:02:10 até 00:03:45 produz 95 segundos; rejeitar fim menor ou igual ao início.
- Permitir uma posição pendente com duração nula; permitir salvar pauta, veículo, mídia e materiais ausentes. Validar valores preenchidos e manter as pendências visíveis.
- Alternar Tabela/Cartões no celular e em telas largas sem perder filtros/seleção; expandir um item e acessar detalhes por controles distintos.
- Cadastrar veículo pelo clipping com descrição/alcance disponíveis e preservar o formulário se a operação falhar.
- Salvar um arquivo como material da publicação sem exigir link; preparar imagem, página ou quadro escolhido para o modelo de relatório.
- Mostrar todos os campos preenchidos pela expansão/detalhes e permitir exportá-los.
- Resolver veículos desconhecidos e possíveis duplicatas na importação; exportar todos os resultados do filtro.
- Impedir acesso a dados e arquivos de outra assessoria, inclusive por IDs enviados manualmente.
- Selecionar/exportar sem exigir permissão de excluir; validar limites e registros protegidos em lotes.
- Preservar dados e imagens de relatórios existentes quando sua origem for alterada.
- Atualizar somente os relatórios/campos escolhidos, preservando a versão anterior; uma falha de geração não deve destruir o relatório existente nem ser apresentada como sucesso.
- Caso o arquivamento seja adotado, ocultar da listagem padrão, preservar os relatórios e permitir consultar/restaurar conforme permissão.
- Abrir e testar o fluxo em celular e tela larga, incluindo listas grandes, falhas de rede e formulário parcialmente preenchido.

**12. Decisões confirmadas pelo usuário nesta conversa**

1. Um cliente por publicação, priorizando o padrão atual. Vínculos com vários clientes ficam para uma necessidade futura.
2. Início e fim são posições dentro de áudio/vídeo.
3. Tier 1 a 3, dos veículos mais conhecidos aos menos conhecidos.
4. Pesquisa de clientes após selecionar ano; modos Tabela/Cartões selecionáveis também no celular.
5. Pauta cumpre o papel de título; não adicionar outro campo de título.
6. Arquivos podem representar a publicação sem link; envio manual permanece disponível.
7. Salvar e adicionar outro mantém cliente/data e limpa veículo/mídias.
8. Descrição e alcance ficam disponíveis no cadastro rápido de veículo pelo clipping.
9. Seleção em lote considera apenas os registros carregados e no máximo 100.
10. Dados podem ficar pendentes e ser completados depois; captura assistida é opcional e pode ser implementada ao final ou durante Relatórios.
11. Data da publicação também é opcional. O sistema preservará o ano selecionado para organizar o clipping enquanto ela estiver pendente.
12. Relembrar pautas utilizadas em novos cadastros por meio de sugestões, de forma semelhante ao seletor de veículos.
13. Incluir “+ Novo clipping” na tela de anos, com seleção de cliente/ano e organização automática nos grupos correspondentes.
14. Categorias livres em seleção cumulativa com sugestões, permitindo valores personalizados.
15. Clipping está vazio segundo o usuário; os dados de Veículos/Mailing são descartáveis caso a implementação precise removê-los.

As definições acima foram incorporadas ao documento, incluindo a concordância do usuário em seguir com as ideias discutidas. As regras descritas orientam a implementação por etapas; captura continua opcional e prevista para o momento adequado.

**13. Exemplo de cadastro com data pendente**

Ao abrir Clipping → 2026 → Cliente A, salvar pauta/arquivo ou outras informações disponíveis sem preencher a data. O registro permanece no cliente e ano escolhidos, identificado como “Data pendente”. Se posteriormente receber a data 15/12/2025, o sistema informa que será organizado em 2025 e grava data/ano juntos. Nenhuma data de publicação é inventada para viabilizar o cadastro.

**14. Revisão do SQL realizada**

- Corrigido arquivado_em para DEFAULT NULL; CURRENT_TIMESTAMP marcaria novos registros como arquivados.
- Acrescentadas chaves de criado_por/arquivado_por no contexto da assessoria, Engine InnoDB explícito e índice por cliente/ano/arquivamento/data.
- CHECKs validam Tier 1–3, ano válido e compatível com a data, categorias como array e duração consistente, aceitando posições incompletas com duração nula.
- clipping_anexos registra tipo/origem, caminho, nome, MIME, tamanho, ordem, autoria, origem de capturas, metadados de recortes e relação com o arquivo original do mesmo clipping.
- Principal e imagem_relatorio usam 1 para selecionado e NULL para não selecionado. Índices únicos garantem no máximo um de cada por clipping. A troca exige limpar a marcação anterior e selecionar a nova na mesma transação; não usar 0.
- As relações dos anexos usam RESTRICT. O serviço de exclusão deve verificar relatórios/versões, tratar recortes antes dos originais e remover os registros elegíveis em transação; a remoção física de arquivos depende das referências preservadas. O esquema atual de slides protege o clipping, mas ainda não possui referência direta ao anexo ou versionamento de arquivos: esses recursos pertencem à etapa de Relatórios.
- A API ainda precisa validar conteúdo real dos arquivos, caminhos de armazenamento, MIME/tamanho permitido, textos das categorias, ciclos na relação original/recorte e preenchimento conjunto de arquivado_em/arquivado_por. CHECK e FK não substituem essas regras de aplicação.
- Validação executada por logos-api/tests/schema_clipping.php: criação do SQL completo e 88 verificações no MariaDB 10.4.32, incluindo persistência e validação de Tier na API, em base aleatória removida ao final. O teste não altera a base logos.
- Para MySQL, os CHECKs exigem 8.0.16 ou superior; referência: https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html. Não foi executado um servidor MySQL nesta verificação.

**15. Tier em veículos implementado em 12/09/2026**

- Campo opcional no cadastro e na edição, com opções Não definido, Tier 1, Tier 2 e Tier 3. A edição sinaliza alterações pendentes e permite limpar a classificação.
- Tier exibido na listagem, nos detalhes e nas sugestões do seletor de veículos.
- API recebe números em JSON ou texto em formulário com logo, aceita null/vazio para limpar e rejeita valores fora de 1–3. Edições que omitem o campo preservam o valor anterior; cadastro automático pelo mailing continua compatível.
- Migração logos-api/migrations/20260912_veiculos_tier.sql aplicada à base local, preservando os veículos existentes. Para outra base já existente, executar a migração uma vez antes de publicar a API; bases novas usam LOGOS.sql.
- Validados tipos do aplicativo, sintaxe PHP, regras de banco/serviço e fluxo no navegador: criar, editar, limpar Tier, salvar junto com logo e limpar ambos. Seletor conferido em largura de 390 pixels e com estado selecionado acessível. Conta, veículo e logo temporários de verificação removidos ao final.
- A base local ainda usa a versão antiga de clippings e não possui clipping_anexos. O arquivo LOGOS.sql contém a estrutura aprovada; sincronizar essas tabelas na etapa de implementação do Clipping, sem reimportar indiscriminadamente a base inteira.
