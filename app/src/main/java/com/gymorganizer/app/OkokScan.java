package com.gymorganizer.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.SparseArray;
import android.widget.Toast;
import java.util.Locale;

final class OkokScan {
    static final int PERMISSION = 27;
    interface Receiver { void save(double kg, double ohms); }
    private final Activity activity;
    private final Receiver receiver;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private BluetoothLeScanner scanner;
    private ScanCallback callback;
    private AlertDialog dialog;
    private android.bluetooth.BluetoothDevice activeScale;
    private double[] pending;
    private static final android.os.ParcelUuid MI_BODY = android.os.ParcelUuid.fromString(
        "0000181b-0000-1000-8000-00805f9b34fb");

    OkokScan(Activity activity, Receiver receiver) {
        this.activity = activity;
        this.receiver = receiver;
    }

    private String permission() {
        return Build.VERSION.SDK_INT >= 31 ? Manifest.permission.BLUETOOTH_SCAN : Manifest.permission.ACCESS_FINE_LOCATION;
    }

    void request() {
        if (activity.checkSelfPermission(permission()) == PackageManager.PERMISSION_GRANTED) afterPermission();
        else activity.requestPermissions(new String[]{permission()}, PERMISSION);
    }

    void afterPermission() {
        if (activity.checkSelfPermission(permission()) != PackageManager.PERMISSION_GRANTED) {
            message("Autorize a busca de dispositivos para ler a balança.");
            return;
        }
        stop();
        try {
            BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            scanner = adapter == null ? null : adapter.getBluetoothLeScanner();
            if (scanner == null) { message("Bluetooth indisponível. Confira se está ligado."); return; }
            dialog = new AlertDialog.Builder(activity).setTitle("Procurando balança")
                .setMessage("Suba na balança e aguarde a medida estabilizar.")
                .setNeutralButton("Usar só o peso", (d,w) -> { if (pending != null) confirm(pending); })
                .setNegativeButton("Cancelar", (d,w) -> stop()).create();
            dialog.setOnCancelListener(d -> stop());
            dialog.show();
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setVisibility(android.view.View.GONE);
            callback = new ScanCallback() {
                @Override public void onScanFailed(int code) {
                    if (callback == this) finish("Falha na busca Bluetooth. Tente novamente.");
                }
                @Override public void onScanResult(int type, ScanResult result) {
                    if (callback != this || result.getScanRecord() == null) return;
                    if (activeScale != null && !activeScale.equals(result.getDevice())) return;
                    double[] mi = decodeMi(result.getScanRecord().getServiceData(MI_BODY));
                    if (mi != null) { receive(result, mi); return; }
                    SparseArray<byte[]> data = result.getScanRecord().getManufacturerSpecificData();
                    for (int i = 0; i < data.size(); i++) {
                        double[] reading = decode(data.keyAt(i), data.valueAt(i));
                        if (reading != null) { receive(result, reading); return; }
                    }
                }
            };
            scanner.startScan(callback);
            handler.postDelayed(() -> {
                if (pending != null) confirm(pending);
                else finish("Nenhuma leitura estável recebida. Confira o Bluetooth e tente novamente.");
            }, 45000);
        } catch (RuntimeException unavailable) { finish("Busca indisponível. Confira as permissões e o Bluetooth."); }
    }

    private void receive(ScanResult result, double[] reading) {
        if (reading[1] > 0) { confirm(reading); return; }
        if (pending == null) {
            activeScale = result.getDevice();
            dialog.setMessage("Peso recebido. Continue na balança enquanto aguardamos a impedância.");
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setVisibility(android.view.View.VISIBLE);
        }
        pending = reading;
    }

    // Mi Body Composition Scale 2, service advertising in kilograms.
    static double[] decodeMi(byte[] data) {
        if (data == null || data.length != 13 || data[0] != 2 || (data[1] & 0xa0) != 0x20) return null;
        double kg = ((data[11] & 255) | ((data[12] & 255) << 8)) / 200.0;
        int ohms = (data[9] & 255) | ((data[10] & 255) << 8);
        if (kg <= 0) return null;
        return new double[]{kg, (data[1] & 2) != 0 && ohms != 65535 ? ohms : 0};
    }

    // OKOK advertisement layouts documented by 100nandoo/okok-bia-formulas.
    static double[] decode(int id, byte[] bytes) {
        if (bytes == null || bytes.length < 7 || (bytes[6] & 1) == 0) return null;
        int weightOffset, impedanceOffset, divisor;
        if (id == 0x20ca && bytes.length == 19) {
            int checksum = 0x20;
            for (int i = 0; i < 12; i++) checksum ^= bytes[i] & 255;
            if (checksum != (bytes[12] & 255)) return null;
            weightOffset = 8;
            impedanceOffset = 10;
            divisor = (bytes[6] & 4) != 0 ? 100 : 10;
        } else if ((id & 255) == 0xc0 && (bytes[6] & 24) == 0) {
            weightOffset = 0;
            impedanceOffset = 2;
            int precision = (bytes[6] >> 1) & 3;
            divisor = precision == 2 ? 100 : precision == 1 ? 1 : 10;
        } else return null;
        double mass = unsignedWord(bytes, weightOffset) / (double) divisor;
        int raw = unsignedWord(bytes, impedanceOffset);
        if (mass <= 0 || mass > 1000) return null;
        return new double[]{mass, raw == 65535 ? 0 : raw / 10.0};
    }

    private static int unsignedWord(byte[] bytes, int i) {
        return ((bytes[i] & 255) << 8) | (bytes[i + 1] & 255);
    }

    private void confirm(double[] reading) {
        stop();
        String summary = String.format(Locale.getDefault(), "%.2f kg", reading[0]);
        if (reading[1] > 0) summary += String.format(Locale.getDefault(), " · %.1f Ω", reading[1]);
        dialog = new AlertDialog.Builder(activity).setTitle("Esta é a sua pesagem?")
            .setMessage(summary + "\nSalvar atualiza o registro de hoje.")
            .setNegativeButton("Descartar", null)
            .setPositiveButton("Salvar", (d,w) -> receiver.save(reading[0], reading[1])).show();
    }

    void stop() {
        ScanCallback active = callback;
        callback = null;
        pending = null;
        activeScale = null;
        handler.removeCallbacksAndMessages(null);
        if (active != null && scanner != null) {
            try { scanner.stopScan(active); } catch (RuntimeException ignored) { }
        }
        scanner = null;
        if (dialog != null) { dialog.dismiss(); dialog = null; }
    }

    private void message(String text) { Toast.makeText(activity, text, Toast.LENGTH_LONG).show(); }
    private void finish(String text) { stop(); message(text); }
}
