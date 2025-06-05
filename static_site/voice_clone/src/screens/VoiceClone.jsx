import React, {useState, useRef, useEffect} from 'react';
import axios from 'axios';

const PARAGRAPHS = [
    "Wow! Can you believe the brilliant crescendo of sound rising at this very moment? It’s time to embark on a thrilling journey, bursting with kinetic energy and electrifying excitement! Picture a carnival of curious creatures cavorting through colorful corridors while a symphony of sizzling snares and booming basslines invigorates every fiber of your being. As you exclaim “syzygy” and “synthesize,” accentuate the crisp “s” and buzzing “z” sibilance dancing between your teeth. Let the quick brown fox jump over the lazy dog with razor-sharp precision, stressing the plosive “k” and “b” sounds for maximum clarity. Imagine rockets hissing through humid night skies, the hiss and thrum propelling you forward in a whirlwind of wondrous anticipation! Exclaim each interjection—oh, wow, ah-ha, whoa—so the voice can flex its dynamic range and capture extreme highs and lows. This paragraph is an exuberant playground, designed to stretch every phoneme, clause, and breath to the limit, unleashing an unstoppable torrent of vocal acrobatics!",
    "Our quarterly financial report underscores a sustained upward trajectory in revenue growth, amplified by optimized operational efficiencies and strategic market positioning. Beginning with core performance metrics, we observed a 12.5% increase in net profit margins compared to the previous fiscal quarter, driven by improved cost management and accelerated sales velocity. Leveraging diversified revenue streams across multiple verticals—technology, healthcare, and consumer goods—we mitigated systemic risks and enhanced our competitive advantage. Through collaborative efforts with cross-functional stakeholders, including supply chain and R&D teams, we streamlined processes, reduced lead times, and refined our product portfolio to align with emerging market demands. This endeavor resulted in a 9.8% reduction in operational expenditures, bolstering our EBITDA and reinforcing shareholder confidence. Our precise forecasting models and rigorous scenario planning enabled us to identify potential headwinds, such as fluctuating currency exchange rates and supply chain disruptions, in advance. As the board evaluates these outcomes, the strategic initiatives presented here lay a robust foundation for sustained growth, fiscal discipline, and market leadership well into the next quarter.",
    "A gentle breeze whispers through the emerald canopy as dawn’s soft light filters across dew-kissed meadows, unveiling a world bathed in pastel hues. In this serene sanctuary, songbirds trill melodiously, weaving intricate patterns of sound that drift through the air like delicate threads of gold. Below, a crystal-clear brook meanders over moss-covered stones, its burbling cadence forming a tranquil symphony that soothes the soul. Pause to observe a solitary dragonfly gliding above a lily pad, wings shimmering with iridescent hues as though kissed by morning’s radiant glow. Nearby, wildflowers unfurl their petals in a silent celebration, releasing subtle fragrances of jasmine and honeysuckle that mingle with the earthy aroma of wet soil. Every syllable of this panorama—soft sighs of wind, distant calls of wildlife, occasional rustle of leaves—invites you to breathe deeply, to let go of restless thoughts, and to find solace in nature’s gentle rhythm. Embrace this moment, allowing your voice to flow like that calm brook, each vowel elongated and each consonant balanced, crafting a soothing narrative of timeless beauty.",
    "Have you ever wandered through a bustling marketplace brimming with fragrant spices, vibrant textiles, and the hum of human connection? It’s there that you might encounter a tapestry of textures, from the rough grain of handwoven baskets to the glossy sheen of polished pottery. Sellers beckon with warm smiles, inviting you to discover the stories behind each handcrafted treasure. “Try this,” they say, extending a spice-stained sample between thumb and forefinger; let its citrusy zest illuminate your palate and its aromatic complexity dance across your senses. Around the corner, a musician strums a lute, producing a resonant melody that wends through the crowd, prompting impromptu foot taps and shared laughter. Pause, inhale the mingled scents of cumin, cardamom, and saffron, and let your words flow naturally, with a gentle cadence and authentic warmth. Engage in light banter—“Where are you from?” or “How long did it take to weave this?”—allowing each question to rise and fall like a friendly echo. This conversational-style paragraph is designed to flex casual inflections, moderate pacing, and affectionate intonations, making it perfect for testing a dynamic, personable voice.",
    "In the dim glow of twilight, cast your gaze toward a solitary, ancient oak standing sentinel atop a windswept hill, its gnarled branches etched against an indigo sky. Beneath its weathered bark, a quiet pulse of memory stirs—whispers of forgotten kingdoms and silent heroes who once sought refuge beneath its sprawling canopy. Feel the weight of history in the hush that falls as dusk settles, broken only by the distant cry of a lone owl, its haunting call echoing through empty fields. Imagine the rustle of leaves, each one a verse in a mournful ballad, sighing for seasons long past. The whirling wind carries the scent of earth and ash, swirling around you like a spectral dance, pressing against your senses with urgent intensity. Each syllable you speak here—resound slowly, enunciate each consonant, linger on each vowel—so your voice embodies this profound gravity and evokes the soul’s raw longing. Let the dramatic pause linger between sentences, amplifying suspense, as you unfold this poetic tableau for a voice that must resonate with haunting clarity and emotional depth."
];

const API_KEY = import.meta.env.VITE_TTS_API_KEY;

export default function VoiceClone({userEmail, onFinish}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [recording, setRecording] = useState(false);
    const [alreadyDone, setAlreadyDone] = useState(false);
    const recordingRef = useRef(false);
    const audioContextRef = useRef(null);
    const workletNodeRef = useRef(null);
    const chunksRef = useRef([]);

    useEffect(() => {
        const key = `voiceclone_${userEmail}_${currentIndex}`;
        setAlreadyDone(localStorage.getItem(key) === 'true');
    }, [currentIndex, userEmail]);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({audio: true}).then(async (stream) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 22050});
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const workletCode = `
        class RecorderWorkletProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const channelData = input[0];
              this.port.postMessage(channelData);
            }
            return true;
          }
        }
        registerProcessor('recorder-worklet', RecorderWorkletProcessor);
      `;
            const blob = new Blob([workletCode], {type: 'application/javascript'});
            const moduleURL = URL.createObjectURL(blob);
            await audioContext.audioWorklet.addModule(moduleURL);
            const workletNode = new AudioWorkletNode(audioContext, 'recorder-worklet');
            workletNode.port.onmessage = (event) => {
                if (recordingRef.current) {
                    const floatSamples = new Float32Array(event.data);
                    chunksRef.current.push(floatSamples);
                }
            };
            source.connect(workletNode);
            workletNode.connect(audioContext.destination);
            workletNodeRef.current = workletNode;
        });
        return () => {
            if (workletNodeRef.current) workletNodeRef.current.disconnect();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const startRecording = () => {
        chunksRef.current = [];
        recordingRef.current = true;
        setRecording(true);
    };

    const stopRecording = () => {
        recordingRef.current = false;
        setRecording(false);
        setTimeout(() => {
            const samples = flattenArray(chunksRef.current);
            const wavBuffer = encodeWAV(samples, audioContextRef.current.sampleRate);
            const blob = new Blob([wavBuffer], {type: 'audio/wav'});
            uploadAudio(blob);
        }, 0);
    };

    const skipToNext = () => {
        if (currentIndex + 1 < PARAGRAPHS.length) {
            setCurrentIndex((i) => i + 1);
        } else {
            onFinish && onFinish();
        }
    };

    const reRecord = () => {
        const key = `voiceclone_${userEmail}_${currentIndex}`;
        localStorage.removeItem(key);
        setAlreadyDone(false);
    };

    function flattenArray(chunks) {
        let length = 0;
        chunks.forEach((c) => (length += c.length));
        const result = new Float32Array(length);
        let offset = 0;
        chunks.forEach((c) => {
            result.set(c, offset);
            offset += c.length;
        });
        return result;
    }

    function encodeWAV(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
        return view;
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async function uploadAudio(blob) {
        const safeName = userEmail.replace(/[@.]/g, '_');
        const filename = `${safeName}_${currentIndex}.wav`;
        const formData = new FormData();
        formData.append('email', userEmail);
        formData.append('file', blob, filename);
        try {
            const resp = await axios.post(
                '/input',
                formData,
                {
                    headers: {
                        'x-api-key': API_KEY
                    }
                }
            );
            if (resp.status !== 201 && resp.status !== 200) {
                alert(`Upload failed: ${resp.statusText}`);
                return;
            }
            const key = `voiceclone_${userEmail}_${currentIndex}`;
            localStorage.setItem(key, 'true');
            if (currentIndex + 1 < PARAGRAPHS.length) {
                setCurrentIndex((i) => i + 1);
            } else {
                alert('🎉 All 5 recordings uploaded successfully!');
                if (typeof onFinish === 'function') onFinish();
            }
        } catch (err) {
            alert('Error uploading audio. Check console for details.');
            console.error(err.response || err);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
            {currentIndex < PARAGRAPHS.length ? (
                <>
                    <h2 className="text-2xl font-semibold mb-4">Clone Your Voice</h2>
                    <p className="mb-6 text-gray-700">Read this paragraph aloud and hit “Record,” then “Stop &
                        Upload.”</p>
                    <blockquote className="bg-gray-100 p-4 rounded-lg mb-6 text-left italic">
                        {PARAGRAPHS[currentIndex]}
                    </blockquote>
                    {alreadyDone ? (
                        <div className="space-x-4">
                            <button
                                onClick={reRecord}
                                className="px-6 py-3 bg-yellow-500 text-white rounded-xl shadow hover:bg-yellow-600 transition"
                            >
                                Re-record
                            </button>
                            <button
                                onClick={skipToNext}
                                className="px-6 py-3 bg-green-600 text-white rounded-xl shadow hover:bg-green-700 transition"
                            >
                                Skip to Next
                            </button>
                        </div>
                    ) : !recording ? (
                        <button
                            onClick={startRecording}
                            className="px-6 py-3 bg-purple-600 text-white rounded-xl shadow hover:bg-purple-700 transition"
                        >
                            ● Record
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="px-6 py-3 bg-red-600 text-white rounded-xl shadow hover:bg-red-700 transition"
                        >
                            ■ Stop & Upload
                        </button>
                    )}
                    <p className="mt-4 text-gray-600">Step {currentIndex + 1} of {PARAGRAPHS.length}</p>
                </>
            ) : (
                <div>
                    <h3 className="text-2xl font-semibold mb-2">Thank you!</h3>
                    <p className="text-gray-600">You’ve recorded all paragraphs. You may close this or go back to the
                        main screen.</p>
                </div>
            )}
        </div>
    );
}
