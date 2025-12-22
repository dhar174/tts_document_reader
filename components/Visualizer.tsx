import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvas) return;
      const width = canvas.width;
      const height = canvas.height;

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#38bdf8'); // brand-400
        gradient.addColorStop(1, '#0ea5e9'); // brand-500

        ctx.fillStyle = gradient;
        
        // Rounded top bars
        if (barHeight > 0) {
            ctx.beginPath();
            // Check if roundRect is supported
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(x, height - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
            } else {
                ctx.rect(x, height - barHeight, barWidth, barHeight);
            }
            ctx.fill();
        }

        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    if (isPlaying) {
      draw();
    } else {
      // Clear canvas when stopped
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw a flat line
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, canvas.height - 2, canvas.width, 2);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={100} 
      className="w-full h-24 rounded-lg bg-slate-900/50 border border-slate-800"
    />
  );
};