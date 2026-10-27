import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Message } from '@arco-design/web-react';
import type { AppSettings, SpeechEngine, VoiceDoctorResult } from '@shared/channels';
import { getSpeechClient } from './speech/speech-client';
import { DEFAULT_SPEECH_MODEL, DEFAULT_SPEECH_PRECISION } from './speech/speech-models';
import { decodeToWhisperInput } from './speech/voice-audio';

/**
 * Push-to-talk voice input.
 * - builtin (default): Whisper ONNX in a worker — downloads the model on first
 *   release of the mic button (ZeroG Terminal behaviour).
 * - server: OpenAI-compatible transcriptions via main process.
 * - yapsnap: legacy CLI path (requires pip install).
 */

type VoiceState = 'idle' | 'recording' | 'transcribing';

const VoiceInput: React.FC<{ onTranscript: (text: string) => void }> = ({ onTranscript }) => {
  const [state, setState] = useState<VoiceState>('idle');
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<VoiceDoctorResult | null>(null);
  const [engine, setEngine] = useState<SpeechEngine>('builtin');
  const settingsRef = useRef<AppSettings | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Release the microphone if the component goes away mid-recording.
  useEffect(() => () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* already stopping */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await window.vibesDesktop.settings.get();
        if (cancelled) return;
        settingsRef.current = settings;
        setEngine(settings.speechEngine ?? 'builtin');
      } catch {
        // defaults
      }
      try {
        const result = await window.vibesDesktop.voice.doctor();
        if (!cancelled) setDoctor(result);
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startRecording = useCallback(async () => {
    const currentEngine = settingsRef.current?.speechEngine ?? engine;
    if (currentEngine === 'yapsnap' && doctor && !doctor.ready) {
      Message.warning(doctor.ffmpegHint ?? doctor.yapsnapHint ?? 'Voice input is not ready.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (streamRef.current === stream) streamRef.current = null;
      };
      streamRef.current = stream;
      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
      setStatusHint(null);
    } catch (error) {
      Message.error(`Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [doctor, engine]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorderRef.current = null;
    setState('transcribing');

    const finalChunk = new Promise<void>((resolve) => {
      let resolved = false;
      const resolveOnce = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      if (typeof (recorder as MediaRecorder & { addEventListener?: Function }).addEventListener === 'function') {
        recorder.addEventListener('dataavailable', resolveOnce, { once: true });
        recorder.addEventListener('stop', resolveOnce, { once: true });
      } else {
        const origData = recorder.ondataavailable;
        recorder.ondataavailable = (e: BlobEvent) => {
          try { origData?.call(recorder, e); } catch { /* ignore */ }
          resolveOnce();
        };
        const origStop = recorder.onstop;
        recorder.onstop = ((ev: Event) => {
          try { origStop?.call(recorder, ev); } catch { /* ignore */ }
          resolveOnce();
        }) as MediaRecorder['onstop'];
      }
    });
    recorder.stop();
    await finalChunk;

    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size === 0) {
        Message.error('Recording captured no audio — held too briefly?');
        return;
      }

      // Refresh settings in case the user changed engine in another tab.
      let settings = settingsRef.current;
      try {
        settings = await window.vibesDesktop.settings.get();
        settingsRef.current = settings;
        setEngine(settings.speechEngine);
      } catch {
        // keep cached
      }
      const currentEngine = settings?.speechEngine ?? 'builtin';

      if (currentEngine === 'builtin') {
        setStatusHint('Loading speech model…');
        const samples = await decodeToWhisperInput(blob);
        const result = await getSpeechClient().transcribe(
          samples,
          {
            model: settings?.speechModel || DEFAULT_SPEECH_MODEL,
            precision: settings?.speechPrecision || DEFAULT_SPEECH_PRECISION,
            language: settings?.speechLang || 'auto',
            device: 'wasm',
          },
          (progress) => {
            if (progress.kind === 'loading') {
              const pct = progress.progress != null ? `${Math.round(progress.progress)}%` : '…';
              setStatusHint(`Downloading speech model ${pct}`);
            } else if (progress.kind === 'notice') {
              setStatusHint(progress.message);
            }
          },
        );
        setStatusHint(null);
        if (result.text) onTranscript(result.text);
        else Message.error('Transcription produced no text (silent or too-short audio).');
        return;
      }

      const audioBase64 = await blobToBase64(blob);
      const result = await window.vibesDesktop.voice.transcribe({ audioBase64, mime: blob.type });
      if (result.ok && result.text) onTranscript(result.text);
      else Message.error(result.error ?? 'Transcription produced no text.');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Transcription failed.');
    } finally {
      setStatusHint(null);
      setState('idle');
    }
  }, [onTranscript]);

  const yapsnapBlocked = engine === 'yapsnap' && doctor && !doctor.ready;
  const label =
    state === 'recording'
      ? 'Recording… release to send'
      : state === 'transcribing'
        ? (statusHint ?? 'Transcribing…')
        : 'Hold to talk';

  return (
    <Button
      long={false}
      type={state === 'recording' ? 'primary' : 'default'}
      status={yapsnapBlocked ? 'warning' : undefined}
      loading={state === 'transcribing'}
      title={statusHint ?? undefined}
      onMouseDown={() => void startRecording()}
      onMouseUp={() => void stopRecording()}
      onMouseLeave={() => { if (state === 'recording') void stopRecording(); }}
      // Keyboard push-to-talk: hold Space or Enter while the button has focus.
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.repeat && state === 'idle') void startRecording();
      }}
      onKeyUp={(e: React.KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        void stopRecording();
      }}
      onBlur={() => { if (state === 'recording') void stopRecording(); }}
    >
      {label}
    </Button>
  );
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

export default VoiceInput;
