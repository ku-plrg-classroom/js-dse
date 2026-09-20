function skip(x) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    if (i === x) continue;
    sum += i;
  }
  return sum;
}
