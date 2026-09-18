from flask import Flask, render_template, request, jsonify
from detector import analyze_image
import os

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/verify', methods=['POST'])
def verify():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Read image bytes and analyse
    image_bytes = file.read()
    result      = analyze_image(image_bytes)
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)