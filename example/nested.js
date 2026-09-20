function nested(x, y) {
  let r = 0;
  if (x > 0) {
    if (y > 0) {
      r = 1;
    } else {
      r = 2;
    }
  } else {
    if (y > 0) {
      r = 3;
    } else {
      r = 4;
    }
  }
  if (r === 1) {
    return r;
  }
  return -r;
}
