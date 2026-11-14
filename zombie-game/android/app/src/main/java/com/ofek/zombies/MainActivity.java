package com.ofek.zombies;

import android.app.Activity;
import android.content.Intent;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import java.util.Locale;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/** Runs the web game full screen. Files are served from assets/www under an https origin so fetch() works. */
public class MainActivity extends Activity {
  private static final String HOST = "appassets.androidplatform.net";
  private static final Map<String, String> MIME = new HashMap<>();
  static {
    MIME.put("html", "text/html"); MIME.put("js", "application/javascript"); MIME.put("json", "application/json");
    MIME.put("mp3", "audio/mpeg"); MIME.put("png", "image/png"); MIME.put("css", "text/css"); MIME.put("svg", "image/svg+xml");
  }
  private WebView web;
  private TextToSpeech tts;
  private boolean ttsReady;

  /** Speech for the radio lines; the game calls window.AndroidTTS.speak(text, pitch, rate). */
  public class TtsBridge {
    @JavascriptInterface public void speak(String text, float pitch, float rate) {
      if (!ttsReady) return; tts.setPitch(pitch); tts.setSpeechRate(rate); tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "radio");
    }
    @JavascriptInterface public void stop() { if (ttsReady) tts.stop(); }
  }

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if (Build.VERSION.SDK_INT >= 28) getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    web = new WebView(this);
    setContentView(web);
    hideBars();
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    // the phone's font size setting must not enlarge the game's text: the screens are laid out for 100%
    s.setTextZoom(100);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setAllowFileAccess(false);
    tts = new TextToSpeech(this, status -> { if (status == TextToSpeech.SUCCESS) { tts.setLanguage(Locale.US); ttsReady = true; } });
    web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");
    web.addJavascriptInterface(new Updater(this, web), "AndroidUpdate");
    web.setWebViewClient(new WebViewClient() {
      // links outside the game (the update download) open in the phone's browser
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        if (HOST.equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* no browser installed */ }
        return true;
      }
      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
        Uri u = req.getUrl();
        if (!HOST.equals(u.getHost())) return null; // fonts and anything else load from the internet when online
        String path = u.getPath() == null || u.getPath().equals("/") ? "/index.html" : u.getPath();
        try {
          InputStream in = getAssets().open("www" + path);
          String ext = path.substring(path.lastIndexOf('.') + 1);
          String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
          return new WebResourceResponse(mime, mime.startsWith("text") || ext.equals("js") || ext.equals("json") ? "utf-8" : null, in);
        } catch (IOException e) {
          return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
        }
      }
    });
    if (state != null) web.restoreState(state); else web.loadUrl("https://" + HOST + "/index.html");
  }

  private void hideBars() {
    web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
  }
  @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) hideBars(); }
  @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
  // the game's Web Audio keeps playing in a paused WebView, so the game is told to go silent first
  @Override protected void onPause() { web.evaluateJavascript("window.APP_PAUSE&&APP_PAUSE()", null); if (tts != null) tts.stop(); web.onPause(); web.pauseTimers(); super.onPause(); }
  @Override protected void onResume() { super.onResume(); web.onResume(); web.resumeTimers(); web.evaluateJavascript("window.APP_RESUME&&APP_RESUME()", null); }
  @Override protected void onDestroy() { if (tts != null) tts.shutdown(); super.onDestroy(); }
  @Override public void onBackPressed() { moveTaskToBack(true); }
}
