package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.progressbar.ProgressBar;
import com.vaadin.flow.component.textfield.EmailField;
import com.vaadin.flow.component.textfield.PasswordField;
import com.vaadin.flow.router.Route;
import elemental.json.Json;
import elemental.json.JsonObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.OutputStream;
import java.util.Scanner;

@Route(value = "login", layout = MainLayout.class)
@CssImport("styles/shared-styles.css")
public class LoginView extends VerticalLayout {

    private ProgressBar progressBar = new ProgressBar();

    public LoginView() {
        setAlignItems(Alignment.CENTER);

        // Campos del formulario
        EmailField emailField = new EmailField("Correo electrónico");
        PasswordField passwordField = new PasswordField("Contraseña");

        Button loginButton = new Button("Iniciar sesión", event ->
                loginUser(emailField.getValue(), passwordField.getValue()));

        loginButton.setWidthFull();
        emailField.setWidthFull();
        passwordField.setWidthFull();

        FormLayout formLayout = new FormLayout(emailField, passwordField, loginButton);
        formLayout.setWidth("350px");

        add(formLayout, progressBar);
        progressBar.setVisible(false);
    }

    private void loginUser(String email, String password) {
        if (email.isEmpty() || password.isEmpty()) {
            Notification.show("Por favor, complete todos los campos.", 3000, Notification.Position.MIDDLE);
            return;
        }

        progressBar.setVisible(true);

        try {
            URL url = new URL("http://localhost:8081/api/auth/login");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JsonObject json = Json.createObject();
            json.put("email", email);
            json.put("password", password);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = json.toJson().getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            Scanner scanner = new Scanner(conn.getInputStream(), "utf-8");
            String response = scanner.useDelimiter("\\A").next();
            scanner.close();

            // Guardar la sesión en el navegador
            getUI().ifPresent(ui -> ui.getPage().executeJs("document.cookie = 'userEmail=' + $0 + '; path=/;'", email));

            progressBar.setVisible(false);
            //Notification.show("Login exitoso.", 3000, Notification.Position.MIDDLE);
            getUI().ifPresent(ui -> ui.navigate("dashboard"));
        } catch (Exception e) {
            progressBar.setVisible(false);
            Notification.show("Error en el inicio de sesión: " + e.getMessage(), 5000, Notification.Position.MIDDLE);
        }
    }
}
