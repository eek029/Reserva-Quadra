Reserva Quadra Esportiva Complexo Júlio Prestes


Descrição do sistema: Sistema completo para gestão de reservas da quadra, com autenticação Google, Apple, E-Mail, regras de negócios complexas (limites, blackouts) e notificações.

Descrição da situação: Em São Paulo, no Complexo Júlio Prestes tem uns 8 a 10 condomínios de prédios residenciais e dentre esses há 5 condomínios que usam a mesma quadra de esportes. Atualmente, a subsíndica da Torre 5 também é a Síndica Geral, então o gerenciamento da quadra é feito através da portaria da Torre 5 (vou chamar de T5). O gerenciamento é feito da seguinte forma: O morador vem até a portaria da T5 e vê se tem horário vago no dia que ela quer utilizar a quadra. Se estiver livre, ela deixa o horário e dia agendados e faltando uns 15 minutos antes de iniciar a sua reserva, o morador vem à portaria e retira a chave.

Problemas: fazemos as reservas no caderno e sempre dá confusão, não temos como verificar todas as datas reservadas porque são muitas reservas e também tem o nosso trabalho na portaria que já é muito cansativo. Conseguimos gerenciar somente as reservas do dia sem muitos problemas. Outro problema é a identificação das pessoas que vêm pegar a chave, porque não temos como ter certeza se essa pessoa é moradora de uma das torres ou não. Ainda sim, nem todas as torres têm acesso à quadra, somente as torres 1 à 5.

Descrição do Frontend (Vercel): Next.js 14 + Tailwind (ou o que achar melhor)

Tela inicial - é a homepage do app. Servirá como tela de login/cadastro do usuário. Ela deverá levar o usuário ao dashboard ou a tela de cadastro.
Tela de cadastro - onde os usuários criarão e/ou editarão seu cadastro no sistema inserindo os seus dados pessoais.
Dashboard - coração do sistema. É onde aparecem os dias e horários livres e ocupados, onde os moradores poderão agendar e/ou verificar a reserva da quadra.

Tela inicial: O nome é Reserva Quadra Complexo Júlio Prestes e acima do nome tem uma logo pequena da imagem do complexo Júlio Prestes. Abaixo do nome escrito “Agende seu horário, gerencie reservas e receba notificações.” Abaixo: “Acesso restrito a moradores e administração.”
A tela de login logo abaixo teria os campos “Email”, “Senha”. Na linha de baixo uma caixa de seleção e escrito ao lado “Lembrar-me” alinhado à esquerda e alinhado à direita “Esqueceu a senha?”. Na linha abaixo o botão “Entrar na Conta”. Na linha abaixo: “—-------------------ou —------------------”. Na linha abaixo botão pra entrar com Google e Apple. Na linha abaixo ‘Não tem uma conta? Cadastre-se aqui”
O flutter seria: 2026 eek029 Sistemas e Automação
E logo abaixo teriam o logo do Telegram e X, mas eles são links que levam para as minhas contas: https://t.me/eek029 e https://x.com/eek029
Segue imagens de como eu quero: (Não consigo colocar imagens aqui, então coloquei essas 2 imagens de exemplo na pasta raiz do projeto, os nomes são img1.jpeg e img2.jpeg)




Tela de cadastro: essa é a página em que os usuários colocarão os seus dados pessoais necessários para acesso ao sistema. Os dados são: Nome completo, RG, CPF, data de nascimento, telefone celular, apartamento, torre e foto. No campo “torre”, se a torre escolhida for a 5, acrescentar um campo com o bloco, pois a Torre 5 tem dois blocos o “A” e o “B”. Tem caixas de seleção para o usuário marcar o seu cargo. Serão 3 caixas de seleção de cargo: “Porteiro”, “Subsíndico” e “Síndico Geral”. Se o cargo selecionado for “Porteiro”, não há necessidade de preencher os campos “Apt”, “Torre”. Ao finalizar o cadastro o usuário receberá a mensagem que o cadastro está pendente de aprovação da administração, ou pode ser direcionado para uma página com a mensagem que o cadastro está pendente de aprovação da administração. Essa tela de cadastro após a aprovação (aprovação essa dada pelo porteiro e subsíndico da torre correspondente ou síndico geral) poderá ser acessada através do dashboard e terá a finalidade de alterar os dados do usuário, se ele assim desejar.

Dashboard: ao efetuar e/ou terminar o cadastro e/ou login, o usuário entra no dashboard. 
Haverá 3 tipos de dashboards: o do Síndico Geral e Sub-síndico, o dos porteiros e o dos usuários (moradores).

- O usuário (morador): deve visualizar alguns dias e horários livres e ocupados de reservas. O nome do app deve aparecer no topo junto com o logo pequeno. Tem que ter 3 botões na parte de baixo: Nova Reserva, Minhas Reservas e Calendário; e 2 ícones pequenos ou botões pequenos no topo da página alinhados à direita: Regras (ao passar o mouse deve aparecer “Regras de Utilização da Quadra”) e Perfil.

Nova Reserva - abre uma nova página com um calendário para a pessoa reservar. O usuário escolhe o dia e os horários pra reservar, clica em agendar. Aparece um modal (pop-up) na tela:
Antes de confirmar: Ao reservar, você concorda que:
👟 Usará tênis adequado e não entrará com bike/skate/patins.
🔇 Respeitará a lei do silêncio.
🌧️ A reserva será cancelada em caso de chuva.
🧹 Recolherá seu lixo ao sair.
      [ ] Li e concordo com as Regras Completas. (Obs.: “Regras Completas” deve ser um link que quando o usuário clicar será levado à página “Regras”). 

	Log de aceite: Quando o usuário marcar o checkbox e clicar em "Confirmar", o sistema não deve apenas criar a reserva. Ele deve salvar um registro desse "aceite". Exemplo: 
JSON
{
  "reserva_id": 1023,
  "usuario_id": 45,
  "data_reserva": "2024-05-20",
  "aceite_termos": true,
  "versao_termos": "v1.0", // Importante caso as regras mudem no futuro
  "timestamp_aceite": "2024-05-18T14:30:00Z"
}
Minhas Reservas - abre uma página com todas as datas e horários reservados do usuário que está logado.
Calendário - abre uma tela com um calendário (abre inicialmente no mês vigente) com todas as reservas efetuadas, horários vagos, horários bloqueados, agendamentos cancelados, etc.
Regras (Regras de Utilização da Quadra) - abre uma página com todas as regras de utilização da quadra. As regras são:
Horário e Reservas: A quadra funciona das 09h às 22h. Apenas moradores das torres 1 a 5, maiores de 18 anos e com cadastro atualizado, podem realizar a reserva, com período máximo de utilização de 2 horas por dia, por unidade.
Responsabilidade: O morador titular da reserva é integralmente responsável pela conservação do espaço e pela conduta dos presentes. Caso haja menores de idade, a permanência do titular na quadra é obrigatória durante todo o período.
Segurança e Chuva: Por questões de segurança, é proibida a utilização da quadra em dias chuvosos ou enquanto o piso estiver molhado. Cabe aos usuários garantir que o local esteja seco antes do início da atividade.
Preservação do Piso: Para evitar danos à pintura e ao piso, é estritamente proibido o uso de bicicletas, patins, skates ou similares dentro da quadra.
Limpeza: Ao final do período reservado, é dever do morador recolher todo o lixo gerado (garrafas, embalagens, etc.) e deixar o local organizado para o próximo usuário.
Lei do Silêncio e Convivência: Barulhos excessivos, gritaria ou uso de caixas de som em volume alto são passíveis de advertência e multa, conforme o Regimento Interno, podendo acarretar a suspensão do direito de reserva.
Perfil - abre uma página com os dados cadastrados do usuário/morador. O usuário/morador poderá alterar alguns dados no perfil (RG e celular). Nome, foto, CPF, apt e torre podem ser alterados, mas só serão validados após autorização do subsíndico da torre correspondente ou pelo síndico geral. No caso da alteração ser de torre, o subsíndico da outra torre escolhida poderá autorizar a também (acontece em casos de mudança para outra torre no Complexo Júlio Prestes).

- Porteiro: o dashboard do porteiro será igual ao dos moradores, mas com as permissões a ele cabidas. Cada porteiro só receber as notificações durante o plantão dele. Como vocês usam 12x36 começando 07:00,

- Síndico Geral / Sub-Síndico: o dashboard a dos moradores, mas com as permissões e poderes a eles cabidas. 

Obs.: O dashboard também tem que ter um local para receber as notificações do sistema como: lembrete de 15 min para começar a reserva, mensagens dos porteiros, subsíndicos e síndico geral. 

Abaixo segue foto do modelo (Não consigo colocar imagens aqui, então coloquei essa imagem de exemplo na pasta raiz do projeto, o nome é img3.png)





Backend (serveless):

Framework: FastAPI (Adaptado para Serverless Function na Vercel).
Processamento: Síncrono (Envio de e-mails direto na requisição) ou via Supabase Edge Functions.

Banco de Dados & Auth (Supabase):
DB: PostgreSQL.
Auth: Supabase Auth.

	Deixei o Backend e o Banco de Dados por último porque os dois se misturam, né? Abaixo descrição dos cargos (roles), horário de funcionamento da quadra, períodos de reserva, tempo máximo de reserva de cada unidade/morador/usuário.

	Criptografia de Coluna: Aqui usamos o banco de dados para criptografar os dados sensíveis (CPF, Telefone). Mesmo se você der um SELECT *, você verá apenas "lixo" (caracteres aleatórios).
	O Supabase/Postgres tem uma extensão chamada pgcrypto. Como funciona a lógica:
O usuário envia o CPF.
O Banco criptografa usando uma "Chave Mestra" que fica guardada nas Variáveis de Ambiente (.env) do servidor, não no banco.
Você (Admin do Banco) vê: \xc30d040...
O App (que tem a chave no .env) consegue descriptografar e mostrar para o Síndico Geral. Exemplo:

SQL
-- 1. Habilita a extensão de criptografia
create extension if not exists pgcrypto;

-- 2. Na hora de INSERIR (no seu FastAPI ou Trigger):
INSERT INTO moradores (nome, cpf_criptografado)
VALUES (
  'João da Silva',
  pgp_sym_encrypt('123.456.789-00', 'MINHA_CHAVE_SECRETA_SUPER_SEGURA')
);

-- 3. Na hora de LER (Só quem tem a chave vê):
SELECT 
  nome, 
  pgp_sym_decrypt(cpf_criptografado, 'MINHA_CHAVE_SECRETA_SUPER_SEGURA') as cpf
FROM moradores;

Segurança: Se você entrar no painel do Supabase sem a chave (que está no Railway/Vercel), você não lê nada.


Horário de Funcionamento: A quadra funciona das 09h às 22h.
Períodos de reserva da quadra: A quadra pode ser reservada por períodos de 1h (exemplo: das 9h às 10h, das 16h às 17h).
Cada unidade/morador/usuário pode reservar no máximo 2h por dia, podendo ser reservas seguidas ou intercaladas (exemplo: unidade 101 da torre 2 reservou a quadra das 14h às 16h - 2h seguidas; unidade 205 da torre 4 reservou a quadra das 11h às 12h e depois reservou das 21h às 22h do mesmo dia - intercaladas).
Cargos: 
Morador: pode reservar a quadra se for maior de 18 anos no limite máximo de 2h por dia.
Porteiros: tem poder de reservar a quadra para moradores acima de 18 anos, e autorizar o cadastro de moradores que ele conhece, ou seja, da torre a qual ele pertence (ou trabalha). Pode mandar mensagem pro morador que estiver com a quadra reservada no momento.
Subsíndicos: tem poder de reservar a quadra, autorizar o cadastro de moradores da sua respectiva torre, cadastrar e autorizar porteiros da sua torre. Pode mandar mensagem pro morador que estiver com a quadra reservada no momento e para todos os moradores da sua torre.
Síndico Geral: tem poder de reservar a quadra, autorizar o cadastro de qualquer morador, cadastrar todos os porteiros e subsíndicos, pode cancelar qualquer reserva e mandar mensagem para todos que estejam cadastrados no sistema.
Acesso: Tem acesso aos dados descriptografados (via App) para resolver problemas do dia a dia.
Dev/System Admin: Cuida da Infraestrutura. Garante que o servidor está de pé.
Acesso: Tem acesso ao Banco, mas vê dados sensíveis criptografados.


LGPD: 

	Para informar que seu aplicativo está em conformidade com a LGPD (Lei Geral de Proteção de Dados) em 2026, você deve focar em transparência e consentimento explícito.
Aqui estão as formas padrão de implementar essa comunicação:

1. Banner de Consentimento (Cookies e Dados): Ao abrir o app pela primeira vez, exiba um aviso claro. Não use apenas um botão "OK"; ofereça opções.
Texto sugerido: "Valorizamos sua privacidade. Utilizamos dados para melhorar sua experiência e garantir a segurança do serviço, conforme a LGPD. Ao continuar, você concorda com nossa Política de Privacidade."
Ação: Inclua botões para "Aceitar Todos" e "Gerenciar Preferências". 
2. Tela de Cadastro com Checkbox: Nunca deixe a caixa de aceitação pré-marcada. O usuário deve realizar a ação. 
Texto: "Li e concordo com os Termos de Uso e a Política de Privacidade sob as diretrizes da LGPD."
3. Página de "Privacidade" ou "Segurança" nas Configurações: Dentro do menu do app, crie uma seção dedicada onde o usuário possa exercer seus direitos em 2026:
Acesso aos dados: Botão para baixar um relatório dos dados coletados.
Revogação: Opção para retirar consentimentos dados anteriormente.
Exclusão: Botão claro para "Excluir minha conta e dados pessoais".
4. Descrição nas Lojas (App Store e Play Store): Utilize a seção de "Segurança de Dados" das lojas para declarar quais informações você coleta (nome, e-mail, localização) e para qual finalidade. Isso gera confiança antes mesmo do download.

Boas Práticas de Texto:

Linguagem Simples: Evite "juridiquês". Explique por que você precisa do dado (ex: "Precisamos do seu e-mail para recuperar sua senha").
Identificação do DPO: Informe quem é o encarregado de dados (DPO) e forneça um canal de contato direto para dúvidas sobre privacidade.

Audit Logs (Logs de Auditoria): Adicione uma tabela de Logs de Acesso Sensível.
	Sempre que alguém (seja você ou o Síndico) descriptografar/visualizar dados sensíveis, o sistema grava automaticamente:
Quem: ID do Usuário
O Quê: Visualizou CPF do Morador X
Quando: Data/Hora

Política de Cookies

1. O que são Cookies?

	Cookies são pequenos arquivos de texto que são armazenados no seu computador ou dispositivo móvel quando você visita um site. Eles são amplamente utilizados para fazer os sites funcionarem, ou funcionarem de forma mais eficiente, bem como para fornecer informações aos proprietários do site.

2. Como usamos os Cookies?

	Utilizamos cookies para diversos fins, incluindo:
Cookies Essenciais: Necessários para o funcionamento do site. Eles permitem que você navegue e use recursos como áreas seguras.
Cookies de Desempenho: Coletam informações sobre como os visitantes usam o site, por exemplo, quais páginas são mais visitadas. Esses dados são usados para melhorar o funcionamento do site.
Cookies Funcionais: Permitem que o site lembre escolhas que você faz (como seu nome de usuário, idioma ou região) e forneça recursos aprimorados e mais pessoais.
Cookies de Publicidade: Usados para fornecer anúncios mais relevantes para você e seus interesses.

3. Gerenciamento de Cookies

	A maioria dos navegadores web permite algum controle da maioria dos cookies através das configurações do navegador. Para saber mais sobre cookies, incluindo como ver quais cookies foram definidos, visite www.aboutcookies.org ou www.allaboutcookies.org.
Você pode optar por não aceitar cookies alterando as configurações do seu navegador. No entanto, se você bloquear todos os cookies (incluindo cookies essenciais), poderá não conseguir acessar todo ou parte do nosso site.

4. Alterações na Política

	Podemos atualizar nossa Política de Cookies de tempos em tempos. Recomendamos que você revise esta página periodicamente para obter as informações mais recentes sobre nossas práticas de privacidade.

5. Contato

	Se você tiver dúvidas sobre esta Política de Cookies, entre em contato conosco através do e-mail: eek029@gmail.com.


