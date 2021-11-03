import * as poseDetection from '@tensorflow-models/pose-detection';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import * as Tone from 'tone';
import { play, soundList } from './sound';
import { Point2D, Point3D, Size } from './util';

let canvas: HTMLCanvasElement;
let context: CanvasRenderingContext2D;
let video: HTMLVideoElement;
let detector, handposeModel;
const cameraSize: Size = { width: 1280, height: 720 };
let ratio, padding;

window.onload = async () => {
  // video
  const constraints = {
    audio: false,
    video: cameraSize
  };
  video = document.createElement('video');
  document.body.appendChild(video);
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints) as any;
    video.srcObject = stream;
    video.width = cameraSize.width;
    video.height = cameraSize.height;
    video.play();
  }
  catch (e) {
    console.log(e);
  }

  // canvas
  canvas = document.getElementsByTagName('canvas')[0];
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  context = canvas.getContext('2d');

  // model
  video.onloadeddata = async() => {
    const model = poseDetection.SupportedModels.BlazePose;
    handposeModel = await handpose.load();
    detector = await poseDetection.createDetector(model, {runtime: 'tfjs'});

    await process();
  }

  ratio = canvas.height / cameraSize.height;
  padding = (canvas.width - cameraSize.width * ratio) / 2;
}

const getScreenPoint = (point: Point2D): Point2D => {
  return {
    x: point.x * ratio + padding,
    y: point.y * ratio
  };
}

const process = async () => {
  const poses = await detector.estimatePoses(video);
  const ms = 10;
  if (poses.length > 0 && 'keypoints' in poses[0]) {
    const keypoints = poses[0].keypoints;
    const keypoints3D = poses[0].keypoints3D;
    const leftHandPos: Point3D = {
      x: keypoints[19].x,
      y: keypoints[19].y,
      z:keypoints[19].z
    };
    const rightHandPos: Point3D = {
      x: keypoints[20].x,
      y: keypoints[20].y,
      z:keypoints[20].z
    };

    // handpose
    const predictHandLandmarks = async (isLeft: boolean): Promise<Point2D[] | null> => {
      const partCanvas = document.createElement('canvas');
      const partContext = partCanvas.getContext('2d');
      partCanvas.width = cameraSize.width / 2;
      partCanvas.height = cameraSize.height;
      partContext.drawImage(
        video,
        isLeft ? -cameraSize.width / 2 : 0,
        0
      );
      const predictions = await handposeModel.estimateHands(partCanvas);
      if (predictions && predictions.length > 0) {
        return predictions[0].landmarks.map((value) => {
          return {
            x: cameraSize.width - value[0] - (isLeft ? cameraSize.width / 2 : 0),
            y: value[1]
          };
        });
      }
      return null;
    }

    const leftHandLandmarks = await predictHandLandmarks(true);
    const rightHandLandmarks = await predictHandLandmarks(false);
    if (leftHandLandmarks) {
      play(leftHandPos, leftHandLandmarks, cameraSize);
    }
    if (rightHandLandmarks) {
      play(rightHandPos, rightHandLandmarks, cameraSize);
    }
    draw(keypoints, keypoints3D, leftHandLandmarks, rightHandLandmarks);
  }
  setTimeout(process, ms);
};

const draw = async (
  keypoints,
  keypoints3D,
  leftHandLandmarks: Point2D[],
  rightHandLandmarks: Point2D[]
) => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(0,0,0,0.8)';
  context.fillRect(padding, 0, canvas.width - padding * 2, canvas.height);
  
  // border
  const separateNo = 7;
  for (let i = 0; i < separateNo + 1; i++) {
    context.fillStyle = '#ff0';
    const x = (canvas.width - padding * 2) * ratio / separateNo * i + padding;
    context.fillRect(x, 0, 1, canvas.height);
  }

  // keypoints
  keypoints.forEach((pose, i: number) => {
    const x = pose.x * ratio + padding;
    const flipedx = canvas.width - x;
    const y = pose.y * ratio;
    const size = 5;//keypoints3D[i].z * -10 + 5;
    context.fillStyle = i == 19 || i == 20 ? '#cc0' : '#ffffff';
    context.fillRect(flipedx, y, size, size);
    //context.fillText(pose.name, flipedx, y);
  });

  const drawHandLandmarks = (isLeft: boolean) => {
    const landmarks = isLeft ? leftHandLandmarks : rightHandLandmarks;
    if (!landmarks) {
      return;
    }

    // line
    const lines = [[1, 4], [5,8], [9, 12], [13, 16], [17, 20]];
    context.strokeStyle = '#ff0';
    context.lineWidth = 1;
    for (const line of lines) {
      context.beginPath();
      for (let i = line[0]; i <= line[1]; i++) {
        const pos = getScreenPoint(landmarks[i]);
        if (i == line[0]) {
          context.moveTo(pos.x, pos.y);
        } else {
          context.lineTo(pos.x, pos.y);
        }
      }
      context.stroke();
    }

    // point
    landmarks.forEach((landmark, i: number) => {
      const pos = getScreenPoint(landmark);
      const size = 5;
      context.fillStyle = i == 9 || i == 12 ? '#ff0' : 'rgba(255,255,255,0.2)';
      context.fillRect(pos.x, pos.y, size, size);
    });
  }
  
  drawHandLandmarks(true);
  drawHandLandmarks(false);

  for (const sound of Object.values(soundList)) {
    const soundPos = getScreenPoint(sound.pos);
    if (sound.fft != null) {
      const fftMin = Math.min(...sound.fft);
      const fftMax = Math.max(...sound.fft);
      const normalizedFft = sound.fft.map((value) => (value - fftMin) / (fftMax - fftMin));
      
      normalizedFft.forEach((value, index) => {
        const radius = sound.times * 4;
        const rad = index / sound.fft.length * 2 * Math.PI;
        const startX = soundPos.x + Math.cos(rad) * radius;
        const startY = soundPos.y + Math.sin(rad) * radius;
        const endX = soundPos.x + Math.cos(rad) * (radius + 20 * value);
        const endY = soundPos.y + Math.sin(rad) * (radius + 20 * value);

        context.strokeStyle = `hsl(${index / sound.fft.length * 360}, 100%, 50%)`;
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
      });
    }
  }
};

const gaussianBlur = () => {
};

let i = 0;