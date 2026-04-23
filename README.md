# Android Studio Dependencies

Este repositório contém as dependências essenciais do Android SDK para compilação de projetos Flutter em APK.

## Conteúdo

- `sdk-essential.tar.gz` — Android SDK compactado contendo:
  - **build-tools** (34.0.0, 35.0.0, 36.0.0)
  - **platforms** (android-34, android-35, android-36)
  - **platform-tools**
  - **cmdline-tools**
  - **licenses** (todas aceitas)
  - **cmake** (3.22.1)

## Uso

O Flutter Web IDE clona este repositório automaticamente e extrai o SDK antes de compilar APKs.

```bash
tar -xzf sdk-essential.tar.gz -C /home/ubuntu/android-sdk/
```

## Requisitos

- Java 17 (OpenJDK)
- Flutter SDK 3.41+
