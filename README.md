# Flutter Web IDE + Android Studio Dependencies

Este repositório contém dois componentes:

## 📦 Dependências de Build (raiz)
Arquivos LFS com todas as dependências para compilar projetos Flutter:

| Arquivo | Tamanho | Conteúdo |
|---------|---------|----------|
| `sdk-essential.tar.gz` | 499MB | Android SDK (build-tools, platforms, cmdline-tools) |
| `sdk-ndk.tar.gz` | 689MB | Android NDK 28.2 |
| `flutter-sdk.tar.gz` | 300MB | Flutter SDK 3.41 |
| `java17-jdk.tar.gz` | 134MB | OpenJDK 17 |

## 🌐 Flutter Web IDE (`flutter-web-ide/`)
IDE web completa para desenvolvimento e compilação de projetos Flutter no browser.

### Funcionalidades
- Editor de código com suporte a Dart, JS, HTML, CSS, JSON, YAML (CodeMirror)
- Terminal integrado via xterm.js
- Compilação Flutter APK e Web com logs em tempo real
- Upload e gerenciamento de projetos Flutter
- Explorador de arquivos lateral
- Download dos artefatos gerados (APK, build web)
- Banco de dados para persistir projetos e histórico de builds

### Como rodar localmente
```bash
cd flutter-web-ide
pnpm install
pnpm dev
```
