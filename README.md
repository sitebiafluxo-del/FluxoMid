# Controle de Fluxo de Pessoas (PT-BR)

Painel web para registrar fluxo de pessoas por hora (08:00-20:00), com:

- contador por intervalo
- total acumulado e media
- comparativo de horarios (pico e menor fluxo)
- grafico em tempo real
- tabela para analise
- exportacao em PDF via impressao do navegador
- funcionamento offline com cache
- fila de sincronizacao para envio posterior a planilha
- login seguro via Supabase Auth
- controle de acesso por perfil (`manager` e `collaborator`)

## Publicar no GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie estes arquivos para a branch `main`:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `supabase-config.js`
   - `supabase-setup.sql`
   - `sw.js`
   - `README.md`
3. No GitHub, abra `Settings` > `Pages`.
4. Em **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` e pasta `/ (root)`
5. Salve e aguarde a URL publica do GitHub Pages.

## Uso

1. Configure Supabase (passo abaixo) e publique.
2. Faça login com e-mail/senha criado no Supabase Auth.
3. Abra **Contador de Fluxo** e preencha os valores por hora.
4. Usuário com perfil `manager` também vê **Total + Grafico**.
5. Configure a **URL da Planilha** (webhook/App Script).
6. Se ficar offline, os dados vao para a fila local e serao enviados automaticamente quando a internet voltar.

## Configuracao do Supabase (gratuito)

1. Crie um projeto no Supabase (Free).
2. Em `SQL Editor`, execute o arquivo `supabase-setup.sql`.
3. Em `Authentication > Users`, crie os usuarios (colaboradores e gestor).
4. Em `Project Settings > API`, copie:
   - `Project URL`
   - `anon public key`
5. Preencha o arquivo `supabase-config.js` com esses valores.
6. Para promover um usuario a gestor, rode o `update` comentado no final de `supabase-setup.sql`.

### Importante sobre seguranca

- Nunca use `service_role key` no frontend.
- A chave `anon` e publica e pode ficar no cliente.
- Login/senha nao ficam mais hardcoded em `app.js`.

## Integracao com Google Sheets (pronto)

O arquivo `google-apps-script.js` ja contem um webhook pronto para receber os dados do painel.

1. Crie uma planilha no Google Sheets.
2. Copie o ID da planilha (na URL).
3. Em `google-apps-script.js`, ajuste:
   - `SPREADSHEET_ID`
   - `SHEET_NAME` (opcional)
4. No Google Sheets, abra `Extensoes > Apps Script`.
5. Cole o conteudo de `google-apps-script.js`.
6. Clique em `Deploy > New deployment > Web app`:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copie a URL do Web App e configure no painel em `URL da Planilha`.

Com isso, quando estiver offline o app guarda na fila local e sincroniza automaticamente assim que voltar online.
