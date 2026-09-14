# Preserve the JavascriptInterface bridge methods (called via reflection from WebView JS)
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.cdfrobotique.fiches.MainActivity$BlobBridge { *; }

