import io
import re
import cv2
import numpy as np
import pytesseract

from PIL import Image, ImageOps


# ==========================================================
# CONFIGURATION
# ==========================================================

MAX_IMAGE_SIZE = (1800, 1800)
MIN_IMAGE_SIZE = 250

# OCR confidence threshold
OCR_CONFIDENCE = 35

# Document keywords
DOCUMENT_KEYWORDS = [
    "election commission",
    "electors photo identity",
    "identity card",
    "voter",
    "government of india",
    "income tax department",
    "permanent account number",
    "driving licence",
    "driving license",
    "passport",
    "aadhaar",
    "unique identification",
    "भारत निर्वाचन आयोग",
    "निर्वाचक फोटो पहचान पत्र",
    "भारत सरकार",
    "आयकर विभाग",
    "स्थायी खाता संख्या",
    "आधार"
]

# Common document field labels
FIELD_KEYWORDS = [
    "name",
    "father",
    "date of birth",
    "dob",
    "gender",
    "address",
    "identity",
    "number",
    "नाम",
    "पिता",
    "जन्म",
    "लिंग",
    "पता"
]


# ==========================================================
# MAIN ANALYSIS FUNCTION
# ==========================================================

def analyze_image(image_bytes):

    try:
        pil_img = Image.open(
            io.BytesIO(image_bytes)
        )

        pil_img = ImageOps.exif_transpose(
            pil_img
        ).convert("RGB")

        original_width, original_height = pil_img.size

        if min(original_width, original_height) < MIN_IMAGE_SIZE:
            return error_result(
                "Image resolution is too small"
            )

        pil_img.thumbnail(MAX_IMAGE_SIZE)

        cv_img = cv2.cvtColor(
            np.array(pil_img),
            cv2.COLOR_RGB2BGR
        )

    except Exception:
        return error_result(
            "Unable to read uploaded image"
        )

    # ------------------------------------------------------
    # STAGE 1: IMAGE QUALITY
    # ------------------------------------------------------

    quality = check_quality(cv_img)

    # ------------------------------------------------------
    # STAGE 2: DOCUMENT SHAPE
    # ------------------------------------------------------

    shape = check_card_shape(cv_img)

    # ------------------------------------------------------
    # STAGE 3: OCR
    # ------------------------------------------------------

    document = check_document_text(cv_img)

    checks = [
        quality,
        shape,
        document
    ]

    # ------------------------------------------------------
    # STAGE 4: DOCUMENT CLASSIFICATION
    # ------------------------------------------------------

    if not document["passed"]:

        return build_result(
            result="NOT_AN_ID_DOCUMENT",
            confidence=0,
            checks=checks,
            message="Identity document indicators were not detected."
        )

    # A document with insufficient quality needs review.
    if not quality["passed"]:

        return build_result(
            result="REVIEW_REQUIRED",
            confidence=40,
            checks=checks,
            message="Document detected, but image quality is insufficient."
        )

    # ------------------------------------------------------
    # STAGE 5: TAMPERING ANALYSIS
    # ------------------------------------------------------

    ela = check_ela(pil_img)

    checks.append(ela)

    qr = check_qr(cv_img)

    # QR is informational only.
    checks.append(qr)

    # ------------------------------------------------------
    # STAGE 6: FINAL ASSESSMENT
    # ------------------------------------------------------

    suspicious = (
        not shape["passed"]
        or not ela["passed"]
    )

    if suspicious:

        return build_result(
            result="REVIEW_REQUIRED",
            confidence=55,
            checks=checks,
            message="Document indicators detected. Additional verification is required."
        )

    return build_result(
        result="DOCUMENT_DETECTED_REVIEW_REQUIRED",
        confidence=70,
        checks=checks,
        message="Document structure detected. Authenticity has not been established."
    )


# ==========================================================
# IMAGE QUALITY CHECK
# ==========================================================

def check_quality(img):

    gray = cv2.cvtColor(
        img,
        cv2.COLOR_BGR2GRAY
    )

    sharpness = cv2.Laplacian(
        gray,
        cv2.CV_64F
    ).var()

    height, width = gray.shape

    passed = (
        sharpness > 35
        and min(height, width) >= MIN_IMAGE_SIZE
    )

    return {
        "name": "Image Quality",
        "passed": bool(passed),
        "status": (
            "Image is sufficiently clear"
            if passed
            else "Image is blurry or too small"
        ),
        "score": 85 if passed else 25
    }


# ==========================================================
# CARD SHAPE DETECTION
# ==========================================================

def check_card_shape(img):

    gray = cv2.cvtColor(
        img,
        cv2.COLOR_BGR2GRAY
    )

    gray = cv2.GaussianBlur(
        gray,
        (5, 5),
        0
    )

    edges = cv2.Canny(
        gray,
        40,
        120
    )

    kernel = np.ones(
        (3, 3),
        np.uint8
    )

    edges = cv2.dilate(
        edges,
        kernel,
        iterations=2
    )

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_LIST,
        cv2.CHAIN_APPROX_SIMPLE
    )

    height, width = gray.shape

    image_area = height * width

    found = False

    for contour in contours:

        area = cv2.contourArea(contour)

        if area < image_area * 0.025:
            continue

        perimeter = cv2.arcLength(
            contour,
            True
        )

        if perimeter == 0:
            continue

        approx = cv2.approxPolyDP(
            contour,
            0.02 * perimeter,
            True
        )

        rect = cv2.minAreaRect(
            contour
        )

        rw, rh = rect[1]

        if min(rw, rh) <= 0:
            continue

        ratio = max(rw, rh) / min(rw, rh)

        # Approximate rectangular ID-card proportions.
        if (
            len(approx) == 4
            and 1.2 <= ratio <= 2.0
        ):
            found = True
            break

    return {
        "name": "Card Shape",
        "passed": found,
        "status": (
            "Possible rectangular document boundary found"
            if found
            else "Document boundary not confidently detected"
        ),
        "score": 85 if found else 20
    }


# ==========================================================
# OCR DOCUMENT VERIFICATION
# ==========================================================

def check_document_text(img):

    try:

        gray = cv2.cvtColor(
            img,
            cv2.COLOR_BGR2GRAY
        )

        gray = cv2.resize(
            gray,
            None,
            fx=1.5,
            fy=1.5,
            interpolation=cv2.INTER_CUBIC
        )

        # Improve text contrast
        gray = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            11
        )

        # English OCR
        text = pytesseract.image_to_string(
            gray,
            config="--psm 6"
        )

        normalized = re.sub(
            r"\s+",
            " ",
            text.lower()
        )

        # Document-specific indicators
        document_matches = [
            keyword
            for keyword in DOCUMENT_KEYWORDS
            if keyword in normalized
        ]

        # Personal information field indicators
        field_matches = [
            keyword
            for keyword in FIELD_KEYWORDS
            if keyword in normalized
        ]

        # Extract OCR words
        words = re.findall(
            r"[a-zA-Z0-9]{2,}",
            normalized
        )

        # Require meaningful document evidence.
        # These are screening rules, not authentication.
        passed = (
            len(document_matches) >= 1
            and len(field_matches) >= 1
            and len(words) >= 5
        )

        return {
            "name": "Document Text (OCR)",
            "passed": bool(passed),
            "status": (
                f"Document indicators: {len(document_matches)}, "
                f"field indicators: {len(field_matches)}"
                if passed
                else "Insufficient document-specific text detected"
            ),
            "score": 90 if passed else 15
        }

    except Exception:

        return {
            "name": "Document Text (OCR)",
            "passed": False,
            "status": "OCR verification failed",
            "score": 0
        }


# ==========================================================
# ERROR LEVEL ANALYSIS
# ==========================================================

def check_ela(pil_img):

    try:

        buffer = io.BytesIO()

        pil_img.save(
            buffer,
            format="JPEG",
            quality=90
        )

        buffer.seek(0)

        compressed = Image.open(
            buffer
        ).convert("RGB")

        original = np.asarray(
            pil_img,
            dtype=np.int16
        )

        altered = np.asarray(
            compressed,
            dtype=np.int16
        )

        difference = np.abs(
            original - altered
        ).sum(axis=2).astype(
            np.float32
        )

        if difference.size == 0:
            raise ValueError("Empty image")

        median = float(
            np.median(difference)
        )

        percentile = float(
            np.percentile(difference, 99)
        )

        ratio = percentile / (
            median + 1e-6
        )

        # ELA is only a warning signal.
        # It cannot independently prove manipulation.
        suspicious = ratio > 8.0

        return {
            "name": "Tampering (ELA)",
            "passed": not suspicious,
            "status": (
                "No strong ELA anomaly detected"
                if not suspicious
                else "Unusual compression pattern - manual review suggested"
            ),
            "score": 70 if not suspicious else 35
        }

    except Exception:

        return {
            "name": "Tampering (ELA)",
            "passed": False,
            "status": "ELA analysis unavailable",
            "score": 35
        }


# ==========================================================
# QR CODE DETECTION
# ==========================================================

def check_qr(img):

    try:

        detector = cv2.QRCodeDetector()

        data, points, _ = detector.detectAndDecode(
            img
        )

        if data:

            return {
                "name": "QR Code",
                "passed": True,
                "status": "QR code detected and decoded",
                "score": 80
            }

        if points is not None:

            return {
                "name": "QR Code",
                "passed": False,
                "status": "QR detected but could not be decoded",
                "score": 40
            }

        return {
            "name": "QR Code",
            "passed": False,
            "status": "No QR code found (informational)",
            "score": 50
        }

    except Exception:

        return {
            "name": "QR Code",
            "passed": False,
            "status": "QR analysis unavailable",
            "score": 50
        }


# ==========================================================
# RESULT BUILDER
# ==========================================================

def build_result(result, confidence, checks, message):

    return {
        "result": result,
        "confidence": int(confidence),
        "message": message,
        "checks": [
            {
                "name": str(check["name"]),
                "passed": bool(check["passed"]),
                "status": str(check["status"])
            }
            for check in checks
        ]
    }


# ==========================================================
# ERROR RESULT
# ==========================================================

def error_result(message="Could not read image"):

    return {
        "result": "ERROR",
        "confidence": 0,
        "message": message,
        "checks": [
            {
                "name": "Image",
                "passed": False,
                "status": message
            }
        ]
    }