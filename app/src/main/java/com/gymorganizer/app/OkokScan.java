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
    interface Receiver { void show(String status, String message, double kg, double ohms); }
    private final Activity activity;
    private final Receiver receiver;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private BluetoothLeScanner scanner;
    private ScanCallback callback;
    private AlertDialog dialog;
    private android.bluetooth.BluetoothDevice activeScale;
    private double[] pending;
    private String diagnosticAddress;
    private final java.util.LinkedHashSet<String> packets = new java.util.LinkedHashSet<>();
    private boolean connectable;
    private static final android.os.ParcelUuid MI_BODY = android.os.ParcelUuid.fromString(
        "0000181b-0000-1000-8000-00805f9b34fb");

    OkokScan(Activity activity, Receiver receiver) {
        this.activity = activity;
        this.receiver = receiver;
    }

    private String permission() {
        return Build.VERSION.SDK_INT >= 31 ? Manifest.permission.BLUETOOTH_SCAN : Manifest.permission.ACCESS_FINE_LOCATION;
    }

    void requestDiagnostic() {
        android.widget.EditText field = new android.widget.EditText(activity);
        field.setSingleLine(true);
        field.setHint("AA:BB:CC:DD:EE:FF");
        new AlertDialog.Builder(activity).setTitle("Diagnóstico Bluetooth")
            .setMessage("Informe o endereço da sua balança. A captura fica no aparelho até você copiá-la.")
            .setView(field).setNegativeButton("Cancelar", null)
            .setPositiveButton("Capturar", (d,w) -> {
                String address = field.getText().toString().trim().toUpperCase(Locale.ROOT);
                if (!BluetoothAdapter.checkBluetoothAddress(address)) {
                    message("Informe um endereço Bluetooth válido.");
                    return;
                }
                request(address);
            }).show();
    }

    void request() { request(null); }

    private void request(String address) {
        stop();
        diagnosticAddress = address;
        if (activity.checkSelfPermission(permission()) == PackageManager.PERMISSION_GRANTED) afterPermission();
        else activity.requestPermissions(new String[]{permission()}, PERMISSION);
    }

    void afterPermission() {
        if (activity.checkSelfPermission(permission()) != PackageManager.PERMISSION_GRANTED) {
            stop();
            message("Autorize a busca de dispositivos para ler a balança.");
            return;
        }
        try {
            BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            scanner = adapter == null ? null : adapter.getBluetoothLeScanner();
            if (scanner == null) { message("Bluetooth indisponível. Confira se está ligado."); return; }
            String guidance = "Suba descalço e aguarde a balança concluir a pesagem.";
            if (diagnosticAddress == null) {
                receiver.show("start", guidance, 0, 0);
            } else {
                dialog = new AlertDialog.Builder(activity).setTitle("Diagnóstico Bluetooth")
                    .setMessage(guidance + " A captura dura 45 segundos.")
                    .setNegativeButton("Cancelar", (d,w) -> stop()).create();
                dialog.setOnCancelListener(d -> stop());
                dialog.show();
            }
            callback = new ScanCallback() {
                @Override public void onScanFailed(int code) {
                    if (callback == this) finish("Falha na busca Bluetooth. Tente novamente.");
                }
                @Override public void onScanResult(int type, ScanResult result) {
                    if (callback != this || result.getScanRecord() == null) return;
                    if (diagnosticAddress != null) {
                        capture(result);
                        return;
                    }
                    if (activeScale != null && !activeScale.equals(result.getDevice())) return;
                    double[] mi = ScalePackets.decodeMi(result.getScanRecord().getServiceData(MI_BODY));
                    if (mi != null) { receive(result, mi); return; }
                    SparseArray<byte[]> data = result.getScanRecord().getManufacturerSpecificData();
                    for (int i = 0; i < data.size(); i++) {
                        int id = data.keyAt(i);
                        byte[] payload = data.valueAt(i);
                        if (id == 0xffff && !"PICOOC-L".equalsIgnoreCase(result.getScanRecord().getDeviceName())) {
                            double[] qn = ScalePackets.decodeQn(payload);
                            if (qn != null) { confirm(qn); return; }
                        }
                        boolean picooc = "PICOOC-L".equalsIgnoreCase(result.getScanRecord().getDeviceName());
                        double[] reading = picooc ? ScalePackets.decodePicooc(id, payload) : ScalePackets.decode(id, payload);
                        if (reading != null) { receive(result, reading); return; }
                    }
                }
            };
            scanner.startScan(null, new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), callback);
            handler.postDelayed(() -> {
                if (diagnosticAddress != null) showDiagnostic();
                else if (pending != null) confirm(pending);
                else finish("Nenhuma leitura estável recebida. Confira o Bluetooth e tente novamente.");
            }, 45000);
        } catch (RuntimeException unavailable) { finish("Busca indisponível. Confira as permissões e o Bluetooth."); }
    }

    private void capture(ScanResult result) {
        if (!diagnosticAddress.equalsIgnoreCase(result.getDevice().getAddress())) return;
        connectable |= result.isConnectable();
        ScanRecord record = result.getScanRecord();
        SparseArray<byte[]> manufacturer = record.getManufacturerSpecificData();
        for (int i = 0; i < manufacturer.size(); i++) {
            addPacket(String.format(Locale.ROOT, "MFR %04X", manufacturer.keyAt(i)), manufacturer.valueAt(i));
        }
        record.getServiceData().forEach((uuid, data) -> addPacket(uuid.toString(), data));
    }

    private void addPacket(String label, byte[] data) {
        if (data == null || packets.size() >= 100) return;
        StringBuilder line = new StringBuilder(label).append(": ");
        for (byte value : data) line.append(String.format(Locale.ROOT, "%02X", value & 255));
        packets.add(line.toString());
    }

    private void showDiagnostic() {
        String report = packets.isEmpty() ? "" : "Aceita conexão: " + (connectable ? "sim" : "não")
            + "\n" + String.join("\n", packets);
        stop();
        AlertDialog.Builder result = new AlertDialog.Builder(activity).setTitle("Diagnóstico Bluetooth")
            .setMessage(report.isEmpty() ? "Nenhum pacote para esse endereço. Confira o endereço e refaça a pesagem." : report)
            .setNegativeButton("Fechar", null);
        if (!report.isEmpty()) result.setPositiveButton("Copiar", (d,w) -> {
            android.content.ClipboardManager clipboard = activity.getSystemService(android.content.ClipboardManager.class);
            if (clipboard != null) clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Balança Bluetooth", report));
        });
        dialog = result.show();
    }

    private void receive(ScanResult result, double[] reading) {
        if (reading[1] > 0) { confirm(reading); return; }
        if (pending == null || pending[0] != reading[0]) {
            receiver.show("waiting", "Peso recebido. Permaneça na balança para captar a impedância.", reading[0], 0);
        }
        activeScale = result.getDevice();
        pending = reading;
    }

    void confirmPending() {
        if (pending != null) confirm(pending);
    }

    private void confirm(double[] reading) {
        stop();
        String detail = reading[1] > 0 ? "Peso e impedância recebidos." : "A balança enviou apenas o peso.";
        receiver.show("reading", detail + " Salvar atualiza o registro de hoje.", reading[0], reading[1]);
    }

    void suspend() {
        if (scanner != null) finish("A busca foi interrompida ao sair do app.");
    }

    void stop() {
        ScanCallback active = callback;
        callback = null;
        pending = null;
        diagnosticAddress = null;
        packets.clear();
        connectable = false;
        activeScale = null;
        handler.removeCallbacksAndMessages(null);
        if (active != null && scanner != null) {
            try { scanner.stopScan(active); } catch (RuntimeException ignored) { }
        }
        scanner = null;
        if (dialog != null) { dialog.dismiss(); dialog = null; }
    }

    private void message(String text) { Toast.makeText(activity, text, Toast.LENGTH_LONG).show(); }
    private void finish(String text) {
        boolean diagnostic = diagnosticAddress != null;
        stop();
        if (diagnostic) message(text);
        else receiver.show("error", text, 0, 0);
    }
}
