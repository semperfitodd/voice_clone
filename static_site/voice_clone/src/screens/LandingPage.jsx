import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import VoiceClone from './VoiceClone';
import axios from 'axios';

const API_KEY = import.meta.env.VITE_TTS_API_KEY;

export default function LandingPage({ email, setEmail }) {
  const [showCloneFlow, setShowCloneFlow] = useState(false);
  const [showTtsFlow, setShowTtsFlow] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [outputs, setOutputs] = useState([]);
  const [blobUrls, setBlobUrls] = useState({});

  useEffect(() => {
    setTtsText('');
    setRequestSent(false);
    setOutputs([]);
    setBlobUrls({});
    if (email) {
      fetchOutputs();
    }
  }, [email]);

  const handleCloneFinish = () => {
    setShowCloneFlow(false);
  };

  const recordingsComplete = () => {
    if (!email) return false;
    for (let i = 0; i < 5; i++) {
      const key = `voiceclone_${email}_${i}`;
      if (localStorage.getItem(key) !== 'true') return false;
    }
    return true;
  };

  const fetchOutputs = async () => {
    try {
      const res = await axios.get(
        `/outputs?email=${encodeURIComponent(email)}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      setOutputs(res.data);
      const newBlobUrls = {};
      await Promise.all(
        res.data.map(async (item) => {
          const wavResp = await axios.get(item.url, {
            responseType: 'blob',
            headers: { 'x-api-key': API_KEY }
          });
          newBlobUrls[item.filename] = URL.createObjectURL(wavResp.data);
        })
      );
      setBlobUrls(newBlobUrls);
    } catch {
      setOutputs([]);
      setBlobUrls({});
    }
  };

  const sendTTSRequest = () => {
    if (!ttsText.trim()) return;
    axios.post(
      '/synthesize',
      { text: ttsText, voice: email },
      { headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' } }
    ).catch(() => {});
    setRequestSent(true);
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Self-hosted Text to Speech (TTS)</h1>
        <p className="text-lg md:text-xl mb-10 text-gray-600">Please sign in with Google to continue.</p>
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            const base64Url = credentialResponse.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(window.atob(base64));
            setEmail(decoded.email);
          }}
          onError={() => {
            alert('Google login failed. Try again.');
          }}
        />
      </div>
    );
  }

  if (showCloneFlow) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <button
          onClick={() => setShowCloneFlow(false)}
          className="absolute top-4 left-4 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
        >
          &larr; Back
        </button>
        <VoiceClone userEmail={email} onFinish={handleCloneFinish} />
      </div>
    );
  }

  if (showTtsFlow) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <button
          onClick={() => setShowTtsFlow(false)}
          className="absolute top-4 left-4 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
        >
          &larr; Back
        </button>
        <h2 className="text-2xl font-medium mb-4">
          Signed in as <span className="font-bold">{email}</span>
        </h2>
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Text to Speech</h1>
        {!requestSent ? (
          <>
            <textarea
              rows="4"
              className="w-full max-w-xl p-4 border border-gray-300 rounded-lg mb-4"
              placeholder="Enter text to synthesize..."
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
            />
            <button
              onClick={sendTTSRequest}
              disabled={!recordingsComplete()}
              title={!recordingsComplete() ? 'Clone your voice first' : ''}
              className={`px-8 py-4 text-white text-lg rounded-xl shadow-lg transition ${
                !recordingsComplete()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Generate Speech
            </button>
            <button
              onClick={fetchOutputs}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Refresh Outputs
            </button>
          </>
        ) : (
          <p className="text-lg text-gray-700">Request sent. Your audio will be processed soon.</p>
        )}
        {outputs.length > 0 && (
          <div className="mt-8 w-full max-w-2xl">
            <h3 className="text-xl font-semibold mb-4">Available Outputs</h3>
            <ul className="space-y-4">
              {outputs.map((item) => {
                const blobUrl = blobUrls[item.filename];
                return (
                  <li key={item.filename} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {blobUrl ? (
                        <audio controls src={blobUrl} />
                      ) : (
                        <span>Loading…</span>
                      )}
                      <span>{item.filename}</span>
                    </div>
                    {blobUrl && (
                      <a
                        href={blobUrl}
                        download={item.filename}
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                      >
                        Download
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 text-center pt-16">
      <h2 className="text-2xl font-medium mb-4">
        Signed in as <span className="font-bold">{email}</span>
      </h2>
      <h1 className="text-4xl md:text-6xl font-bold mb-6">Self-hosted Text to Speech (TTS)</h1>
      <div className="space-x-4 mb-8">
        <button
          onClick={() => {
            setShowCloneFlow(true);
            setShowTtsFlow(false);
          }}
          className="px-8 py-4 bg-purple-600 text-white text-lg rounded-xl shadow-lg hover:bg-purple-700 transition"
        >
          Clone Your Voice
        </button>
        <button
          onClick={() => {
            setShowTtsFlow(true);
            setShowCloneFlow(false);
          }}
          disabled={!recordingsComplete()}
          title={!recordingsComplete() ? 'Clone your voice first' : ''}
          className={`px-8 py-4 text-white text-lg rounded-xl shadow-lg transition ${
            !recordingsComplete()
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          Generate Speech
        </button>
      </div>
      <button
        onClick={fetchOutputs}
        className="mb-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        Check for New Outputs
      </button>
      {outputs.length > 0 && (
        <div className="w-full max-w-2xl">
          <h3 className="text-xl font-semibold mb-4">Available Outputs</h3>
          <ul className="space-y-4">
            {outputs.map((item) => {
              const blobUrl = blobUrls[item.filename];
              return (
                <li key={item.filename} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {blobUrl ? (
                      <audio controls src={blobUrl} />
                    ) : (
                      <span>Loading…</span>
                    )}
                    <span>{item.filename}</span>
                  </div>
                  {blobUrl && (
                    <a
                      href={blobUrl}
                      download={item.filename}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                    >
                      Download
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
