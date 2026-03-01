import numpy as np
import matplotlib.pyplot as plt

width = 512
height = 512

x = np.arange(width)
y = np.arange(height)

X, Y = np.meshgrid(x, y)

image = np.sin(X * 0.1) * np.cos(Y * 0.1)

# Normalize
image = (image - image.min()) / (image.max() - image.min())

plt.figure(figsize=(6, 6))
plt.imshow(image, cmap='gray')
plt.title("Vectorized Procedural Texture")
plt.axis('off')
plt.show()