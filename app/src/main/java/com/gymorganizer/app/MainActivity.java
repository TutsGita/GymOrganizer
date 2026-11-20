package com.gymorganizer.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MainActivity extends Activity {
    private static final String LATEST_RELEASE =
        "https://api.github.com/repos/TutsGita/GymOrganizer/releases/latest";
    private static final String CURRENT_VERSION = "0.1.1";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView view;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        view = new WebView(this);
        view.setBackgroundColor(0xff171722);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setBlockNetworkLoads(true);
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                return true;
            }
        });
        setContentView(view);
        getWindow().getDecorView().setBackgroundColor(0xff171722);
        view.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 35) {
                android.graphics.Insets padding = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime()
                );
                v.setPadding(padding.left, padding.top, padding.right, padding.bottom);
            }
            return insets;
        });
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        view.loadUrl("file:///android_asset/index.html");
        checkForUpdate();
    }

    private void checkForUpdate() {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(LATEST_RELEASE).openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(4000);
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;
                StringBuilder response = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = reader.readLine()) != null) response.append(line);
                }
                JSONObject release = new JSONObject(response.toString());
                String latest = release.optString("tag_name", "").replaceFirst("^[vV]", "");
                String releaseUrl = release.optString("html_url", "");
                if (isNewerVersion(latest, CURRENT_VERSION) && releaseUrl.startsWith("https://github.com/")) {
                    mainHandler.post(() -> showUpdateDialog(releaseUrl));
                }
            } catch (Exception ignored) {
                // Update checks are optional. Keep the workout app usable offline.
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "gym-update-check").start();
    }

    private boolean isNewerVersion(String latest, String current) {
        Pattern pattern = Pattern.compile("\\d+");
        Matcher latestParts = pattern.matcher(latest);
        Matcher currentParts = pattern.matcher(current);
        while (latestParts.find() && currentParts.find()) {
            int latestNumber = Integer.parseInt(latestParts.group());
            int currentNumber = Integer.parseInt(currentParts.group());
            if (latestNumber != currentNumber) return latestNumber > currentNumber;
        }
        return latestParts.find();
    }

    private void showUpdateDialog(String releaseUrl) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
            .setTitle("Atualização disponível")
            .setMessage("Uma nova versão do Gym Organizer está disponível no GitHub.")
            .setNegativeButton("Agora não", null)
            .setPositiveButton("Baixar", (dialog, which) ->
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(releaseUrl))))
            .show();
    }

    @Override
    public void onBackPressed() {
        view.evaluateJavascript("window.gymBack ? window.gymBack() : false", result -> {
            if ("false".equals(result)) finish();
        });
    }
}
