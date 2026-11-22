package com.gymorganizer.app;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;

final class PlanPdf {
    private static final int WIDTH = 595;
    private static final int HEIGHT = 842;
    private static final int MARGIN = 42;
    private static final int CONTENT_WIDTH = WIDTH - 2 * MARGIN;
    private static final int INK = Color.rgb(34, 32, 47);
    private static final int SECONDARY = Color.rgb(88, 84, 108);
    private static final int ACCENT = Color.rgb(75, 61, 157);

    private final PdfDocument document;
    private PdfDocument.Page page;
    private int pageNumber;
    private int y;

    private PlanPdf(PdfDocument document) {
        this.document = document;
    }

    static void write(JSONObject plan, OutputStream destination) throws IOException, JSONException {
        PdfDocument document = new PdfDocument();
        PlanPdf pdf = new PlanPdf(document);
        try {
            pdf.startPage();
            pdf.drawPlan(plan);
            pdf.finishPage();
            document.writeTo(destination);
        } finally {
            if (pdf.page != null) pdf.finishPage();
            document.close();
        }
    }

    private void drawPlan(JSONObject plan) throws JSONException {
        block(plan.getString("name"), 28, true, INK, 6);
        block(plan.getString("mode"), 12, false, SECONDARY, 17);
        JSONArray slots = plan.getJSONArray("slots");
        for (int i = 0; i < slots.length(); i++) {
            JSONObject slot = slots.getJSONObject(i);
            if (y + 62 > HEIGHT - MARGIN) nextPage();
            block(slot.getString("label") + "  ·  " + slot.getString("name"), 16, true, ACCENT, 6);
            block(slot.optString("note"), 11, false, SECONDARY, 6);
            JSONArray exercises = slot.getJSONArray("exercises");
            for (int j = 0; j < exercises.length(); j++) {
                JSONObject exercise = exercises.getJSONObject(j);
                if (y + 43 > HEIGHT - MARGIN) nextPage();
                block((j + 1) + ". " + exercise.getString("name"), 12, true, INK, 1);
                block(exercise.getInt("sets") + " séries  ·  " + exercise.getInt("reps") + " reps  ·  "
                    + exercise.getString("load"), 11, false, SECONDARY, 4);
                block(exercise.optString("note"), 11, false, SECONDARY, 6);
            }
            y += 12;
        }
    }

    private void startPage() {
        page = document.startPage(new PdfDocument.PageInfo.Builder(WIDTH, HEIGHT, ++pageNumber).create());
        Canvas canvas = page.getCanvas();
        canvas.drawText("GYM ORGANIZER  /  PLANO DE TREINO", MARGIN, 38, paint(10, true, ACCENT));
        canvas.drawText(String.valueOf(pageNumber), MARGIN, HEIGHT - 20, paint(10, false, SECONDARY));
        y = 58;
    }

    private void finishPage() {
        document.finishPage(page);
        page = null;
    }

    private void nextPage() {
        finishPage();
        startPage();
    }

    private void block(String text, int size, boolean bold, int color, int gap) {
        if (text.trim().isEmpty()) return;
        StaticLayout layout = StaticLayout.Builder.obtain(text, 0, text.length(),
            paint(size, bold, color), CONTENT_WIDTH).setIncludePad(false)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL).build();
        if (y + layout.getHeight() > HEIGHT - MARGIN && layout.getHeight() < HEIGHT - 100) nextPage();
        int first = 0;
        while (first < layout.getLineCount()) {
            int last = first;
            int top = layout.getLineTop(first);
            while (last < layout.getLineCount()
                    && y + layout.getLineBottom(last) - top <= HEIGHT - MARGIN) last++;
            if (last == first) { nextPage(); continue; }
            int height = layout.getLineBottom(last - 1) - top;
            Canvas canvas = page.getCanvas();
            canvas.save();
            canvas.clipRect(MARGIN, y, WIDTH - MARGIN, y + height);
            canvas.translate(MARGIN, y - top);
            layout.draw(canvas);
            canvas.restore();
            y += height;
            first = last;
            if (first < layout.getLineCount()) nextPage();
        }
        y += gap;
    }

    private static TextPaint paint(int size, boolean bold, int color) {
        TextPaint paint = new TextPaint(TextPaint.ANTI_ALIAS_FLAG);
        paint.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        paint.setTextSize(size);
        paint.setColor(color);
        return paint;
    }
}
