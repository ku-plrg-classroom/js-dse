function nestedloop(x, y) {
  let hits = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      if (x === i && y === j) {
        hits++;
      }
    }
  }
  return hits;
}
