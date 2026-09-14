package com.cdfrobotique.fiches

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.VibrationEffect
import android.os.VibratorManager
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

class MainActivity : ComponentActivity() {

    companion object {
        // Durée minimale d'affichage du splash, en millisecondes.
        // Sans cela, comme notre HTML est 100 % local, onPageFinished se déclenche
        // en ~200 ms et l'utilisateur ne voit pas l'écran de démarrage.
        // 2000 ms = valeur réglée pour ce projet.
        //
        // Note : la sensation de durée du splash dépend aussi (et surtout) de
        // l'absence de coupure visuelle à sa disparition. Voir le commentaire
        // dans `Theme.FichesHoraires` (themes.xml) qui aligne windowBackground
        // sur la couleur du splash (#DFEEFC) — modèle repris de urgpocket.
        private const val MIN_SPLASH_DURATION_MS = 2000L
        // Filet de sécurité : si onPageFinished tarde anormalement,
        // on libère le splash quoi qu'il arrive après ce délai.
        private const val SPLASH_TIMEOUT_MS = 3000L
    }

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val results = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            filePathCallback?.onReceiveValue(results)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Splash : on retient l'écran tant que les DEUX conditions ne sont pas
        // satisfaites :
        //  1) la WebView a fini de charger (webViewReady)
        //  2) ET il s'est écoulé au moins MIN_SPLASH_DURATION_MS depuis onCreate
        //
        // urgpocket (référence) ne fait que `installSplashScreen()` puis
        // `super.onCreate()` sans rien retenir, mais leur splash dure quand même
        // parce qu'ils chargent une URL distante (HTTPS) — c'est la latence réseau
        // qui maintient le splash. Nous chargeons un asset local instantané, donc
        // sans délai minimum le splash flashe en ~200 ms.
        val splashScreen = installSplashScreen()
        val splashStartMs = System.currentTimeMillis()
        var webViewReady = false
        splashScreen.setKeepOnScreenCondition {
            val elapsed = System.currentTimeMillis() - splashStartMs
            elapsed < MIN_SPLASH_DURATION_MS || !webViewReady
        }

        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 1001)
            }
        }

        webView = findViewById(R.id.webview)
        
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("handleBack()") { result ->
                    if (result == "false") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        })

        val rootView = findViewById<android.view.View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Signale au splash qu'on peut le retirer (la WebView est prête).
                webViewReady = true
            }
        }
        // Filet de sécurité : si onPageFinished tarde anormalement, on libère le splash après le timeout
        // pour ne pas bloquer l'utilisateur sur un écran statique.
        // (MIN_SPLASH_DURATION_MS reste un plancher, donc l'écran n'aura jamais disparu avant lui.)
        webView.postDelayed({ webViewReady = true }, SPLASH_TIMEOUT_MS)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = params?.createIntent()
                if (intent != null) {
                    try {
                        filePickerLauncher.launch(intent)
                        return true
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Erreur ouverture sélecteur fichier", e)
                    }
                }
                filePathCallback = null
                return false
            }
        }

        webView.addJavascriptInterface(BlobBridge(), "AndroidBlob")
        webView.loadUrl("https://appassets.androidplatform.net/assets/app.html")
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    inner class BlobBridge {
        @JavascriptInterface
        fun save(base64Data: String, mimeType: String, filename: String) {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                val safeMime = mimeType.ifBlank { "application/octet-stream" }
                val safeName = filename.ifBlank { "fichier" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, safeName)
                        put(MediaStore.MediaColumns.MIME_TYPE, safeMime)
                        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    uri?.let {
                        contentResolver.openOutputStream(it)?.use { os -> os.write(bytes) }
                        runOnUiThread { android.widget.Toast.makeText(this@MainActivity, "Enregistré : $safeName", android.widget.Toast.LENGTH_SHORT).show() }
                    }
                } else {
                    val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val out = File(downloads, safeName)
                    FileOutputStream(out).use { it.write(bytes) }
                    runOnUiThread { android.widget.Toast.makeText(this@MainActivity, "Enregistré dans Téléchargements", android.widget.Toast.LENGTH_SHORT).show() }
                }
            } catch (e: Exception) { Log.e("AndroidBlob", "Save failed", e) }
        }

        @JavascriptInterface
        fun vibrate(ms: Long) {
            val duration = if (ms <= 0) 10L else ms
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(VIBRATOR_SERVICE) as android.os.Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    v.vibrate(duration)
                }
            }
        }

        @JavascriptInterface
        fun share(base64Data: String, mimeType: String, filename: String) {
            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                val shareDir = File(cacheDir, "shared")
                shareDir.mkdirs()
                val outFile = File(shareDir, filename)
                FileOutputStream(outFile).use { it.write(bytes) }
                val uri = FileProvider.getUriForFile(this@MainActivity, "${packageName}.fileprovider", outFile)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(intent, "Partager"))
            } catch (e: Exception) { Log.e("AndroidBlob", "Share failed", e) }
        }
    }
}
