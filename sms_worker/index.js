
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const NOTIF_EXCHANGE = process.env.NOTIF_EXCHANGE || 'notifications';
const QUEUE_NAME = process.env.QUEUE_NAME || 'sms_queue';
const BINDING_KEY = process.env.BINDING_KEY || 'notify.client.*';
const SERVICE_NAME = process.env.SERVICE_NAME || 'sms_worker';

async function run() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(NOTIF_EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(QUEUE_NAME, { durable: true });
  await ch.bindQueue(QUEUE_NAME, NOTIF_EXCHANGE, BINDING_KEY);
  console.log(`[sms_worker] Esperando mensajes en ${QUEUE_NAME} (binding ${BINDING_KEY})`);
  ch.consume(QUEUE_NAME, (msg) => {
    const payload = JSON.parse(msg.content.toString());
    console.log(`ENVIANDO SMS a ${payload.phone}: ¡Tu repartidor está llegando! (pedido ${payload.order_id})`);
    ch.ack(msg);
  });
}

run().catch(err => { console.error('[sms_worker] Falla crítica', err); process.exit(1); });
