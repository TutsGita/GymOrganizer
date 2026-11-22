package com.gymorganizer.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.HashSet;

import javax.net.ssl.HttpsURLConnection;

final class AppUpdates {
    static final int INSTALL_PERMISSION = 29;
    private static final String REPO = "https://github.com/TutsGita/GymOrganizer/releases/download/";
    private static final String API = "https://api.github.com/repos/TutsGita/GymOrganizer/releases/latest";
    private static final long MAX_APK_BYTES = 128L * 1024 * 1024;
    private final Activity activity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean foreground;
    private boolean installerOpened;
    private boolean busy;
    private Release available;
    private boolean ready;
    private AlertDialog dialog;

    private static final class Release {
        final String version;
        final String url;
        final long size;
        Release(String version, String url, long size) {
            this.version = version;
            this.url = url;
            this.size = size;
        }
    }

    AppUpdates(Activity activity) { this.activity = activity; }

    void onResume() {
        foreground = true;
        showOffer();
    }

    void onPause() { foreground = false; }

    private boolean visible() {
        return foreground && !activity.isFinishing() && !activity.isDestroyed();
    }

    void check(boolean manual) {
        if (busy) {
            if (manual) message("Aguarde a operação em andamento.");
            return;
        }
        if (ready) { showOffer(); return; }
        busy = true;
        if (manual) message("Verificando atualizações…");
        new Thread(() -> {
            try {
                PackageInfo installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
                Release release = findRelease(installed.versionName);
                main.post(() -> {
                    busy = false;
                    available = release;
                    if (release != null) showOffer();
                    else if (manual) message("Você já tem a versão mais recente.");
                });
            } catch (Exception error) {
                main.post(() -> {
                    busy = false;
                    if (manual) message("Não foi possível verificar. Confira sua conexão e tente novamente.");
                });
            }
        }, "gym-update-check").start();
    }

    private static Release findRelease(String installed) throws Exception {
        HttpsURLConnection http = open(new URL(API));
        JSONObject metadata;
        try {
            if (http.getResponseCode() != 200) throw new IOException("Release indisponível.");
            try (InputStream in = http.getInputStream(); ByteArrayOutputStream body = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = in.read(buffer)) != -1) {
                    if (body.size() + count > 512 * 1024) throw new IOException("Resposta grande demais.");
                    body.write(buffer, 0, count);
                }
                metadata = new JSONObject(new String(body.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally {
            http.disconnect();
        }
        String tag = metadata.optString("tag_name");
        if (!tag.matches("v[0-9]{1,5}\\.[0-9]{1,5}\\.[0-9]{1,5}")) return null;
        String version = tag.substring(1);
        if (!newer(version, installed)) return null;
        String file = "GymOrganizer-" + version + ".apk";
        String expected = REPO + tag + "/" + file;
        JSONArray assets = metadata.getJSONArray("assets");
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            long size = asset.optLong("size");
            if (file.equals(asset.optString("name")) && expected.equals(asset.optString("browser_download_url"))
                    && size > 0 && size <= MAX_APK_BYTES) return new Release(version, expected, size);
        }
        throw new IOException("APK ausente na release.");
    }

    static boolean newer(String next, String previous) {
        if (next == null || previous == null || !next.matches("[0-9]{1,5}(\\.[0-9]{1,5}){2}")
                || !previous.matches("[0-9]{1,5}(\\.[0-9]{1,5}){2}")) return false;
        String[] a = next.split("\\.");
        String[] b = previous.split("\\.");
        for (int i = 0; i < a.length; i++) {
            int diff = Integer.parseInt(a[i]) - Integer.parseInt(b[i]);
            if (diff != 0) return diff > 0;
        }
        return false;
    }

    private void showOffer() {
        if (!visible() || available == null || busy || (dialog != null && dialog.isShowing())) return;
        dialog = new AlertDialog.Builder(activity)
            .setTitle(ready ? "Atualização pronta" : "Atualização disponível")
            .setMessage(ready ? "Confirme a instalação da versão " + available.version + " no Android."
                : "Baixe a versão " + available.version + " pelo Gym Organizer.")
            .setNegativeButton("Agora não", (d, which) -> { if (!ready) available = null; })
            .setPositiveButton(ready ? "Instalar" : "Baixar no app", (d, which) -> {
                if (ready) install(); else download(available);
            }).show();
    }

    private void download(Release release) {
        busy = true;
        message("Baixando atualização…");
        new Thread(() -> {
            File temporary = null;
            String error = null;
            try {
                temporary = File.createTempFile("apk-download-", ".apk", activity.getCacheDir());
                downloadApk(release, temporary);
                validateApk(temporary, release.version);
                Files.move(temporary.toPath(), UpdateApkProvider.file(activity).toPath(),
                    StandardCopyOption.REPLACE_EXISTING);
            } catch (SecurityException invalid) {
                error = "O APK não corresponde à instalação atual.";
            } catch (Exception failed) {
                error = "Não foi possível baixar a atualização completa.";
            } finally {
                if (temporary != null) temporary.delete();
            }
            final String failure = error;
            main.post(() -> {
                busy = false;
                ready = failure == null;
                if (ready) showOffer();
                else message(failure);
            });
        }, "gym-update-download").start();
    }

    private static HttpsURLConnection open(URL url) throws IOException {
        HttpsURLConnection http = (HttpsURLConnection) url.openConnection();
        http.setInstanceFollowRedirects(false);
        http.setConnectTimeout(8000);
        http.setReadTimeout(12000);
        http.setRequestProperty("User-Agent", "GymOrganizer-Android");
        return http;
    }

    private static void downloadApk(Release release, File destination) throws IOException {
        URL url = new URL(release.url);
        for (int hop = 0; hop <= 4; hop++) {
            String host = url.getHost();
            if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null ||
                    (url.getPort() != -1 && url.getPort() != 443) ||
                    !("github.com".equalsIgnoreCase(host) || "release-assets.githubusercontent.com".equalsIgnoreCase(host)
                    || "objects.githubusercontent.com".equalsIgnoreCase(host))) throw new IOException("Origem inválida.");
            HttpsURLConnection http = open(url);
            try {
                int status = http.getResponseCode();
                if (status >= 300 && status < 400) {
                    String next = http.getHeaderField("Location");
                    if (next == null) throw new IOException("Redirecionamento inválido.");
                    url = new URL(url, next);
                    continue;
                }
                if (status != 200) throw new IOException("APK indisponível.");
                try (InputStream in = http.getInputStream(); FileOutputStream out = new FileOutputStream(destination)) {
                    byte[] buffer = new byte[64 * 1024];
                    int count;
                    long total = 0;
                    while ((count = in.read(buffer)) != -1) {
                        total += count;
                        if (total > release.size) throw new IOException("APK excede o tamanho esperado.");
                        out.write(buffer, 0, count);
                    }
                    if (total != release.size) throw new IOException("APK incompleto.");
                }
                return;
            } finally {
                http.disconnect();
            }
        }
        throw new IOException("Muitos redirecionamentos.");
    }

    private void validateApk(File apk, String version) throws PackageManager.NameNotFoundException {
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flags);
        PackageInfo candidate = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (candidate == null || !installed.packageName.equals(candidate.packageName)
                || !version.equals(candidate.versionName)) throw new SecurityException();
        long currentCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        long updateCode = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
        Signature[] current = signers(installed);
        Signature[] update = signers(candidate);
        if (updateCode <= currentCode || current == null || update == null || current.length == 0 ||
                !new HashSet<>(Arrays.asList(current)).equals(new HashSet<>(Arrays.asList(update)))) {
            throw new SecurityException();
        }
    }

    private static Signature[] signers(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= 28) {
            return info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners();
        }
        return info.signatures;
    }

    private void install() {
        if (!ready || !visible()) return;
        try {
            if (!activity.getPackageManager().canRequestPackageInstalls()) {
                new AlertDialog.Builder(activity).setTitle("Permitir instalação")
                    .setMessage("O Android pede autorização para o Gym Organizer instalar o APK baixado. Você pode revisar essa permissão nas configurações.")
                    .setNegativeButton("Cancelar", null)
                    .setPositiveButton("Abrir configurações", (d, which) -> openInstallSettings()).show();
                return;
            }
            Uri apk = UpdateApkProvider.uri(activity);
            Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE, apk)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(install);
            installerOpened = true;
        } catch (RuntimeException failure) {
            message("Não foi possível abrir o instalador do Android.");
        }
    }

    private void openInstallSettings() {
        try {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(settings);
        } catch (RuntimeException failure) {
            message("Não foi possível abrir as configurações de instalação.");
        }
    }

    private void message(String text) {
        if (visible()) Toast.makeText(activity, text, Toast.LENGTH_LONG).show();
    }
}
