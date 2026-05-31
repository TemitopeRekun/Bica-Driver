package com.bicadriver.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String RIDE_UPDATES_CHANNEL_ID = "ride_updates";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createRideUpdatesChannel();
    }

    private void createRideUpdatesChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            RIDE_UPDATES_CHANNEL_ID,
            "Ride Updates",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alerts for new ride requests and trip updates.");
        notificationManager.createNotificationChannel(channel);
    }
}
