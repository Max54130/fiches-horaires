# Fiches Horaires — projet Android Studio

Application Android (WebView) qui embarque le générateur de fiches horaires de navettes
pour la Coupe de France de Robotique.

## Démarrage rapide

1. Ouvrir le dossier dans **Android Studio** (Hedgehog 2023.1.1 ou plus récent).
2. Laisser Gradle synchroniser (téléchargera AGP 8.7.3, Kotlin 2.0.21, Gradle 8.10.2).
   Au premier sync, Android Studio créera `local.properties` avec le chemin de
   **ton** Android SDK — c'est normal, ce fichier reste local et ne se versionne pas.
3. Brancher un téléphone (mode développeur activé) ou démarrer un émulateur, puis ▶ Run.

Pour produire un APK signé : `Build > Generate Signed Bundle / APK`.

## Documentation complète

Consulter **`DOCUMENTATION.md`** — 15 sections couvrant compilation, architecture,
pièges connus, cheatsheet, et l'historique des décisions de design.

## Caractéristiques techniques

- **Package** : `com.cdfrobotique.fiches`
- **minSdk** 24 (Android 7.0) / **targetSdk** 35 (Android 15)
- **AGP** 8.7.3 / **Kotlin** 2.0.21 / **Gradle** 8.10.2 / **JDK** 17
- **Permissions** : `INTERNET`, `VIBRATE`, `WRITE_EXTERNAL_STORAGE` (Android ≤ 9 uniquement)
- **Splash screen** Android 12+ via `androidx.core.splashscreen`
- **WebView** chargeant `assets/index.html` (100 % offline, `html2canvas` embarqué)
- **Pont JS ↔ Kotlin** `AndroidBlob` (3 méthodes : `save`, `vibrate`, `share`)
- **FileProvider** déclaré sous l'autorité `${applicationId}.fileprovider`

## Structure résumée

```
.
├── DOCUMENTATION.md           Documentation de reprise complète
├── README.md                  Ce fichier
├── build.gradle.kts           Build root
├── settings.gradle.kts
├── gradle.properties
├── gradle/
│   ├── libs.versions.toml
│   └── wrapper/               Gradle wrapper (inclus)
├── gradlew, gradlew.bat       Scripts d'invocation Gradle
└── app/
    ├── build.gradle.kts       Config du module app
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── assets/
        │   ├── index.html                 Le générateur (~2440 lignes)
        │   ├── lib/html2canvas.min.js     Lib embarquée (~200 Ko)
        │   └── fonts/                     Manrope embarquée
        ├── java/com/cdfrobotique/fiches/
        │   └── MainActivity.kt
        └── res/
            ├── drawable/ic_launcher_foreground.png
            ├── layout/activity_main.xml
            ├── mipmap-*/                  Icônes 5 densités + adaptive icon v26
            ├── values{,-night}/{colors,strings,themes}.xml
            └── xml/file_paths.xml
```

## Note sur le HTML

Toute l'UI et la logique métier vivent dans `app/src/main/assets/index.html`
(HTML + CSS + JS vanilla, pas de framework, pas de build step). Les appels au pont
natif `AndroidBlob.vibrate(...)`, `AndroidBlob.save(...)`, `AndroidBlob.share(...)`
doivent être préservés.

Pour déboguer ce fichier : ouvrir `chrome://inspect` dans Chrome desktop avec le
téléphone branché en USB.
