package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.html.Image;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.orderedlayout.FlexLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.orderedlayout.FlexLayout.FlexWrap;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.component.notification.Notification;
import elemental.json.JsonArray;
import elemental.json.JsonObject;
import elemental.json.impl.JsonUtil;
import com.proyectos2recuelink.security.SecurityUtils;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;

@Route(value = "alerts", layout = MainLayout.class)
@CssImport("styles/shared-styles.css")
public class AlertsView extends VerticalLayout implements BeforeEnterObserver {

    private static final String DEFAULT_IMAGE_URL = "https://images.genius.com/71188f0b7269154a8d6ee7e0b0e77229.300x300x1.jpg"; // Imagen genérica

    private FlexLayout alertsLayout = new FlexLayout();

    public AlertsView() {
        setAlignItems(Alignment.CENTER);
        setSizeFull();

        alertsLayout.setFlexWrap(FlexWrap.WRAP);
        alertsLayout.setJustifyContentMode(JustifyContentMode.CENTER);
        alertsLayout.setWidth("80%");

        Button loadAlertsButton = new Button("Cargar Alertas", event -> loadAlerts());

        add(loadAlertsButton, alertsLayout);
    }

    private void loadAlerts() {
        try {
            URL url = new URL("http://localhost:8081/api/alerts"); // ✅ URL corregida
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Content-Type", "application/json");

            Scanner scanner = new Scanner(conn.getInputStream(), "UTF-8");
            String response = scanner.useDelimiter("\\A").next();
            scanner.close();

            JsonArray alertsArray = (JsonArray) JsonUtil.parse(response);

            alertsLayout.removeAll(); // Limpiar alertas previas

            for (int i = 0; i < alertsArray.length(); i++) {
                JsonObject alert = alertsArray.getObject(i);
                alertsLayout.add(createAlertCard(alert));
            }

        } catch (Exception e) {
            Notification.show("Error al cargar alertas: " + e.getMessage());
        }
    }

    private VerticalLayout createAlertCard(JsonObject alert) {
        VerticalLayout card = new VerticalLayout();
        card.setClassName("alert-card");

        // ✅ Agregar imagen genérica en todas las alertas
        Image image = new Image(DEFAULT_IMAGE_URL, "Imagen genérica");
        image.setWidth("100%");
        image.setHeight("150px");

        Paragraph title = new Paragraph(alert.getString("title"));
        title.getStyle().set("font-weight", "bold");

        Button detailsButton = new Button("Ver Detalles", event -> {
            int alertId = (int) alert.getNumber("id");
            getUI().ifPresent(ui -> ui.navigate("alert-detail/" + alertId));
        });


        card.add(image, title, detailsButton);
        return card;
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        if (!SecurityUtils.isAuthenticated()) {
            Notification.show("Debes iniciar sesión primero.");
            event.forwardTo("login");
        }
    }
}
