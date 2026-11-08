package com.example.organization_service.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Set;

@Component
public class GatewayOrMockAuthFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "MANAGER", "EMPLOYEE");

    private final String gatewaySecret;
    private final boolean mockEnabled;

    @Autowired
    public GatewayOrMockAuthFilter(
            @Value("${app.security.gateway-secret:}") String gatewaySecret,
            @Value("${app.security.mock-enabled:true}") boolean mockEnabled
    ) {
        this.gatewaySecret = gatewaySecret != null ? gatewaySecret.trim() : "";
        this.mockEnabled = mockEnabled;
    }

    public GatewayOrMockAuthFilter() {
        this("", true);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String roleHeader = request.getHeader("X-User-Role");

        if (roleHeader != null && !roleHeader.isBlank()) {
            boolean secretValid = gatewaySecret.isEmpty() || gatewaySecret.equals(request.getHeader("X-Gateway-Secret"));
            if (secretValid) {
                String role = roleHeader.trim().toUpperCase();
                if (ALLOWED_ROLES.contains(role)) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    "gateway-user-" + role.toLowerCase(),
                                    null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                            );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } else if (mockEnabled) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7).trim();
                String role = resolveRoleFromMockToken(token);
                if (role != null) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    "mock-user-" + role.toLowerCase(),
                                    null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                            );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveRoleFromMockToken(String token) {
        return switch (token) {
            case "mock-admin-token", "ADMIN" -> "ADMIN";
            case "mock-manager-token", "MANAGER" -> "MANAGER";
            case "mock-employee-token", "EMPLOYEE" -> "EMPLOYEE";
            default -> null;
        };
    }
}
