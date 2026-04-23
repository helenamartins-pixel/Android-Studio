# Android Studio Dependencies

Este repositório contém as dependências completas do Android SDK para compilação de projetos Flutter em APK, incluindo suporte a plugins nativos (Firebase, Google Ads, etc.).

## Conteúdo

### sdk-essential.tar.gz
Componentes essenciais do Android SDK:
- **build-tools** (34.0.0, 35.0.0, 36.0.0)
- **platforms** (android-34, android-35, android-36)
- **platform-tools** (adb, fastboot)
- **cmdline-tools** (sdkmanager, avdmanager)
- **licenses** (todas aceitas)
- **cmake** (3.22.1)

### sdk-ndk.tar.gz
Android NDK para compilação de código nativo (C/C++):
- **NDK** 28.2.13676358
- Necessário para plugins Flutter que usam código nativo (Firebase, Google Mobile Ads, camera, etc.)

## Uso

O Flutter Web IDE clona este repositório automaticamente e extrai o SDK antes de compilar APKs.

```bash
# Extrair SDK essencial
tar -xzf sdk-essential.tar.gz -C /home/ubuntu/

# Extrair NDK (necessário para plugins nativos)
tar -xzf sdk-ndk.tar.gz -C /home/ubuntu/
```

## Requisitos

- Java 17 (OpenJDK)
- Flutter SDK 3.41+
- Git LFS (para baixar os arquivos .tar.gz)
