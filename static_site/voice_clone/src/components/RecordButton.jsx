import React, {useState, useRef} from 'react';

export default function RecordButton({email}) {
    const [recording, setRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const [chunks, setChunks] = useState([]);

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
            setChunks((prev) => [...prev, e.data]);
        };
        recorder.start();
        setRecording(true);
    };

    const stopRecording = async () => {
        const recorder = mediaRecorderRef.current;
        recorder.stop();
        setRecording(false);
        recorder.onstop = async () => {
            const blob = new Blob(chunks, {type: 'audio/wav'});
            const form = new FormData();
            form.append('email', email);
            form.append('file', blob, `${email.replace(/[@.]/g, '_')}_${Date.now()}.wav`);

            try {
                const res = await fetch(import.meta.env.VITE_API_INPUT_URL, {
                    method: 'POST',
                    headers: {
                        'x-api-key': import.meta.env.VITE_TTS_API_KEY,
                    },
                    body: form,
                });
                const json = await res.json();
                console.log('Upload response:', json);
            } catch (err) {
                console.error('Upload failed:', err);
            }

            setChunks([]);
        };
    };

    return (
        <div>
            {!recording ? (
                <button
                    onClick={startRecording}
                    className="px-6 py-3 bg-indigo-600 text-white text-lg rounded-xl shadow-md hover:bg-indigo-700 transition"
                >
                    🎙️ Start Recording
                </button>
            ) : (
                <button
                    onClick={stopRecording}
                    className="px-6 py-3 bg-red-600 text-white text-lg rounded-xl shadow-md hover:bg-red-700 transition"
                >
                    🛑 Stop & Upload
                </button>
            )}
        </div>
    );
}
