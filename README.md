# Rappi-Stream (Plataforma de Logística en Tiempo Real)

Arquitectura de referencia **Comando -> Evento -> Comando** con **RabbitMQ** para comandos y **Kafka** como **System of Record** (Event Sourcing). Incluye dashboard en vivo por WebSocket.

## Servicios

- **order_api**: POST `/order` publica el comando en RabbitMQ (`new_orders_queue`).
- **order_processor**: Consume la cola, asigna repartidor y escribe `DRIVER_ASSIGNED` en Kafka (`order_events`, key = `order_id`).
- **driver_simulator**: Al ver `DRIVER_ASSIGNED`, publica `DRIVER_ARRIVING` (10s) y `ORDER_DELIVERED` (5s después).
- **notification_router**: Puente Kafka->RabbitMQ. Enruta a `notifications` exchange (topic):
  - `notify.client.sms` -> `sms_worker`.
  - `notify.driver.push` -> `push_notification_worker`.
- **sms_worker**: Imprime envío de SMS.
- **push_notification_worker**: Imprime notificación push al repartidor.
- **dashboard_aggregator**: Consumidor stateful de Kafka. Reconstruye estado y lo envía por WebSocket.
- **dashboard_backend**: Servidor HTTP + WebSocket. Sirve `dashboard.html` y retransmite el estado.

## Requisitos

- Docker y Docker Compose.

## Uso

1. Clona este proyecto y navega al directorio.
2. Ejecuta:

```bash
docker compose up --build
```

3. En otro terminal, crea un pedido:

```bash
curl -X POST http://localhost:3000/order
```

4. Abre el dashboard en tu navegador:

```
http://localhost:8080
```

Verás el estado cambiar: **Asignado -> Llegando -> Entregado**, y en logs se imprimirán las notificaciones.

## Variables de entorno relevantes

- Kafka: `KAFKA_BROKERS=kafka:9092`, `KAFKA_TOPIC=order_events`.
- RabbitMQ: `RABBITMQ_URL=amqp://rabbitmq:5672`, `NEW_ORDERS_QUEUE=new_orders_queue`.
- Notificaciones: `NOTIF_EXCHANGE=notifications`, bindings `notify.client.*`, `notify.driver.*`.
- Dashboard: `PORT=8080`, `DASHBOARD_WS_URL=ws://dashboard_backend:8080/ws`.

## Notas

- El topic `order_events` se auto-crea gracias a `KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true`.
- Los ejemplos usan mensajes JSON y clave de Kafka = `order_id` para garantizar orden por pedido.
- Ajusta los **delays** del simulador con `ARRIVING_DELAY_MS` y `DELIVERED_DELAY_MS`.

## Créditos

- Imágenes oficiales de **RabbitMQ** y **Kafka/Zookeeper**.
- Clientes: `amqplib` (RabbitMQ), `kafkajs` (Kafka), `ws` (WebSocket), `express`.
