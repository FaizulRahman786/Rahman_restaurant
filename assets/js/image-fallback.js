(() => {
  const fallbackPath = 'assets/images/misc/image-fallback.svg';
  const resolvedFallback = new URL(fallbackPath, window.location.href).href;

  function applyFallback(img) {
    if (!img || img.dataset.fallbackBound === '1') {
      return;
    }

    img.dataset.fallbackBound = '1';

    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === '1') {
        return;
      }

      const currentSrc = img.currentSrc || img.src || '';
      if (currentSrc === resolvedFallback || currentSrc.endsWith('/' + fallbackPath)) {
        return;
      }

      img.dataset.fallbackApplied = '1';
      img.src = fallbackPath;
      if (!img.alt) {
        img.alt = 'Image unavailable';
      }
      img.classList.add('img-fallback-applied');
    });

    if (img.complete && img.naturalWidth === 0) {
      img.dispatchEvent(new Event('error'));
    }
  }

  function bindAllImages() {
    document.querySelectorAll('img').forEach(applyFallback);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        if (node.tagName === 'IMG') {
          applyFallback(node);
        }

        node.querySelectorAll?.('img').forEach(applyFallback);
      });
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAllImages, { once: true });
  } else {
    bindAllImages();
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
