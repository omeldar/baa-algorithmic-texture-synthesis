import numpy as np
import matplotlib.pyplot as plt

def expand_lsystem(axiom: str, rules: dict[str, str], iterations: int) -> str:
    s = axiom
    for _ in range(iterations):
        s = "".join(rules.get(ch, ch) for ch in s)
    return s

def turtle_to_segments(lsys: str, angle_deg: float = 25.0, step: float = 1.0):
    """
    Interpret an L-system string with a simple turtle:
      F: move forward and draw a line
      +: turn left
      -: turn right
      [: push state (x, y, heading)
      ]: pop state
    Returns: Nx2 arrays for segment start/end points.
    """
    angle = np.deg2rad(angle_deg)

    # Turtle state
    x, y = 0.0, 0.0
    heading = np.pi / 2  # start pointing up
    stack = []

    starts = []
    ends = []

    for ch in lsys:
        if ch == "F":
            nx = x + step * np.cos(heading)
            ny = y + step * np.sin(heading)
            starts.append((x, y))
            ends.append((nx, ny))
            x, y = nx, ny
        elif ch == "+":
            heading += angle
        elif ch == "-":
            heading -= angle
        elif ch == "[":
            stack.append((x, y, heading))
        elif ch == "]":
            x, y, heading = stack.pop()

    return np.array(starts), np.array(ends)

def plot_segments(starts: np.ndarray, ends: np.ndarray, linewidth: float = 1.0):
    fig, ax = plt.subplots(figsize=(6, 6))
    # Efficient-ish plotting: draw each segment
    for (x0, y0), (x1, y1) in zip(starts, ends):
        ax.plot([x0, x1], [y0, y1], color="black", linewidth=linewidth)

    ax.set_aspect("equal", adjustable="box")
    plt.title("Tree-like L-System")
    ax.axis("off")
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    # The rule: F → F[+F]F[-F]F
    rules = {"F": "F[+F]F[-F]F"}
    axiom = "F"

    iterations = 4      # try 3..6 (grows quickly!)
    angle_deg = 25.0    # tweak to change branching shape
    step = 1.0

    lsys = expand_lsystem(axiom, rules, iterations)
    starts, ends = turtle_to_segments(lsys, angle_deg=angle_deg, step=step)
    plot_segments(starts, ends, linewidth=0.8)