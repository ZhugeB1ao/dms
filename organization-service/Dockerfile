# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -B || true

COPY src ./src
RUN ./mvnw clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=builder /app/target/organization-service-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8083
ENTRYPOINT ["java", "-jar", "app.jar"]
