function update(x) {
  let n = x;
  if (n++ > 5) {
    return n;
  }
  if (++n > 5) {
    return -n;
  }
  n--;
  return --n;
}
