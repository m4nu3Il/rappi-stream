
const { Kafka } = require('kafkajs');
const WebSocket = require('ws');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'order_events';
const GROUP_ID = process.env.GROUP_ID || 'dashboard_aggregator';
const DASHBOARD_WS_URL = process.env.DASHBOARD_WS_URL || 'ws://localhost:8080/ws';
const SERVICE_NAME = process.env.SERVICE_NAME || 'dashboard_aggregator';

const statusMap = {}; // order_id -> { status, client_id, driver_id, event_type }

function updateState(evt) {
  const orderId = evt.order_id;
  const entry = statusMap[orderId] || {};
  if (evt.event_type === 'DRIVER_ASSIGNED') {
    entry.status = 'Asignado';
    entry.driver_id = evt.driver_id;
    entry.client_id = evt.client_id;
  } else if (evt.event_type === 'DRIVER_ARRIVING') {
    entry.status = 'Llegando';
  } else if (evt.event_type === 'ORDER_DELIVERED') {
    entry.status = 'Entregado';
  } else {
    entry.status = 'Creado';
  }
  entry.event_type = evt.event_type;
  statusMap[orderId] = entry;
}

async function run() {
  const kafka = new Kafka({ clientId: SERVICE_NAME, brokers: KAFKA_BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });

  const ws = new WebSocket(DASHBOARD_WS_URL);
  ws.on('open', () => {
    console.log('[dashboard_aggregator] Conectado al WebSocket del backend.');
    // Al conectar, enviamos estado inicial
    ws.send(JSON.stringify({ type: 'state_update', data: statusMap }));
  });

  ws.on('error', (err) => console.error('[dashboard_aggregator] WS error', err));
  ws.on('close', () => console.log('[dashboard_aggregator] WS cerrado'));

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const evt = JSON.parse(message.value.toString());
        updateState(evt);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'state_update', data: statusMap }));
        }
        console.log('[dashboard_aggregator] Estado actualizado para', evt.order_id, statusMap[evt.order_id]);
      } catch (err) {
        console.error('[dashboard_aggregator] Error procesando evento', err);
      }
    }
  });
}

run().catch(err => { console.error('[dashboard_aggregator] Falla crítica', err); process.exit(1); });
