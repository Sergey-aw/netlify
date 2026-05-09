// Audio Recorder Utility
// Records WAV audio in browser (16kHz, mono, PCM16) as required by SpeechSuper API

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];

  /**
   * Request microphone permission and initialize recorder
   */
  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1, // Mono
          sampleRate: 16000, // 16kHz
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Create audio context for processing
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Initialize MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm', // We'll convert to WAV later
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

    } catch (error) {
      console.error('Failed to initialize audio recorder:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  /**
   * Start recording
   */
  startRecording(): void {
    if (!this.mediaRecorder) {
      throw new Error('Recorder not initialized');
    }

    this.audioChunks = [];
    this.mediaRecorder.start();
  }

  /**
   * Stop recording and return WAV blob
   */
  async stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder) {
      throw new Error('Recorder not initialized');
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          // Combine chunks
          const webmBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          
          // Convert to WAV (16kHz, mono, PCM16)
          const wavBlob = await this.convertToWav(webmBlob);
          
          resolve(wavBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Convert WebM to WAV format (16kHz, mono, PCM16)
   */
  private async convertToWav(webmBlob: Blob): Promise<Blob> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Decode audio data
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // Resample to 16kHz if needed and convert to mono
    const targetSampleRate = 16000;
    const resampled = this.resampleAndConvertToMono(audioBuffer, targetSampleRate);

    // Convert to WAV
    const wavBlob = this.audioBufferToWav(resampled, targetSampleRate);
    
    return wavBlob;
  }

  /**
   * Resample audio buffer and convert to mono
   */
  private resampleAndConvertToMono(audioBuffer: AudioBuffer, targetSampleRate: number): Float32Array {
    const sourceSampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    
    // Get mono channel data
    let monoData: Float32Array;
    if (channels === 1) {
      monoData = audioBuffer.getChannelData(0);
    } else {
      // Mix down to mono
      const length = audioBuffer.length;
      monoData = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        monoData[i] = sum / channels;
      }
    }

    // Resample if needed
    if (sourceSampleRate === targetSampleRate) {
      return monoData;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(monoData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;
      
      if (index + 1 < monoData.length) {
        // Linear interpolation
        result[i] = monoData[index] * (1 - fraction) + monoData[index + 1] * fraction;
      } else {
        result[i] = monoData[index];
      }
    }

    return result;
  }

  /**
   * Convert audio buffer to WAV blob (PCM16, 16kHz, mono)
   */
  private audioBufferToWav(samples: Float32Array, sampleRate: number): Blob {
    const numChannels = 1; // Mono
    const bitsPerSample = 16; // PCM16
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true); // File size - 8
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true); // Subchunk2Size

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      // Convert float32 [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, samples[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true); // Little-endian
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Check if recording is in progress
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.mediaRecorder = null;
    this.audioContext = null;
    this.stream = null;
    this.audioChunks = [];
  }
}

/**
 * Validate WAV file format
 */
export async function validateWavFile(file: Blob): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // Check minimum size
    if (buffer.byteLength < 44) {
      return { isValid: false, error: 'File too small to be a valid WAV' };
    }

    // Check RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );

    // Check WAVE format
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );

    if (riff !== 'RIFF' || wave !== 'WAVE') {
      return { isValid: false, error: 'Invalid WAV file format' };
    }

    // Check sample rate (offset 24, 4 bytes, little-endian)
    const sampleRate = view.getUint32(24, true);
    if (sampleRate !== 16000) {
      return { 
        isValid: false, 
        error: `Invalid sample rate: ${sampleRate}. Must be 16000 Hz` 
      };
    }

    // Check channels (offset 22, 2 bytes, little-endian)
    const channels = view.getUint16(22, true);
    if (channels !== 1) {
      return { 
        isValid: false, 
        error: `Invalid channel count: ${channels}. Must be mono (1)` 
      };
    }

    // Check bits per sample (offset 34, 2 bytes, little-endian)
    const bitsPerSample = view.getUint16(34, true);
    if (bitsPerSample !== 16) {
      return { 
        isValid: false, 
        error: `Invalid bits per sample: ${bitsPerSample}. Must be 16` 
      };
    }

    return { isValid: true };

  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error' 
    };
  }
}
