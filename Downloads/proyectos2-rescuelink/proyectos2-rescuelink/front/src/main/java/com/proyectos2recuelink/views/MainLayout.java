package com.proyectos2recuelink.views;

import com.vaadin.flow.component.applayout.AppLayout;
import com.vaadin.flow.component.applayout.DrawerToggle;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.icon.VaadinIcon;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.RouterLink;

public class MainLayout extends AppLayout {

    private final VerticalLayout menuLayout;  // 🔹 Definimos menuLayout

    public MainLayout() {
        // 🔹 Botón para abrir/cerrar el sidebar
        DrawerToggle toggle = new DrawerToggle();
        addToNavbar(toggle);

        // 🔹 Sidebar con enlaces de navegación
        menuLayout = new VerticalLayout();
        RouterLink dashboardLink = new RouterLink("Dashboard", DashboardView.class);
        RouterLink alertsLink = new RouterLink("Alertas", AlertsView.class);
        RouterLink volunteersLink = new RouterLink("Voluntarios", VolunteersView.class);

        // 🔹 Botón para crear alerta
        Button createAlertButton = new Button("Crear Alerta", new Icon(VaadinIcon.PLUS_CIRCLE), event ->
                getUI().ifPresent(ui -> ui.navigate("create-alert"))
        );
        createAlertButton.setWidthFull();
        createAlertButton.addClassName("create-alert-button");

        // 🔹 Botón de cerrar sesión
        Button logoutButton = new Button(new Icon(VaadinIcon.SIGN_OUT), event -> logout());
        logoutButton.setWidthFull();
        logoutButton.addClassName("logout-button");

        // 🔹 Añadir elementos al menú
        menuLayout.add(dashboardLink, alertsLink, volunteersLink, createAlertButton, logoutButton);
        addToDrawer(menuLayout);
    }

    private void logout() {
        getUI().ifPresent(ui -> {
            ui.getPage().executeJs("document.cookie = 'userEmail=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'");
            ui.navigate("login");
        });
    }
}
