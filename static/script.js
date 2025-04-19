const videoUpload = document.getElementById('video-upload');
const uploadButton = document.getElementById('upload-button');
const videoUrlInput = document.getElementById('video-url');
const videoPlayer = document.getElementById('video-player');
const timelineContainer = document.getElementById('timeline-container');
const timeline = document.getElementById('timeline');
const rangeSelector = document.getElementById('range-selector');
const leftHandle = document.getElementById('left-handle');
const rightHandle = document.getElementById('right-handle');
const extractButton = document.getElementById('extract-button');
const downloadSection = document.querySelector('.download-section');
const downloadLink = document.getElementById('download-link');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const startTimeDisplay = document.getElementById('start-time-display');
const endTimeDisplay = document.getElementById('end-time-display');
const dynamicTimeLabels = document.getElementById('dynamic-time-labels'); // Get the container

let videoDuration = 0;
let startTime = 0;
let endTime = 60;
let isDragging = null; // 'left', 'right', 'body', or null
let dragStartX = 0;
let dragStartLeft = 0;
let dragStartRight = 0;
let uploadedVideoFile = null; // To store the selected video file
let uploadedFilename = null; // To store the filename from the server
let urlInputChangeTimeout; // To debounce URL input changes
let isExtracting = false; // To prevent multiple extract requests

// Trigger file input when the upload button is clicked
uploadButton.addEventListener('click', () => {
    console.log('Upload button clicked');
    videoUpload.click();
});

// Function to load video from a file
videoUpload.addEventListener('change', (event) => {
    console.log('videoUpload change event triggered');
    const file = event.target.files[0];
    if (file) {
        console.log('Selected file:', file);
        uploadedVideoFile = file; // Store the selected file
        const videoURL = URL.createObjectURL(file);
        console.log('Video URL:', videoURL);
        loadVideo(videoURL); // Use a common function to load video
    } else {
        console.log('No file selected');
        uploadedVideoFile = null;
        uploadedFilename = null;
    }
});

// Listen for changes in the video URL input
videoUrlInput.addEventListener('input', () => {
    clearTimeout(urlInputChangeTimeout);
    const url = videoUrlInput.value;
    if (url) {
        urlInputChangeTimeout = setTimeout(() => {
            console.log('Video URL entered:', url);
            // Basic client-side check for common video file extensions (for direct links)
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
            const isDirectVideoURL = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));

            if (isDirectVideoURL) {
                loadVideo(url); // Load directly if it seems to be a direct link
                uploadedVideoFile = null;
                uploadedFilename = null;
            } else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('twitter.com') || url.includes('x.com') || url.includes('instagram.com')) {
                // Send to backend for extraction from URL
                extractAudioFromURL(url);
            } else if (url) {
                alert('Please enter a direct URL to a video file (e.g., .mp4, .webm) or a valid YouTube, Twitter (X), or Instagram URL.');
                videoUrlInput.value = '';
                resetTimeline();
                videoPlayer.src = '';
            }
        }, 500); // Wait for 500ms of inactivity before processing
    } else {
        resetTimeline();
        videoPlayer.src = '';
    }
});

function extractAudioFromURL(url) {
    if (isExtracting) return;
    isExtracting = true;
    extractButton.textContent = 'Extracting...';
    extractButton.disabled = true;
    downloadSection.style.display = 'none';

    const outputFormat = document.getElementById('output-format').value;
    const extractionDetails = {
        url: url,
        outputFormat: outputFormat
    };

    fetch('http://127.0.0.1:5000/extract_from_url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractionDetails),
    })
    .then(response => response.json())
    .then(audioData => {
        isExtracting = false;
        extractButton.textContent = 'Extract audio ▶';
        extractButton.disabled = false;
        console.log('Audio extraction from URL successful:', audioData);
        if (audioData && audioData.output_filename) {
            const downloadUrl = `http://127.0.0.1:5000/download/${audioData.output_filename}`;
            downloadLink.href = downloadUrl;
            downloadLink.download = audioData.output_filename;
            downloadSection.style.display = 'block';
        } else if (audioData && audioData.error) {
            alert(`Error extracting audio: ${audioData.error}`);
        } else {
            alert('An unexpected error occurred during audio extraction from URL.');
        }
    })
    .catch(error => {
        isExtracting = false;
        extractButton.textContent = 'Extract audio ▶';
        extractButton.disabled = false;
        console.error('Error extracting audio from URL:', error);
        alert('An error occurred while trying to extract audio from the URL.');
    });
}

// Function to load video and initialize timeline (for direct video URLs)
function loadVideo(videoSource) {
    videoPlayer.src = videoSource;
    console.log('Video source set to:', videoSource);
    videoPlayer.onloadedmetadata = () => {
        console.log('Metadata loaded');
        videoDuration = videoPlayer.duration;
        endTime = videoDuration > 60 ? 60 : videoDuration;
        startTimeInput.value = startTime.toFixed(1);
        endTimeInput.value = endTime.toFixed(1);
        generateTimeLabels(); // Generate labels based on duration
        initializeTimeline();
    };
    videoPlayer.onerror = () => {
        alert('Error loading video from the provided URL. Please check the URL and ensure it is a valid and accessible video file.');
        videoUrlInput.value = ''; // Clear the input
        resetTimeline();
        videoPlayer.src = ''; // Clear the video player
    };
    // Reset timeline and range selector when a new video is loaded
    resetTimeline();
}

function resetTimeline() {
    timeline.style.width = '0%';
    rangeSelector.style.display = 'none';
    rangeSelector.style.left = '0%';
    rangeSelector.style.width = '0%';
    startTime = 0;
    endTime = videoDuration > 60 ? 60 : videoDuration;
    startTimeInput.value = startTime.toFixed(1);
    endTimeInput.value = endTime.toFixed(1);
    dynamicTimeLabels.innerHTML = ''; // Clear existing labels
    updateRangeSelector();
}

function generateTimeLabels() {
    dynamicTimeLabels.innerHTML = ''; // Clear any existing labels

    if (videoDuration) {
        const numLabels = 5; // Adjust the number of labels as needed
        for (let i = 0; i < numLabels; i++) {
            const time = (videoDuration * i) / (numLabels - 1);
            const minutes = Math.floor(time / 60);
            const seconds = Math.floor(time % 60).toString().padStart(2, '0');
            const labelText = `${minutes}:${seconds}`;

            const label = document.createElement('span');
            label.textContent = labelText;
            label.style.left = `${(i / (numLabels - 1)) * 100}%`;
            dynamicTimeLabels.appendChild(label);
        }
        // Add the end time label
        const endMinutes = Math.floor(videoDuration / 60);
        const endSeconds = Math.floor(videoDuration % 60).toString().padStart(2, '0');
        const endLabelText = `${endMinutes}:${endSeconds}`;
        const endLabel = document.createElement('span');
        endLabel.textContent = endLabelText;
        endLabel.style.right = '0%';
        dynamicTimeLabels.appendChild(endLabel);
    } else {
        // Default labels if no video loaded
        dynamicTimeLabels.innerHTML = '<span>0:00</span><span>0:30</span><span>1:00</span><span>...</span>';
    }
}

// Function to upload the video file to the server
function uploadVideoToServer() {
    if (uploadedVideoFile) {
        const formData = new FormData();
        formData.append('video', uploadedVideoFile); // 'video' is the field name our Flask app expects

        return fetch('http://127.0.0.1:5000/upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json()); // Return the promise for further processing
    } else {
        alert('Please upload a video file first.');
        return Promise.reject('No video file to upload.'); // Reject the promise
    }
}

// Function to send extraction details to the server (for uploaded files)
function extractAudioFromServer(extractionDetails) {
    if (isExtracting) return;
    isExtracting = true;
    extractButton.textContent = 'Extracting...';
    extractButton.disabled = true;
    downloadSection.style.display = 'none';

    console.log('About to fetch /extract_audio with:', extractionDetails);
    return fetch('http://127.0.0.1:5000/extract_audio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractionDetails),
    })
    .then(response => {
        console.log('Received response from /extract_audio:', response);
        return response.json();
    })
    .finally(() => {
        isExtracting = false;
        extractButton.textContent = 'Extract audio ▶';
        extractButton.disabled = false;
    });
}

// Initialize the timeline based on video duration
function initializeTimeline() {
    timelineContainer.addEventListener('click', (event) => {
        const clickPosition = event.clientX - timelineContainer.getBoundingClientRect().left;
        const timelineWidth = timelineContainer.offsetWidth;
        const selectedTime = (clickPosition / timelineWidth) * videoDuration;
        startTime = selectedTime;
        endTime = videoDuration; // Reset end time on click
        startTimeInput.value = startTime.toFixed(1);
        endTimeInput.value = endTime.toFixed(1);
        updateRangeSelector();
    });

    rangeSelector.addEventListener('mousedown', (event) => {
        if (event.target === leftHandle) {
            isDragging = 'left';
            dragStartX = event.clientX;
            dragStartLeft = parseFloat(rangeSelector.style.left) || 0;
        } else if (event.target === rightHandle) {
            isDragging = 'right';
            dragStartX = event.clientX;
            dragStartRight = parseFloat(rangeSelector.style.left) + parseFloat(rangeSelector.style.width) || 0;
        } else {
            isDragging = 'body';
            dragStartX = event.clientX;
            dragStartLeft = parseFloat(rangeSelector.style.left) || 0;
            dragStartRight = parseFloat(rangeSelector.style.left) + parseFloat(rangeSelector.style.width) || 0;
        }
    });

    document.addEventListener('mousemove', (event) => {
        if (!isDragging || !videoDuration) return;

        const currentX = event.clientX;
        const deltaX = currentX - dragStartX;
        const timelineWidth = timelineContainer.offsetWidth;
        const timePerPixel = videoDuration / timelineWidth;

        if (isDragging === 'left') {
            const newStartTime = Math.max(0, startTime + deltaX * timePerPixel);
            if (newStartTime < endTime) {
                startTime = newStartTime;
            }
        } else if (isDragging === 'right') {
            const newEndTime = Math.min(videoDuration, endTime + deltaX * timePerPixel);
            if (newEndTime > startTime) {
                endTime = newEndTime;
            }
        } else if (isDragging === 'body') {
            const deltaLeftPercentage = (deltaX / timelineWidth) * 100;
            let newLeftPercentage = dragStartLeft + deltaLeftPercentage;
            let newRightPercentage = dragStartRight + deltaLeftPercentage;

            if (newLeftPercentage >= 0 && newRightPercentage <= 100) {
                startTime = newLeftPercentage / 100 * videoDuration;
                endTime = newRightPercentage / 100 * videoDuration;
            }
        }

        startTimeInput.value = startTime.toFixed(1);
        endTimeInput.value = endTime.toFixed(1);
        updateRangeSelector();
    });

    document.addEventListener('mouseup', () => {
        isDragging = null;
    });

    videoPlayer.addEventListener('timeupdate', () => {
        if (videoDuration) {
            const progress = (videoPlayer.currentTime / videoDuration) * 100;
            timeline.style.width = `${progress}%`;
        }
    });
}

function updateRangeSelector() {
    if (videoDuration) {
        const startPercentage = (startTime / videoDuration) * 100;
        const endPercentage = (endTime / videoDuration) * 100;
        rangeSelector.style.left = `${Math.min(startPercentage, endPercentage)}%`;
        rangeSelector.style.width = `${Math.abs(endPercentage - startPercentage)}%`;
        rangeSelector.style.display = 'block';
        startTimeDisplay.textContent = `${startTime.toFixed(1)} s`;
        endTimeDisplay.textContent = `${endTime.toFixed(1)} s`;
    } else {
        startTimeDisplay.textContent = '0.0 s';
        endTimeDisplay.textContent = '60.0 s';
    }
}

// Update start and end times from input fields
startTimeInput.addEventListener('change', () => {
    startTime = parseFloat(startTimeInput.value) || 0;
    updateRangeSelector();
});

endTimeInput.addEventListener('change', () => {
    endTime = parseFloat(endTimeInput.value) || videoDuration || 60;
    updateRangeSelector();
});

extractButton.addEventListener('click', () => {
    const outputFormat = document.getElementById('output-format').value;

    if (uploadedVideoFile) {
        uploadVideoToServer()
            .then(data => {
                console.log('Upload successful:', data);
                uploadedFilename = data.filename;

                const extractionDetails = {
                    filename: uploadedFilename,
                    startTime: parseFloat(startTimeInput.value),
                    endTime: parseFloat(endTimeInput.value),
                    outputFormat: outputFormat
                };
                console.log('Extraction Details (file):', extractionDetails);
                return extractAudioFromServer(extractionDetails);
            })
            .then(audioData => {
                console.log('Audio extraction successful (file):', audioData);
                if (audioData && audioData.output_filename) {
                    const downloadUrl = `http://127.0.0.1:5000/download/${audioData.output_filename}`;
                    downloadLink.href = downloadUrl;
                    downloadLink.download = audioData.output_filename; // Suggest a filename
                    downloadSection.style.display = 'block';
                } else if (audioData && audioData.error) {
                    alert(`Error extracting audio: ${audioData.error}`);
                } else {
                    alert('An unexpected error occurred during audio extraction from file.');
                }
            })
            .catch(error => {
                console.error('Error (file):', error);
                alert('An error occurred during upload or audio extraction from file.');
            });
    } else if (videoUrlInput.value) {
        extractAudioFromURL(videoUrlInput.value);
    } else {
        alert('Please upload a video file or enter a video URL.');
    }
});

// Call updateRangeSelector initially to set the initial display
updateRangeSelector();

downloadLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent the default navigation
    const downloadUrl = downloadLink.href;
    const filename = downloadLink.download;
    if (downloadUrl && filename) {
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.download = filename;
        document.body.appendChild(tempLink);
        tempLink.style.display = 'none'; // Prevent it from being visible
        tempLink.click();
        document.body.removeChild(tempLink);
    }
});