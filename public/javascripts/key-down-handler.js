// 画面サイズを小さくした際に、矢印キーやスペースキー押下によるスクロールを防ぐ
document.addEventListener("keydown", handleKeyDown, { passive: false });
function handleKeyDown(event) {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
    case 'ArrowLeft':
    case 'ArrowRight':
    case ' ':
      event.preventDefault();
      break;
  }
}