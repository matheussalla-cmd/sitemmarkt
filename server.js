/**
 * THEUSMARKT — PIX BACKEND (server.js)
 *
 * Endpoints:
 *  POST /api/pix/criar       → Cria um PIX dinâmico via Mercado Pago
 *  GET  /api/pix/status/:id  → Retorna o status atual de um pedido
 *  POST /api/pix/webhook     → Recebe confirmação do Mercado Pago
 *  GET  /health              → Health check
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();

// ── CORS: apenas o seu site pode chamar este backend ──────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// O webhook do Mercado Pago envia raw JSON, então precisamos do body parser
app.use('/api/pix/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── Mercado Pago client ───────────────────────────────────
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const mpPayment = new Payment(mpClient);

// ── Armazenamento em memória dos pedidos ─────────────────
// Para uma solução simples de venda de código-fonte com volume baixo,
// isso é suficiente. Se o servidor reiniciar, pedidos em andamento
// são perdidos — o comprador precisaria gerar outro PIX.
// (Para persistência real, adicione um banco de dados.)
const orders = {};

function generateOrderId() {
  return 'TM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

// ── POST /api/pix/criar ───────────────────────────────────
app.post('/api/pix/criar', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
    }

    const orderId = generateOrderId();

    // Cria o pagamento PIX no Mercado Pago
    const payment = await mpPayment.create({
      body: {
        transaction_amount: 99.99,
        description: 'TheusMarkt — Licença de Uso',
        payment_method_id: 'pix',
        payer: {
          email,
          first_name: name.split(' ')[0],
          last_name:  name.split(' ').slice(1).join(' ') || '.',
          identification: { type: 'CPF', number: '00000000000' } // placeholder aceito pelo MP
        },
        external_reference: orderId,
        notification_url: `${process.env.BACKEND_URL}/api/pix/webhook`
      }
    });

    // Salva o pedido em memória
    orders[orderId] = {
      orderId,
      name,
      email,
      phone: phone || '',
      mpPaymentId: payment.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Log para o painel (aparece no Railway/Render em Logs)
    console.log(`📦 Novo pedido: ${orderId} | ${name} <${email}> | MP ID: ${payment.id}`);

    // Retorna os dados do QR Code ao frontend
    const qrData = payment.point_of_interaction?.transaction_data;
    res.json({
      orderId,
      pixCopiaCola: qrData?.qr_code || '',
      qrCodeBase64: `data:image/png;base64,${qrData?.qr_code_base64 || ''}`,
      mpPaymentId: payment.id
    });

  } catch (err) {
    console.error('Erro ao criar PIX:', err);
    res.status(500).json({ error: 'Erro ao gerar o PIX. Tente novamente.' });
  }
});

// ── GET /api/pix/status/:orderId ─────────────────────────
app.get('/api/pix/status/:orderId', (req, res) => {
  const order = orders[req.params.orderId];
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado.' });
  }
  res.json({ orderId: order.orderId, status: order.status });
});

// ── POST /api/pix/webhook ────────────────────────────────
// Mercado Pago chama este endpoint quando o pagamento é confirmado.
app.post('/api/pix/webhook', async (req, res) => {
  // Responde imediatamente para o MP não reenviar
  res.status(200).send('OK');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, data } = body;

    if (type !== 'payment' || !data?.id) return;

    // Busca os detalhes do pagamento na API do MP
    const payment = await mpPayment.get({ id: data.id });

    const status   = payment.status;           // 'approved' | 'rejected' etc.
    const orderId  = payment.external_reference;

    if (!orderId || !orders[orderId]) {
      console.warn(`Webhook sem orderId válido: mpId=${data.id}`);
      return;
    }

    orders[orderId].status = status;
    console.log(`💳 Webhook recebido: ${orderId} → status: ${status}`);

    if (status === 'approved') {
      console.log(`✅ PAGAMENTO APROVADO: ${orderId} | ${orders[orderId].email}`);
      // Aqui você pode adicionar: envio de e-mail, notificação no WhatsApp, etc.
    }

  } catch (err) {
    console.error('Erro ao processar webhook:', err);
  }
});

// ── GET /health ───────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'theusmarkt-pix' }));
app.get('/', (req, res) => res.send('TheusMarkt PIX Backend rodando 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 PIX Backend rodando na porta ${PORT}`));
