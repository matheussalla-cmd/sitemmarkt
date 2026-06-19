/* ============================================
   THEUSMARKT — PAYMENT.JS
   Fluxo: formulário → gerar PIX via backend →
          polling de confirmação → exibir download
   ============================================ */

let orderId = null;
let pollInterval = null;

// ── Utilitários ──────────────────────────────────────────
function showStep(id) {
  document.querySelectorAll('.payment-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

function setErr(msg) {
  const el = document.getElementById('buyerErr');
  if (el) el.textContent = msg;
}

function copyPixCode() {
  const input = document.getElementById('pixCopyCode');
  const btn   = document.getElementById('btnCopyPix');
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    btn.textContent = 'Copiado ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2500);
  }).catch(() => {
    input.select();
    document.execCommand('copy');
  });
}

// ── Passo 1: Submissão do formulário ─────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();
  setErr('');

  const name  = document.getElementById('buyerName').value.trim();
  const email = document.getElementById('buyerEmail').value.trim().toLowerCase();
  const phone = document.getElementById('buyerPhone').value.trim();
  const btn   = document.getElementById('btnGeneratePix');

  if (!name || !email) { setErr('Preencha nome e e-mail.'); return; }

  btn.disabled = true;
  btn.textContent = 'Gerando PIX...';

  try {
    const res = await fetch(`${PAYMENT_API_URL}/api/pix/criar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro ${res.status} ao gerar o PIX.`);
    }

    const data = await res.json();

    // Preenche o step de PIX
    orderId = data.orderId;
    document.getElementById('pixQrImage').src  = data.qrCodeBase64;
    document.getElementById('pixCopyCode').value = data.pixCopiaCola;
    document.getElementById('pixOrderId').textContent = data.orderId;

    showStep('stepPix');
    startPolling(data.orderId);

  } catch (err) {
    setErr(err.message || 'Erro ao conectar com o servidor. Verifique sua internet e tente novamente.');
    btn.disabled = false;
    btn.textContent = 'Gerar PIX e pagar →';
  }
}

// ── Passo 2: Polling de confirmação ──────────────────────
function startPolling(orderIdParam) {
  let attempts = 0;
  const MAX_ATTEMPTS = 180; // 15 minutos (a cada 5s)

  pollInterval = setInterval(async () => {
    attempts++;
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(pollInterval);
      document.getElementById('pixStatus').innerHTML =
        '<span style="color:var(--red)">⏰ Tempo de espera esgotado. Se já pagou, aguarde mais alguns instantes e recarregue a página.</span>';
      return;
    }

    try {
      const res = await fetch(`${PAYMENT_API_URL}/api/pix/status/${orderIdParam}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'approved') {
        clearInterval(pollInterval);
        handlePaymentApproved();
      }
    } catch(e) {
      // Falha de rede momentânea — apenas ignora e tenta novamente
    }
  }, 5000);
}

// ── Passo 3: Pagamento aprovado ──────────────────────────
function handlePaymentApproved() {
  const statusEl = document.getElementById('pixStatus');
  if (statusEl) {
    statusEl.className = 'pix-status paid';
    statusEl.innerHTML = '<span>✅ Pagamento confirmado! Preparando seu acesso...</span>';
  }

  setTimeout(() => {
    // Seta o link de download
    const dlLink = document.getElementById('downloadLink');
    if (dlLink) dlLink.href = DOWNLOAD_LINK;

    showStep('stepSuccess');
  }, 1200);
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('buyerForm');
  if (form) form.addEventListener('submit', handleFormSubmit);
});
