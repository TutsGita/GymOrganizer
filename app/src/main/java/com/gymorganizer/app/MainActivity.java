package com.gymorganizer.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowInsets;
import android.view.RoundedCorner;
import android.view.View;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebViewRenderProcess;
import android.webkit.WebViewRenderProcessClient;
import android.widget.FrameLayout;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;
import org.json.JSONTokener;


public final class MainActivity extends Activity {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView view;
    private FrameLayout safeArea;
    private int navInsetLeft;
    private int navInsetRight;
    private boolean foreground;
    private Runnable recoverRenderer;
    private static long lastRendererRestart;
    private OkokScan scale;
    private AppUpdates updates;
    private WellnessBridge wellness;
    private static final int EXPORT_CARD = 28;
    private static final int EXPORT_PLAN = 29;
    private byte[] cardImage;
    private JSONObject pdfPlan;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        updates = new AppUpdates(this);
        view = new WebView(this);
        wellness = new WellnessBridge(this, view);
        view.addJavascriptInterface(wellness, "GymWellness");
        view.addJavascriptInterface(new PlanExporter(), "GymPlan");
        view.setBackgroundColor(0xff171722);
        view.addJavascriptInterface(new ScreenAppearance(), "GymScreen");
        if (android.os.Build.VERSION.SDK_INT >= 35) {
            view.setRequestedFrameRate(View.REQUESTED_FRAME_RATE_CATEGORY_HIGH);
        }
        if (android.os.Build.VERSION.SDK_INT >= 29) watchRenderer();
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
            public void onPageFinished(WebView webView, String url) {
                applyNavigationInsets();
            }

            @Override
            public boolean onRenderProcessGone(WebView failed, RenderProcessGoneDetail detail) {
                cancelRendererRecovery();
                scale.stop();
                safeArea.removeView(failed);
                failed.destroy();
                view = null;
                long now = android.os.SystemClock.elapsedRealtime();
                if (lastRendererRestart == 0 || now - lastRendererRestart > 15000) {
                    lastRendererRestart = now;
                    recreate();
                } else {
                    android.widget.Button retry = new android.widget.Button(MainActivity.this);
                    retry.setText("Reabrir Gym Organizer");
                    retry.setOnClickListener(button -> recreate());
                    FrameLayout.LayoutParams position = new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                        android.view.Gravity.CENTER);
                    safeArea.addView(retry, position);
                }
                return true;
            }

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
                    if ("gym://updates/check".equals(url)) updates.check(true);
                    Uri target = request.getUrl();
                    if (url.matches("https://commons\\.wikimedia\\.org/wiki/File:[A-Za-z0-9_-]+\\.(?i:webm|jpg)")
                            || url.matches("https://wger\\.de/media/exercise-images/[A-Za-z0-9_./%()\\-]+")
                            || url.matches("https://wger\\.de/media/exercise-video/[0-9]+/[A-Za-z0-9_-]+\\.(?i:mp4|mov|webm|m4v)")
                            || url.matches("https://creativecommons\\.org/(licenses/by(?:-sa)?/(?:3|4)\\.0|publicdomain/(?:mark|zero)/1\\.0)/?")
                            || "https://github.com/namnq/workout-free-videos/tree/v2.0.0".equals(url)) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, target));
                        } catch (android.content.ActivityNotFoundException ignored) { }
                    }
                    if ("gym://wellness/tbca".equals(url)) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.tbca.net.br/base-dados/composicao_alimentos.php")));
                        } catch (android.content.ActivityNotFoundException ignored) { }
                    }
                }
                return true;
            }
        });
        safeArea = new FrameLayout(this);
        safeArea.setBackgroundColor(0xff171722);
        safeArea.addView(view);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
            safeArea.setOnApplyWindowInsetsListener((container, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                container.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                if (android.os.Build.VERSION.SDK_INT >= 31) {
                    int left = cornerSideInset(insets, RoundedCorner.POSITION_BOTTOM_LEFT, safe.bottom, safe.left);
                    int right = cornerSideInset(insets, RoundedCorner.POSITION_BOTTOM_RIGHT, safe.bottom, safe.right);
                    if (left != navInsetLeft || right != navInsetRight) {
                        navInsetLeft = left;
                        navInsetRight = right;
                        applyNavigationInsets();
                    }
                }
                return WindowInsets.CONSUMED;
            });
        } else if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.view.WindowManager.LayoutParams layout = getWindow().getAttributes();
            layout.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            getWindow().setAttributes(layout);
        }
        setContentView(safeArea);
        safeArea.requestApplyInsets();
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        view.loadUrl("file:///android_asset/index.html");
        updates.check(false);
    }

    private static int cornerSideInset(WindowInsets insets, int position, int bottom, int side) {
        RoundedCorner corner = insets.getRoundedCorner(position);
        if (corner == null || bottom >= corner.getRadius()) return 0;
        int radius = corner.getRadius();
        double y = radius - bottom;
        return Math.max(0, (int) Math.ceil(radius - Math.sqrt((double) radius * radius - y * y)) - side);
    }

    private void applyNavigationInsets() {
        if (view == null) return;
        float density = getResources().getDisplayMetrics().density;
        view.evaluateJavascript(
            "document.documentElement.style.setProperty('--nav-safe-left', '" + Math.ceil(navInsetLeft / density) + "px');"
                + "document.documentElement.style.setProperty('--nav-safe-right', '" + Math.ceil(navInsetRight / density) + "px');",
            null);
    }

    private final class ScreenAppearance {
        @android.webkit.JavascriptInterface
        public void apply(String top, String bottom) {
            if (top == null || bottom == null || !top.matches("#[0-9a-fA-F]{6}") ||
                    !bottom.matches("#[0-9a-fA-F]{6}")) return;
            int statusColor = android.graphics.Color.parseColor(top);
            int navigationColor = android.graphics.Color.parseColor(bottom);
            mainHandler.post(() -> {
                if (isFinishing() || isDestroyed() || view == null) return;
                safeArea.setBackground(new android.graphics.drawable.GradientDrawable(
                    android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
                    new int[]{statusColor, statusColor, navigationColor, navigationColor}));
                view.setBackgroundColor(statusColor);
                if (android.os.Build.VERSION.SDK_INT < 30) {
                    getWindow().setStatusBarColor(statusColor);
                    getWindow().setNavigationBarColor(navigationColor);
                }
                boolean lightTop = android.graphics.Color.luminance(statusColor) > 0.5;
                boolean lightBottom = android.graphics.Color.luminance(navigationColor) > 0.5;
                if (android.os.Build.VERSION.SDK_INT >= 30) {
                    android.view.WindowInsetsController controller = getWindow().getInsetsController();
                    if (controller != null) {
                        int topFlag = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS;
                        int bottomFlag = android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        controller.setSystemBarsAppearance(
                            (lightTop ? topFlag : 0) | (lightBottom ? bottomFlag : 0), topFlag | bottomFlag);
                    }
                } else {
                    getWindow().getDecorView().setSystemUiVisibility(
                        (lightTop ? View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : 0)
                        | (lightBottom ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
                }
            });
        }
    }

    private void watchRenderer() {
        view.setWebViewRenderProcessClient(new WebViewRenderProcessClient() {
            @Override
            public void onRenderProcessUnresponsive(WebView affected, WebViewRenderProcess process) {
                if (!foreground || process == null || recoverRenderer != null) return;
                recoverRenderer = () -> {
                    recoverRenderer = null;
                    if (foreground && view == affected && !isFinishing()) process.terminate();
                };
                mainHandler.postDelayed(recoverRenderer, 5000);
            }

            @Override
            public void onRenderProcessResponsive(WebView affected, WebViewRenderProcess process) {
                cancelRendererRecovery();
            }
        });
    }

    private void cancelRendererRecovery() {
        if (recoverRenderer != null) mainHandler.removeCallbacks(recoverRenderer);
        recoverRenderer = null;
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
        updates.onResume();
    }

    @Override
    protected void onPause() {
        foreground = false;
        updates.onPause();
        cancelRendererRecovery();
        super.onPause();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == OkokScan.PERMISSION) scale.afterPermission();
        if (code == WaterReminder.PERMISSION) wellness.afterReminderPermission();
    }

    @Override
    protected void onStop() {
        scale.suspend();
        wellness.onStop();
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
        if (request == EXPORT_PLAN) {
            JSONObject plan = pdfPlan;
            pdfPlan = null;
            if (result == RESULT_OK && data != null && data.getData() != null) {
                if (plan == null) showCardMessage("Exporte o plano novamente.");
                else savePlanPdf(plan, data.getData());
            }
            return;
        }
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

    private final class PlanExporter {
        @android.webkit.JavascriptInterface
        public void exportPdf(String json) {
            if (json == null || json.length() > 2_000_000) return;
            runOnUiThread(() -> {
                if (pdfPlan != null || isFinishing() || isDestroyed()) return;
                try {
                    pdfPlan = new JSONObject(json);
                    String filename = pdfPlan.getString("name").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
                    Intent destination = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("application/pdf")
                        .putExtra(Intent.EXTRA_TITLE, (filename.isEmpty() ? "Plano de treino" : filename) + ".pdf");
                    startActivityForResult(destination, EXPORT_PLAN);
                } catch (Exception error) {
                    pdfPlan = null;
                    showCardMessage("Não foi possível preparar o PDF.");
                }
            });
        }
    }

    private void savePlanPdf(JSONObject plan, Uri destination) {
        new Thread(() -> {
            String message;
            try (java.io.OutputStream stream = getContentResolver().openOutputStream(destination)) {
                if (stream == null) throw new java.io.IOException("Destino indisponível");
                PlanPdf.write(plan, stream);
                message = "Plano salvo em PDF.";
            } catch (Exception error) {
                message = "Não foi possível salvar o plano em PDF.";
            }
            String result = message;
            runOnUiThread(() -> showCardMessage(result));
        }, "gym-plan-pdf").start();
    }

    private void showCardMessage(String message) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        if (view == null) { finish(); return; }
        view.evaluateJavascript("window.gymBack ? window.gymBack() : false", result -> {
            if ("false".equals(result)) finish();
        });
    }
}
