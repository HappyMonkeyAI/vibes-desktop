import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Message } from '@arco-design/web-react';
import VoiceInput from '../src/renderer/VoiceInput';

// Arco's static Message API needs a mounted <Message /> container on React 18+
// (ReactDOM.render is gone). Render the component inside one, like App does.
const renderWithMessages = (ui: React.ReactElement) => render(<>{ui}<Message /></>);

beforeEach(() => {
  vi.clearAllMocks();
  // Use the main-process (yapsnap/server) path in unit tests — builtin Whisper
  // needs AudioContext + a worker, which jsdom does not provide.
  vi.mocked(window.vibesDesktop.settings.get).mockResolvedValue({
    vibesPath: '',
    contextPath: '',
    memoryPath: '',
    autoSave: true,
    verboseLogging: false,
    speechEngine: 'yapsnap',
    speechModel: 'onnx-community/whisper-tiny.en',
    speechPrecision: 'q8',
    speechLang: 'auto',
    speechServerUrl: 'http://127.0.0.1:8765/v1/audio/transcriptions',
    speechServerModel: 'qwen3-asr-0.6b-q8-0',
    speechServerHasKey: false,
    decisionMcpUrl: '',
    decisionMcpHasToken: false,
    ttsAnnounceEnabled: false,
    ttsDaemonUrl: 'http://127.0.0.1:4100',
    ttsDaemonHasToken: false,
    htmlDesignAdvisorEnabled: false,
    htmlDesignAdvisorPython: 'python',
    htmlDesignAdvisorWorkspace: '',
    maxSteps: 25,
    maxConcurrentTasks: 1,
    yoloMode: true,
    thinkingMode: true,
    contextCompactionEnabled: true,
    smallModelProfile: false,
    triageEnabled: false,
    triageInterval: 5,
    triageAutoSteer: true,
    memoryEnabled: true,
    localMemory: false,
  });
});

/** A minimal MediaRecorder fake that fires ondataavailable on start and onstop on stop. */
function installMediaMock() {
  const recorder = {
    state: 'inactive',
    mimeType: 'audio/webm',
    ondataavailable: null as null | ((e: BlobEvent) => void),
    onstop: null as null | (() => void),
    start: vi.fn(function () {
      this.state = 'recording';
      // Emit a data chunk shortly after start, like a real recorder.
      queueMicrotask(() => this.ondataavailable?.({ data: new Blob(['fake-audio']) } as BlobEvent));
    }),
    stop: vi.fn(function () {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.onstop?.();
    }),
  };
  class MediaRecorderFake {
    state = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable: null | ((e: BlobEvent) => void) = null;
    onstop: null | (() => void) = null;
    start = recorder.start;
    stop = recorder.stop;
  }
  vi.stubGlobal('MediaRecorder', MediaRecorderFake);

  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => stream) },
    configurable: true,
  });

  // jsdom's FileReader doesn't implement readAsDataURL; fake it to resolve a data URL.
  class FileReaderFake {
    result: string | null = null;
    onload: null | (() => void) = null;
    onerror: null | ((e: unknown) => void) = null;
    error: unknown = null;
    readAsDataURL(blob: Blob): void {
      this.result = 'data:audio/webm;base64,ZmFrZQ==';
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('FileReader', FileReaderFake);
  return Object.assign(recorder, { track });
}

describe('VoiceInput (T10)', () => {
  it('runs the doctor on mount and shows the button when voice is unavailable', async () => {
    vi.mocked(window.vibesDesktop.voice.doctor).mockResolvedValue({
      ffmpegAvailable: false, yapsnapAvailable: false, ready: false, ffmpegHint: 'install ffmpeg', yapsnapHint: 'pip install yapsnap',
    });
    renderWithMessages(<VoiceInput onTranscript={() => undefined} />);
    await waitFor(() => expect(window.vibesDesktop.voice.doctor).toHaveBeenCalled());
    expect(screen.getByText('Hold to talk')).toBeTruthy();
  });

  it('records on hold, transcribes on release, and delivers the text', async () => {
    installMediaMock();
    vi.mocked(window.vibesDesktop.voice.doctor).mockResolvedValue({
      ffmpegAvailable: true, yapsnapAvailable: true, ready: true, ffmpegHint: null, yapsnapHint: null,
    });
    const onTranscript = vi.fn();
    renderWithMessages(<VoiceInput onTranscript={onTranscript} />);
    await waitFor(() => expect(screen.queryByText('voice not ready')).toBeNull());

    const button = screen.getByText('Hold to talk');
    fireEvent.mouseDown(button);
    // startRecording is async (awaits getUserMedia) — wait until it's actually recording.
    await waitFor(() => expect(screen.getByText('Recording… release to send')).toBeTruthy());
    fireEvent.mouseUp(screen.getByText('Recording… release to send'));
    await waitFor(() => expect(window.vibesDesktop.voice.transcribe).toHaveBeenCalled());

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('stub transcription'));
    // The transcribe request carried a base64 payload (not the data-URL prefix).
    const arg = vi.mocked(window.vibesDesktop.voice.transcribe).mock.calls[0][0];
    expect(arg.audioBase64).toBe('ZmFrZQ==');
    expect(arg.mime).toBe('audio/webm');
  });

  it('surfaces a transcription error instead of delivering text', async () => {
    installMediaMock();
    vi.mocked(window.vibesDesktop.voice.doctor).mockResolvedValue({
      ffmpegAvailable: true, yapsnapAvailable: true, ready: true, ffmpegHint: null, yapsnapHint: null,
    });
    vi.mocked(window.vibesDesktop.voice.transcribe).mockResolvedValue({ ok: false, error: 'model missing' });
    const onTranscript = vi.fn();
    renderWithMessages(<VoiceInput onTranscript={onTranscript} />);
    await waitFor(() => expect(screen.queryByText('voice not ready')).toBeNull());

    fireEvent.mouseDown(screen.getByText('Hold to talk'));
    await waitFor(() => expect(screen.getByText('Recording… release to send')).toBeTruthy());
    fireEvent.mouseUp(screen.getByText('Recording… release to send'));
    // The release must have reached the transcriber (proving the flow ran) but
    // delivered no text because transcription failed.
    await waitFor(() => expect(window.vibesDesktop.voice.transcribe).toHaveBeenCalled());
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('T33 — holding Space on the focused button records and transcribes on release', async () => {
    installMediaMock();
    vi.mocked(window.vibesDesktop.voice.doctor).mockResolvedValue({
      ffmpegAvailable: true, yapsnapAvailable: true, ready: true, ffmpegHint: null, yapsnapHint: null,
    });
    // The error test above leaves a failing transcribe mock behind.
    vi.mocked(window.vibesDesktop.voice.transcribe).mockResolvedValue({ ok: true, text: 'stub transcription' });
    const onTranscript = vi.fn();
    renderWithMessages(<VoiceInput onTranscript={onTranscript} />);
    await waitFor(() => expect(window.vibesDesktop.voice.doctor).toHaveBeenCalled());

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: ' ' });
    await waitFor(() => expect(screen.getByText('Recording… release to send')).toBeTruthy());
    // Auto-repeat keydowns while held must not restart capture.
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: ' ' });
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('stub transcription'));
  });

  it('T33 — unmounting mid-recording releases the microphone', async () => {
    const recorder = installMediaMock();
    vi.mocked(window.vibesDesktop.voice.doctor).mockResolvedValue({
      ffmpegAvailable: true, yapsnapAvailable: true, ready: true, ffmpegHint: null, yapsnapHint: null,
    });
    const view = renderWithMessages(<VoiceInput onTranscript={() => undefined} />);
    await waitFor(() => expect(window.vibesDesktop.voice.doctor).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByText('Hold to talk'));
    await waitFor(() => expect(screen.getByText('Recording… release to send')).toBeTruthy());
    view.unmount();
    expect(recorder.stop).toHaveBeenCalled();
    expect(recorder.track.stop).toHaveBeenCalled();
  });
});
