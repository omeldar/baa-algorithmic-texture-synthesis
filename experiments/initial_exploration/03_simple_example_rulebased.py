import numpy as np
import matplotlib.pyplot as plt

width = 512
height = 512

x = np.arange(width)
y = np.arange(height)

X, Y = np.meshgrid(x, y)

image = np.ones((height, width, 3))  # start white

# Rule 1: x % 2 == 0 → black
mask_black = (X % 2 == 0)
image[mask_black] = [0, 0, 0]

# Rule 2: y % 3 == 0 → red (only where not already black)
mask_red = (Y % 3 == 0) & (~mask_black)
image[mask_red] = [1, 0, 0]

plt.figure(figsize=(6, 6))
plt.imshow(image)
plt.title("Rule-Based Texture (Vectorized)")
plt.axis('off')
plt.show()