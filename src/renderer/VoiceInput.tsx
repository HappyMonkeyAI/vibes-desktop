import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Message } from '@arco-design/web-react';
import type { VoiceDoctorResult } from '@shared/channels';

/**
 * T10 — push-to-talk voice input. Press-and-hold the button to record mic audio
 * (MediaRecorder → webm/opus); on release the buffer is base64-encoded and sent
 * to main for transcription, whose text lands in the mission request field via
 * `onTranscript`. The doctor check runs before first capture so a missing ffmpeg
 * or yapsnap produces an actionable hint, not a crash (SPEC S5).
 */

type VoiceState = 'idle' | 'recording' | 'transcribing';

const VoiceInput: React.FC<{ onTranscript: (text: string) => void }> = ({ onTranscript }) => {
  const [state, setState] = useState<VoiceState>('idle');
  const [doctor, setDoctor] = useState<VoiceDoctorResult | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Run the doctor once on mount so capture is blocked with a clear hint if not ready.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.vibesDesktop.voice.doctor();
        if (!cancelled) setDoctor(result);
      } catch {
        // Doctor itself failing is non-fatal; capture will surface its own error.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startRecording = useCallback(async () => {
    if (doctor && !doctor.ready) {
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
      recorder.onstop = () => stream.getTracks().forEach((t) => t.stop());
      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
    } catch (error) {
      Message.error(`Microphone unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [doctor]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorderRef.current = null;
    setState('transcribing');
    // Per the MediaRecorder spec, a recorder started WITHOUT a timeslice delivers
    // its (only) chunk in a final dataavailable that fires asynchronously AFTER
    // stop() returns. Support both callback-style (tests) and addEventListener
    // style (real browsers).
    const finalChunk = new Promise<void>((resolve) => {
      let resolved = false;
      const resolveOnce = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      if (typeof (recorder as any).addEventListener === 'function') {
        (recorder as any).addEventListener('dataavailable', resolveOnce, { once: true });
        (recorder as any).addEventListener('stop', resolveOnce, { once: true });
      } else {
        // callback form (test mocks)
        const origData = (recorder as any).ondataavailable;
        (recorder as any).ondataavailable = (e: any) => {
          try { origData?.(e); } catch {}
          resolveOnce();
        };
        const origStop = (recorder as any).onstop;
        (recorder as any).onstop = () => {
          try { origStop?.(); } catch {}
          resolveOnce();
        };
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
      const audioBase64 = await blobToBase64(blob);
      const result = await window.vibesDesktop.voice.transcribe({ audioBase64, mime: blob.type });
      if (result.ok && result.text) onTranscript(result.text);
      else Message.error(result.error ?? 'Transcription produced no text.');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Transcription failed.');
    } finally {
      setState('idle');
    }
  }, [onTranscript]);

  const notReady = doctor && !doctor.ready;
  return (
    <Button
      long={false}
      type={state === 'recording' ? 'primary' : 'default'}
      status={notReady ? 'warning' : undefined}
      loading={state === 'transcribing'}
      onMouseDown={() => void startRecording()}
      onMouseUp={() => void stopRecording()}
      onMouseLeave={() => { if (state === 'recording') void stopRecording(); }}
    >
      {state === 'recording' ? 'Recording… release to send' : state === 'transcribing' ? 'Transcribing…' : 'Hold to talk'}
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
