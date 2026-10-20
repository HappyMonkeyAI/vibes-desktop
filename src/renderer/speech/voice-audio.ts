/** Decode MediaRecorder blobs to mono 16 kHz Float32 for Whisper. */

export const WHISPER_SAMPLE_RATE = 16_000;

export async function decodeToWhisperInput(blob: Blob): Promise<Float32Array> {
  const decodeContext = new AudioContext();
  try {
    const decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer());
    const length = Math.max(1, Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, length, WHISPER_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } finally {
    void decodeContext.close();
  }
}
