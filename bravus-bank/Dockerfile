# ============================================================
# Bravus Bank — Dockerfile otimizado pro Render Free (512MB)
# Build multi-stage, JVM tunada pra container pequeno
# ============================================================

# Build stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -e -DskipTests dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -q -DskipTests package

# Run stage — JRE slim
FROM eclipse-temurin:17-jre
WORKDIR /app

# Curl pro healthcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && apt-get clean

COPY --from=build /app/target/*.jar app.jar

# Render injeta $PORT automaticamente
ENV PORT=9000
EXPOSE 9000

# JVM otimizada pra container de 512MB:
#   MaxRAMPercentage=70 → heap = 70% do limite (~350MB)
#   SerialGC → footprint menor que G1
#   TieredStopAtLevel=1 → arranque mais rápido
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Djava.security.egd=file:/dev/./urandom -Dspring.profiles.active=prod"

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fs http://localhost:${PORT}/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT} -jar app.jar"]
