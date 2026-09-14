# Documentation de reprise — Fiches Horaires

> **À qui s'adresse ce document ?** À toi, la personne qui reprend la maintenance ou
> l'évolution de l'app **Fiches Horaires** (générateur de fiches horaires pour les
> navettes de la Coupe de France de Robotique) si l'auteur initial ne peut plus s'en
> occuper. L'objectif est que tu puisses **compiler, faire évoluer et publier**
> l'app sans avoir besoin de lui poser de questions.
>
> Ce document décrit l'état du code tel qu'il est dans ce ZIP. Il documente ce qui
> existe — pas des intentions ou des roadmaps imaginaires. Les zones d'incertitude
> sont explicitement marquées avec `⚠️ Inconnu`.

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Stack technique et dépendances](#2-stack-technique-et-dépendances)
3. [Vue d'ensemble de l'architecture](#3-vue-densemble-de-larchitecture)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Mise en route : ouvrir, compiler, déployer](#5-mise-en-route--ouvrir-compiler-déployer)
6. [Côté Android natif (Kotlin)](#6-côté-android-natif-kotlin)
7. [Côté WebView (HTML / CSS / JS)](#7-côté-webview-html--css--js)
8. [Pont JS ↔ Kotlin : `AndroidBlob`](#8-pont-js--kotlin--androidblob)
9. [Persistance des données](#9-persistance-des-données)
10. [Theming, icônes, splash](#10-theming-icônes-splash)
11. [Cheatsheet : comment faire X](#11-cheatsheet--comment-faire-x)
12. [Pièges connus et leur résolution](#12-pièges-connus-et-leur-résolution)
13. [Historique des décisions de design](#13-historique-des-décisions-de-design)
14. [Zones d'incertitude / TODO](#14-zones-dincertitude--todo)
15. [Glossaire](#15-glossaire)

---

## 1. Présentation du projet

**Fiches Horaires** est une application Android qui sert à générer des **fiches
horaires de navettes** (transport en bus) pour la Coupe de France de Robotique. Une
fiche horaire ressemble à ce qu'on voit dans les gares routières : un tableau qui
liste les heures de passage à chaque arrêt, dans les deux sens du trajet, sur tous
les jours de la semaine concernés.

L'utilisateur cible est probablement un bénévole organisateur qui doit produire ces
fiches pour les afficher (PDF, PNG, partage) avant et pendant la Coupe. Toute la
saisie se fait dans l'app, sans connexion serveur — c'est 100 % offline.

> ⚠️ **Note** : Le projet a été **régénéré par reverse-engineering** d'un APK
> v1.0 antérieur (voir `README.md`). Il n'y a pas d'historique Git dans ce ZIP
> (pas de dossier `.git/`).

### Fonctionnalités présentes dans le code

- Créer plusieurs fiches (chacune avec un nom, un titre, une période, une légende)
- Choisir un logo (parmi 3 presets embarqués : Planète Sciences, Coupe de France de
  Robotique, Eurobot — ou importer le sien)
- Auto-détecter les **2 couleurs principales** depuis le logo importé
- Définir les jours actifs (Lun-Dim)
- Définir le sens 1 et le sens 2 du trajet (départ → arrivée + arrêts intermédiaires)
- Saisir les horaires du matin et du soir pour chaque arrêt, dans les deux sens
- Aperçu temps réel sur tablette (≥1024 px)
- Export PNG (via `html2canvas`) et HTML autonome
- Partage natif Android (intent `ACTION_SEND`)
- Persistance via `localStorage` du WebView
- Dark mode système supporté (mais le splash et les icônes sont volontairement clairs)

---

## 2. Stack technique et dépendances

| Composant | Version | Rôle |
|---|---|---|
| Android Gradle Plugin (AGP) | 8.7.3 | Build |
| Kotlin | 2.0.21 | Code natif |
| Gradle | 8.10.2 | Build system (déclaré dans `gradle/wrapper/gradle-wrapper.properties`) |
| JDK | 17 | Compilation (déclaré dans `app/build.gradle.kts`) |
| minSdk | 24 | Android 7.0 Nougat |
| targetSdk / compileSdk | 35 | Android 15 |
| `androidx.core:core-ktx` | 1.13.1 | KTX extensions |
| `androidx.appcompat:appcompat` | 1.7.0 | AppCompat |
| `androidx.activity:activity-ktx` | 1.9.3 | `ComponentActivity` |
| `androidx.core:core-splashscreen` | 1.0.1 | API splash 12+ avec backport |
| `androidx.webkit:webkit` | 1.12.1 | WebView modernisé |

Côté WebView (dans `assets/index.html`) :

| Lib | Version | Source | Rôle |
|---|---|---|---|
| `html2canvas` | 1.4.1 (estimation) | embarqué dans `assets/lib/` | Export d'une `<div>` en image PNG |
| Manrope (font) | — | embarquée dans `assets/fonts/` | Typographie |

**Pas** d'autres dépendances JS, **pas** de framework (pas de React/Vue), **pas**
de Tailwind, **pas** d'appel réseau. Tout est en JS vanilla et CSS.

---

## 3. Vue d'ensemble de l'architecture

L'app est une **WebView Android** qui charge un **fichier HTML local**. Toute l'UI
et la logique métier vivent en HTML/CSS/JS. Le code natif Kotlin sert uniquement à :

1. **Héberger la WebView** (activité unique, layout unique avec une `<WebView>` plein écran).
2. **Exposer des fonctionnalités natives** au JS via un pont `addJavascriptInterface` :
   sauvegarde de fichiers, vibration haptique, partage de fichiers.
3. **Gérer le splash screen** Android 12+.
4. **Gérer le bouton retour** (délégué au JS pour la navigation interne).
5. **Gérer les insets système** (barres de statut/navigation transparentes).

```
┌──────────────────────────────────────────────┐
│ Activité Android (MainActivity.kt)           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ <WebView> charge file:///android_asset/│  │
│  │   index.html                           │  │
│  │                                        │  │
│  │  Tout l'UI métier vit ici :            │  │
│  │  - State global (`state`)              │  │
│  │  - localStorage pour persistance       │  │
│  │  - Render → innerHTML                  │  │
│  │                                        │  │
│  │  Appels JS → Kotlin :                  │  │
│  │  AndroidBlob.save / share / vibrate    │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Conséquence importante** : 95 % des modifications de fonctionnalité se font dans
**un seul fichier** : `app/src/main/assets/index.html` (~2440 lignes, tout
en un — HTML + CSS dans `<style>` + JS dans `<script>`).

---

## 4. Structure des fichiers

```
android-project/
├── README.md                       (court résumé, peut être obsolète)
├── DOCUMENTATION.md                (CE FICHIER)
├── build.gradle.kts                (build root, ne touche pas sauf cas exceptionnel)
├── settings.gradle.kts             (déclare le module :app)
├── gradle.properties               (config JVM Gradle)
├── gradle/
│   ├── libs.versions.toml          (versions centralisées de AGP/Kotlin)
│   └── wrapper/                    (Gradle wrapper)
├── gradlew, gradlew.bat            (scripts pour invoquer Gradle sans installation)
├── local.properties                (chemin local Android SDK — à régénérer)
└── app/
    ├── build.gradle.kts            (config du module app : SDK, deps, signing)
    ├── proguard-rules.pro          (règles ProGuard/R8 pour le release)
    └── src/main/
        ├── AndroidManifest.xml     (permissions, activité, provider)
        ├── java/com/cdfrobotique/fiches/
        │   └── MainActivity.kt     (~190 lignes, le seul Kotlin du projet)
        ├── assets/
        │   ├── index.html          (~2440 lignes, le générateur)
        │   ├── lib/html2canvas.min.js  (export PNG)
        │   └── fonts/
        │       ├── manrope.css
        │       ├── manrope-latin.woff2
        │       └── manrope-latin-ext.woff2
        └── res/
            ├── drawable/
            │   └── ic_launcher_foreground.png   (432×432, foreground adaptive)
            ├── layout/
            │   └── activity_main.xml            (juste un FrameLayout + WebView)
            ├── mipmap-anydpi-v26/
            │   ├── ic_launcher.xml              (adaptive icon ≥ API 26)
            │   └── ic_launcher_round.xml
            ├── mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
            │   ├── ic_launcher.png              (icône carrée legacy)
            │   ├── ic_launcher_round.png        (icône ronde legacy)
            │   └── ic_launcher_foreground.png   (foreground par densité)
            ├── values/
            │   ├── colors.xml                   (couleurs nommées)
            │   ├── strings.xml                  (juste app_name)
            │   └── themes.xml                   (thèmes app + splash, light)
            ├── values-night/
            │   ├── colors.xml                   (vide, juste un commentaire)
            │   └── themes.xml                   (thèmes app + splash, dark)
            └── xml/
                └── file_paths.xml               (paths FileProvider)
```

> **Pas de tests** : il n'y a actuellement ni tests unitaires Kotlin, ni tests
> instrumentés, ni tests JS. À toi de décider si tu veux en ajouter.

---

## 5. Mise en route : ouvrir, compiler, déployer

### Pré-requis sur ta machine

- **Android Studio** Hedgehog (2023.1.1) ou plus récent
- **JDK 17** (intégré à Android Studio récent)
- **Android SDK** avec la plateforme API 35 installée (Android Studio le proposera automatiquement)
- Connexion internet au premier build (Gradle télécharge AGP, Kotlin, et les dépendances AndroidX)

### Première ouverture

1. Décompresse le ZIP du projet.
2. Ouvre Android Studio → **Open** → sélectionne le dossier `android-project/`.
3. Android Studio détecte le projet Gradle et lance la synchronisation.
   La première synchronisation peut prendre 5-10 minutes (téléchargements).
4. Si Android Studio affiche **"local.properties does not point to a valid SDK"**,
   ouvre le fichier `local.properties` à la racine et remplace la valeur de `sdk.dir`
   par le chemin de **ton** Android SDK. Exemples :
   ```properties
   # Windows
   sdk.dir=C:\\Users\\TON_USER\\AppData\\Local\\Android\\Sdk
   # macOS
   sdk.dir=/Users/TON_USER/Library/Android/sdk
   # Linux
   sdk.dir=/home/TON_USER/Android/Sdk
   ```
   En général, Android Studio régénère ce fichier tout seul au premier sync, donc
   tu peux aussi simplement **supprimer** `local.properties` et laisser l'IDE le recréer.

### Lancer l'app sur un téléphone ou un émulateur

1. Branche un téléphone Android (avec le **mode développeur + débogage USB activés**)
   ou démarre un émulateur depuis Android Studio.
2. Clique sur le bouton ▶ **Run 'app'** en haut. L'app se compile en mode debug et
   s'installe sur l'appareil. Temps typique du premier build : 2-5 minutes.
3. Pour les builds suivants (modifs incrémentales) : 5-15 secondes.

### Compiler un APK release signé (pour distribuer)

1. **Menu Build → Generate Signed Bundle / APK…**
2. Choisis **APK** (pas AAB, sauf si tu vas publier sur le Play Store).
3. **Create new…** pour ton keystore de signature si tu n'en as pas, sinon utilise
   l'existant. ⚠️ **Garde ton keystore et son mot de passe en lieu sûr**. Si tu les
   perds, tu ne pourras plus publier de mise à jour signée par la même clé.
4. Choisis la variante `release`, clique **Create**.
5. L'APK final est dans `app/release/app-release.apk`.

> ⚠️ **Inconnu** : Aucun keystore n'est fourni dans ce ZIP. Si l'auteur initial
> avait un keystore pour signer les versions précédentes, il faudra le récupérer
> séparément. Sinon, tu signeras avec ta propre clé, ce qui empêche les utilisateurs
> de mettre à jour "par-dessus" l'ancienne version (ils devront désinstaller-réinstaller).

### Pour modifier le code de la WebView sans recompiler

L'index.html est dans `app/src/main/assets/`. Tu peux l'éditer directement.
Pour tester rapidement sans relancer l'app à chaque fois, **ouvre ce fichier dans
Chrome desktop** (drag-and-drop dans le navigateur, ou `file://...`). Tu pourras
voir le rendu et utiliser les DevTools. ⚠️ **Limitation** : l'objet `AndroidBlob`
n'existe pas dans Chrome ; les fonctions `vibrate()`, `save()`, `share()` ne feront
rien (le code teste `typeof AndroidBlob !== 'undefined'` pour les sauter sans erreur).

Pour déboguer la WebView **sur l'appareil** :

1. Branche le téléphone en USB.
2. Ouvre `chrome://inspect` dans Chrome desktop.
3. Tu verras la WebView listée → clique **inspect**. Tu as DevTools complet (console,
   éléments, network, sources).

---

## 6. Côté Android natif (Kotlin)

Le seul fichier Kotlin est `MainActivity.kt`. Il fait ~190 lignes. Voici ce qu'il
fait, dans l'ordre où le code s'exécute :

### 6.1 `onCreate()` — initialisation

```kotlin
val splashScreen = installSplashScreen()
val splashStartMs = System.currentTimeMillis()
var webViewReady = false
splashScreen.setKeepOnScreenCondition {
    val elapsed = System.currentTimeMillis() - splashStartMs
    elapsed < MIN_SPLASH_DURATION_MS || !webViewReady
}
super.onCreate(savedInstanceState)
```

- `installSplashScreen()` doit être appelé **avant** `super.onCreate()` (contrainte
  de l'API).
- La condition retient le splash tant que **les deux conditions** ne sont pas
  satisfaites : la WebView doit avoir fini de charger **ET** au moins
  `MIN_SPLASH_DURATION_MS` (1200 ms, déclaré en `companion object`) doit s'être
  écoulé depuis `onCreate`. Sans le plancher temporel, le splash flashe en ~200 ms
  car l'HTML est chargé depuis un asset local (instantané).
  Voir [Pièges](#12-pièges-connus-et-leur-résolution).
- Cette logique a été ajustée après comparaison avec l'app de référence **urgpocket**
  (cf. section 13). urgpocket ne retient pas le splash dans son code, mais charge
  une URL distante (HTTPS) — c'est la latence réseau qui maintient leur splash.
  Notre app étant 100 % offline, on simule la même durée perçue via le plancher.

Ensuite :

- `WindowCompat.setDecorFitsSystemWindows(window, false)` : on dessine derrière les
  barres système (statut + navigation).
- `statusBarColor = TRANSPARENT`, idem nav bar.
- `controller.isAppearanceLightStatusBars = !isNightMode` : icônes des barres
  système adaptées au mode jour/nuit.
- `setContentView(R.layout.activity_main)` : charge le layout (juste un FrameLayout
  avec une WebView).
- Permission `WRITE_EXTERNAL_STORAGE` demandée uniquement sur Android ≤ 9 (sur
  Android 10+, le scoped storage gère ça via MediaStore).

### 6.2 Configuration de la WebView

```kotlin
webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true       // localStorage
    allowFileAccess = true
    allowContentAccess = true
    cacheMode = WebSettings.LOAD_DEFAULT
}
```

- `domStorageEnabled = true` est **critique** : c'est ce qui active `localStorage`,
  qui est la persistance de toutes les fiches. Sans ça, les fiches sont perdues à
  chaque fermeture.

### 6.3 `WebViewClient` et signal de fin de chargement

```kotlin
webView.webViewClient = object : WebViewClient() {
    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        webViewReady = true
    }
}
webView.postDelayed({ webViewReady = true }, SPLASH_TIMEOUT_MS)
```

- `onPageFinished` signale que la WebView a fini de charger. La condition splash
  peut alors être levée (sous réserve que `MIN_SPLASH_DURATION_MS` soit aussi
  atteint).
- Le `postDelayed(SPLASH_TIMEOUT_MS)` (3000 ms par défaut) est un **filet de
  sécurité** : si pour une raison quelconque `onPageFinished` ne se déclenche pas
  (par ex. erreur de chargement), le splash se retire après ce délai pour ne pas
  bloquer l'utilisateur.

### 6.4 `WebChromeClient` — file picker

`onShowFileChooser` permet à l'`<input type="file">` du HTML d'ouvrir le sélecteur
de fichier Android natif (pour choisir un logo personnalisé).

### 6.5 Bouton retour

```kotlin
onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
        webView.evaluateJavascript("handleBack()") { result ->
            if (result == "false") {
                if (webView.canGoBack()) webView.goBack()
                else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        }
    }
})
```

- Au lieu de quitter l'app immédiatement, le bouton retour appelle
  `handleBack()` côté JS.
- Si le JS retourne `"true"` (le JS a géré le retour, par ex. fermé une modale),
  on ne fait rien de plus.
- Si le JS retourne `"false"`, on essaie `webView.goBack()` (historique de
  navigation), puis sinon on laisse le système quitter l'app.

Voir `handleBack()` ligne ~2387 dans `index.html` pour la logique JS.

### 6.6 Insets système (notch, barre de gestes…)

```kotlin
ViewCompat.setOnApplyWindowInsetsListener(rootView) { v, insets ->
    val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
    v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
    WindowInsetsCompat.CONSUMED
}
```

- On applique un padding au FrameLayout racine pour que le contenu ne passe pas
  sous l'encoche / la barre de gestes / le clavier soft.
- Comme la WebView fille a `match_parent`, elle bénéficie automatiquement de ces
  paddings.

### 6.7 Classe interne `BlobBridge` — voir section [8](#8-pont-js--kotlin--androidblob)

---

## 7. Côté WebView (HTML / CSS / JS)

`app/src/main/assets/index.html` contient **tout** : HTML, CSS dans un `<style>`,
JS dans un `<script>`. Pas de bundler, pas de transpilation : ce que tu écris est
ce qui s'exécute. C'est intentionnel pour la simplicité.

### 7.1 Découpage logique du fichier

| Zone | Lignes (approx.) | Contenu |
|---|---|---|
| `<style>` | 30 — 740 | Tout le CSS (variables, layout, composants, responsive) |
| Media query desktop ≥1024 | 786 — 880 | Layout 3 colonnes : sidebar / éditeur / preview |
| `<body>` | 845 — 888 | Squelette HTML : header + main + section vide |
| Time picker overlay | 861 — 887 | Markup statique du clavier custom des horaires |
| Bloc `<script>` | 890 — 2440 | Tout le JS |
| Constantes (DEFAULT_LOGO, PRESET_LOGOS, DEFAULT_COLORS) | 893 — 911 | Voir section [7.4](#74-constantes-importantes) |
| Time picker logic | 915 — 1040 | `openTimePicker`, `closeTimePicker`, finalisation HH:MM |
| Utils | 1042 — 1100 | `uid`, `escapeHtml`, `slugify`, `downloadFile`, `showToast`, `confirmModal` |
| Modèle de données | 1099 — 1200 | `JOURS_NAMES`, `newFiche`, `migrateFiche` (V1→V2) |
| State & persistance | 1198 — 1280 | `loadState`, `saveState`, `checkStorage`, `exportAllJSON`, `importAllJSON` |
| Render principal | 1284 — 1360 | `renderSidebar`, `render`, `renderTabContent` |
| Onglet Général | 1363 — 1610 | `renderTabGeneral` : nom, titre, logo, couleurs, jours, légende |
| Image utils | 1611 — 1640 | `resizeImageToDataURL` (compresse les logos importés) |
| Onglet Sens (1 ou 2) | 1637 — 1880 | `renderTabSens` : départ, arrivée, arrêts, tables horaires |
| Format horaires | 1883 — 1930 | `autoFormatTime`, `finalizeTime` (saisie "0930" → "09:30") |
| Onglet Aperçu / export | 1938 — 2050 | `renderTabApercu`, captures PNG via html2canvas, partage |
| Couleurs | 2053 — 2180 | `lighten`, `darken`, `extractThemeFromImage` (analyse logo) |
| Render fiche finale | 2178 — 2390 | `renderFicheHTML`, `parseTime`, `buildTableHTML`, `buildStandaloneHTML` |
| Bouton retour | 2387 — 2410 | `handleBack` (appelé depuis Kotlin) |
| Bootstrap | 2440+ | DOM ready, init |

### 7.2 Modèle de données d'une fiche

Une fiche est un objet JS avec cette structure (voir `newFiche()` ligne 1141) :

```js
{
  id: "f_lp9xz_abcde",          // unique, généré par uid()
  nom: "Nouvelle fiche",        // affiché dans la sidebar
  titre: "NAVETTE BÉNÉVOLE",    // affiché en haut de la fiche imprimée
  logo: "data:image/png;base64,...",   // PNG/JPG/etc encodé en base64 inline
  periode: "COUPE DE FRANCE DE ROBOTIQUE",  // sous-titre
  joursCoches: [true, true, true, true, true, false, false],  // Lun-Dim
  legende: "ALD = À La Demande",
  colors: { sens1: '#005bb0', sens2: '#ed1e79' },  // 2 couleurs de bandeau
  sens: [
    { depart: '...', arrivee: '...', arrets: [...], matin: [...], soir: [...] },
    { depart: '...', arrivee: '...', arrets: [...], matin: [...], soir: [...] }
  ]
}
```

Notes :
- `sens` est un tableau de 2 éléments (sens 1 et sens 2). C'est en dur, pas un nombre
  variable.
- `arrets` est un tableau de strings (les noms des arrêts intermédiaires).
- `matin` et `soir` sont des tableaux de colonnes (une colonne = un trajet complet,
  on peut avoir plusieurs colonnes par sens pour des passages multiples). Chaque
  colonne est un tableau de strings au format `"HH:MM"` ou `"ALD"` (À La Demande) ou
  `"—"` (pas de passage).
- `logo` est inline base64 → ça pèse lourd (50-200 Ko par logo dans `localStorage`).

### 7.3 State global

Variable `state` (déclarée vers ligne 1198) :

```js
const state = {
  fiches: [],              // tableau de toutes les fiches
  currentFicheId: null,    // id de la fiche actuellement éditée
  currentTab: 'general'    // onglet actif : 'general' | 'sens1' | 'sens2' | 'apercu'
};
```

- Tout est sauvegardé dans `localStorage` sous la clé `fiches-data`.
- `saveState()` est appelé après chaque modification (avec debounce 300ms + flush immédiat sur fermeture/changement d'onglet).
- `loadState()` est appelé au démarrage.

### 7.4 Constantes importantes

| Constante | Ligne | Rôle |
|---|---|---|
| `DEFAULT_LOGO` | 893 | Le logo Planète Sciences (PNG palette base64, ~15 Ko) appliqué aux nouvelles fiches et au bouton "Logo par défaut" |
| `PRESET_LOGOS` | 896 | Objet `{planete_sciences, cdf_robotique, eurobot}` → data URL PNG. C'est ce que les 3 vignettes cliquables appliquent. |
| `PRESET_LOGO_META` | 901 | Tableau des metadata des presets (key + label) pour générer les vignettes |
| `DEFAULT_COLORS` | 910 | `{sens1: '#005bb0', sens2: '#ed1e79'}` — couleurs par défaut bleu marine + rose magenta Planète Sciences |
| `JOURS_NAMES` | 1099 | `['LUNDI', 'MARDI', ...]` pour l'affichage |
| `JOURS_SHORT` | 1100 | `['Lun', 'Mar', ...]` pour la sidebar |

### 7.5 Cycle de rendu

Pas de framework réactif : on régénère l'innerHTML d'un conteneur après chaque
changement de state.

```
action utilisateur (clic, input)
  → modifie state.fiches[i].xxx
  → saveState() (persiste localStorage)
  → render() (régénère #main-content innerHTML)
  → renderSidebar() (régénère la sidebar)
```

C'est rudimentaire mais ça marche bien pour la taille du projet (~10 fiches max
typiquement). Les inputs sont parfois reliés directement via `addEventListener`
après chaque rendu (donc les listeners sont jetés-recréés à chaque render).

### 7.6 Time picker custom

Le clavier numérique custom en bas de l'écran (`#time-picker`) est en dur dans le
HTML (lignes 861-887). Il est masqué par défaut, montré via la classe `.show`.

Au clic sur un input horaire :
1. `openTimePicker(input)` est appelé.
2. La classe `picker-open` est ajoutée à `<body>` → ajoute un padding-bottom de
   320 px pour permettre de scroller le dernier input au-dessus du picker.
3. Un scroll précis est calculé pour placer l'input dans la zone visible (entre le
   header et le picker).

Voir aussi le [piège](#12-pièges-connus-et-leur-résolution) sur le clavier qui
masquait les inputs.

---

## 8. Pont JS ↔ Kotlin : `AndroidBlob`

Le pont s'appelle `AndroidBlob` (nom historique, hérité de l'APK reverse-engineered).
Il expose **3 méthodes** au JS :

### 8.1 `AndroidBlob.vibrate(durationMs)`

Vibration haptique. Utilisée pour les retours tactiles (clics sur le time picker,
sélection de logo, etc.).

- Côté Kotlin : utilise `VibratorManager` (API 31+) ou `Vibrator` (sinon).
- Si `durationMs <= 0`, default à 10 ms.

### 8.2 `AndroidBlob.save(base64Data, mimeType, filename)`

Enregistre un fichier dans le dossier **Téléchargements**.

- Android 10+ (API 29+) : utilise `MediaStore.Downloads` (scoped storage, pas de permission).
- Android ≤ 9 : écrit directement dans `Environment.DIRECTORY_DOWNLOADS` (requiert
  `WRITE_EXTERNAL_STORAGE`, demandée à l'install).
- Affiche un Toast "Enregistré : {filename}".

Utilisé par exemple pour l'export PNG d'une fiche.

### 8.3 `AndroidBlob.share(base64Data, mimeType, filename)`

Partage un fichier via l'intent `ACTION_SEND` (WhatsApp, Gmail, Drive, etc.).

- Écrit le fichier dans `cacheDir/shared/{filename}`.
- Génère une URI via `FileProvider` (autorité `${applicationId}.fileprovider`).
- Ouvre le sélecteur d'app de partage.

### 8.4 Sécurité du WebView et pont natif

L'application utilise désormais `androidx.webkit.WebViewAssetLoader` servant les fichiers locaux sous l'origine sécurisée `https://appassets.androidplatform.net/assets/`.
- `allowFileAccess` et `allowContentAccess` sont positionnés à `false` (conformité aux recommandations de sécurité Android 14/15 contre l'exfiltration de fichiers locaux).
- L'interface `addJavascriptInterface(BlobBridge(), "AndroidBlob")` est protégée contre l'obfuscation R8/ProGuard (`proguard-rules.pro`).
- La gestion du cycle de vie (`onResume`, `onPause`, `onDestroy`) suspend et reprend proprement le WebView.

---

## 9. Persistance des données

**Tout** est dans `localStorage` du WebView, clé `fiches-data`.

Caractéristiques :
- Stockage local, **par installation d'app** (réinstaller = perdre les fiches sauf
  si l'utilisateur a autorisé le backup auto Android via `allowBackup="true"`).
- Quota : généralement 5-10 Mo selon Android.
- Format : JSON sérialisé.
- Sécurisation anti-perte : un écouteur sur `visibilitychange`, `pagehide` et `beforeunload` force un `saveStateImmediately()` pour éviter toute perte lors d'un kill système ou d'une fermeture rapide.

### Migrations

`migrateFiche(f)` convertit les anciennes fiches V1 vers le format
actuel (ajout des palettes de couleurs `sens1`/`sens2`, initialisation des 7 jours). Si tu changes la structure du modèle, **ajoute une étape de migration ici**
pour ne pas casser les fiches des utilisateurs existants.

### Export / import manuel

Les fonctions `exportAllJSON()` et `importAllJSON(file)` permettent à l'utilisateur
de sauver / restaurer ses fiches sous forme d'un fichier JSON (utile en cas de
réinstallation ou de transfert vers un autre téléphone).

> ⚠️ **Inconnu** : Je ne sais pas si ces fonctions sont reliées à des boutons
> visibles dans l'UI actuelle. À vérifier dans `renderTabApercu` ou la sidebar.

---

## 10. Theming, icônes, splash

### 10.1 Icônes du launcher

Le projet utilise les **adaptive icons** Android (API 26+) :

- `res/mipmap-anydpi-v26/ic_launcher.xml` : composé d'un **background** (couleur
  unie `#DFEEFC`, définie par `<color name="ic_launcher_background">` dans
  `values/colors.xml`) et d'un **foreground** (un PNG par densité dans
  `mipmap-*/ic_launcher_foreground.png`).
- Sur Android < 26 (rare en 2026 : minSdk 24), les icônes carrée et ronde "legacy"
  sont utilisées (`mipmap-*/ic_launcher.png` et `ic_launcher_round.png`).

**Logo source** : reconstruction faite à partir du fichier source (combo Planète
Sciences + bus + badge "NAVETTE"). Pour le **régénérer** depuis une nouvelle source :

1. Place ton nouveau logo source (idéalement 1024×1024 ou plus, fond clair ou transparent).
2. Pour chaque densité (mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192), produis :
   - `ic_launcher.png` (carré, full bleed ou avec fond uni `#DFEEFC`)
   - `ic_launcher_round.png` (cercle)
   - `ic_launcher_foreground.png` (1,5× la taille, contenu utile dans **les 61 %
     centraux** du canvas — c'est la safe zone Android pour les masques squircle/cercle)
3. Pour le foreground 432×432 dans `drawable/`, idem (1,5× xxxhdpi = 192 × 2,25 = 432).

> ⚠️ **Important** : le contenu utile du foreground doit tenir dans **~60-61 %**
> du canvas (276 px sur 432). Au-delà, les masques squircle (Pixel) et cercle
> (Samsung) **clippent les coins**. C'est exactement ce qui s'est produit avec
> "NAVETT" coupé sur une version intermédiaire.

### 10.2 Splash screen Android 12+

Configuration dans `values/themes.xml` et `values-night/themes.xml` :

```xml
<style name="Theme.FichesHoraires.Splash" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#DFEEFC</item>
    <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>
    <item name="postSplashScreenTheme">@style/Theme.FichesHoraires</item>
</style>

<style name="Theme.FichesHoraires" parent="Theme.AppCompat.DayNight.NoActionBar">
    <!-- ... -->
    <item name="android:windowBackground">#DFEEFC</item>  <!-- ⚠ même teinte que le splash -->
</style>
```

Points importants :
- `windowSplashScreenAnimatedIcon` pointe sur l'**adaptive icon launcher**, pas
  sur un PNG simple. Raison : Android 12+ applique un clipping circulaire de 160dp
  aux drawables PNG simples, ce qui coupe les coins du contenu rectangulaire. Les
  adaptive icons échappent à ce clipping.
- Le mode night utilise les **mêmes** valeurs (fond clair) que le mode day. Le
  logo est conçu pour fond clair et ne contraste pas sur un fond sombre.
- Le splash est maintenu visible jusqu'à `onPageFinished` de la WebView grâce à
  `setKeepOnScreenCondition` dans `MainActivity.kt`, avec un plancher minimum de
  2000 ms (sinon le splash flashe en ~200 ms sur les téléphones rapides puisque
  notre HTML est local).
- **Pattern urgpocket** : `android:windowBackground` du thème *post-splash* est
  volontairement aligné sur `windowSplashScreenBackground` (#DFEEFC). Quand le
  splash disparaît, l'écran reste de la même couleur le temps que la WebView
  devienne visible. **Sans ça, on a un flash sombre** entre la fin du splash
  (bleu pâle) et l'affichage de la WebView, qui donne l'impression d'un splash
  écourté. Avec ça, la transition est invisible et le splash semble "naturel".
  Le background du `FrameLayout` dans `activity_main.xml` est aussi à `#DFEEFC`
  pour la même raison.

### 10.3 Couleurs

| Nom XML | Valeur | Utilisation |
|---|---|---|
| `primary` | `#009de0` | Cyan, hérité du theme AppCompat (presque pas utilisé en pratique) |
| `primary_dark` | `#0079b3` | Idem |
| `white` | `#FFFFFF` | (dead code, plus référencé après nettoyage) |
| `black` | `#000000` | (dead code) |
| `splash_background` | `#FFFFFF` | (dead code, peut être supprimé) |
| `ic_launcher_background` | `#DFEEFC` | Background de l'adaptive icon. Non redéfinie en night → reste claire. |

> ⚠️ **À nettoyer** : `white`, `black` et `splash_background` ne sont plus
> référencés ailleurs. Tu peux les supprimer de `values/colors.xml` si tu veux
> vraiment minimiser. Personnellement je les laisse au cas où quelqu'un en aurait
> besoin pour de futurs styles XML.

### 10.4 Theming dans la WebView

C'est **complètement séparé** du theming Android natif. Le HTML utilise des CSS
variables (`:root { --bg: ... }`) qui basculent en dark mode via la media query
`@media (prefers-color-scheme: dark)`. Aucun pont avec les thèmes Android.

Les **couleurs des fiches générées** (bandeaux sens 1 et sens 2) viennent de :
- Le state `f.colors.sens1` et `f.colors.sens2` de chaque fiche.
- Par défaut, `DEFAULT_COLORS = {sens1: '#005bb0', sens2: '#ed1e79'}` (Planète Sciences).
- L'utilisateur peut les modifier via deux color pickers.
- Si l'utilisateur active "Détecter automatiquement", `extractThemeFromImage()` est
  appelée sur le logo importé pour deviner 2 couleurs contrastées. Voir l'algo
  dans la section suivante.

### 10.5 Extraction automatique de couleurs depuis le logo

`extractThemeFromImage(img)` ligne ~2089 :

1. Quantization 5×5×5 (125 bins) sur l'image redimensionnée à 80×80 px.
2. On ignore le blanc (>240), le noir (<20) et les pixels désaturés (<20 % de sat).
3. Le bin le plus rempli donne **sens 1** (la couleur dominante).
4. Pour **sens 2** : on parcourt les autres bins par poids décroissant et on prend
   le premier qui a une teinte HSL **>60° d'écart** par rapport à sens 1, et un
   poids ≥ 8 % du max.
5. Fallback (logo monochrome, pas de 2e teinte trouvée) : `darken(sens1, 0.5)`.

Résultats typiques sur les presets :
- Planète Sciences → bleu marine + rose magenta
- CdFR → cyan + cyan foncé (fallback, logo monochrome)
- Eurobot → bleu marine + jaune

---

## 11. Cheatsheet : comment faire X

### 11.1 Modifier le logo par défaut

Dans `index.html`, remplace la valeur de la constante `DEFAULT_LOGO` (ligne 893)
par ton data URL base64. Outils utiles :
- En CLI : `base64 -w0 monlogo.png` (Linux/Mac).
- En ligne : nombreux convertisseurs PNG → base64.
- Préfixer : `data:image/png;base64,XXXXX` (ou `image/jpeg`, etc.).

Conseil : pour limiter la taille, redimensionne à 400 px max et encode en PNG
palette ou JPEG q≈85.

### 11.2 Ajouter un nouveau logo preset

1. Encode-le en base64 inline.
2. Ajoute une entrée dans `PRESET_LOGOS` (ligne 896) et `PRESET_LOGO_META` (ligne 901).
3. Reload : la nouvelle vignette apparaîtra automatiquement (la grille `repeat(3, 1fr)`
   est dans le CSS, tu devras peut-être passer à 4 colonnes si tu en ajoutes un 4e).

### 11.3 Changer les couleurs par défaut des nouvelles fiches

Modifie `DEFAULT_COLORS` (ligne 910).

### 11.4 Changer l'icône de l'app

Voir [section 10.1](#101-icônes-du-launcher) — il faut régénérer 16 fichiers PNG +
les XML adaptive icon (ces derniers ne changent pas en général).

### 11.5 Changer le splash

- Couleur de fond : `windowSplashScreenBackground` dans `themes.xml` (day + night).
- Icône du splash : `windowSplashScreenAnimatedIcon` (pointe vers
  `@mipmap/ic_launcher`, donc régénérer le launcher icon régénère le splash).

### 11.6 Changer le nom de l'app

`res/values/strings.xml` → `<string name="app_name">…</string>`.

### 11.7 Changer le package name (applicationId)

3 endroits à mettre à jour de manière cohérente :
1. `app/build.gradle.kts` → `applicationId = "com.cdfrobotique.fiches"`
2. `app/build.gradle.kts` → `namespace = "com.cdfrobotique.fiches"`
3. Renommer les dossiers `app/src/main/java/com/cdfrobotique/fiches/` selon le nouveau package.
4. Mettre à jour la déclaration `package com.cdfrobotique.fiches` en haut de
   `MainActivity.kt`.

Android Studio peut le faire en bulk : **Refactor → Rename** sur le package.

### 11.8 Incrémenter la version pour publier une mise à jour

`app/build.gradle.kts` :
```kotlin
defaultConfig {
    versionCode = 2   // incrémenter de 1 à chaque release
    versionName = "1.1"  // version humaine
}
```

### 11.9 Ajouter une nouvelle méthode native (Kotlin) appelable depuis le JS

Dans `MainActivity.kt`, classe interne `BlobBridge` :
```kotlin
@JavascriptInterface
fun maNouvelleFonction(arg: String) {
    // ...
}
```

Côté JS, appel direct : `AndroidBlob.maNouvelleFonction("hello");`. Pas de modification
nécessaire du manifest ou du XML.

### 11.10 Déboguer un crash natif

Ouvre **Logcat** dans Android Studio, filtre par tag `AndroidBlob` ou par le
package `com.cdfrobotique.fiches`. Les exceptions du `BlobBridge` sont catchées
et loggées via `Log.e("AndroidBlob", "...", e)`.

### 11.11 Déboguer la WebView (HTML/JS)

`chrome://inspect` dans Chrome desktop (téléphone branché en USB, débogage activé).
Tu as la console JS complète, le DOM, le network, etc.

---

## 12. Pièges connus et leur résolution

### 12.1 Le splash flashe et disparaît immédiatement

**Symptôme** : sur les téléphones rapides, le splash dure ~200 ms et est
imperceptible, OU il dure 1 s mais se termine par un flash sombre désagréable.
**Cause 1** (durée) : par défaut, le splash se retire dès que la 1ʳᵉ frame de
l'app est prête. Avec un HTML 100 % local, `onPageFinished` se déclenche
quasi-instantanément.
**Cause 2** (flash sombre) : un `windowBackground` post-splash de couleur
différente du splash crée une coupure visuelle à l'instant où le splash disparaît
— l'utilisateur a l'impression que le splash a été coupé court.
**Fix** :
1. `MainActivity.kt` retient le splash via `setKeepOnScreenCondition` avec
   **deux conditions combinées** : (1) la WebView doit avoir signalé
   `onPageFinished`, (2) il doit s'être écoulé au moins `MIN_SPLASH_DURATION_MS`
   (2000 ms) depuis `onCreate`. Pour ajuster la durée perçue, modifie la
   constante en haut de la classe. Un filet `SPLASH_TIMEOUT_MS` (3000 ms)
   débloque le splash même si la WebView ne signale jamais sa fin de chargement.
2. `Theme.FichesHoraires` a `android:windowBackground = #DFEEFC` (même teinte
   que `windowSplashScreenBackground`) — modèle repris de urgpocket. Le
   `FrameLayout` root de `activity_main.xml` est aussi en `#DFEEFC` pour
   couvrir le cas où la WebView mettrait quelques millisecondes de plus à se
   rendre.

### 12.2 L'icône a un fond noir en mode night

**Symptôme** : sur un téléphone en thème sombre, l'icône launcher a un fond presque
noir au lieu de blanc.
**Cause historique** : `<color name="white">#121212</color>` dans
`values-night/colors.xml` (un hack laissé par une version antérieure). Comme
l'adaptive icon référençait `@color/white`, ça basculait en noir en mode night.
**Fix** : déjà en place — l'adaptive icon utilise désormais
`@color/ic_launcher_background` (non redéfinie en night), et le hack a été supprimé
de `values-night/colors.xml`.

### 12.3 Le contenu de l'icône est coupé (NAVETTE → NAVETT)

**Cause** : le contenu utile du foreground dépassait la safe zone (61 % du canvas).
Les masques squircle/cercle des launchers modernes l'ont clippé.
**Fix** : foreground regénéré avec `fill_ratio = 0.68` après crop du contenu utile
du logo source.
**Règle pour le futur** : si tu remplaces le foreground, vise un contenu utile à
≤ 60 % du canvas adaptive icon.

### 12.4 Le splash n'affiche pas le logo

**Symptôme** : on voit le fond bleu pâle, mais pas le logo.
**Cause** : Android 12+ clippe les drawables PNG simples dans un cercle de 160 dp.
Le contenu rectangulaire est rogné aux coins.
**Fix** : `windowSplashScreenAnimatedIcon` pointe désormais vers `@mipmap/ic_launcher`
(adaptive icon → pas de clipping).

### 12.5 Le clavier custom cache les horaires du soir

**Symptôme** : en saisissant des horaires du soir (en bas de la fiche), le picker
recouvre les inputs et on ne voit pas ce qu'on tape.
**Cause** : `scrollIntoView({block: 'center'})` ignorait la zone occupée par le
picker `position: fixed`. Pire, pour le dernier input on ne pouvait physiquement
pas scroller assez (le picker n'ajoute pas de hauteur au document).
**Fix** :
- CSS : `body.picker-open { padding-bottom: 320px; }` ajoute de la place sous le
  document quand le picker est ouvert.
- JS : scroll manuel précis calculé sur `picker.offsetHeight` et `headerHeight`.

### 12.6 L'extraction de couleurs renvoyait deux teintes très proches

**Symptôme** : sens 1 et sens 2 visuellement quasi identiques.
**Cause** : l'algo précédent retournait `main + darken(main, 0.4)` → un assombri,
pas une 2e teinte.
**Fix** : `extractThemeFromImage` cherche une 2e teinte avec ≥ 60° d'écart sur le
cercle chromatique HSL. Fallback `darken(main, 0.5)` (plus tranché) si pas trouvé.

### 12.7 `localStorage` plein → fiches perdues

**Symptôme rare** : si l'utilisateur accumule beaucoup de fiches avec gros logos
(50-200 Ko chacun), `localStorage` peut saturer (~5-10 Mo).
**Détection** : `checkStorage()` (ligne 1198) surveille la taille et appelle
`showStorageWarning()` (ligne 1246) si on dépasse un seuil.
**Mitigation actuelle** : `resizeImageToDataURL` (ligne 1611) redimensionne les
logos importés à 600 px max et compresse en JPEG.
**Si ça arrive en pratique** : il faudra peut-être migrer vers IndexedDB (capacité
beaucoup plus grande). Travail non-trivial mais pas catastrophique.

### 12.8 `local.properties` cassé entre machines

**Symptôme** : Android Studio refuse de sync : `SDK location not found`.
**Cause** : le chemin `sdk.dir` dans `local.properties` est spécifique à la
machine d'origine.
**Fix** : supprimer `local.properties` et laisser Android Studio le régénérer, ou
le réécrire manuellement.

---

## 13. Historique des décisions de design

> Ce sont les "pourquoi" derrière certains choix techniques actuels. Utile pour
> savoir si tu peux modifier quelque chose sans casser une intention.

### 13.1 Pourquoi WebView et pas Jetpack Compose / Views ?

L'app a été reverse-engineered depuis un APK existant. Le code natif Android sert
juste de wrapper autour d'un générateur HTML/JS qui existait probablement déjà.
Avantages secondaires : développement rapide en HTML, portable sur d'autres
plateformes au besoin (juste héberger l'HTML).

### 13.2 Pourquoi pas de framework JS ?

Simplicité, pas de bundle à produire, pas de toolchain. Pour un projet de cette
taille (~2400 lignes JS), vanilla JS reste lisible. Si tu décides d'ajouter React
ou autre, il faudra introduire un bundler (Vite, esbuild…) et un workflow de build.

### 13.3 Pourquoi `localStorage` et pas IndexedDB ?

Plus simple, suffisant pour ~10-20 fiches. Bascule vers IndexedDB seulement si on
voit en pratique que le quota est trop petit.

### 13.4 Pourquoi le logo embarqué inline (base64) ?

Pour rester 100 % offline, sans dépendance à un dossier d'assets servis par la
WebView. Aussi : permet à l'utilisateur de **copier le logo dans une fiche
exportée** sans qu'il y ait de référence externe.

### 13.5 Pourquoi 3 logos presets ?

Décision UX : les 3 organisations majeures qui utilisent l'app sont Planète Sciences
(qui organise), la Coupe de France de Robotique, et Eurobot (homologue européen).
Embarquer ces 3 logos évite à l'utilisateur de devoir les retrouver et importer à
chaque fois.

### 13.6 Pourquoi splash et icônes en fond clair, même en mode night ?

Le logo utilisé (combo Planète Sciences + bus + NAVETTE) est conçu pour fond clair.
Le bus est bleu marine, le globe Planète Sciences est bleu, le badge NAVETTE est
bleu vif → impossible de bien faire ressortir sur un fond bleu nuit. Un fond clair
en mode sombre est moins esthétique mais 1000× plus lisible.

### 13.7 Pourquoi le time picker custom et pas le `<input type="time">` natif ?

Plusieurs raisons probables :
1. Cohérence visuelle (le picker natif Android est moche dans une WebView).
2. Capacité d'ajouter des boutons spéciaux : "ALD" (à la demande), "+10m" (incrémenter), tabulation auto entre les inputs.
3. Pas de bug lié au clavier soft qui s'ouvrirait par-dessus.

---

## 14. Zones d'incertitude / TODO

> Ce que je ne sais pas avec certitude et qu'il pourrait être utile de vérifier
> avec d'anciens contributeurs.

- **Existence d'un keystore de signature partagé** : ⚠️ inconnu. Si l'app a été
  publiée sur le Play Store ou distribuée signée à des bénévoles, il faut récupérer
  ce keystore pour publier une mise à jour qui s'installe par-dessus.
- **Vérifier que `exportAllJSON()` et `importAllJSON()` sont bien exposées dans
  l'UI**. Elles sont définies en JS mais je n'ai pas vérifié qu'un bouton les
  appelle.
- **Pas de tests** : aucune suite de tests automatisée. À considérer si le projet
  évolue beaucoup.
- **Le wrapper Gradle est-il à jour ?** Il est dans `gradle/wrapper/` mais je n'ai
  pas vérifié sa version exacte vs AGP 8.7.3. En cas de problème de sync, faire
  `./gradlew wrapper --gradle-version 8.10.2`.
- **Comportement multi-utilisateurs sur tablette Android** : non testé. Le
  `localStorage` est probablement isolé par utilisateur, mais à vérifier si c'est
  un cas d'usage attendu.
- **Backup auto Android** (`allowBackup="true"` dans le manifest) : non testé.
  En théorie, les données `localStorage` sont sauvegardées dans le cloud Google
  Drive de l'utilisateur, ce qui permettrait de récupérer les fiches après
  réinstallation. À vérifier en pratique.

---

## 15. Glossaire

| Terme | Définition |
|---|---|
| **Adaptive icon** | Format d'icône Android (API 26+) en 2 couches (background + foreground) que le launcher peut masquer en différentes formes (cercle, squircle, etc.) |
| **AGP** | Android Gradle Plugin, le plugin qui orchestre la compilation Android |
| **AAB** | Android App Bundle, format pour publier sur le Play Store (Google génère les APK adaptés à chaque device) |
| **ALD** | "À La Demande" — convention métier : arrêt non desservi en temps normal, sur appel |
| **Coupe de France de Robotique** (CdFR) | Compétition annuelle de robots étudiants, organisée notamment par Planète Sciences |
| **Eurobot** | Compétition européenne, suite de la CdFR française |
| **FileProvider** | API Android pour exposer des fichiers internes à d'autres apps via des URI content:// |
| **html2canvas** | Lib JS qui rasterise un `<div>` du DOM en image PNG |
| **MediaStore** | Base de données Android centralisant l'accès aux fichiers média (depuis Android 10) |
| **mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi** | Densités d'écran Android (160/240/320/480/640 dpi respectivement). Les icônes doivent être fournies à chaque densité. |
| **Safe zone (adaptive icon)** | Les 61 % centraux du canvas du foreground, où le contenu est garanti visible quelque soit le masque du launcher |
| **Scoped storage** | Modèle d'accès aux fichiers introduit en Android 10, où chaque app a son propre espace |
| **Splash screen API** | API Android 12+ pour gérer l'écran de démarrage. Backportée sur API plus anciennes via `androidx.core.splashscreen` |
| **Squircle** | Forme "carré-cercle" intermédiaire utilisée par les launchers Pixel pour les icônes |
| **WebView** | Composant Android qui embarque le moteur de rendu Chromium pour afficher du HTML/CSS/JS |

---

## Annexes

### A. Commandes utiles

```bash
# Compiler en mode debug depuis la ligne de commande
./gradlew assembleDebug
# Produit app/build/outputs/apk/debug/app-debug.apk

# Compiler en mode release (non signé)
./gradlew assembleRelease

# Installer sur appareil branché en USB
./gradlew installDebug

# Nettoyer le build
./gradlew clean

# Voir l'arbre des dépendances
./gradlew app:dependencies

# Mettre à jour le wrapper Gradle
./gradlew wrapper --gradle-version 8.10.2
```

### B. Liens utiles

- Documentation officielle WebView Android :
  https://developer.android.com/develop/ui/views/layout/webapps/webview
- API Splash Screen :
  https://developer.android.com/develop/ui/views/launch/splash-screen
- Adaptive icons (design guide) :
  https://developer.android.com/develop/ui/views/launch/icon_design_adaptive

### C. Convention de versionning suggérée

Pas obligatoire mais conseillée pour la suite :
- `versionCode` : entier monotone croissant (1, 2, 3…)
- `versionName` : sémantique `MAJOR.MINOR.PATCH`
  - MAJOR : changement breaking (modèle de données incompatible)
  - MINOR : nouvelle fonctionnalité rétro-compatible
  - PATCH : bugfix

---

*Documentation rédigée à partir d'une exploration intégrale du code à la date du
ZIP. En cas de divergence entre cette doc et le code, **le code fait foi**.*
