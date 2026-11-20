package com.gymorganizer.app;

final class ScalePackets {
    private ScalePackets() {}

    static double[] decodeQn(byte[] p) {
        if (p == null || p.length < 19 || (p[0] & 255) != 0xaa || (p[1] & 255) != 0xbb) return null;
        boolean ft26r = p.length >= 22 && p[19] == 0x51 && p[20] == 0x0e && p[21] == 3;
        if ((p[15] & (ft26r ? 0x21 : 0x20)) == 0) return null;
        double kg = ((p[17] & 255) + ((p[18] & 255) << 8)) / 100.0;
        return kg >= 0.5 && kg <= 300 ? new double[]{kg, 0} : null;
    }

    static double[] decodePicooc(int company, byte[] p) {
        if (p == null || p.length != 14 || p[4] != 0x39) return null;
        int sum = (company & 255) + (company >>> 8);
        for (byte b : p) sum += b & 255;
        if ((sum & 255) != 255) return null;
        double kg = unsignedWord(p, 6) / 20.0;
        int impedance = unsignedWord(p, 8);
        return kg >= 0.5 && kg <= 300 ? new double[]{kg, impedance == 65535 ? 0 : impedance / 10.0} : null;
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

}
