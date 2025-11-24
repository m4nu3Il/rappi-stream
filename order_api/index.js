const express = require("express");
const cors = require("cors");
const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://stream:stream@rabbitmq:5672";
const NEW_ORDERS_QUEUE = process.env.NEW_ORDERS_QUEUE || "new_orders_queue";

let channel;

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function initRabbitWithRetry(maxRetries = 20, baseDelayMs = 500) {
  let attempt = 0;
  while (true) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      channel = await conn.createChannel();
      await channel.assertQueue(NEW_ORDERS_QUEUE, { durable: true });
      console.log(`[order_api] RabbitMQ OK, cola '${NEW_ORDERS_QUEUE}' lista.`);
      return;
    } catch (err) {
      attempt++;
      const delay = Math.min(baseDelayMs * Math.pow(1.5, attempt), 5000);
      console.log(
        `[order_api] RabbitMQ no listo (intento ${attempt}). Reintentando en ${delay}ms...`
      );
      if (attempt >= maxRetries) {
        console.error("[order_api] No se pudo conectar a RabbitMQ. Abortando.");
        process.exit(1);
      }
      await wait(delay);
    }
  }
}

function randomOrder() {
  const orderId = `order-${uuidv4().slice(0, 8)}`;
  const clientId = `user-${Math.floor(Math.random() * 900) + 100}`;
  const payload = {
    order_id: orderId,
    client_id: clientId,
    details: {
      pickup: "Supermercado Central",
      dropoff: "Calle 12 #34-56",
      items: [
        { sku: "A1", qty: 2 },
        { sku: "B7", qty: 1 },
      ],
    },
    ts: Date.now(),
  };
  return payload;
}

async function publishNewOrder(order) {
  await channel.sendToQueue(
    NEW_ORDERS_QUEUE,
    Buffer.from(JSON.stringify(order)),
    { persistent: true }
  );
  console.log(`[order_api] Comando publicado en '${NEW_ORDERS_QUEUE}':`, order);
}

(async () => {
  await initRabbitWithRetry();
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/order", async (_req, res) => {
    const order = randomOrder();
    await publishNewOrder(order);
    res.status(201).json({ ok: true, order });
  });

  app.get("/", (_req, res) =>
    res.send("order_api OK. POST /order para crear pedidos.")
  );

  app.listen(PORT, () =>
    console.log(`[order_api] Escuchando en puerto ${PORT}`)
  );
})();
