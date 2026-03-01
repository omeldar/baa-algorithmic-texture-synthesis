import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter

# Utility: Histogram Matching
def match_histogram(source, template):
    """
    Adjust pixel values of source image so that its histogram
    matches the template image histogram.
    """
    src = source.ravel()
    tmpl = template.ravel()

    s_values, s_indices, s_counts = np.unique(src, return_inverse=True, return_counts=True)
    t_values, t_counts = np.unique(tmpl, return_counts=True)

    s_quantiles = np.cumsum(s_counts).astype(np.float64)
    s_quantiles /= s_quantiles[-1]

    t_quantiles = np.cumsum(t_counts).astype(np.float64)
    t_quantiles /= t_quantiles[-1]

    interp_t_values = np.interp(s_quantiles, t_quantiles, t_values)

    return interp_t_values[s_indices].reshape(source.shape)


# Optimization-Based Texture Synthesis

def synthesize_texture(target, iterations=50, smooth_sigma=1.0):
    """
    Generate a new texture by matching statistics of target texture.
    """

    # Start from random noise
    generated = np.random.rand(*target.shape)

    for i in range(iterations):

        # 1. Match histogram
        generated = match_histogram(generated, target)

        # 2. Match mean & std
        gen_mean, gen_std = generated.mean(), generated.std()
        tgt_mean, tgt_std = target.mean(), target.std()

        generated = (generated - gen_mean) / (gen_std + 1e-8)
        generated = generated * tgt_std + tgt_mean

        # 3. Smoothness constraint
        generated = gaussian_filter(generated, sigma=smooth_sigma)

    return generated


# Example Target Texture
def create_target_texture(size=128):
    x = np.arange(size)
    y = np.arange(size)
    X, Y = np.meshgrid(x, y)

    texture = np.sin(X * 0.15) * np.cos(Y * 0.1)
    texture = (texture - texture.min()) / (texture.max() - texture.min())

    return texture


# Run Example
target = create_target_texture(128)

generated = synthesize_texture(target, iterations=50, smooth_sigma=1.0)

# Normalize for display
generated = (generated - generated.min()) / (generated.max() - generated.min())

plt.figure(figsize=(10, 4))

plt.subplot(1, 2, 1)
plt.title("Target Texture")
plt.imshow(target, cmap='gray')
plt.axis('off')

plt.subplot(1, 2, 2)
plt.title("Optimization-Based Synthesis (50 iters)")
plt.imshow(generated, cmap='gray')
plt.axis('off')

plt.show()