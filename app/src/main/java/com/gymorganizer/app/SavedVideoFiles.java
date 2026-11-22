package com.gymorganizer.app;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.util.Set;
import java.util.regex.Pattern;

final class SavedVideoFiles {
    private static final Pattern VIDEO = Pattern.compile("[A-Za-z0-9_-]+\\.(?i:mp4|mov|webm|m4v)");

    static void removeObsolete(File directory, Set<String> keep) {
        File[] files = directory.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (keep.contains(file.getName()) || !VIDEO.matcher(file.getName()).matches()
                    || !Files.isRegularFile(file.toPath(), LinkOption.NOFOLLOW_LINKS)) continue;
            try {
                Files.deleteIfExists(file.toPath());
            } catch (IOException ignored) {
                // Retry on the next app launch if this file could not be removed.
            }
        }
    }
}
