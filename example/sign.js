function sign(x) {
  const s = x > 0 ? 1 : x < 0 ? -1 : 0;
  if (s * x < 0) {
    return -1;
  }
  return s;
}
