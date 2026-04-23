# Flutter Web IDE - TODO

## Banco de Dados & Schema
- [x] Tabela `projects` (id, userId, name, description, createdAt, updatedAt)
- [x] Tabela `build_history` (id, projectId, userId, type, status, logs, artifactUrl, createdAt)
- [x] Tabela `project_sessions` (id, projectId, userId, lastOpenedFile, createdAt, updatedAt)
- [x] Migração e aplicação do schema no banco

## Backend - APIs tRPC
- [x] Procedimento: listar projetos do usuário
- [x] Procedimento: criar projeto
- [x] Procedimento: deletar projeto
- [x] Procedimento: listar arquivos/pastas de um projeto
- [x] Procedimento: ler conteúdo de arquivo
- [x] Procedimento: salvar conteúdo de arquivo
- [x] Procedimento: criar arquivo/pasta
- [x] Procedimento: deletar arquivo/pasta
- [x] Procedimento: renomear arquivo/pasta
- [x] Procedimento: iniciar build (APK ou Web)
- [x] Procedimento: obter status/logs de build
- [x] Procedimento: listar histórico de builds
- [x] Procedimento: download de artefato de build

## Backend - Terminal WebSocket
- [x] Servidor WebSocket com node-pty para terminal real
- [x] Autenticação de sessão no WebSocket
- [x] Gerenciamento de sessões de terminal por usuário

## Backend - Sistema de Build Flutter
- [x] Verificação/instalação de dependências Android Studio via Git LFS
- [x] Execução de `flutter build apk` com streaming de logs
- [x] Execução de `flutter build web` com streaming de logs
- [x] Armazenamento de artefatos no S3
- [x] Notificação de conclusão de build

## Frontend - Layout IDE
- [x] Layout principal com painéis redimensionáveis (react-resizable-panels)
- [x] Painel esquerdo: explorador de arquivos
- [x] Painel central: editor de código (CodeMirror)
- [x] Painel inferior: terminal xterm.js
- [x] Barra de menu superior com ações (Arquivo, Build, etc.)
- [x] Barra de status inferior com informações do projeto

## Frontend - Explorador de Arquivos
- [x] Árvore de diretórios com expansão/colapso
- [x] Ícones por tipo de arquivo
- [x] Menu de contexto (criar, renomear, deletar)
- [x] Indicador de arquivo modificado

## Frontend - Editor CodeMirror
- [x] Suporte a Dart, JavaScript, HTML, CSS, JSON, YAML
- [x] Tema dark (One Dark)
- [x] Abas de arquivos abertos
- [x] Indicador de arquivo não salvo
- [x] Atalhos de teclado (Ctrl+S para salvar)

## Frontend - Terminal xterm.js
- [x] Terminal integrado com WebSocket
- [x] Redimensionamento automático
- [x] Histórico de sessão

## Frontend - Painel de Build
- [x] Seletor de tipo de build (APK / Web)
- [x] Botão de iniciar build
- [x] Log de build em tempo real (streaming)
- [x] Indicador de progresso
- [x] Botão de download do artefato gerado

## Frontend - Autenticação
- [x] Tela de login com Manus OAuth
- [x] Proteção de rotas autenticadas
- [x] Exibição de perfil do usuário

## Frontend - Gerenciamento de Projetos
- [x] Tela de listagem de projetos
- [x] Criar novo projeto
- [x] Deletar projeto
- [x] Abrir projeto na IDE

## Testes
- [x] Testes de procedimentos tRPC (projetos, builds, arquivos)
- [x] Testes de autenticação

## Deploy
- [x] Checkpoint final

## Integração Repositório Original (Carlos20473736/Flutter-Web-IDE)
- [x] Código do servidor substituído pelo repositório original
- [x] Schema do banco corrigido (projects + build_logs do repositório original)
- [x] Dependências faltantes instaladas (multer, @codemirror/lang-xml, @codemirror/lang-markdown)
- [x] Testes Vitest atualizados para o novo schema (14 testes passando)
- [x] Tela de login removida (acesso direto sem autenticação)
