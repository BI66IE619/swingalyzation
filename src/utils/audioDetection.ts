export async function detectCrackOfBat(
  videoElement: HTMLVideoElement,
  fps: number,
  onProgress?: (p: number) => void
): Promise<number | null> {
  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(videoElement);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const originalTime = videoElement.currentTime;
    videoElement.currentTime = 0;

    await new Promise<void>((resolve) => {
      const handler = () => resolve();
      videoElement.addEventListener('seeked', handler, { once: true });
    });

    const duration = videoElement.duration;
    const stepSize = 1 / fps;
    let maxAmplitude = 0;
    let contactTime: number | null = null;

    const highFreqThreshold = 180;

    for (let t = 0; t < duration; t += stepSize) {
      videoElement.currentTime = t;
      await new Promise<void>((resolve) => {
        const handler = () => resolve();
        videoElement.addEventListener('seeked', handler, { once: true });
      });

      analyser.getByteFrequencyData(dataArray);

      const highFreqSum = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0);
      const avgHighFreq = highFreqSum / (bufferLength / 2);

      if (avgHighFreq > highFreqThreshold && avgHighFreq > maxAmplitude) {
        maxAmplitude = avgHighFreq;
        contactTime = t;
      }

      onProgress?.(t / duration);
    }

    videoElement.currentTime = originalTime;
    audioCtx.close();

    if (contactTime !== null) {
      return Math.floor(contactTime * fps);
    }
    return null;
  } catch (err) {
    console.error('Audio detection failed:', err);
    return null;
  }
}
