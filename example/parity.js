function parity(n) {
  if (n < 0) {
    return -1;
  }
  return isEven(n) ? 1 : 0;
}

function isEven(n) {
  if (n === 0) {
    return true;
  }
  return isOdd(n - 1);
}

function isOdd(n) {
  if (n === 0) {
    return false;
  }
  return isEven(n - 1);
}
