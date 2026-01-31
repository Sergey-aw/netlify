/**
 * Minimal WAV recorder (16-bit PCM) for SpeechSuper compatibility.
 *
 * Why: Some browsers only produce `audio/webm` via MediaRecorder, which SpeechSuper rejects.
 * This fallback records PCM from the mic and encodes a WAV file client-side.
 */

export type WavRecorderOptions = {
  targetSampleRate?: number;
  numChannels?: 1; // keep mono for now
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function downsampleBuffer(input: Float32Array, inSampleRate: number, outSampleRate: number): Float32Array {
  if (outSampleRate === inSampleRate) return input;
  if (outSampleRate > inSampleRate) {
    // Avoid upsampling complexity; keep original rate.
    return input;
  }

  const ratio = inSampleRate / outSampleRate;
  const newLength = Math.round(input.length / ratio);
  const output = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < output.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    output[offsetResult] = count ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return output;
}

function encodeWavPCM16(monoSamples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  const dataSize = monoSamples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    offset += s.length;
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');

  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true); // PCM
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true); // bits per sample
  offset += 2;

  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  // PCM16 samples
  for (let i = 0; i < monoSamples.length; i++) {
    const s = clamp(monoSamples[i], -1, 1);
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function createWavRecorder(stream: MediaStream, options: WavRecorderOptions = {}) {
  const targetSampleRate = options.targetSampleRate ?? 16000;

  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let chunks: Float32Array[] = [];
  let stopped = false;

  const start = async () => {
    stopped = false;
    chunks = [];

    // Prefer built-in sample rate; downsample on stop.
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    source = audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode is deprecated but still broadly supported; sufficient for a fallback recorder.
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (stopped) return;
      const input = e.inputBuffer.getChannelData(0);
      // Copy the buffer (input is reused)
      chunks.push(new Float32Array(input));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  const stop = async (): Promise<Blob> => {
    stopped = true;

    const ctx = audioContext;
    const inSampleRate = ctx?.sampleRate ?? targetSampleRate;

    // Cleanup graph
    try {
      processor?.disconnect();
      source?.disconnect();
    } catch {
      // ignore
    }

    // Stop tracks
    stream.getTracks().forEach((t) => t.stop());

    try {
      await ctx?.close();
    } catch {
      // ignore
    }

    audioContext = null;
    source = null;
    processor = null;

    // Flatten
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    const downsampled = downsampleBuffer(merged, inSampleRate, targetSampleRate);
    return encodeWavPCM16(downsampled, targetSampleRate);
  };

  return { start, stop };
}
