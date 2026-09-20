function hashed(x, y) {
  const z = hash(x);
  if (x > 5) {
    if (z === y) {
      return 1;
    }
    return 2;
  }
  return 3;
}
