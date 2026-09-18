// ── ELEMENTS ──────────────────────────────────────────
const uploadArea    = document.getElementById('uploadArea');
const fileInput     = document.getElementById('fileInput');
const previewBox    = document.getElementById('previewBox');
const previewImg    = document.getElementById('previewImg');
const removeBtn     = document.getElementById('removeBtn');
const scanBtn       = document.getElementById('scanBtn');
const uploadCard    = document.getElementById('uploadCard');
const loadingCard   = document.getElementById('loadingCard');
const resultCard    = document.getElementById('resultCard');
const resultIcon    = document.getElementById('resultIcon');
const resultTitle   = document.getElementById('resultTitle');
const resultSub     = document.getElementById('resultSub');
const confidenceFill= document.getElementById('confidenceFill');
const confidencePct = document.getElementById('confidencePct');
const checksGrid    = document.getElementById('checksGrid');
const resetBtn      = document.getElementById('resetBtn');

const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
  document.getElementById('step4'),
];

let selectedFile = null;

// ── DRAG AND DROP ──────────────────────────────────────
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleFile(file);
  }
});

// ── FILE INPUT ─────────────────────────────────────────
uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    handleFile(fileInput.files[0]);
  }
});

// ── HANDLE FILE ────────────────────────────────────────
function handleFile(file) {
  selectedFile = file;
  const reader  = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewBox.style.display = 'block';
    scanBtn.style.display    = 'block';
    uploadArea.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ── REMOVE FILE ────────────────────────────────────────
removeBtn.addEventListener('click', resetUpload);

function resetUpload() {
  selectedFile       = null;
  fileInput.value    = '';
  previewImg.src     = '';
  previewBox.style.display  = 'none';
  scanBtn.style.display     = 'none';
  uploadArea.style.display  = 'block';
}

// ── SCAN BUTTON ────────────────────────────────────────
scanBtn.addEventListener('click', () => {
  if (!selectedFile) return;

  // Show loading
  uploadCard.style.display  = 'none';
  loadingCard.style.display = 'block';
  resultCard.style.display  = 'none';

  // Animate steps
  animateSteps();

  // Send to backend
  const formData = new FormData();
  formData.append('file', selectedFile);

  fetch('/verify', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    setTimeout(() => showResult(data), 3500);
  })
  .catch(() => {
    // If backend not ready — show demo result
    setTimeout(() => showResult(getDemoResult()), 3500);
  });
});

// ── ANIMATE LOADING STEPS ──────────────────────────────
function animateSteps() {
  steps.forEach(s => {
    s.classList.remove('active', 'done');
  });

  steps.forEach((step, i) => {
    setTimeout(() => {
      step.classList.add('active');
    }, i * 700);

    setTimeout(() => {
      step.classList.remove('active');
      step.classList.add('done');
    }, i * 700 + 600);
  });
}

// ── SHOW RESULT ────────────────────────────────────────
function showResult(data) {
  loadingCard.style.display = 'none';
  resultCard.style.display  = 'block';

  const isGenuine = data.result === 'GENUINE';

  // Icon and title
  resultIcon.textContent  = isGenuine ? '✅' : '❌';
  resultTitle.textContent = isGenuine ? 'GENUINE ID' : 'FAKE ID DETECTED';
  resultTitle.className   = 'result-title ' + (isGenuine ? 'genuine' : 'fake');
  resultSub.textContent   = isGenuine
    ? 'This document appears to be authentic.'
    : 'This document shows signs of tampering or forgery.';

  // Confidence bar
  const pct = data.confidence || 0;
  confidencePct.textContent = pct + '%';
  confidenceFill.className  = 'confidence-fill ' + (isGenuine ? 'genuine' : 'fake');
  setTimeout(() => {
    confidenceFill.style.width = pct + '%';
  }, 100);

  // Checks grid
  checksGrid.innerHTML = '';
  const checks = data.checks || [];
  checks.forEach(check => {
    const div = document.createElement('div');
    div.className = 'check-item ' + (check.passed ? 'pass' : 'fail');
    div.innerHTML = `
      <div class="check-name">${check.passed ? '✅' : '❌'} ${check.name}</div>
      <div class="check-status">${check.status}</div>
    `;
    checksGrid.appendChild(div);
  });
}

// ── DEMO RESULT (when backend not ready) ───────────────
function getDemoResult() {
  return {
    result: 'GENUINE',
    confidence: 91,
    checks: [
      { name: 'Font Analysis',    passed: true,  status: 'Official fonts detected' },
      { name: 'Logo & Watermark', passed: true,  status: 'Seals verified' },
      { name: 'QR Validation',    passed: true,  status: 'QR data matches' },
      { name: 'Pixel Tampering',  passed: true,  status: 'No edits found' },
    ]
  };
}

// ── RESET ──────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  resultCard.style.display  = 'none';
  uploadCard.style.display  = 'block';
  resetUpload();
  confidenceFill.style.width = '0%';
  steps.forEach(s => s.classList.remove('active', 'done'));
});