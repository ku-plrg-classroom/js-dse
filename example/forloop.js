function forloop(x) {
  let count = 0;
  for (let i = 0; i < 3; i++) {
    if (x > i * 10) {
      count += 1;
    }
  }
  return count;
}
