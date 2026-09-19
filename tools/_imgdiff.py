"""how different are two shots, as a percentage of pixels and as a mean."""
import sys
from PIL import Image
import numpy as np
a = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.int16)
b = np.asarray(Image.open(sys.argv[2]).convert('RGB'), dtype=np.int16)
if a.shape != b.shape:
    print('different shapes', a.shape, b.shape); sys.exit(1)
d = np.abs(a - b).max(axis=2)
moved = (d > 8).mean() * 100
print('%s vs %s: %.3f%% of pixels differ by more than 8, mean difference %.2f, worst %d'
      % (sys.argv[1].split('/')[-1], sys.argv[2].split('/')[-1], moved, d.mean(), d.max()))
