package com.gymorganizer.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.MediaController;
import android.widget.VideoView;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

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
import java.util.HashSet;
import java.util.Set;

import javax.net.ssl.HttpsURLConnection;

final class WellnessBridge {
    private static final String USER_AGENT = "GymOrganizer/0.4.1 (https://github.com/TutsGita/GymOrganizer)";
    private static final int MAX_RESPONSE = 360_000;
    private static final long MAX_VIDEO = 64L * 1024 * 1024;
    private static final long VIDEO_BUDGET = 128L * 1024 * 1024;
    private static final String TACO = "https://brolesi.github.io/taco/";
    private final Activity activity;
    private final WebView web;
    private final File videos;
    private int reminderRequest;
    private int[] reminderSchedule;
    private boolean savingVideo;
    private AlertDialog videoDialog;

    WellnessBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        videos = new File(activity.getFilesDir(), "saved-exercise-videos");
    }

    @JavascriptInterface
    public void request(int id, String operation, String argument) {
        if (id <= 0 || operation == null || argument == null || argument.length() > 300) return;
        activity.runOnUiThread(() -> {
            if (!alive()) return;
            switch (operation) {
                case "barcode": scan(id); break;
                case "reminder": configureReminder(id, argument); break;
                case "play-video": play(id, argument); break;
                case "save-video": saveVideo(id, argument); break;
                case "remove-video": removeVideo(id, argument); break;
                case "taco-index": case "taco-food": case "product":
                    new Thread(() -> lookup(id, operation, argument), "gym-food-lookup").start();
                    break;
                default: fail(id, "Ação indisponível.");
            }
        });
    }

    @JavascriptInterface
    public boolean videoSaved(String url) {
        return validVideo(url) && fileFor(url).isFile();
    }

    @JavascriptInterface
    public boolean hasSavedVideos() {
        return videos.isDirectory();
    }

    @JavascriptInterface
    public void pruneSavedVideos(String catalogUrls) {
        if (catalogUrls == null || catalogUrls.length() > 1_000_000) return;
        Set<String> keep = new HashSet<>();
        try {
            JSONArray urls = new JSONArray(catalogUrls);
            for (int i = 0; i < urls.length(); i++) {
                String url = urls.getString(i);
                if (!validVideo(url)) return;
                keep.add(fileFor(url).getName());
            }
        } catch (org.json.JSONException invalid) {
            return;
        }
        new Thread(() -> SavedVideoFiles.removeObsolete(videos, keep), "gym-prune-videos").start();
    }

    @JavascriptInterface
    public String reminder() {
        android.content.SharedPreferences s = WaterReminder.preferences(activity);
        return s.getInt("start", 8) + "," + s.getInt("end", 21) + "," +
            (WaterReminder.allowed(activity) ? s.getInt("interval", 0) : 0);
    }

    private boolean alive() { return !activity.isFinishing() && !activity.isDestroyed(); }

    private void reply(int id, Object value, String error) {
        String data = value == null ? "null" : JSONObject.wrap(value).toString();
        activity.runOnUiThread(() -> {
            if (alive()) web.evaluateJavascript("window.finishWellness(" + id + "," + data + ","
                + (error == null ? "null" : JSONObject.quote(error)) + ")", null);
        });
    }

    private void fail(int id, String error) { reply(id, null, error); }
    private void ok(int id, Object value) {
        if (value instanceof String) {
            activity.runOnUiThread(() -> {
                if (alive()) web.evaluateJavascript("window.finishWellness(" + id + "," + JSONObject.quote((String)value) + ",null)", null);
            });
        } else reply(id, value, null);
    }

    private static HttpsURLConnection connect(String url) throws IOException {
        HttpsURLConnection http = (HttpsURLConnection) new URL(url).openConnection();
        http.setInstanceFollowRedirects(false);
        http.setConnectTimeout(8000);
        http.setReadTimeout(12000);
        http.setRequestProperty("User-Agent", USER_AGENT);
        return http;
    }

    private static JSONObject getJson(String url, boolean allowMissing) throws Exception {
        HttpsURLConnection http = connect(url);
        try {
            int status = http.getResponseCode();
            if (allowMissing && status == 404) return new JSONObject();
            if (status != 200) throw new IOException("Resposta indisponível");
            try (InputStream in = http.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int length;
                while ((length = in.read(buffer)) != -1) {
                    if (out.size() + length > MAX_RESPONSE) throw new IOException("Resposta excede o limite");
                    out.write(buffer, 0, length);
                }
                return new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally { http.disconnect(); }
    }

    private void lookup(int id, String operation, String argument) {
        try {
            if ("taco-index".equals(operation)) {
                JSONArray results = getJson(TACO + "foods.json", false).getJSONArray("foods");
                JSONArray index = new JSONArray();
                for (int i = 0; i < results.length(); i++) {
                    JSONObject item = results.getJSONObject(i);
                    index.put(new JSONArray().put(item.getInt("id")).put(item.getString("description")));
                }
                ok(id, index);
            } else if ("taco-food".equals(operation) && argument.matches("[0-9]{1,4}")) {
                JSONObject raw = getJson(TACO + "foods/" + argument + ".json", false);
                JSONObject food = new JSONObject().put("name", raw.getString("description")).put("source", "TACO");
                map(food, raw, new String[]{"energy_kcal", "protein_g", "carbohydrate_g", "lipids_g", "dietary_fiber_g"});
                ok(id, food);
            } else if ("product".equals(operation) && argument.matches("[0-9]{8}|[0-9]{12,14}")) {
                JSONObject payload = getJson("https://world.openfoodfacts.org/api/v2/product/" + argument
                    + ".json?fields=product_name,nutriments,product_quantity_unit", true);
                JSONObject raw = payload.optJSONObject("product");
                if (payload.optInt("status") != 1 || raw == null) { ok(id, false); return; }
                JSONObject nutrients = raw.optJSONObject("nutriments");
                JSONObject food = new JSONObject().put("name", raw.optString("product_name", ""))
                    .put("source", "Open Food Facts").put("barcode", argument);
                boolean liquid = "ml".equalsIgnoreCase(raw.optString("product_quantity_unit"));
                food.put("unit", liquid ? "mL" : "g");
                map(food, nutrients, new String[]{"energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "fiber_100g"});
                ok(id, food);
            } else fail(id, "Código inválido.");
        } catch (Exception error) {
            fail(id, "Consulta indisponível. Confira a conexão ou cadastre o alimento manualmente.");
        }
    }

    private static void map(JSONObject food, JSONObject source, String[] keys) throws Exception {
        String[] labels = {"energy", "protein", "carbs", "fat", "fiber"};
        for (int i = 0; i < keys.length; i++) {
            double n = source == null ? Double.NaN : source.optDouble(keys[i], Double.NaN);
            food.put(labels[i], Double.isFinite(n) && n >= 0 ? n : JSONObject.NULL);
        }
    }

    private void scan(int id) {
        try {
            GmsBarcodeScannerOptions formats = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A)
                .build();
            GmsBarcodeScanning.getClient(activity, formats).startScan()
                .addOnSuccessListener(code -> {
                    String value = code.getRawValue();
                    if (value == null) fail(id, "Não foi possível ler o código.");
                    else ok(id, value);
                })
                .addOnCanceledListener(() -> ok(id, false))
                .addOnFailureListener(error -> fail(id, "Leitor indisponível. Digite o código de barras."));
        } catch (RuntimeException error) { fail(id, "Leitor indisponível. Digite o código de barras."); }
    }

    private void configureReminder(int id, String argument) {
        String[] parts = argument.split(",", -1);
        if (!argument.matches("[0-9]{1,2},[0-9]{1,2},[0-9]{1,2}")) { fail(id, "Horário inválido."); return; }
        int start = Integer.parseInt(parts[0]), end = Integer.parseInt(parts[1]), interval = Integer.parseInt(parts[2]);
        if (start > end || end > 23 || interval > 12) { fail(id, "Confira os horários e o intervalo."); return; }
        if (interval != 0 && Build.VERSION.SDK_INT >= 33 &&
                activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            if (reminderSchedule != null) { fail(id, "Aguarde a solicitação de permissão."); return; }
            reminderRequest = id;
            reminderSchedule = new int[]{start, end, interval};
            activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, WaterReminder.PERMISSION);
        } else setReminder(id, start, end, interval);
    }

    void afterReminderPermission() {
        int[] schedule = reminderSchedule;
        reminderSchedule = null;
        if (schedule != null) setReminder(reminderRequest, schedule[0], schedule[1], schedule[2]);
    }

    private void setReminder(int id, int start, int end, int interval) {
        if (interval != 0 && !WaterReminder.allowed(activity)) {
            fail(id, "Habilite as notificações do Gym Organizer nas configurações do Android.");
            return;
        }
        WaterReminder.configure(activity, start, end, interval);
        ok(id, true);
    }

    private static boolean validVideo(String url) {
        return url != null && (url.matches("https://wger\\.de/media/exercise-video/[0-9]+/[a-zA-Z0-9_-]+\\.(?i:mp4|mov|webm|m4v)")
            || url.matches("https://upload\\.wikimedia\\.org/wikipedia/commons/[a-f0-9]/[a-f0-9]{2}/[A-Za-z0-9_-]+\\.webm")
            || url.matches("https://cdn\\.jsdelivr\\.net/gh/namnq/workout-free-videos@v2\\.0\\.0/media/video/[a-z0-9-]+\\.mp4"));
    }

    private File fileFor(String url) { return new File(videos, url.substring(url.lastIndexOf('/') + 1)); }

    private void play(int id, String url) {
        if (!validVideo(url)) { fail(id, "Vídeo indisponível."); return; }
        if (videoDialog != null && videoDialog.isShowing()) { ok(id, true); return; }
        VideoView player = new VideoView(activity);
        MediaController controls = new MediaController(activity);
        controls.setAnchorView(player);
        player.setMediaController(controls);
        player.setMinimumHeight((int) (200 * activity.getResources().getDisplayMetrics().density));
        videoDialog = new AlertDialog.Builder(activity).setTitle("Execução do exercício")
            .setView(player).setNegativeButton("Fechar", null).create();
        videoDialog.setOnDismissListener(dialog -> player.stopPlayback());
        player.setOnErrorListener((media, what, extra) -> {
            videoDialog.dismiss();
            android.widget.Toast.makeText(activity, "Vídeo indisponível. Confira a conexão e o formato.", android.widget.Toast.LENGTH_LONG).show();
            return true;
        });
        File file = fileFor(url);
        videoDialog.show();
        if (file.isFile()) player.setVideoPath(file.getAbsolutePath());
        else player.setVideoURI(Uri.parse(url), java.util.Collections.singletonMap("User-Agent", USER_AGENT));
        player.start();
        ok(id, true);
    }

    void onStop() {
        if (videoDialog != null) videoDialog.dismiss();
    }

    private void saveVideo(int id, String url) {
        if (!validVideo(url)) { fail(id, "Vídeo indisponível."); return; }
        if (savingVideo) { fail(id, "Aguarde o download atual."); return; }
        if (fileFor(url).isFile()) { ok(id, true); return; }
        savingVideo = true;
        new Thread(() -> {
            File temp = null;
            HttpsURLConnection http = null;
            try {
                if (!videos.isDirectory() && !videos.mkdirs()) throw new IOException("Pasta indisponível.");
                long used = 0;
                File[] stored = videos.listFiles();
                if (stored != null) for (File item : stored) used += item.length();
                long limit = Math.min(MAX_VIDEO, VIDEO_BUDGET - used);
                http = connect(url);
                if (http.getResponseCode() != 200) throw new IOException("Vídeo indisponível.");
                long expected = http.getContentLengthLong();
                if (limit <= 0 || expected > limit) throw new IOException("Limite de armazenamento.");
                temp = File.createTempFile("gym-video-", ".part", activity.getCacheDir());
                try (InputStream in = http.getInputStream(); FileOutputStream out = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[32768];
                    int count;
                    long received = 0;
                    while ((count = in.read(buffer)) != -1) {
                        received += count;
                        if (received > limit) throw new IOException("Limite de armazenamento.");
                        out.write(buffer, 0, count);
                    }
                    if (received == 0 || (expected > 0 && received != expected)) throw new IOException("Vídeo incompleto.");
                }
                Files.move(temp.toPath(), fileFor(url).toPath(), StandardCopyOption.REPLACE_EXISTING);
                ok(id, true);
            } catch (Exception error) {
                fail(id, "Não foi possível salvar. Confira a conexão ou libere espaço nos vídeos salvos.");
            } finally {
                if (http != null) http.disconnect();
                if (temp != null) temp.delete();
                activity.runOnUiThread(() -> savingVideo = false);
            }
        }, "gym-save-video").start();
    }

    private void removeVideo(int id, String url) {
        if (!validVideo(url)) { fail(id, "Vídeo indisponível."); return; }
        File file = fileFor(url);
        if (!file.exists() || file.delete()) ok(id, true);
        else fail(id, "Não foi possível remover o vídeo.");
    }
}
