package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.textfield.TextArea;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import elemental.json.Json;
import elemental.json.JsonObject;
import com.proyectos2recuelink.security.SecurityUtils;

import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

@PageTitle("Crear Alerta")
@Route(value = "create-alert", layout = MainLayout.class)
@CssImport("styles/shared-styles.css")
public class CreateAlertView extends VerticalLayout implements BeforeEnterObserver {

    private TextField titleField;
    private TextArea descriptionField;
    private TextField locationField;

    public CreateAlertView() {
        setAlignItems(Alignment.CENTER);
        setSizeFull();

        H1 title = new H1("Crear Nueva Alerta");

        titleField = new TextField("Título");
        descriptionField = new TextArea("Descripción");
        locationField = new TextField("Ubicación");

        Button submitButton = new Button("Crear Alerta", event -> createAlert());

        add(title, titleField, descriptionField, locationField, submitButton);
    }

    private void createAlert() {
        try {
            URL url = new URL("http://localhost:8081/api/alerts/create");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JsonObject json = Json.createObject();
            json.put("title", titleField.getValue());
            json.put("description", descriptionField.getValue());
            json.put("location", locationField.getValue());
            json.put("alertType", "general"); // Ajusta esto si el backend requiere otro tipo

            // 📌 Imprimir la petición JSON antes de enviarla
            System.out.println("Enviando JSON: " + json.toJson());

            byte[] input = json.toJson().getBytes(StandardCharsets.UTF_8);
            conn.getOutputStream().write(input);

            Scanner scanner = new Scanner(conn.getInputStream(), "UTF-8");
            String response = scanner.useDelimiter("\\A").next();
            scanner.close();

            Notification.show("Alerta creada correctamente.");
            getUI().ifPresent(ui -> ui.navigate("alerts"));

        } catch (Exception e) {
            Notification.show("Error al crear alerta: " + e.getMessage());
            System.out.println("Error al crear alerta: " + e.getMessage());
        }
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        if (!SecurityUtils.isAuthenticated()) {
            Notification.show("Debes iniciar sesión primero.");
            event.forwardTo("login");
        }
    }
}
