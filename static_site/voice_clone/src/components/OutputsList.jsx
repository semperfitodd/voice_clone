import React from "react";

export default function OutputsList({ blobUrls, outputs }) {
  if (!outputs.length) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl">
      <h3 className="text-xl font-semibold mb-4">Available Outputs</h3>
      <ul className="space-y-4">
        {outputs.map((item) => {
          const blobUrl = blobUrls[item.filename];
          return (
            <li key={item.filename} className="output-row">
              <div className="output-row-main">
                {blobUrl ? (
                  <audio controls src={blobUrl} />
                ) : (
                  <span>Loading…</span>
                )}
                <span className="output-filename">{item.filename}</span>
              </div>
              {blobUrl && (
                <a className="btn btn-secondary btn-sm" download={item.filename} href={blobUrl}>
                  Download
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
