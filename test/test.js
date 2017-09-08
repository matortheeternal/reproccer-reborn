const assert = require('assert');

function test(a, b, c) {
  assert.equal(a, a);
  assert.equal(b, b);
  assert.equal(c, c);
}

test(1,2,3);
