import React from 'react';
import RecordButton from '../components/RecordButton';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl md:text-6xl font-bold mb-6">
        Self-hosted Text to Speech (TTS)
      </h1>
      <p className="text-lg md:text-xl mb-10 text-gray-600">
        Easily test your own voice for TTS inference.
      </p>
      <RecordButton />
    </div>
  );
}
