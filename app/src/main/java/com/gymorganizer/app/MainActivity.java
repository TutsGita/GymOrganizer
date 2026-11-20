package com.gymorganizer.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
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
    }

    @Override
    public void onBackPressed() {
        view.evaluateJavascript("window.gymBack ? window.gymBack() : false", result -> {
            if ("false".equals(result)) finish();
        });
    }
}
