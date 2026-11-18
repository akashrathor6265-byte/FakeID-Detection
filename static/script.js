const uploadArea     = document.getElementById('uploadArea');
const fileInput      = document.getElementById('fileInput');
const previewBox     = document.getElementById('previewBox');
const previewImg     = document.getElementById('previewImg');
const removeBtn      = document.getElementById('removeBtn');
const scanBtn        = document.getElementById('scanBtn');
const uploadCard     = document.getElementById('uploadCard');
const loadingCard    = document.getElementById('loadingCard');
const resultCard     = document.getElementById('resultCard');

const resultIcon     = document.getElementById('resultIcon');
const resultTitle    = document.getElementById('resultTitle');
const resultSub      = document.getElementById('resultSub');

const confidenceFill = document.getElementById('confidenceFill');
const confidencePct  = document.getElementById('confidencePct');
const checksGrid     = document.getElementById('checksGrid');

const resetBtn       = document.getElementById('resetBtn');

const steps = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
    document.getElementById('step4')
];

let selectedFile = null;


// ------------------------------------
// 1. FILE VALIDATION
// ------------------------------------

function isValidImage(file) {

    if (!file) {
        alert('Please select an image.');
        return false;
    }

    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
        alert('Please upload a JPG, PNG or WEBP image.');
        return false;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
        alert('Image size must be below 10 MB.');
        return false;
    }

    return true;
}


// ------------------------------------
// 2. DRAG AND DROP
// ------------------------------------

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

    if (isValidImage(file)) {
        handleFile(file);
    }

});


// ------------------------------------
// 3. FILE INPUT
// ------------------------------------

uploadArea.addEventListener('click', () => {

    fileInput.click();

});

fileInput.addEventListener('change', () => {

    const file = fileInput.files[0];

    if (file && isValidImage(file)) {
        handleFile(file);
    }

});


// ------------------------------------
// 4. IMAGE PREVIEW
// ------------------------------------

function handleFile(file) {

    selectedFile = file;

    const reader = new FileReader();

    reader.onload = (e) => {

        previewImg.src = e.target.result;

        previewBox.style.display = 'block';

        scanBtn.style.display = 'block';

        uploadArea.style.display = 'none';

    };

    reader.onerror = () => {

        alert('Unable to preview this image.');

        resetUpload();

    };

    reader.readAsDataURL(file);

}


// ------------------------------------
// 5. REMOVE IMAGE
// ------------------------------------

removeBtn.addEventListener('click', resetUpload);

function resetUpload() {

    selectedFile = null;

    fileInput.value = '';

    previewImg.src = '';

    previewBox.style.display = 'none';

    scanBtn.style.display = 'none';

    uploadArea.style.display = 'block';

}


// ------------------------------------
// 6. SCAN DOCUMENT
// ------------------------------------

scanBtn.addEventListener('click', async () => {

    if (!selectedFile) {
        alert('Please select an image first.');
        return;
    }

    uploadCard.style.display = 'none';

    loadingCard.style.display = 'block';

    resultCard.style.display = 'none';

    scanBtn.disabled = true;

    animateSteps();

    const formData = new FormData();

    formData.append('file', selectedFile);

    try {

        const response = await fetch('/verify', {

            method: 'POST',

            body: formData

        });

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error || 'Server error: ' + response.status
            );

        }

        if (!data || !data.result) {

            throw new Error('Invalid response received from server.');

        }

        setTimeout(() => {

            showResult(data);

            scanBtn.disabled = false;

        }, 1200);

    }

    catch (error) {

        loadingCard.style.display = 'none';

        uploadCard.style.display = 'block';

        scanBtn.disabled = false;

        alert('Analysis failed: ' + error.message);

    }

});


// ------------------------------------
// 7. LOADING ANIMATION
// ------------------------------------

function animateSteps() {

    steps.forEach(step => {

        if (step) {
            step.classList.remove('active', 'done');
        }

    });

    steps.forEach((step, index) => {

        if (!step) return;

        setTimeout(() => {

            step.classList.add('active');

        }, index * 400);

        setTimeout(() => {

            step.classList.remove('active');

            step.classList.add('done');

        }, index * 400 + 350);

    });

}


// ------------------------------------
// 8. RESULT CLASSIFICATION
// ------------------------------------

function getResultDetails(result) {

    switch (result) {

        case 'GENUINE':

            return {
                type: 'success',
                icon: '✅',
                title: 'SCREENING PASSED',
                message: 'No obvious issues were identified by the available screening checks. This does not prove authenticity.'
            };

        case 'DOCUMENT_DETECTED':
        case 'DOCUMENT_DETECTED_REVIEW_REQUIRED':

            return {
                type: 'warning',
                icon: '🟠',
                title: 'DOCUMENT DETECTED',
                message: 'Identity-document indicators were detected. Further verification is required before confirming authenticity.'
            };

        case 'REVIEW_REQUIRED':

            return {
                type: 'warning',
                icon: '⚠️',
                title: 'MANUAL REVIEW REQUIRED',
                message: 'The document could not be confidently assessed. Please review it manually.'
            };

        case 'NOT_AN_ID_DOCUMENT':

            return {
                type: 'fake',
                icon: '❌',
                title: 'NOT AN ID DOCUMENT',
                message: 'The uploaded image does not contain sufficient identity-document indicators.'
            };

        case 'FAKE':

            return {
                type: 'warning',
                icon: '⚠️',
                title: 'POTENTIAL TAMPERING DETECTED',
                message: 'Some checks raised concerns. This is not a definitive fraud determination; manual verification is required.'
            };

        case 'ERROR':

            return {
                type: 'warning',
                icon: '⚠️',
                title: 'ANALYSIS ERROR',
                message: 'The image could not be analysed. Please try another image.'
            };

        default:

            return {
                type: 'warning',
                icon: '⚠️',
                title: 'RESULT INCONCLUSIVE',
                message: 'The system returned an unrecognised result. Manual verification is recommended.'
            };

    }

}


// ------------------------------------
// 9. DISPLAY RESULT
// ------------------------------------

function showResult(data) {

    loadingCard.style.display = 'none';

    resultCard.style.display = 'block';

    const details = getResultDetails(data.result);

    resultIcon.textContent = details.icon;

    resultTitle.textContent = details.title;

    resultTitle.className = 'result-title ' + details.type;

    resultSub.textContent = details.message;


    // Display screening score safely

    const pct = Math.min(
        100,
        Math.max(0, Number(data.confidence) || 0)
    );

    confidencePct.textContent = pct + '%';

    confidenceFill.className =
        'confidence-fill ' + details.type;

    confidenceFill.style.width = '0%';

    setTimeout(() => {

        confidenceFill.style.width = pct + '%';

    }, 100);


    // Display individual checks

    checksGrid.innerHTML = '';

    (data.checks || []).forEach(check => {

        const div = document.createElement('div');

        div.className =
            'check-item ' + (check.passed ? 'pass' : 'fail');


        const name = document.createElement('div');

        name.className = 'check-name';

        name.textContent =
            (check.passed ? '✅ ' : '❌ ') +
            (check.name || 'Unknown check');


        const status = document.createElement('div');

        status.className = 'check-status';

        status.textContent =
            check.status || 'No additional information';


        div.appendChild(name);

        div.appendChild(status);

        checksGrid.appendChild(div);

    });

}


// ------------------------------------
// 10. RESET APPLICATION
// ------------------------------------

resetBtn.addEventListener('click', () => {

    resultCard.style.display = 'none';

    loadingCard.style.display = 'none';

    uploadCard.style.display = 'block';

    resetUpload();

    confidenceFill.style.width = '0%';

    confidencePct.textContent = '0%';

    checksGrid.innerHTML = '';

    steps.forEach(step => {

        if (step) {
            step.classList.remove('active', 'done');
        }

    });

});