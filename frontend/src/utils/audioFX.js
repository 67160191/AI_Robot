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
    
    // เสียง Beep ที่ 1 (สั้นๆ)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.1);

    // เสียง Beep ที่ 2 (สูงขึ้นและยาวกว่านิดหน่อย)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.12); // E6
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};

export const playSendSound = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1); 

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
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
