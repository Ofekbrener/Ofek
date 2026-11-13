package com.ofek.zombies;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app update. The game calls window.AndroidUpdate.start(url): the new APK streams straight into an Android
 * install session with download progress sent back to the game, then Android shows its own install confirmation
 * (it always asks for apps that do not come from a store). Events reach the game as UPD_EVENT(name, value).
 */
public class Updater {
  private static final String ACTION = "com.ofek.zombies.INSTALL_STATUS";
  private final Activity act;
  private final WebView web;
  private volatile boolean busy;

  Updater(Activity a, WebView w) {
    act = a; web = w;
    BroadcastReceiver r = new BroadcastReceiver() {
      @Override public void onReceive(Context c, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
          Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
          if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); act.startActivity(confirm); }
          send("confirm", 0);
        } else if (st == PackageInstaller.STATUS_SUCCESS) { busy = false; send("done", 0); }
        else { busy = false; send("error", st); }
      }
    };
    IntentFilter f = new IntentFilter(ACTION);
    if (Build.VERSION.SDK_INT >= 33) act.registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED); else act.registerReceiver(r, f);
  }

  private void send(String ev, long v) { web.post(() -> web.evaluateJavascript("window.UPD_EVENT&&UPD_EVENT('" + ev + "'," + v + ")", null)); }

  /** Android 8+ asks once per app before it may install updates. */
  @JavascriptInterface public boolean canInstall() { return Build.VERSION.SDK_INT < 26 || act.getPackageManager().canRequestPackageInstalls(); }

  /** Opens the system page where the player allows this app to install updates. */
  @JavascriptInterface public void allow() {
    if (Build.VERSION.SDK_INT >= 26) act.runOnUiThread(() -> act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName()))));
  }

  @JavascriptInterface public void start(String url) {
    if (busy) return; busy = true;
    new Thread(() -> {
      try {
        HttpURLConnection con = open(url);
        long total = con.getContentLengthLong();
        PackageInstaller pi = act.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams p = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        if (total > 0) p.setSize(total);
        int id = pi.createSession(p);
        PackageInstaller.Session s = pi.openSession(id);
        try (InputStream in = con.getInputStream(); OutputStream out = s.openWrite("update.apk", 0, total > 0 ? total : -1)) {
          byte[] buf = new byte[65536]; long got = 0, last = -1; int n;
          while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n); got += n;
            long pct = total > 0 ? got * 100 / total : -1; if (pct != last) { last = pct; send("progress", pct); }
          }
          s.fsync(out);
        }
        Intent i = new Intent(ACTION).setPackage(act.getPackageName());
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        send("installing", 0);
        s.commit(PendingIntent.getBroadcast(act, id, i, fl).getIntentSender());
        s.close();
      } catch (Exception e) { busy = false; send("error", -1); }
    }).start();
  }

  /** GitHub release links redirect to a download host; follow up to 5 hops. */
  private static HttpURLConnection open(String url) throws IOException {
    for (int hop = 0; hop < 5; hop++) {
      HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
      c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000);
      int code = c.getResponseCode();
      if (code >= 300 && code < 400) { url = c.getHeaderField("Location"); c.disconnect(); continue; }
      if (code != 200) throw new IOException("HTTP " + code);
      return c;
    }
    throw new IOException("too many redirects");
  }
}
