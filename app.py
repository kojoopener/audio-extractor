import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import ffmpeg
import yt_dlp
import json  # Import the json module

#app = Flask(__name__)
app = Flask(__name__, static_folder='./static', static_url_path='/static') # Changed static_folder
print(f"Current working directory: {os.getcwd()}") # Keep this for now
CORS(app)

# ... rest of your app.py code ...

UPLOAD_FOLDER = 'uploads'
EXTRACTED_AUDIO_FOLDER = 'extracted_audio'
ALLOWED_EXTENSIONS = {'mp4', 'webm', 'ogg', 'mov'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXTRACTED_AUDIO_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'video' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filename)
        return jsonify({'filename': file.filename})
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/extract_audio', methods=['POST'])
def extract_audio():
    data = request.get_json()
    filename = os.path.join(UPLOAD_FOLDER, data['filename'])
    start_time = float(data['startTime'])
    end_time = float(data['endTime'])
    output_format = data['outputFormat'].lower()
    output_filename = os.path.join(EXTRACTED_AUDIO_FOLDER, f"extracted_{os.path.splitext(data['filename'])[0]}.{output_format}")

    try:
        ffmpeg.input(filename, ss=start_time, to=end_time).output(output_filename, format=output_format).run(overwrite_output=True)
        return jsonify({'output_filename': os.path.basename(output_filename)})
    except ffmpeg.Error as e:
        return jsonify({'error': str(e)}), 500

@app.route('/extract_from_url', methods=['POST'])
def extract_from_url():
    data = request.get_json()
    video_url = data.get('url')
    output_format = data.get('outputFormat', 'mp3').lower()
    output_filename = os.path.join(EXTRACTED_AUDIO_FOLDER, f"extracted_from_url.{output_format}")

    ydl_opts = {
        'format': 'bestaudio/best',
        'extractaudio': True,
        'audioformat': output_format,
        'outtmpl': output_filename,
        'overwrite': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(video_url, download=True)
            if info_dict and info_dict.get('title'):
                base_filename = f"extracted_{info_dict['title'].replace(' ', '_')}.{output_format}"
                new_output_filename = os.path.join(EXTRACTED_AUDIO_FOLDER, base_filename)
                os.rename(output_filename, new_output_filename)
                return jsonify({'output_filename': os.path.basename(new_output_filename)})
            else:
                return jsonify({'output_filename': os.path.basename(output_filename)})
    except yt_dlp.DownloadError as e:
        return jsonify({'error': f"Error downloading from URL: {str(e)}"}), 500
    except Exception as e:
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(EXTRACTED_AUDIO_FOLDER, filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)