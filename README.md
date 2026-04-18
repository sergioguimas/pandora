# 🧠 Pandora

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-private-red)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

> Hub interno de agentes inteligentes para produtividade administrativa

---

## 📌 Sobre o Projeto

O **Pandora** é uma aplicação interna desenvolvida para centralizar e utilizar **agentes de inteligência artificial especializados**, com foco em apoiar colaboradores em atividades administrativas, operacionais e de atendimento.

Ao invés de um chatbot genérico, o Pandora funciona como um **ambiente com múltiplos agentes**, onde cada agente possui:

- função bem definida  
- comportamento estruturado  
- conhecimento específico do domínio  

---

## 🎯 Objetivo

Aumentar a eficiência operacional através de:

- 📊 padronização de processos administrativos  
- ⚡ redução de tarefas repetitivas  
- 🧠 apoio à tomada de decisão  
- 🗣️ melhoria na comunicação interna e externa  
- ❌ redução de erros operacionais  

---

## 🚫 Escopo da V1

A primeira versão do Pandora será:

- 🔒 Uso exclusivamente interno  
- 👥 Focada em colaboradores  
- ⚙️ Simples e funcional (sem overengineering)  
- 🤖 Com número reduzido de agentes iniciais  
- 📂 Com suporte a arquivos (PDF, imagens, texto)  

---

## 🤖 Tipos de Agentes

### 🔹 Executor
Processa dados e retorna resultados estruturados.

**Exemplos de uso:**
- análise de documentos  
- extração de dados  
- geração de relatórios  

---

### 🔹 Copiloto (principal foco)
Auxilia o colaborador na execução de tarefas e decisões.

**Exemplos de uso:**
- orientação de atendimento  
- suporte administrativo  
- estruturação de respostas  
- apoio em processos internos  

---

### 🔹 Assistente (futuro)
Agentes mais genéricos para apoio complementar.

---

## 🧱 Arquitetura

Frontend (React / Next.js)
↓
Backend (Fastify)
↓
Serviços:

LLM API
Supabase (Auth, Database, Storage)

---

## ⚙️ Stack Tecnológica

### 🖥️ Frontend
- React (Vite) ou Next.js  
- Tailwind CSS  
- shadcn/ui  

**Justificativa:**
- alta produtividade no desenvolvimento  
- criação rápida de interfaces modernas  
- padronização visual consistente  

---

### 🔙 Backend
- Node.js  
- Fastify  
- TypeScript  

**Justificativa:**
- performance elevada  
- simplicidade de implementação  
- integração fácil com APIs externas  

---

### 🗄️ Banco de Dados
- PostgreSQL (via Supabase)

**Justificativa:**
- confiabilidade  
- integração com autenticação e storage  
- escalabilidade futura  

---

### 🔐 Autenticação
- Supabase Auth  

---

### 📎 Armazenamento de Arquivos
- Supabase Storage  

---

### 🧠 Inteligência Artificial
- API de LLM (OpenAI ou compatível)

---

### 🚀 Infraestrutura
- VPS própria  
- Docker  
- Traefik (proxy reverso + SSL)  

---

## 🧩 Estrutura do Sistema

### 👥 Usuários
- autenticação obrigatória  
- acesso individual às conversas  

---

### 🤖 Agentes
Cada agente possui:
- prompt próprio  
- comportamento definido  
- base de conhecimento opcional  

---

### 💬 Conversas
- modelo inspirado em aplicativos de chat  
- histórico persistente  
- isolamento por agente  

---

### 📂 Arquivos
- upload por conversa  
- suporte a múltiplos formatos  
- utilizados por agentes executores  

---

### 📚 Base de Conhecimento
- vinculada a cada agente  
- composta por documentos e conteúdos internos  

---

## 🔄 Fluxo de Funcionamento

1. Usuário envia mensagem (e arquivos, se necessário)  
2. Sistema identifica o agente selecionado  
3. Carrega configurações e contexto  
4. Processa arquivos (se houver)  
5. Envia requisição para o modelo de IA  
6. Recebe resposta  
7. Salva histórico  
8. Retorna resposta ao usuário  

---

## 🧠 Princípios do Projeto

- ❌ Não é um chatbot genérico  
- ✅ Cada agente tem um propósito específico  
- ✅ Foco em produtividade, não em conversa  
- ✅ Respostas práticas e aplicáveis  
- ✅ Estrutura e clareza acima de criatividade  

---

## 🗺️ Roadmap

### ✅ Fase 1 — MVP
- autenticação de usuários  
- lista inicial de agentes  
- chat funcional  
- upload de arquivos  
- integração com IA  

---

### 🔜 Fase 2
- CRUD de agentes  
- base de conhecimento por agente  
- melhorias no processamento de arquivos  

---

### 🔜 Fase 3
- memória persistente  
- sugestões automáticas  
- templates de resposta  

---

### 🔮 Futuro (possível evolução)
- integrações externas (e-mail, mensageria, CRM)  
- multi-tenant  
- white-label  
- automação de fluxos  

---

## 📌 Status

🚧 Em desenvolvimento — Versão 0.1 (MVP)

---

## 📄 Licença

Uso interno — projeto privado

---

## 💡 Observação

O Pandora foi projetado inicialmente como uma ferramenta interna para ganho de produtividade administrativa,  
mas sua arquitetura permite evolução futura para cenários mais amplos, caso necessário.