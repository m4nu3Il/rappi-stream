const { Kafka } = require("kafkajs");
const amqp = require("amqplib");

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "order_events";
const GROUP_ID = process.env.GROUP_ID || "notification_router";
const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://stream:stream@rabbitmq:5672";
const NOTIF_EXCHANGE = process.env.NOTIF_EXCHANGE || "notifications";
const SERVICE_NAME = process.env.SERVICE_NAME || "notification_router";

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connectKafkaWithRetry() {
  const kafka = new Kafka({ clientId: SERVICE_NAME, brokers: KAFKA_BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  let attempt = 0;
  while (true) {
    try {
      await consumer.connect();
      await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });
      return consumer;
    } catch (err) {
      attempt++;
      const delay = Math.min(500 * Math.pow(1.5, attempt), 5000);
      console.log(
        `[notification_router] Kafka no listo (intento ${attempt}). Reintento en ${delay}ms...`
      );
      await wait(delay);
    }
  }
}

async function connectRabbitWithRetry() {
  let attempt = 0;
  while (true) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      const ch = await conn.createChannel();
      await ch.assertExchange(NOTIF_EXCHANGE, "topic", { durable: true });
      return ch;
    } catch (err) {
      attempt++;
      const delay = Math.min(500 * Math.pow(1.5, attempt), 5000);
      console.log(
        `[notification_router] RabbitMQ no listo (intento ${attempt}). Reintento en ${delay}ms...`
      );
      await wait(delay);
    }
  }
}

async function run() {
  const consumer = await connectKafkaWithRetry();
  const ch = await connectRabbitWithRetry();

  console.log(
    "[notification_router] Enrutando eventos a comandos de notificación..."
  );
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        if (evt.event_type === "DRIVER_ARRIVING") {
          const routingKey = "notify.client.sms";
          const payload = {
            phone: "+57-300-000-0000",
            text: "¡Tu repartidor está llegando!",
            order_id: evt.order_id,
          };
          await ch.publish(
            NOTIF_EXCHANGE,
            routingKey,
            Buffer.from(JSON.stringify(payload))
          );
          console.log("[notification_router] Comando SMS publicado", payload);
        } else if (evt.event_type === "ORDER_DELIVERED") {
          const routingKey = "notify.driver.push";
          const payload = {
            driver_id: evt.driver_id || "driver-unknown",
            text: "¡Entrega confirmada!",
            order_id: evt.order_id,
          };
          await ch.publish(
            NOTIF_EXCHANGE,
            routingKey,
            Buffer.from(JSON.stringify(payload))
          );
          console.log("[notification_router] Comando PUSH publicado", payload);
        }
      } catch (err) {
        console.error("[notification_router] Error procesando evento", err);
      }
    },
  });
}

run().catch((err) => {
  console.error("[notification_router] Falla crítica", err);
  process.exit(1);
});
