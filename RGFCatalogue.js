// PDF.js (ESM build)
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.mjs";

// IMPORTANT: spaces in URLs should be encoded to avoid 404s on many servers
const PDF_URL = "RARE Food Catalogue.pdf";

const bookEl = document.getElementById("book");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

let currentPageFlip = null;
let cachedPdf = null;

function isMobileLayout() {
  return window.matchMedia("(max-width: 700px)").matches;
}

/** Pick a target render width for each PDF page (CSS pixels) */
function getTargetPageWidthPx() {
  const shellWidth = bookEl.clientWidth || 900;
  const padding = 30;

  if (isMobileLayout()) {
    // single page view on mobile
    return Math.min(shellWidth - padding, 560);
  }

  // two-page spread on wider screens: each page ~ half the container
  return Math.min((shellWidth - padding) / 2, 560);
}

/** Render a PDF page into a crisp canvas (retina support) */
async function renderPdfPageToCanvas(pdf, pageNumber, targetWidthPx) {
  const page = await pdf.getPage(pageNumber);

  const viewportAt1 = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / viewportAt1.width;
  const viewport = page.getViewport({ scale });

  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  // Actual pixel buffer for sharpness
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);

  // CSS size
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  // Scale drawing ops to DPR
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    canvas,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}

function destroyFlipbook() {
  if (currentPageFlip) {
    try { currentPageFlip.destroy(); } catch (_) {}
    currentPageFlip = null;
  }
  bookEl.innerHTML = "";
}

async function buildFlipbook() {
  destroyFlipbook();

  // Load PDF once (reuse on rebuild)
  if (!cachedPdf) {
    const loadingTask = pdfjsLib.getDocument(PDF_URL);
    cachedPdf = await loadingTask.promise;
  }
  const pdf = cachedPdf;

  const targetWidth = getTargetPageWidthPx();

  // Render first page to define base size for PageFlip
  const first = await renderPdfPageToCanvas(pdf, 1, targetWidth);
  const baseWidth = first.width;
  const baseHeight = first.height;

  // Create page DOMs (canvas inside each .page)
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pageDiv = document.createElement("div");
    pageDiv.className = "page";

    // Make cover/back cover “hard”
    if (i === 1 || i === pdf.numPages) pageDiv.dataset.density = "hard";

    const { canvas } = (i === 1)
      ? first
      : await renderPdfPageToCanvas(pdf, i, targetWidth);

    pageDiv.appendChild(canvas);
    bookEl.appendChild(pageDiv);
    pages.push(pageDiv);
  }

  const pageFlip = new St.PageFlip(bookEl, {
    width: baseWidth,
    height: baseHeight,
    size: "stretch",
    minWidth: 320,
    maxWidth: 1400,
    minHeight: 420,
    maxHeight: 1400,
    showCover: true,

    // Key for responsiveness: single-page on mobile
    usePortrait: isMobileLayout(),

    mobileScrollSupport: true,
  });

  pageFlip.loadFromHTML(pages);
  currentPageFlip = pageFlip;

  function updateInfo() {
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = pageFlip.getPageCount();
    pageInfo.textContent = `Page ${current} / ${total}`;
  }

  pageFlip.on("flip", updateInfo);
  updateInfo();

  prevBtn.onclick = () => pageFlip.flipPrev();
  nextBtn.onclick = () => pageFlip.flipNext();
}

// Debounced rebuild on resize/orientation change
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => buildFlipbook().catch(console.error), 250);
});

buildFlipbook().catch((err) => {
  console.error(err);
  bookEl.innerHTML = `<div style="color:#fff;padding:16px;">
    Failed to load catalog. Make sure the PDF exists at <b>${PDF_URL}</b>.
  </div>`;
});
