package com.bicadriver.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MyFirebaseMessagingService extends MessagingService {
    private static final String CHANNEL_ID = "ride_updates";
    private static final String CHANNEL_NAME = "Ride Updates";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        if (remoteMessage.getNotification() != null || remoteMessage.getData().isEmpty()) {
            return;
        }

        showDataNotification(remoteMessage);
    }

    private void showDataNotification(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String notificationType = normalizeType(data.get("type"));
        String title = firstText(data.get("title"), isRideRequest(notificationType) ? "New ride request" : "BicaDriver");
        String body = firstText(data.get("body"), data.get("message"), defaultBody(notificationType));
        String messageId = firstText(remoteMessage.getMessageId(), String.valueOf(System.currentTimeMillis()));
        int notificationId = messageId.hashCode();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("google.message_id", messageId);

        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        ensureNotificationChannel();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(notificationId, builder.build());
        }
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts for new ride requests and trip updates.");
        notificationManager.createNotificationChannel(channel);
    }

    private boolean isRideRequest(String notificationType) {
        return "newride".equals(notificationType)
            || "rideassigned".equals(notificationType)
            || "riderequest".equals(notificationType)
            || "newriderequest".equals(notificationType)
            || "newscheduledtrip".equals(notificationType);
    }

    private String defaultBody(String notificationType) {
        if (isRideRequest(notificationType)) {
            return "Open BicaDriver to accept or decline this ride.";
        }
        return "Open BicaDriver to view the latest update.";
    }

    private String normalizeType(String type) {
        return firstText(type).toLowerCase().replaceAll("[\\s_.:\\-]+", "");
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }
}
