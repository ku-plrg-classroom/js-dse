function assign(x, y) {
  let a = x;
  a += y;
  a *= 2;
  let b = a - x;
  if (b > 10) {
    b -= 10;
  }
  return b > 0 ? b : -b;
}
