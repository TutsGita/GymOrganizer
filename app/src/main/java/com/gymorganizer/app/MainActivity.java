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
import org.json.JSONTokener;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MainActivity extends Activity {
    private static final String LATEST_RELEASE =
        "https://api.github.com/repos/TutsGita/GymOrganizer/releases/latest";
    private static final String CURRENT_VERSION = "0.3.0";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView view;
    private OkokScan scale;
    private static final int EXPORT_CARD = 28;
    private byte[] cardImage;

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
        scale = new OkokScan(this, (status, message, mass, impedance) -> view.evaluateJavascript(
            "window.showScaleStatus(" + JSONObject.quote(status) + "," + JSONObject.quote(message)
                + "," + mass + "," + impedance + ")", null));
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                if (!request.isForMainFrame()) return true;
                String url = request.getUrl().toString();
                if ("gym://okok/cancel".equals(url)) scale.stop();
                if (request.hasGesture()) {
                    if ("gym://okok/scan".equals(url)) scale.request();
                    if ("gym://okok/diagnostic".equals(url)) scale.requestDiagnostic();
                    if ("gym://okok/weight".equals(url)) scale.confirmPending();
                    if ("gym://body-card/export".equals(url)) exportBodyCard();
                }
                return true;
            }
        });
        android.widget.FrameLayout safeArea = new android.widget.FrameLayout(this);
        safeArea.setBackgroundColor(0xff171722);
        safeArea.addView(view);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            safeArea.setOnApplyWindowInsetsListener((container, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                container.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        } else if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.view.WindowManager.LayoutParams layout = getWindow().getAttributes();
            layout.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            getWindow().setAttributes(layout);
        }
        setContentView(safeArea);
        safeArea.requestApplyInsets();
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        view.loadUrl("file:///android_asset/index.html");
        checkForUpdate();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == OkokScan.PERMISSION) scale.afterPermission();
    }

    @Override
    protected void onStop() {
        scale.suspend();
        super.onStop();
    }

    private void exportBodyCard() {
        if (cardImage != null) return;
        view.evaluateJavascript("window.bodyCardPng()", result -> {
            try {
                Object encoded = new JSONTokener(result).nextValue();
                if (!(encoded instanceof String) || ((String) encoded).length() > 2_000_000) {
                    throw new IllegalArgumentException("Imagem inválida");
                }
                cardImage = android.util.Base64.decode((String) encoded, android.util.Base64.DEFAULT);
                Intent destination = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("image/png")
                    .putExtra(Intent.EXTRA_TITLE, "Gym Organizer - Pesagem.png");
                startActivityForResult(destination, EXPORT_CARD);
            } catch (Exception error) {
                cardImage = null;
                showCardMessage("Não foi possível preparar o cartão.");
            }
        });
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != EXPORT_CARD) return;
        byte[] pixels = cardImage;
        cardImage = null;
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        if (pixels == null) { showCardMessage("Gere o cartão novamente."); return; }
        Uri destination = data.getData();
        try (java.io.OutputStream stream = getContentResolver().openOutputStream(destination)) {
            if (stream == null) throw new java.io.IOException("Destino indisponível");
            stream.write(pixels);
        } catch (java.io.IOException | SecurityException error) {
            showCardMessage("Não foi possível salvar a imagem.");
            return;
        }
        Intent share = new Intent(Intent.ACTION_SEND).setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, destination)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        share.setClipData(android.content.ClipData.newUri(getContentResolver(), "Cartão da pesagem", destination));
        startActivity(Intent.createChooser(share, "Compartilhar cartão"));
    }

    private void showCardMessage(String message) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show();
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
