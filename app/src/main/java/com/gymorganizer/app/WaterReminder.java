package com.gymorganizer.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Calendar;

public final class WaterReminder extends BroadcastReceiver {
    static final int PERMISSION = 41;
    private static final String CHANNEL = "water";
    private static final int ID = 401;

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("water-reminder", Context.MODE_PRIVATE);
    }

    static boolean allowed(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 33
            || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }

    static void configure(Context context, int start, int end, int interval) {
        preferences(context).edit().putInt("start", start).putInt("end", end).putInt("interval", interval).apply();
        schedule(context);
    }

    static int nextHour(int hour, int start, int end, int interval) {
        for (int slot = start; slot <= end; slot += interval) {
            if (slot > hour) return slot;
        }
        return start + 24;
    }

    static void schedule(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent reminder = PendingIntent.getBroadcast(context, ID,
            new Intent(context, WaterReminder.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        alarms.cancel(reminder);
        SharedPreferences settings = preferences(context);
        int interval = settings.getInt("interval", 0);
        if (interval <= 0 || !allowed(context)) return;
        Calendar next = Calendar.getInstance();
        int hour = nextHour(next.get(Calendar.HOUR_OF_DAY), settings.getInt("start", 8), settings.getInt("end", 21), interval);
        if (hour >= 24) next.add(Calendar.DAY_OF_YEAR, 1);
        next.set(Calendar.HOUR_OF_DAY, hour % 24);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), reminder);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction() == null && allowed(context) && preferences(context).getInt("interval", 0) > 0) {
            SharedPreferences settings = preferences(context);
            int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            if (hour >= settings.getInt("start", 8) && hour <= settings.getInt("end", 21)) notifyWater(context);
        }
        schedule(context);
    }

    private void notifyWater(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Lembretes de água", NotificationManager.IMPORTANCE_DEFAULT));
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, ID,
            open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        manager.notify(ID, new Notification.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Hora de beber água")
            .setContentText("Registre o copo no Gym Organizer.")
            .setAutoCancel(true).setContentIntent(tap).build());
    }
}
