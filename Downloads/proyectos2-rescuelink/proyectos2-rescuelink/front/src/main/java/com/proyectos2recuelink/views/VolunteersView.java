package com.proyectos2recuelink.views;

import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.Route;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.List;
import java.util.Map;

@Route("/api/volunteers")
public class VolunteersView extends VerticalLayout {

    private final RestTemplate restTemplate = new RestTemplate();
    private Grid<Map<String, Object>> volunteersGrid = new Grid<>();

    public VolunteersView() {
        Button loadVolunteersButton = new Button("Cargar Voluntarios", event -> loadVolunteers());

        volunteersGrid.addColumn(volunteer -> volunteer.get("id")).setHeader("ID");
        volunteersGrid.addColumn(volunteer -> volunteer.get("name")).setHeader("Nombre");

        add(loadVolunteersButton, volunteersGrid);
    }

    private void loadVolunteers() {
        String url = "http://localhost:8081/api/volunteers";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<List> response = restTemplate.exchange(url, HttpMethod.GET, entity, List.class);
            volunteersGrid.setItems(response.getBody());
        } catch (Exception e) {
            Notification.show("Error al cargar voluntarios");
        }
    }
}
