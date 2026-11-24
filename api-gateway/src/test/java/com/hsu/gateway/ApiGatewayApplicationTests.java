package com.hsu.gateway;

import com.hsu.gateway.filter.JwtAuthFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.server.mvc.config.GatewayMvcProperties;
import org.springframework.cloud.gateway.server.mvc.config.RouteProperties;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ApiGatewayApplicationTests {

	@Autowired
	private GatewayMvcProperties gatewayMvcProperties;

	@Autowired
	@Qualifier("gatewayCompositeRouterFunction")
	private RouterFunction<ServerResponse> gatewayCompositeRouterFunction;

	@Autowired
	private JwtAuthFilter jwtAuthFilter;

	@Test
	void contextLoads() {
	}

	@Test
	void dossierRoutesAreConfiguredUnderFileServiceRoute() {
		RouteProperties fileServiceRoute = gatewayMvcProperties.getRoutes().stream()
				.filter(route -> "file-service".equals(route.getId()))
				.findFirst()
				.orElseThrow();

		assertThat(fileServiceRoute.getUri()).isEqualTo(URI.create("http://localhost:8085"));
		assertThat(fileServiceRoute.getPredicates())
				.flatMap(predicate -> predicate.getArgs().values())
				.contains("/api/documents", "/api/documents/**", "/api/dossiers", "/api/dossiers/**");

		assertThat(gatewayCompositeRouterFunction.route(
				ServerRequest.create(new MockHttpServletRequest("GET", "/api/documents"), List.of())))
				.isPresent();
		assertThat(gatewayCompositeRouterFunction.route(
				ServerRequest.create(new MockHttpServletRequest("GET", "/api/dossiers"), List.of())))
				.isPresent();
		assertThat(gatewayCompositeRouterFunction.route(
				ServerRequest.create(new MockHttpServletRequest("GET", "/api/dossiers/42/documents"), List.of())))
				.isPresent();
	}

	@Test
	void dossierEndpointsRequireJwtAuthentication() throws Exception {
		for (String path : List.of("/api/dossiers", "/api/dossiers/42")) {
			MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
			MockHttpServletResponse response = new MockHttpServletResponse();
			MockFilterChain filterChain = new MockFilterChain();

			jwtAuthFilter.doFilter(request, response, filterChain);

			assertThat(response.getStatus()).isEqualTo(401);
			assertThat(filterChain.getRequest()).isNull();
		}
	}

}
