"""Reproduce the six PB primitive-minimal rotation classes in Z/30, exactly.

No floating point: binary subset polynomials vanish at exp(2*pi*i/30)
iff divisible by Phi_30. Meet-in-the-middle enumerates 2**15 + 2**15
remainder vectors. Nonminimal unions are then removed. No third-party deps.
"""
from collections import defaultdict
import json

polynomial = [1, 1, 0, -1, -1, -1, 0, 1]  # Phi_30 without leading x**8
vectors = [(1, 0, 0, 0, 0, 0, 0, 0)]
for _ in range(29):
    old = vectors[-1]
    shifted = [0, *old[:-1]]
    vectors.append(tuple(shifted[j] - old[-1] * polynomial[j] for j in range(8)))


def subset_sums(offset):
    sums = [(0,) * 8]
    for i in range(15):
        sums += [tuple(a + b for a, b in zip(s, vectors[offset + i])) for s in sums]
    return sums


right = defaultdict(list)
for mask, vector in enumerate(subset_sums(15)):
    right[tuple(-x for x in vector)].append(mask << 15)
regular = [sum(1 << (offset + j * (30 // k)) for j in range(k))
           for k in [2, 3, 5] for offset in range(30 // k)]
candidates = []
for left, vector in enumerate(subset_sums(0)):
    for other in right.get(vector, []):
        mask = left | other
        if mask and all(mask & r != r for r in regular):
            candidates.append(mask)
minimal = []
for mask in sorted(candidates, key=int.bit_count):
    if all(mask & m != m for m in minimal):
        minimal.append(mask)


def rotate(mask, k):
    return ((mask << k) | (mask >> (30 - k))) & ((1 << 30) - 1)


classes = {min(rotate(mask, k) for k in range(30)) for mask in minimal}
assert len(classes) == 6 and len(minimal) == 180
result = []
for mask in sorted(classes, key=lambda m: (m.bit_count(), m)):
    values = [i for i in range(30) if mask >> i & 1]
    result.append([v - values[0] for v in values])
print(json.dumps(result))
