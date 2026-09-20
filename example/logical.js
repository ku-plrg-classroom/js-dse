function logical(x, y) {
  if (x > 0 && y > 0) {
    return 1;
  } else if (x < 0 || y < 0) {
    return 2;
  }
  return 3;
}
