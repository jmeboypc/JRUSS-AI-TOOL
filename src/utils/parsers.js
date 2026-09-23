import JSZip from 'jszip';

// Load PDF.js dynamically from CDN to avoid worker/bundler issues in Vite
async function loadPdfJS() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = (e) => reject(new Error("Failed to load PDF parser from CDN: " + e.message));
    document.head.appendChild(script);
  });
}

/**
 * Extracts text from a DOCX file using JSZip and native DOMParser
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const documentXmlPath = "word/document.xml";
  if (!zip.file(documentXmlPath)) {
    throw new Error("Invalid DOCX file structure (missing word/document.xml)");
  }
  
  const docXml = await zip.file(documentXmlPath).async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "text/xml");
  
  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  let textParts = [];
  
  for (let i = 0; i < paragraphs.length; i++) {
    const tTags = paragraphs[i].getElementsByTagName("w:t");
    let pText = "";
    for (let j = 0; j < tTags.length; j++) {
      pText += tTags[j].textContent;
    }
    if (pText.trim()) {
      textParts.push(pText);
    }
  }
  
  return textParts.join("\n");
}

/**
 * Extracts text from a PPTX file slide-by-slide
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function parsePptx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Find all slide files
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );
  
  if (slideFiles.length === 0) {
    throw new Error("No slides found in the PPTX file");
  }
  
  // Sort slides numerically (slide1.xml, slide2.xml, slide10.xml...)
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
    const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
    return numA - numB;
  });
  
  let slideTextParts = [];
  const parser = new DOMParser();
  
  for (const slideFile of slideFiles) {
    const slideXml = await zip.file(slideFile).async("text");
    const xmlDoc = parser.parseFromString(slideXml, "text/xml");
    
    // Extract paragraphs inside the slide
    const paragraphs = xmlDoc.getElementsByTagName("a:p");
    let slideLines = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      const tTags = paragraphs[i].getElementsByTagName("a:t");
      let pText = "";
      for (let j = 0; j < tTags.length; j++) {
        pText += tTags[j].textContent;
      }
      if (pText.trim()) {
        slideLines.push(pText);
      }
    }
    
    const slideNum = slideFile.replace(/[^0-9]/g, "");
    slideTextParts.push(`--- Slide ${slideNum} ---\n` + slideLines.join("\n"));
  }
  
  return slideTextParts.join("\n\n");
}

/**
 * Extracts text from a PDF file page-by-page
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function parsePdf(file) {
  const pdfjsLib = await loadPdfJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let pageTextParts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    
    if (pageText.trim()) {
      pageTextParts.push(`--- Page ${i} ---\n` + pageText);
    }
  }
  
  return pageTextParts.join("\n\n");
}

/**
 * Main parser entrypoint that routes files by extension
 * @param {File} file 
 * @returns {Promise<string>}
 */
export async function parseDocument(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'docx':
      return await parseDocx(file);
    case 'pptx':
      return await parsePptx(file);
    case 'pdf':
      return await parsePdf(file);
    case 'txt':
    case 'md':
      return await file.text();
    default:
      throw new Error(`Unsupported file format: .${ext}. Please upload .docx, .pptx, .pdf, .txt, or .md files.`);
  }
}
