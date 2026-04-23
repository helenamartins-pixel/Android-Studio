# Android Studio Dependencies

Este repositório contém todas as dependências necessárias para compilar projetos Flutter em APK/Web. O Flutter Web IDE clona este repositório automaticamente — o servidor só precisa de **Git + Git LFS**.

## Arquivos

| Arquivo | Tamanho | Conteúdo |
|---------|---------|----------|
| `sdk-essential.tar.gz` | 153MB | Android SDK: build-tools (34/35/36), platforms, cmdline-tools, platform-tools, cmake, licenses |
| `sdk-ndk.tar.gz` | 689MB | Android NDK 28.2 (plugins nativos: Firebase, Google Ads, camera) |
| `flutter-sdk.tar.gz` | 300MB | Flutter SDK 3.41 (sem .git interno, cache otimizado) |
| `java17-jdk.tar.gz` | 134MB | OpenJDK 17 (necessário para Gradle) |

## Uso automático

O Flutter Web IDE faz tudo automaticamente ao compilar um projeto:

1. Clona este repositório (se ainda não existir localmente)
2. Puxa os arquivos LFS
3. Extrai Java 17 → `/usr/lib/jvm/java-17-openjdk-amd64/`
4. Extrai Flutter SDK → `/home/ubuntu/flutter-sdk/`
5. Extrai Android SDK → `/home/ubuntu/android-sdk/`
6. Extrai NDK → `/home/ubuntu/android-sdk/ndk/`

## Uso manual

```bash
git clone https://github.com/Carlos20473736/Android-Studio.git
cd Android-Studio
git lfs pull

# Extrair Java 17
sudo tar -xzf java17-jdk.tar.gz -C /usr/

# Extrair Flutter SDK
tar -xzf flutter-sdk.tar.gz -C /home/ubuntu/

# Extrair Android SDK + NDK
tar -xzf sdk-essential.tar.gz -C /home/ubuntu/
tar -xzf sdk-ndk.tar.gz -C /home/ubuntu/
```

## Requisitos do servidor

Apenas **Git** e **Git LFS** precisam estar instalados. Todo o resto é baixado automaticamente deste repositório.
