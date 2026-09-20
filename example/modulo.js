function modulo(x) {
  const r = x % 3;
  if (r === 0) {
    return 1;
  }
  if (x > 100) {
    return 2;
  }
  return 3;
}
