
const amqp = require('amqplib');
const { Kafka } = require('kafkajs');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const NEW_ORDERS_QUEUE = process.env.NEW_ORDERS_QUEUE || 'new_orders_queue';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'order_events';
const SERVICE_NAME = process.env.SERVICE_NAME || 'order_processor';

async function run() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(NEW_ORDERS_QUEUE, { durable: true });
  await ch.prefetch(1);

  const kafka = new Kafka({ clientId: SERVICE_NAME, brokers: KAFKA_BROKERS });
  const producer = kafka.producer();
  await producer.connect();

  console.log(`[order_processor] Esperando mensajes en '${NEW_ORDERS_QUEUE}'...`);
  ch.consume(NEW_ORDERS_QUEUE, async (msg) => {
    try {
      const order = JSON.parse(msg.content.toString());
      const driverId = `driver-${Math.floor(Math.random()*900)+100}`;
      const event = {
        event_type: 'DRIVER_ASSIGNED',
        order_id: order.order_id,
        driver_id: driverId,
        client_id: order.client_id,
        ts: Date.now()
      };
      await producer.send({
        topic: KAFKA_TOPIC,
        messages: [{ key: order.order_id, value: JSON.stringify(event) }]
      });
      console.log(`[order_processor] Evento enviado a Kafka:`, event);
      ch.ack(msg);
    } catch (err) {
      console.error('[order_processor] Error procesando mensaje', err);
      ch.nack(msg, false, true);
    }
  });
}

run().catch(err => {
  console.error('[order_processor] Falla crítica', err);
  process.exit(1);
});
