// ============================================================
// Audio Effects Utility (Synthesized Sounds using Web Audio API)
// ============================================================

const getAudioContext = () => {
  // รองรับ Safari และเบราว์เซอร์อื่นๆ
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return new AudioContext();
};

export const playSuccessSound = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // โน้ต A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // ขยับขึ้นไป A6 แบบเร็วๆ (เสียงติ๊ง)

    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); // เฟดเสียงออกนุ่มๆ

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};

export const playSirenSound = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'square';
    // สร้างเสียงไซเรนฉุกเฉิน (หมุนความถี่ขึ้นลง)
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.4);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.8);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 1.2);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 1.6);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 2.0);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 2.4);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 2.4); // เฟดเสียงออกตอนจบ

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 2.5);
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};
