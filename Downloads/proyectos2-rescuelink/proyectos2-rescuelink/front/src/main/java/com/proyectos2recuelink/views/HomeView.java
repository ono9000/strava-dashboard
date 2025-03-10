package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.dependency.CssImport;
import com.vaadin.flow.component.html.H1;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.Route;

@Route(value = "")
@CssImport("styles/shared-styles.css")
public class HomeView extends VerticalLayout {

    public HomeView() {
        setAlignItems(Alignment.CENTER);
        setJustifyContentMode(JustifyContentMode.CENTER);
        setSizeFull();

        H1 title = new H1("Bienvenido a RescueLink");
        Paragraph description = new Paragraph("Una plataforma para la gestión de desastres naturales.");
        Button loginButton = new Button("Iniciar sesión", event ->
                getUI().ifPresent(ui -> ui.navigate("login")));

        loginButton.setWidth("200px");

        add(title, description, loginButton);
    }
}
