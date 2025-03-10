package com.proyectos2recuelink.views;

import com.proyectos2recuelink.security.SecurityUtils;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.orderedlayout.FlexLayout;
import com.vaadin.flow.component.orderedlayout.FlexLayout.FlexDirection;
import com.vaadin.flow.component.orderedlayout.FlexLayout.FlexWrap;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.icon.Icon;
import com.vaadin.flow.component.icon.VaadinIcon;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.Route;

@Route(value = "dashboard", layout = MainLayout.class)
@CssImport("styles/shared-styles.css")
public class DashboardView extends VerticalLayout {

    public DashboardView() {
        setAlignItems(Alignment.CENTER);
        setSizeFull();

        // Obtener el username desde el backend
        String username = SecurityUtils.getUsername().orElse("Usuario");

        // Encabezado con nombre del usuario
        H1 title = new H1("Bienvenido, " + username);

        // Layout de las tarjetas principales
        FlexLayout cardLayout = new FlexLayout();
        cardLayout.setFlexDirection(FlexDirection.ROW);
        cardLayout.setJustifyContentMode(JustifyContentMode.CENTER);
        cardLayout.setFlexWrap(FlexWrap.WRAP);
        cardLayout.setWidth("80%");

        // Tarjetas de acceso rápido
        cardLayout.add(createCard("Alertas", VaadinIcon.BELL, "alerts"));
        cardLayout.add(createCard("Voluntarios", VaadinIcon.USERS, "volunteers"));
        cardLayout.add(createCard("Configuración", VaadinIcon.COG, "settings"));

        add(title, cardLayout);
    }

    private VerticalLayout createCard(String title, VaadinIcon icon, String route) {
        VerticalLayout card = new VerticalLayout();
        card.setAlignItems(Alignment.CENTER);
        card.setClassName("dashboard-card");

        Icon vaadinIcon = icon.create();
        vaadinIcon.setSize("50px");

        Paragraph text = new Paragraph(title);
        Button button = new Button("Ir", event -> getUI().ifPresent(ui -> ui.navigate(route)));

        card.add(vaadinIcon, text, button);
        return card;
    }

}
