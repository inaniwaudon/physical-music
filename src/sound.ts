import * as Tone from 'tone';
import piano_B4 from './piano_B4.wav';
import { Point2D, Point3D, Size } from './util';

interface Sound {
  pos: Point2D;
  times: number;
  fft: number[];
  region: number;
  height: number;
}
export const soundList: { [key in string]: Sound } = {};
let latestSoundKey: string = null;

const existsFlat: boolean[] = [
  true,
  true,
  false,
  true,
  true,
  true,
  false
];
const sumFlats = (previousValue, currentValue) => previousValue + (currentValue ? 1 : 0);

const audioContext = new AudioContext();

// load
const loadSource = (url: string) => {
  return new Promise<AudioBuffer>(async (resolve) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    audioContext.decodeAudioData(arrayBuffer, (buffer) => { resolve(buffer) });
  });
}

const getFrequency = (name: string) => {
  const A4 = 440;
  const noExceptFlat = name.charCodeAt(0) - "A".charCodeAt(0)
    + (name.charCodeAt(1) - "4".charCodeAt(0)) * 7
    + (["C", "D", "E", "F", "G"].includes(name.charAt(0)) ? -7 : 0);

  // flat
  let flatsNo = name.length > 2 && name.charAt(2) == "#" ? 1 : 0;
  if (noExceptFlat >= 0) {
    flatsNo += existsFlat.reduce(sumFlats, 0) * Math.floor(noExceptFlat / existsFlat.length)
      + existsFlat.slice(0, noExceptFlat % existsFlat.length).reduce(sumFlats, 0) - 1;
  } else {
    flatsNo += existsFlat.reduce(sumFlats, 0) * Math.ceil(noExceptFlat / existsFlat.length)
      - existsFlat.slice(existsFlat.length + noExceptFlat % existsFlat.length - 1, existsFlat.length).reduce(sumFlats, 0);
  }

  const n = noExceptFlat + flatsNo;
  return n;
  //return A4 * Math.pow(2, n / 12);
};

const frequencyList: string[] = [
  "C4",
  "D4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C4",
];

export const play = async (
  handPos: Point3D,
  handLandmarks: Point2D[],
  cameraSize: Size
) => {
  const ringFingerTipPos = handLandmarks[12];
  const ringFingerRootPos = handLandmarks[9];
  const isHandForward = ringFingerRootPos.y - ringFingerTipPos.y < 40;
  if (!isHandForward) {
    return;
  }

  const sound: Sound = {
    pos: {
      x: ringFingerTipPos.x,
      y: ringFingerTipPos.y
    },
    times: 0,
    fft: null,
    region: Math.ceil(ringFingerTipPos.x / cameraSize.width * 7) - 1,
    height: 3 - Math.ceil(ringFingerTipPos.y / cameraSize.height * 3)
  };

  const interval = 10;
  const plaingInterval = 200;
  if (Object.values(soundList).reduce((previous, sound) => sound.times * interval < plaingInterval || previous, false)) {
    return;
  }
  
  // tone
  const synth = new Tone.Synth({
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.3,
      release: 1,
    },
    oscillator: {
      type: 'triangle'
    }
  }).toDestination();
  const fftSize = 128;
  const analyser = new Tone.Analyser("waveform", fftSize).toDestination();
  synth.connect(analyser);
  synth.triggerAttackRelease(frequencyList[sound.region], "4n");

  // fft
  const key = String(Math.random());
  const duration = 500;
  const updateFFT = (i: number) => {
    const fft = analyser.getValue();
    sound.times++;
    sound.fft = Array.from(Array.isArray(fft) ? fft[0] : fft);
    if (i < duration / interval) {
      setTimeout(() => updateFFT(i + 1), interval);
    } else {
      delete soundList[key];
    }
  };
  updateFFT(0);

  soundList[key] = sound;
  latestSoundKey = key;
}