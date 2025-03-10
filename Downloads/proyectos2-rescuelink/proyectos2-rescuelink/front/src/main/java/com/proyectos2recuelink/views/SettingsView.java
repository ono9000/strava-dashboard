package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.Route;
import com.proyectos2recuelink.security.SecurityUtils;

@Route(value = "settings", layout = MainLayout.class)
@CssImport("styles/shared-styles.css")
public class SettingsView extends VerticalLayout implements BeforeEnterObserver {

    public SettingsView() {
        setAlignItems(Alignment.CENTER);
        setSizeFull();

        // Obtener el username del usuario autenticado
        String username = SecurityUtils.getUsername().orElse("Usuario");

        // Mostrar mensaje de depuración para ver si se obtiene el username
        Notification.show("Usuario autenticado: " + username);

        // Encabezado
        H1 title = new H1("Configuración de " + username);

        // Botón de ejemplo (podemos añadir opciones de configuración aquí)
        Button changePasswordButton = new Button("Cambiar Contraseña", event ->
                getUI().ifPresent(ui -> ui.navigate("change-password")));

        add(title, changePasswordButton);
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        if (!SecurityUtils.isAuthenticated()) {
            Notification.show("No estás autenticado, redirigiendo a login...");
            event.forwardTo("login");
        }
    }
}
