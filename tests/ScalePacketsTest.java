package com.gymorganizer.app;

import java.util.HexFormat;
import java.util.Arrays;

public final class ScalePacketsTest {
    private static byte[] hex(String s) { return HexFormat.of().parseHex(s); }
    private static void reading(double[] actual, double kg, double ohms) {
        if (!Arrays.equals(actual, new double[]{kg, ohms})) throw new AssertionError(Arrays.toString(actual));
    }
    private static void reject(double[] actual) {
        if (actual != null) throw new AssertionError("Unexpected reading: " + Arrays.toString(actual));
    }

    public static void main(String[] args) {
        // Manufacturer payloads from openScale's PicoocBroadcastHandlerTest (Mini Lite).
        byte[] pico = hex("004B4F1E391F065E13388704009C");
        reading(ScalePackets.decodePicooc(0x49d0, pico), 81.5, 492);
        reading(ScalePackets.decodePicooc(0x49d0, hex("004B4F1E391F066013748706005C")), 81.6, 498);
        reading(ScalePackets.decodePicooc(0x49d0, hex("004B4F1E391F0676136087200040")), 82.7, 496);
        pico[6]++;
        reject(ScalePackets.decodePicooc(0x49d0, pico));

        byte[] qn = new byte[22];
        qn[0] = (byte)0xaa; qn[1] = (byte)0xbb; qn[17] = 0x58; qn[18] = 0x1b;
        qn[15] = 0x20;
        reading(ScalePackets.decodeQn(qn), 70, 0);
        qn[15] = 0x15;
        reject(ScalePackets.decodeQn(qn));
        qn[19] = 0x51; qn[20] = 0x0e; qn[21] = 3;
        reading(ScalePackets.decodeQn(qn), 70, 0);
        qn[15] = 0x14;
        reject(ScalePackets.decodeQn(qn));
        reading(ScalePackets.decodeMi(hex("022200000000000000f401b036")), 70, 500);
        reject(ScalePackets.decodeMi(hex("02a200000000000000f401b036")));
        reading(ScalePackets.decode(0x07c0, hex("1a3117700a0125")), 67.05, 600);
        byte[] v20 = new byte[19];
        v20[6] = 5; v20[8] = 0x1b; v20[9] = 0x58; v20[10] = 0x13; v20[11] = (byte)0x88;
        v20[12] = 0x20;
        for (int i = 0; i < 12; i++) v20[12] ^= v20[i];
        reading(ScalePackets.decode(0x20ca, v20), 70, 500);
        v20[12]++;
        reject(ScalePackets.decode(0x20ca, v20));
        reject(ScalePackets.decodeQn(new byte[5]));
        System.out.println("Scale packet checks passed.");
    }
}
