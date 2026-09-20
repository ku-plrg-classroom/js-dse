function simple(x, y) {
  let z = 2 * x;
  if (z === y) {
    z = y - x;
    if (x < z) {
      return 1;
    } else {
      return 2;
    }
  } else {
    return 3;
  }
}
