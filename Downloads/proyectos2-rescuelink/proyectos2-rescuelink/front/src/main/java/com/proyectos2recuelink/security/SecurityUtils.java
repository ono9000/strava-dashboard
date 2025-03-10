package com.proyectos2recuelink.security;

import com.vaadin.flow.server.VaadinService;
import jakarta.servlet.http.Cookie;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.Optional;

public class SecurityUtils {

    private static final String BACKEND_URL = "http://localhost:8081/api/auth/get-username";

    public static boolean isAuthenticated() {
        boolean authenticated = getUserEmail().isPresent();
        System.out.println("¿Usuario autenticado?: " + authenticated);
        return authenticated;
    }

    public static Optional<String> getUserEmail() {
        if (VaadinService.getCurrentRequest() == null || VaadinService.getCurrentRequest().getCookies() == null) {
            System.out.println("No hay cookies en la solicitud.");
            return Optional.empty();
        }

        return Arrays.stream(VaadinService.getCurrentRequest().getCookies())
                .filter(cookie -> "userEmail".equals(cookie.getName()))
                .findFirst()
                .map(cookie -> {
                    System.out.println("Cookie encontrada: " + cookie.getValue());
                    return cookie.getValue();
                });
    }

    public static Optional<String> getUsername() {
        Optional<String> email = getUserEmail();
        if (email.isEmpty()) {
            return Optional.empty();
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = BACKEND_URL + "?email=" + email.get();
            var response = restTemplate.getForObject(url, UsernameResponse.class);
            String username = response != null ? response.getUsername() : null;
            System.out.println("Username obtenido desde la API: " + username);
            return Optional.ofNullable(username);
        } catch (Exception e) {
            System.out.println("Error obteniendo el username: " + e.getMessage());
            return Optional.empty();
        }
    }

    private static class UsernameResponse {
        private String username;
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
    }
}
