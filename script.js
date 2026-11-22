// Keyboard controls
document.addEventListener("keydown", event => {
  if (event.key === "Escape" &&
      overlay.classList.contains("is-visible")) {
    closeSection();
    return;
  }

  if (!overlay.classList.contains("is-visible")) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();

    activeIndex = Math.min(
      activeIndex + 1,
      activeEntries.length - 1
    );

    renderActive();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    activeIndex = Math.max(
      activeIndex - 1,
      0
    );

    renderActive();
  }
});
