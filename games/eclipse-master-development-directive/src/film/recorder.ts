import { audio } from '../audio/audio';

class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  recording = false;
  start(canvas: HTMLCanvasElement): boolean {
    if (this.recording || typeof MediaRecorder === 'undefined') return false;
    const stream = (canvas as HTMLCanvasElement).captureStream(30);
    const a = audio.getStream(); a?.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    try {
      this.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    } catch { return false; }
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'eclipse-the-last-awakening.webm'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.recording = false;
    };
    this.rec.start(1000); this.recording = true; return true;
  }
  stop() { if (this.rec && this.recording) this.rec.stop(); }
}
export const recorder = new Recorder();
