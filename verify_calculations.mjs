const readings = [
  [2.7, 2.72, 2.74, 2.65, 2.66, 2.67, 2.8, 2.82, 2.84],
  [3.1, 3.12, 3.14, 3.05, 3.08, 3.06, 3.0, 3.02, 3.04],
  [2.2, 2.22, 2.21, 2.3, 2.31, 2.29, 2.25, 2.26, 2.24],
  [3.6, 3.62, 3.61, 3.55, 3.54, 3.56, 3.58, 3.59, 3.57],
  [2.5, 2.52, 2.51, 2.48, 2.47, 2.49, 2.55, 2.56, 2.54],
  [2.9, 2.92, 2.91, 2.88, 2.87, 2.89, 2.95, 2.96, 2.94],
];

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values) {
  const mean = avg(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function percentile(sortedValues, p) {
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

const rows = readings.map((values, index) => {
  const p1 = avg(values.slice(0, 3));
  const p2 = avg(values.slice(3, 6));
  const p3 = avg(values.slice(6, 9));
  const locationAvg = avg([p1, p2, p3]);
  return {
    id: `TEST-${index + 1}`,
    p1,
    p2,
    p3,
    locationAvg,
    sd: sampleSd(values),
  };
});

const ranked = [...rows].sort((a, b) => a.locationAvg - b.locationAvg);
ranked.forEach((row, index) => {
  row.rank = index + 1;
});

const values = ranked.map((row) => row.locationAvg).sort((a, b) => a - b);
const output = {
  completed: values.length,
  mean: avg(values),
  median: percentile(values, 0.5),
  p25: percentile(values, 0.25),
  p75: percentile(values, 0.75),
  sd: sampleSd(values),
  lowestFive: ranked.slice(0, 5).map((row) => ({
    id: row.id,
    rank: row.rank,
    locationAvg: row.locationAvg,
  })),
};

console.log(JSON.stringify(output, null, 2));
