function bool(flag, x) {
  let ok = flag;
  if (!ok) {
    ok = x > 10;
  }
  if (ok && x !== 42) {
    return 1;
  }
  return 0;
}
