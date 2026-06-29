/**
 * TinyML Drowsiness Classifier — 3-layer MLP (7 → 16 → 8 → 4), weights embedded (edge-deployable).
 * Classes: [ALERT, MILD, MODERATE, SEVERE]. Ported from DriveSafer-AI.
 *
 * HONEST NOTE (read before quoting accuracy in the pitch):
 *   - The weights were trained on SYNTHETIC data generated from physiological distributions,
 *     not a labelled real-driver dataset.
 *   - The live forward pass below applies a hand-crafted "physiological correction" ensemble
 *     (see predictDrowsiness) that materially shapes the output. So treat this as a TinyML-style
 *     second opinion, NOT a validated 97.8% neural net. The defensible primary signal is the
 *     7-factor fusion in drowsinessModel.ts.
 */

export interface MLPrediction {
  class: 'ALERT' | 'MILD' | 'MODERATE' | 'SEVERE';
  probabilities: number[];
  confidence: number;
  inferenceTimeMs: number;
}

const W1: number[][] = [
  [-0.4663, 1.0696, 0.3385, 0.4663, -0.214, -0.171, -0.5105, 0.6064, 0.4538, 0.5325, -0.0, 0.3167, 0.0813, 0.0, -0.24, -0.2092],
  [-0.2408, -0.4288, 0.0619, -0.192, 0.5868, -0.0712, -0.8633, -1.0206, 0.0807, -0.4314, -0.0, 0.3466, 0.018, -0.0, 0.5495, -0.1186],
  [0.7312, 1.9221, 2.8168, -1.4279, 1.7827, -0.0002, -0.0625, 2.018, -2.5201, -1.6296, 0.0, 2.6932, -0.0257, 0.0, 1.3895, 2.8827],
  [-0.0271, 0.0435, 0.6317, 0.3597, 0.8481, 0.1793, -0.003, 0.8918, -0.2553, -0.3261, -0.0, 0.3157, -0.0381, 0.0, 0.7082, 0.3553],
  [-0.324, 0.048, 0.0743, 0.5226, -0.0892, 0.2588, 0.1871, -0.4429, -0.3326, 0.371, -0.0, 0.1449, 0.0685, 0.0, 0.087, -0.3214],
  [0.5516, -0.0094, -0.1126, -0.4621, 0.1243, -0.0411, 0.0078, -0.1571, 0.3688, -0.5103, -0.0, 0.4794, 0.1043, -0.0, 0.614, 0.1278],
  [-0.1215, 0.4152, -0.6268, 0.13, -0.8371, 0.0717, -0.0134, 0.2925, 0.8535, 0.2419, -0.0, -0.2579, -0.077, 0.0, -0.4682, -0.7586],
];
const B1 = [0.3527, 1.241, -0.0237, 0.9337, 0.2716, -0.351, 0.6925, 0.915, 0.8935, 1.1212, -0.1859, -0.3538, -0.2929, -0.0745, 0.2337, 0.6894];

const W2: number[][] = [
  [-0.2487, 0.8885, -0.2396, 0.9623, 0.0542, -0.3343, 0.0142, -0.2031],
  [0.4405, 0.9122, -0.1791, 1.1805, 0.9164, -0.0383, -0.0, -0.0845],
  [-0.8413, 1.3431, 0.0573, 2.5407, -1.357, 1.177, 0.0, -2.1568],
  [0.7928, -0.4301, 0.1932, -0.1919, 1.1867, -0.3215, -0.0, 1.003],
  [-0.606, 0.9673, 0.0285, 0.9784, -0.9182, 1.5371, -0.0, -1.5367],
  [-0.0, 0.0, 0.0, -0.0, 0.0001, -0.0, -0.0, -0.0001],
  [0.9861, 0.4267, -0.1915, 0.8565, 0.2978, -1.6313, 0.0104, 0.6864],
  [0.1436, 1.0183, 0.285, 0.9782, 0.4193, -0.0737, -0.0042, 0.3939],
  [1.4526, -0.8473, -0.1826, -1.1236, 1.3679, -0.4014, 0.0036, 1.4251],
  [1.487, -0.9097, -0.9107, 0.1111, 1.1743, -1.3338, -0.0, 0.9762],
  [0.0, 0.0, -0.0, 0.0, -0.0, -0.0, 0.0, -0.0],
  [-1.1169, 1.7507, 0.3652, 1.9518, -0.7866, 1.4418, -0.0, -1.6353],
  [0.0, -0.0, 0.0, 0.0, 0.0, -0.0, -0.0, 0.0],
  [0.0, -0.0, -0.0, -0.0, 0.0, 0.0, -0.0, 0.0],
  [0.0729, 0.9369, 0.472, 0.4963, -0.7858, 1.371, -0.0037, 0.0545],
  [0.2082, 2.0957, -0.3088, 1.9477, -0.1265, 0.8318, -0.0, -1.189],
];
const B2 = [1.1075, 0.4857, -0.1663, 0.0612, 0.7716, 0.2184, -0.3653, 0.2745];

const W3: number[][] = [
  [0.9075, 0.7937, 0.6478, -1.0566],
  [-1.6562, 0.4674, 0.867, 0.8743],
  [0.4735, 0.5615, -1.0253, 0.6699],
  [-1.1933, 1.0744, 0.6858, 0.7674],
  [1.0823, 0.2619, -0.0763, -1.9006],
  [-0.3233, -2.6704, 0.3498, 1.1309],
  [-0.0, -0.0, -0.0, -0.0],
  [1.6995, -0.4432, -2.8168, -0.0858],
];
const B3 = [0.0607, -0.0037, 0.4224, -0.9078];

const relu = (x: number) => Math.max(0, x);
function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function matmul(input: number[], weights: number[][], bias: number[]): number[] {
  const out = new Array(bias.length).fill(0);
  for (let j = 0; j < bias.length; j++) {
    let s = bias[j];
    for (let i = 0; i < input.length; i++) s += input[i] * weights[i][j];
    out[j] = s;
  }
  return out;
}
function normalizeFeatures(features: number[]): number[] {
  const ranges = [[0, 0.5], [0, 1.0], [0, 1.0], [-45, 45], [0, 40], [50, 500], [0, 1.0]];
  return features.map((f, i) => {
    const [min, max] = ranges[i];
    return Math.max(0, Math.min(1, (f - min) / (max - min)));
  });
}

export function predictDrowsiness(
  ear: number,
  mar: number,
  perclos: number,
  headPitch: number,
  blinkRate: number,
  blinkDuration: number,
  gazeStability: number
): MLPrediction {
  const start = performance.now();
  const normalized = normalizeFeatures([ear, mar, perclos, headPitch, blinkRate, blinkDuration, gazeStability]);

  const h1 = matmul(normalized, W1, B1).map(relu);
  const h2 = matmul(h1, W2, B2).map(relu);
  const mlpLogits = matmul(h2, W3, B3);

  // Physiological correction ensemble (see honest note at top of file).
  const invertedEar = 1 - normalized[0];
  const perclosNorm = normalized[2];
  const pitchNorm = Math.abs(normalized[3]);
  const blinkDurationNorm = normalized[5];
  const invertedGaze = 1 - normalized[6];
  const physiologicalRisk =
    0.3 * perclosNorm + 0.2 * invertedEar + 0.15 * blinkDurationNorm + 0.12 * pitchNorm +
    0.1 * normalized[1] + 0.07 * invertedGaze + 0.06 * Math.abs(normalized[4] - 0.375);

  const corrected = [
    mlpLogits[0] + (1 - physiologicalRisk) * 1.5,
    mlpLogits[1] + (physiologicalRisk > 0.25 ? physiologicalRisk * 1.2 : -0.5),
    mlpLogits[2] + (physiologicalRisk > 0.45 ? physiologicalRisk * 2.0 : -1.0),
    mlpLogits[3] + (physiologicalRisk > 0.65 ? physiologicalRisk * 3.0 : -2.0),
  ];

  const probabilities = softmax(corrected);
  const classIdx = probabilities.indexOf(Math.max(...probabilities));
  const classes: MLPrediction['class'][] = ['ALERT', 'MILD', 'MODERATE', 'SEVERE'];
  return {
    class: classes[classIdx],
    probabilities,
    confidence: probabilities[classIdx],
    inferenceTimeMs: performance.now() - start,
  };
}
