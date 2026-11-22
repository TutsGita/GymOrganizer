package com.gymorganizer.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

public final class UpdateApkProvider extends ContentProvider {
    private static final String NAME = "gym-organizer-update.apk";

    static File file(Context context) { return new File(context.getCacheDir(), NAME); }

    static Uri uri(Context context) {
        return Uri.parse("content://" + context.getPackageName() + ".updates/" + NAME);
    }

    private boolean matches(Uri uri) { return uri.equals(uri(getContext())); }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) {
        return matches(uri) ? "application/vnd.android.package-archive" : null;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!matches(uri) || !"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file(getContext()), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        if (!matches(uri)) return null;
        String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        MatrixCursor cursor = new MatrixCursor(columns);
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = NAME;
            else if (OpenableColumns.SIZE.equals(columns[i])) row[i] = file(getContext()).length();
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
