import numpy as np
import matplotlib.pyplot as plt

width = 512
height = 512

image = np.zeros((height, width))

for x in range(width):
    for y in range(height):
        if np.sin(x * 0.2) > 0:
            image[y, x] = 1.0  # white
        else:
            image[y, x] = 0.0  # black

plt.figure(figsize=(6, 6))
plt.imshow(image, cmap='gray')
plt.title("Procedural Stripe Texture (Loop)")
plt.axis('off')
plt.show()