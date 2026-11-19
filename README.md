# GODOI CT — Jiu-Jitsu

Site institucional responsivo do GODOI CT, centro de treinamento de Jiu-Jitsu liderado por Jeferson Godoi. A página é estática; horários e acesso administrativo usam Supabase.

## Executar localmente

Abra `index.html` no navegador ou inicie um servidor estático na raiz do projeto. Não é necessário instalar dependências.

## WhatsApp

O WhatsApp já está configurado para o número informado, usando o código do Brasil e o DDD: `5548999132017`.

## Configurar o Supabase

1. Crie um projeto no Supabase.
2. No **SQL Editor**, execute o conteúdo de `supabase/schema.sql`.
3. Em **Project Settings → API**, copie a Project URL e a chave publicável (anon / publishable) para `supabaseUrl` e `supabaseAnonKey` no início de `app.js`. A chave publicável pode estar no frontend; **nunca** use a chave `service_role` no site.
4. Em **Authentication → Providers → Email**, desative o cadastro público de usuários. Crie/invite a conta do responsável pelo painel e confirme o usuário no Supabase.
5. Copie o UUID desse usuário e autorize-o no SQL Editor:

   ```sql
   insert into public.admin_users (user_id) values ('UUID-DO-USUARIO');
   ```

6. Abra **Gerenciar horários** no site e entre com o e-mail e a senha autorizados.

As políticas RLS em `supabase/schema.sql` permitem leitura pública da grade e escrita somente a usuários listados em `admin_users`. A sessão do responsável fica no armazenamento local do navegador; use uma senha exclusiva e publique somente com HTTPS.

## Antes de publicar

1. Troque as fotografias ilustrativas por fotos autorizadas do CT, especialmente o retrato de Jeferson Godoi e as imagens da galeria. Atualize os endereços no `index.html` e `styles.css`.
2. Atualize as informações profissionais do professor quando os dados oficiais forem fornecidos. O site não atribui graduação ou conquistas não confirmadas.
3. Cadastre os horários reais no painel e valide o site e os contatos antes de divulgar.

## Publicação

Publique `index.html`, `styles.css`, `app.js` e a pasta `supabase` em hospedagem estática (por exemplo, Netlify ou Cloudflare Pages). Configure domínio e HTTPS. O Google Fonts e as fotografias de demonstração usam recursos externos; para maior controle, substitua-os por ativos locais autorizados.

## Estrutura

- `index.html` — seções do site, conteúdo, formulários e diálogos acessíveis.
- `styles.css` — identidade visual, efeitos e layout responsivo.
- `app.js` — menu, galeria, WhatsApp e autenticação/gerenciamento de horários via Supabase.
- `supabase/schema.sql` — tabelas, permissões e políticas de segurança RLS.
