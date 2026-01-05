// PDF.js (ESM build)
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.mjs";

// IMPORTANT: set workerSrc (recommended by PDF.js docs/maintainers)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.mjs";

const PDF_URL = "/catalog/RARE Food Catalogue.pdf";  // <-- your catalog path

const bookEl = document.getElementById("book");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");

function getTargetPageWidthPx() {
  // In landscape mode, StPageFlip shows 2 pages. Give each page roughly half the container.
  const shellWidth = bookEl.clientWidth || 900;
  const isNarrow = shellWidth < 700;
  return isNarrow ? Math.min(shellWidth - 40, 520) : Math.min((shellWidth - 40) / 2, 520);
}

async function renderPdfPageToCanvas(pdf, pageNumber, targetWidthPx) {
  const page = await pdf.getPage(pageNumber);

  // Start with scale 1 to measure original size
  const viewport1 = page.getViewport({ scale: 1 });

  // Scale so the page matches our target width
  const scale = targetWidthPx / viewport1.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return { canvas, width: canvas.width, height: canvas.height };
}

async function buildFlipbook() {
  bookEl.innerHTML = ""; // reset

  const loadingTask = pdfjsLib.getDocument(PDF_URL);
  const pdf = await loadingTask.promise;

  const targetWidth = getTargetPageWidthPx();

  // Render first page to determine base page size for StPageFlip
  const first = await renderPdfPageToCanvas(pdf, 1, targetWidth);
  const baseWidth = first.width;
  const baseHeight = first.height;

  // Create page DOMs (canvas inside each .page)
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pageDiv = document.createElement("div");
    pageDiv.className = "page";

    // Make cover/back cover “hard” (nice effect)
    if (i === 1 || i === pdf.numPages) pageDiv.dataset.density = "hard";

    // Render canvas for this page
    const { canvas } = (i === 1)
      ? first
      : await renderPdfPageToCanvas(pdf, i, targetWidth);

    pageDiv.appendChild(canvas);
    bookEl.appendChild(pageDiv);
    pages.push(pageDiv);
  }

  // Init StPageFlip
  // Using the browser bundle: new St.PageFlip(...)
  const pageFlip = new St.PageFlip(bookEl, {
    width: baseWidth,
    height: baseHeight,
    size: "stretch",
    minWidth: 320,
    maxWidth: 900,
    minHeight: 420,
    maxHeight: 1200,
    showCover: true,
    mobileScrollSupport: true
  });

  pageFlip.loadFromHTML(pages);

  function updateInfo() {
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = pageFlip.getPageCount();
    pageInfo.textContent = `Page ${current} / ${total}`;
  }

  pageFlip.on("flip", updateInfo);
  updateInfo();

  prevBtn.onclick = () => pageFlip.flipPrev();
  nextBtn.onclick = () => pageFlip.flipNext();

  // Rebuild on resize (keeps it sharp & correctly scaled)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => buildFlipbook().catch(console.error), 250);
  });
}

buildFlipbook().catch((err) => {
  console.error(err);
  bookEl.innerHTML = `<div style="color:#fff;padding:16px;">
    Failed to load catalog. Make sure the PDF exists at <b>${PDF_URL}</b>.
  </div>`;
});

