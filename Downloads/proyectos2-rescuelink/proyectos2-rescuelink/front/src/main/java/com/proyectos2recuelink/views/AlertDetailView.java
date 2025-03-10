package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.html.Image;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.html.H2;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.router.RouteParameters;
import com.vaadin.flow.component.notification.Notification;
import elemental.json.JsonObject;
import elemental.json.impl.JsonUtil;
import com.proyectos2recuelink.security.SecurityUtils;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;

@PageTitle("Detalles de la Alerta")
@Route(value = "alert-detail/:alertId", layout = MainLayout.class)
@CssImport("styles/shared-styles.css")
public class AlertDetailView extends VerticalLayout implements BeforeEnterObserver {

    private static final String DEFAULT_IMAGE_URL = "https://images.genius.com/71188f0b7269154a8d6ee7e0b0e77229.300x300x1.jpg"; // Imagen genérica

    private Long alertId;

    public AlertDetailView() {
        setAlignItems(Alignment.CENTER);
        setSizeFull();
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        if (!SecurityUtils.isAuthenticated()) {
            Notification.show("Debes iniciar sesión primero.");
            event.forwardTo("login");
            return;
        }

        // Obtener parámetros de la URL
        RouteParameters params = event.getRouteParameters();
        params.get("alertId").ifPresent(id -> {
            try {
                this.alertId = Long.parseLong(id); // Convertimos a Long sin ".0"
                loadAlertDetails();
            } catch (NumberFormatException e) {
                Notification.show("Error: ID de alerta no válido");
                getUI().ifPresent(ui -> ui.navigate("alerts"));
            }
        });
    }

    private void loadAlertDetails() {
        try {
            URL url = new URL("http://localhost:8081/api/alerts/" + alertId);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            Scanner scanner = new Scanner(conn.getInputStream(), "UTF-8");
            String response = scanner.useDelimiter("\\A").next();
            scanner.close();

            JsonObject alert = (JsonObject) JsonUtil.parse(response);

            H2 title = new H2(alert.getString("title"));
            Paragraph description = new Paragraph(alert.getString("description"));

            // Usa la imagen de la alerta si está presente, de lo contrario, usa la imagen genérica
            String imageUrl = alert.hasKey("imageUrl") ? alert.getString("imageUrl") : DEFAULT_IMAGE_URL;
            Image image = new Image(imageUrl, "Imagen de la alerta");
            image.setWidth("50%");

            Button backButton = new Button("Volver a Alertas", event -> getUI().ifPresent(ui -> ui.navigate("alerts")));

            add(title, image, description, backButton);

        } catch (Exception e) {
            Notification.show("Error al cargar detalles: " + e.getMessage());
        }
    }
}
