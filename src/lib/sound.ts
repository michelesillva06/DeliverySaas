/**
 * Gerenciador de Áudio e Notificação Sonora usando Web Audio API
 * Toca um aviso sonoro tipo sino/chime agradável e chamativo sem depender de arquivos externos.
 */

let audioCtx: AudioContext | null = null;
let soundIntervalId: any = null;
let titleIntervalId: any = null;
let originalTitle = document.title;
let isMuted = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Toca uma nota única sintetizada
 */
function playTone(freq: number, startTime: number, duration: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.15, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

let currentSound: 'chime' | 'bell' | 'alert' = 'chime';

export function setCurrentSound(sound: 'chime' | 'bell' | 'alert') {
  currentSound = sound;
}

export function getCurrentSound(): 'chime' | 'bell' | 'alert' {
  return currentSound;
}

export interface SoundOption {
  id: 'chime' | 'bell' | 'alert';
  nome: string;
  descricao: string;
  tag: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'chime',
    nome: 'Sino Melódico',
    descricao: 'Sequência ascendente harmônica de 3 notas suaves e nítidas',
    tag: 'Padrão Recomendado',
  },
  {
    id: 'bell',
    nome: 'Campainha de Balcão',
    descricao: 'Dois toques elegantes e tradicionais de sino de atendimento',
    tag: 'Clássico',
  },
  {
    id: 'alert',
    nome: 'Alerta Rápido & Urgente',
    descricao: 'Pulsos sonoros dinâmicos de alta atenção para cozinhas movimentadas',
    tag: 'Mais Chamativo',
  },
];

/**
 * Toca a prévia do som especificado, independente do estado de mudo (para teste pelo usuário)
 */
export function playSoundPreview(sound: 'chime' | 'bell' | 'alert') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (sound === 'chime') {
      playTone(659.25, now, 0.32, ctx);
      playTone(783.99, now + 0.16, 0.32, ctx);
      playTone(1046.5, now + 0.32, 0.55, ctx);
    } else if (sound === 'bell') {
      playTone(880, now, 0.22, ctx);
      playTone(880, now + 0.24, 0.5, ctx);
    } else if (sound === 'alert') {
      playTone(523.25, now, 0.1, ctx);
      playTone(783.99, now + 0.14, 0.1, ctx);
      playTone(523.25, now + 0.28, 0.1, ctx);
      playTone(1046.5, now + 0.42, 0.35, ctx);
    }
  } catch (err) {
    console.warn('Web Audio não pôde iniciar sem interação prévia:', err);
  }
}

/**
 * Executa sequência sonora baseada na opção selecionada
 */
export function playChime() {
  if (isMuted) return;
  playSoundPreview(currentSound);
}

export const playNewOrderAlert = playChime;

/**
 * Inicia o alarme sonoro em loop
 */
export function startOrderAlarmLoop() {
  if (soundIntervalId) return;
  playChime();
  soundIntervalId = setInterval(() => {
    playChime();
  }, 3500);
}

/**
 * Para o alarme sonoro
 */
export function stopOrderAlarmLoop() {
  if (soundIntervalId) {
    clearInterval(soundIntervalId);
    soundIntervalId = null;
  }
}

/**
 * Inicia a oscilação do título da aba do navegador
 */
export function startTitleBlink(message = '🔔 Novo Pedido!') {
  if (titleIntervalId) return;
  originalTitle = document.title;
  let toggle = false;
  titleIntervalId = setInterval(() => {
    document.title = toggle ? message : `⭐ ${originalTitle}`;
    toggle = !toggle;
  }, 1000);
}

/**
 * Restaura o título da aba
 */
export function stopTitleBlink() {
  if (titleIntervalId) {
    clearInterval(titleIntervalId);
    titleIntervalId = null;
    document.title = originalTitle;
  }
}

/**
 * Alterna modo mudo
 */
export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (isMuted) {
    stopOrderAlarmLoop();
  }
  return isMuted;
}

export function getIsMuted(): boolean {
  return isMuted;
}
