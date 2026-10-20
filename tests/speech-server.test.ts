import { describe, expect, it } from 'vitest';
import { isSupportedSpeechEndpoint, parseTranscriptionText } from '../src/main/voice/speech-server';

describe('speech-server helpers', () => {
  it('accepts http(s) transcription URLs only', () => {
    expect(isSupportedSpeechEndpoint('http://127.0.0.1:8765/v1/audio/transcriptions')).toBe(true);
    expect(isSupportedSpeechEndpoint('https://asr.example/v1/audio/transcriptions')).toBe(true);
    expect(isSupportedSpeechEndpoint('file:///tmp/x')).toBe(false);
    expect(isSupportedSpeechEndpoint('not a url')).toBe(false);
  });

  it('parses OpenAI-style and segment transcripts', () => {
    expect(parseTranscriptionText({ text: '  hello  ' })).toBe('hello');
    expect(parseTranscriptionText({ segments: [{ text: 'hi' }, { text: 'there' }] })).toBe('hi there');
    expect(parseTranscriptionText('plain')).toBe('plain');
    expect(parseTranscriptionText({})).toBeNull();
  });
});
