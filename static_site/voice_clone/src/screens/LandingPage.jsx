import React, { useCallback, useEffect, useState } from "react";

import apiClient from "../api/client.js";
import LoginButton from "../components/LoginButton.jsx";
import OutputsList from "../components/OutputsList.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { recordingsComplete } from "../utils/recordings.js";
import VoiceClone from "./VoiceClone.jsx";

export default function LandingPage() {
  const { email, isAuthenticated, logout } = useAuth();
  const [showCloneFlow, setShowCloneFlow] = useState(false);
  const [showTtsFlow, setShowTtsFlow] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [outputs, setOutputs] = useState([]);
  const [blobUrls, setBlobUrls] = useState({});

  const allRecordingsDone = useCallback(() => recordingsComplete(email), [email]);

  const fetchOutputs = useCallback(async () => {
    if (!email) return;
    try {
      const res = await apiClient.get("/outputs");
      setOutputs(res.data);
      const newBlobUrls = {};
      await Promise.all(
        res.data.map(async (item) => {
          const wavResp = await apiClient.get(item.url, { responseType: "blob" });
          newBlobUrls[item.filename] = URL.createObjectURL(wavResp.data);
        }),
      );
      setBlobUrls(newBlobUrls);
    } catch {
      setOutputs([]);
      setBlobUrls({});
    }
  }, [email]);

  useEffect(() => {
    setTtsText("");
    setRequestSent(false);
    setOutputs([]);
    setBlobUrls({});
    if (email) {
      fetchOutputs();
    }
  }, [email, fetchOutputs]);

  const handleCloneFinish = () => {
    setShowCloneFlow(false);
  };

  const sendTTSRequest = async () => {
    if (!ttsText.trim()) return;
    try {
      await apiClient.post("/synthesize", { text: ttsText });
      setRequestSent(true);
    } catch {
      setRequestSent(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="page-center bg-gray-50">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Self-hosted Text to Speech (TTS)</h1>
        <p className="text-lg md:text-xl mb-10 text-gray-600">Please sign in with Google to continue.</p>
        <LoginButton />
      </div>
    );
  }

  if (showCloneFlow) {
    return (
      <div className="page-center">
        <button type="button" className="btn btn-back" onClick={() => setShowCloneFlow(false)}>
          &larr; Back
        </button>
        <VoiceClone onFinish={handleCloneFinish} userEmail={email} />
      </div>
    );
  }

  if (showTtsFlow) {
    return (
      <div className="page-center">
        <button type="button" className="btn btn-back" onClick={() => setShowTtsFlow(false)}>
          &larr; Back
        </button>
        <h2 className="text-2xl font-medium mb-4">
          Signed in as <span className="font-bold">{email}</span>
        </h2>
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Text to Speech</h1>
        {!requestSent ? (
          <>
            <textarea
              className="textarea-field"
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Enter text to synthesize..."
              rows="4"
              value={ttsText}
            />
            <button
              className={`btn btn-lg ${allRecordingsDone() ? "btn-success" : "btn-disabled"}`}
              disabled={!allRecordingsDone()}
              onClick={sendTTSRequest}
              title={!allRecordingsDone() ? "Clone your voice first" : ""}
              type="button"
            >
              Generate Speech
            </button>
            <button className="btn btn-info mt-4" onClick={fetchOutputs} type="button">
              Refresh Outputs
            </button>
          </>
        ) : (
          <p className="text-lg text-gray-700">Request sent. Your audio will be processed soon.</p>
        )}
        <div className="mt-8">
          <OutputsList blobUrls={blobUrls} outputs={outputs} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-center bg-gray-50 pt-16">
      <h2 className="text-2xl font-medium mb-4">
        Signed in as <span className="font-bold">{email}</span>
      </h2>
      <button className="btn btn-secondary btn-sm mb-4" onClick={logout} type="button">
        Sign out
      </button>
      <h1 className="text-4xl md:text-6xl font-bold mb-6">Self-hosted Text to Speech (TTS)</h1>
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <button
          className="btn btn-lg btn-primary"
          onClick={() => {
            setShowCloneFlow(true);
            setShowTtsFlow(false);
          }}
          type="button"
        >
          Clone Your Voice
        </button>
        <button
          className={`btn btn-lg ${allRecordingsDone() ? "btn-success" : "btn-disabled"}`}
          disabled={!allRecordingsDone()}
          onClick={() => {
            setShowTtsFlow(true);
            setShowCloneFlow(false);
          }}
          title={!allRecordingsDone() ? "Clone your voice first" : ""}
          type="button"
        >
          Generate Speech
        </button>
      </div>
      <button className="btn btn-info mb-8" onClick={fetchOutputs} type="button">
        Check for New Outputs
      </button>
      <OutputsList blobUrls={blobUrls} outputs={outputs} />
    </div>
  );
}
