# 🏛️ Monitor Proposições AL — ALAL

Monitora automaticamente o SAPL da Assembleia Legislativa de Alagoas e envia email quando há proposições novas. Roda **4x por dia** via GitHub Actions (8h, 12h, 17h e 21h, horário de Brasília).

---

## Como funciona

1. O GitHub Actions roda o script nos horários configurados
2. O script baixa o export CSV público do SAPL (`sapl.al.al.leg.br/materia/pesquisar-materia?format=csv`)
3. Compara as proposições recebidas com as já registradas no `estado.json`
4. Se há proposições novas → envia email com a lista organizada por tipo
5. Salva o estado atualizado no repositório

> **Por que CSV e não API?**
> A API REST retorna o autor apenas como ID numérico (ex: `autores: [118]`).
> O CSV já traz o nome completo do autor em uma única chamada, sem chamadas extras.

---

## Estrutura do repositório

```
monitor-proposicoes-al/
├── monitor.js
├── package.json
├── estado.json
├── README.md
└── .github/
    └── workflows/
        └── monitor.yml
```

---

## Setup — Passo a Passo

### PARTE 1 — Preparar o Gmail

**1.1** Acesse [myaccount.google.com/security](https://myaccount.google.com/security)

**1.2** Certifique-se de que a **Verificação em duas etapas** está ativa.

**1.3** Procure por **"Senhas de app"** e clique.

**1.4** Digite um nome qualquer (ex: `monitor-alal`) e clique em **Criar**.

**1.5** Copie a senha de **16 letras** — ela só aparece uma vez.

> Se já tem App Password de outro monitor, pode reutilizar.

---

### PARTE 2 — Criar o repositório no GitHub

**2.1** Acesse [github.com](https://github.com) → **+ → New repository**

**2.2** Preencha:
- **Repository name:** `monitor-proposicoes-al`
- **Visibility:** Private

**2.3** Clique em **Create repository**

---

### PARTE 3 — Fazer upload dos arquivos

**3.1** Clique em **"uploading an existing file"**

**3.2** Faça upload de:
```
monitor.js
package.json
README.md
```
Clique em **Commit changes**.

**3.3** Clique em **Add file → Create new file**, digite o nome:
```
.github/workflows/monitor.yml
```
Abra o arquivo `monitor.yml`, copie todo o conteúdo e cole. Clique em **Commit changes**.

---

### PARTE 4 — Configurar os Secrets

**4.1** No repositório: **Settings → Secrets and variables → Actions**

**4.2** Clique em **New repository secret** e crie os 3 secrets:

| Name | Valor |
|------|-------|
| `EMAIL_REMETENTE` | seu Gmail (ex: seuemail@gmail.com) |
| `EMAIL_SENHA` | a senha de 16 letras do App Password (sem espaços) |
| `EMAIL_DESTINO` | email onde quer receber os alertas |

---

### PARTE 5 — Testar

**5.1** Vá em **Actions → Monitor Proposições AL → Run workflow → Run workflow**

**5.2** Aguarde ~15 segundos. Verde = funcionou.

**5.3** O **primeiro run** envia email com todas as proposições de 2026 e salva o estado. A partir do segundo run, só envia se houver proposições novas.

---

## Resetar o estado

1. No repositório, clique em `estado.json` → lápis
2. Substitua o conteúdo por:
```json
{"proposicoes_vistas":[],"ultima_execucao":""}
```
3. Commit → rode o workflow manualmente

---

## API / fonte utilizada

```
URL: http://sapl.al.al.leg.br/materia/pesquisar-materia?format=csv&ano=2026&orderby=-id
Método: GET
Autenticação: nenhuma
```
