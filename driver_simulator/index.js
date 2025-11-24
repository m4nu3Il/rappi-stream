
const { Kafka } = require('kafkajs');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'order_events';
const GROUP_ID = process.env.GROUP_ID || 'driver_simulator';
const ARRIVING_DELAY_MS = parseInt(process.env.ARRIVING_DELAY_MS || '10000', 10);
const DELIVERED_DELAY_MS = parseInt(process.env.DELIVERED_DELAY_MS || '5000', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'driver_simulator';

async function run() {
  const kafka = new Kafka({ clientId: SERVICE_NAME, brokers: KAFKA_BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  const producer = kafka.producer();
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });
  console.log('[driver_simulator] Iniciado, escuchando eventos...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        if (evt.event_type === 'DRIVER_ASSIGNED') {
          const orderId = evt.order_id;
          console.log(`[driver_simulator] Trabajo detectado para ${orderId} por ${evt.driver_id}.`);
          setTimeout(async () => {
            const arrivingEvt = { event_type: 'DRIVER_ARRIVING', order_id: orderId, driver_id: evt.driver_id, ts: Date.now() };
            await producer.send({ topic: KAFKA_TOPIC, messages: [{ key: orderId, value: JSON.stringify(arrivingEvt) }] });
            console.log('[driver_simulator] DRIVER_ARRIVING publicado', arrivingEvt);
          }, ARRIVING_DELAY_MS);

          setTimeout(async () => {
            const deliveredEvt = { event_type: 'ORDER_DELIVERED', order_id: orderId, driver_id: evt.driver_id, ts: Date.now() };
            await producer.send({ topic: KAFKA_TOPIC, messages: [{ key: orderId, value: JSON.stringify(deliveredEvt) }] });
            console.log('[driver_simulator] ORDER_DELIVERED publicado', deliveredEvt);
          }, ARRIVING_DELAY_MS + DELIVERED_DELAY_MS);
        }
      } catch (err) {
        console.error('[driver_simulator] Error manejando evento', err);
      }
    }
  });
}

run().catch(err => { console.error('[driver_simulator] Falla crítica', err); process.exit(1); });
