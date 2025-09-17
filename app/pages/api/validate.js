import formidable from 'formidable';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';
import { DOMParser } from 'xmldom';

// Disable body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the uploaded file
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);
    const file = files.document[0];

    if (!file || !file.originalFilename.endsWith('.docx')) {
      return res.status(400).json({ error: 'Please upload a .docx file' });
    }

    // Read and parse the DOCX file
    const fileBuffer = await fs.readFile(file.filepath);
    const validator = new APAValidator();
    const results = await validator.validateDocument(fileBuffer, file.originalFilename);

    // Clean up temp file
    await fs.unlink(file.filepath);

    res.status(200).json(results);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Failed to validate document' });
  }
}

class APAValidator {
  async validateDocument(buffer, filename) {
    try {
      const zip = new AdmZip(buffer);
      const docStructure = this.parseDocxStructure(zip);
      
      const results = {
        filename,
        issues: [],
        passing: [],
        score: 0
      };

      // Run all APA validation checks
      this.validateGeneralFormatting(docStructure, results);
      this.validateTitlePage(docStructure, results);
      this.validateAbstract(docStructure, results);
      this.validateHeadings(docStructure, results);
      this.validateCitations(docStructure, results);
      this.validateReferences(docStructure, results);

      // Calculate final score
      const errors = results.issues.filter(i => i.severity === 'error').length;
      const warnings = results.issues.filter(i => i.severity === 'warning').length;
      const suggestions = results.issues.filter(i => i.severity === 'suggestion').length;
      
      results.score = Math.max(0, 100 - (errors * 15) - (warnings * 8) - (suggestions * 3));

      return results;
    } catch (error) {
      throw new Error(`Document parsing failed: ${error.message}`);
    }
  }

  parseDocxStructure(zip) {
    const parser = new DOMParser();
    
    // Extract key XML files
    const documentXml = zip.readAsText('word/document.xml');
    const stylesXml = zip.readAsText('word/styles.xml') || '';
    const headerXml = zip.readAsText('word/header1.xml') || '';
    const footerXml = zip.readAsText('word/footer1.xml') || '';

    // Parse XML documents
    const documentDoc = parser.parseFromString(documentXml, 'text/xml');
    const stylesDoc = parser.parseFromString(stylesXml, 'text/xml');

    return {
      documentXml,
      stylesXml,
      headerXml,
      footerXml,
      documentDoc,
      stylesDoc,
      text: this.extractText(documentDoc),
      fontInfo: this.extractFontInfo(stylesDoc, documentDoc),
      spacingInfo: this.extractSpacingInfo(stylesDoc, documentDoc),
      headings: this.extractHeadings(documentDoc),
      pageNumbers: this.detectPageNumbers(documentXml, headerXml, footerXml)
    };
  }

  extractText(doc) {
    const textElements = doc.getElementsByTagName('w:t');
    let text = '';
    for (let i = 0; i < textElements.length; i++) {
      text += textElements[i].textContent || '';
    }
    return text;
  }

  extractFontInfo(stylesDoc, documentDoc) {
    // Check default font in styles
    const defaultFont = stylesDoc.getElementsByTagName('w:rFonts')[0];
    const defaultSize = stylesDoc.getElementsByTagName('w:sz')[0];
    
    // Also check document-level fonts
    const docFonts = documentDoc.getElementsByTagName('w:rFonts');
    const docSizes = documentDoc.getElementsByTagName('w:sz');
    
    let font = 'Times New Roman'; // Default assumption
    let size = 12; // Default assumption
    
    if (defaultFont) {
      font = defaultFont.getAttribute('w:ascii') || font;
    }
    
    if (defaultSize) {
      size = parseInt(defaultSize.getAttribute('w:val')) / 2; // Word uses half-points
    }
    
    return { font, size };
  }

  extractSpacingInfo(stylesDoc, documentDoc) {
    // Check for line spacing in styles and document
    const spacingElements = [
      ...Array.from(stylesDoc.getElementsByTagName('w:spacing')),
      ...Array.from(documentDoc.getElementsByTagName('w:spacing'))
    ];
    
    let isDoubleSpaced = false;
    
    for (const spacing of spacingElements) {
      const lineRule = spacing.getAttribute('w:lineRule');
      const line = spacing.getAttribute('w:line');
      
      // Double spacing is typically line="480" with lineRule="auto"
      if (line === '480' || lineRule === 'auto') {
        isDoubleSpaced = true;
        break;
      }
    }
    
    return { isDoubleSpaced };
  }

  extractHeadings(doc) {
    const paragraphs = doc.getElementsByTagName('w:p');
    const headings = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const style = p.getElementsByTagName('w:pStyle')[0];
      
      if (style) {
        const styleName = style.getAttribute('w:val') || '';
        if (styleName.toLowerCase().includes('heading')) {
          const text = this.extractParagraphText(p);
          const level = this.extractHeadingLevel(styleName);
          const formatting = this.extractParagraphFormatting(p);
          
          headings.push({
            text: text.trim(),
            level,
            ...formatting
          });
        }
      }
    }
    
    return headings;
  }

  extractParagraphText(paragraph) {
    const textElements = paragraph.getElementsByTagName('w:t');
    let text = '';
    for (let i = 0; i < textElements.length; i++) {
      text += textElements[i].textContent || '';
    }
    return text;
  }

  extractParagraphFormatting(paragraph) {
    const jc = paragraph.getElementsByTagName('w:jc')[0];
    const bold = paragraph.getElementsByTagName('w:b')[0];
    const italic = paragraph.getElementsByTagName('w:i')[0];
    
    return {
      isCentered: jc ? jc.getAttribute('w:val') === 'center' : false,
      isBold: bold !== undefined,
      isItalic: italic !== undefined
    };
  }

  extractHeadingLevel(styleName) {
    const match = styleName.match(/heading\s*(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  }

  detectPageNumbers(documentXml, headerXml, footerXml) {
    const pageNumberPatterns = [
      /w:fldChar.*?w:fldCharType="begin".*?PAGE.*?w:fldCharType="end"/i,
      /<w:pgNum/i,
      /PAGE\s*\\*/i
    ];
    
    const allXml = documentXml + headerXml + footerXml;
    return pageNumberPatterns.some(pattern => pattern.test(allXml));
  }

  validateGeneralFormatting(docStructure, results) {
    const { fontInfo, spacingInfo, pageNumbers } = docStructure;
    
    // Font validation
    const acceptableFonts = [
      { name: 'Times New Roman', size: 12 },
      { name: 'Calibri', size: 11 },
      { name: 'Arial', size: 11 },
      { name: 'Georgia', size: 11 },
      { name: 'Lucida Sans Unicode', size: 10 }
    ];
    
    const isAcceptableFont = acceptableFonts.some(acceptable => 
      fontInfo.font.toLowerCase().includes(acceptable.name.toLowerCase()) && 
      fontInfo.size === acceptable.size
    );
    
    if (isAcceptableFont) {
      results.passing.push({
        message: `Font is correct: ${fontInfo.font} ${fontInfo.size}pt`,
        details: 'Meets APA 7 font requirements'
      });
    } else {
      results.issues.push({
        id: 'font-incorrect',
        severity: 'error',
        message: `Font "${fontInfo.font} ${fontInfo.size}pt" is not APA compliant`,
        details: 'Use Times New Roman 12pt, Calibri 11pt, Arial 11pt, Georgia 11pt, or Lucida Sans Unicode 10pt'
      });
    }
    
    // Spacing validation
    if (spacingInfo.isDoubleSpaced) {
      results.passing.push({
        message: 'Document is properly double-spaced',
        details: 'Line spacing follows APA 7 requirements'
      });
    } else {
      results.issues.push({
        id: 'spacing-incorrect',
        severity: 'error',
        message: 'Document is not double-spaced',
        details: 'Set line spacing to double (2.0) throughout the entire document'
      });
    }
    
    // Page numbers validation
    if (pageNumbers) {
      results.passing.push({
        message: 'Page numbers are present',
        details: 'Page numbering follows APA requirements'
      });
    } else {
      results.issues.push({
        id: 'page-numbers-missing',
        severity: 'error',
        message: 'Page numbers are missing',
        details: 'Insert page numbers in the top right corner of every page'
      });
    }
  }

  validateTitlePage(docStructure, results) {
    const { text } = docStructure;
    const firstPage = text.substring(0, 1500);
    
    // Check for title (basic presence)
    if (firstPage.trim().length > 10) {
      results.passing.push({
        message: 'Title page content detected',
        details: 'Document appears to have a title page'
      });
    }
    
    // Check for author
    const authorPatterns = [
      /^[A-Z][a-z]+\s+[A-Z][a-z]+/m,
      /Author/i,
      /By\s+[A-Z]/i
    ];
    
    const hasAuthor = authorPatterns.some(pattern => pattern.test(firstPage));
    if (hasAuthor) {
      results.passing.push({
        message: 'Author information found',
        details: 'Title page includes author information'
      });
    } else {
      results.issues.push({
        id: 'author-missing',
        severity: 'error',
        message: 'Author information missing from title page',
        details: 'Include author name(s) on the title page'
      });
    }
    
    // Check for institution
    const institutionPatterns = [/university/i, /college/i, /school/i];
    const hasInstitution = institutionPatterns.some(pattern => pattern.test(firstPage));
    
    if (hasInstitution) {
      results.passing.push({
        message: 'Institutional affiliation found',
        details: 'Title page includes institutional information'
      });
    } else {
      results.issues.push({
        id: 'institution-missing',
        severity: 'warning',
        message: 'Institutional affiliation may be missing',
        details: 'Include your university or institution on the title page'
      });
    }
  }

  validateAbstract(docStructure, results) {
    const { text } = docStructure;
    const abstractMatch = text.match(/Abstract\s*([\s\S]*?)(?:Keywords?|Introduction|$)/i);
    
    if (abstractMatch) {
      results.passing.push({
        message: 'Abstract section found',
        details: 'Document includes an abstract section'
      });
      
      const abstractText = abstractMatch[1].trim();
      const wordCount = abstractText.split(/\s+/).length;
      
      if (wordCount >= 150 && wordCount <= 250) {
        results.passing.push({
          message: `Abstract word count is appropriate (${wordCount} words)`,
          details: 'Abstract length follows APA guidelines (150-250 words)'
        });
      } else if (wordCount > 250) {
        results.issues.push({
          id: 'abstract-too-long',
          severity: 'warning',
          message: `Abstract is too long (${wordCount} words)`,
          details: 'APA recommends 150-250 words for abstracts'
        });
      } else if (wordCount < 150 && wordCount > 50) {
        results.issues.push({
          id: 'abstract-too-short',
          severity: 'suggestion',
          message: `Abstract may be too short (${wordCount} words)`,
          details: 'Consider expanding to 150-250 words'
        });
      }
    }
  }

  validateHeadings(docStructure, results) {
    const { headings } = docStructure;
    
    if (headings.length === 0) {
      results.issues.push({
        id: 'no-headings',
        severity: 'suggestion',
        message: 'No headings detected',
        details: 'Consider using APA-style headings to organize your content'
      });
      return;
    }
    
    // Filter out special headings like Abstract, References
    const contentHeadings = headings.filter(h => 
      !['abstract', 'references', 'keywords'].includes(h.text.toLowerCase())
    );
    
    if (contentHeadings.length > 0) {
      results.passing.push({
        message: `Document uses ${contentHeadings.length} heading(s)`,
        details: 'Headings help organize content according to APA style'
      });
      
      // Check heading hierarchy
      for (let i = 1; i < contentHeadings.length; i++) {
        const current = contentHeadings[i];
        const previous = contentHeadings[i - 1];
        
        if (current.level > previous.level + 1) {
          results.issues.push({
            id: `heading-hierarchy-${i}`,
            severity: 'error',
            message: 'Heading level skipped',
            details: `Cannot jump from Level ${previous.level} to Level ${current.level} ("${current.text}")`
          });
        }
      }
      
      // Validate individual headings
      contentHeadings.forEach((heading, index) => {
        this.validateIndividualHeading(heading, index, results);
      });
    }
  }

  validateIndividualHeading(heading, index, results) {
    const { level, text, isCentered, isBold } = heading;
    
    // APA heading requirements
    const requirements = {
      1: { centered: true, bold: true, titleCase: true },
      2: { centered: false, bold: true, titleCase: true },
      3: { centered: false, bold: true, titleCase: true },
      4: { centered: false, bold: true, titleCase: true },
      5: { centered: false, bold: true, titleCase: true }
    };
    
    const req = requirements[level];
    if (!req) return;
    
    // Check centering
    if (req.centered && isCentered) {
      results.passing.push({
        message: `Level ${level} heading is properly centered`,
        details: `"${text}" follows APA centering requirements`
      });
    } else if (req.centered && !isCentered) {
      results.issues.push({
        id: `heading-not-centered-${index}`,
        severity: 'error',
        message: `Level ${level} heading should be centered`,
        details: `"${text}" should be centered according to APA format`
      });
    }
    
    // Check bold
    if (req.bold && isBold) {
      results.passing.push({
        message: `Level ${level} heading is properly bolded`,
        details: `"${text}" follows APA bold formatting`
      });
    } else if (req.bold && !isBold) {
      results.issues.push({
        id: `heading-not-bold-${index}`,
        severity: 'error',
        message: `Level ${level} heading should be bold`,
        details: `"${text}" must be formatted in bold`
      });
    }
  }

  validateCitations(docStructure, results) {
    const { text } = docStructure;
    
    // Find in-text citations
    const citationRegex = /\(([A-Za-z\s&,.-]+),\s*(\d{4}[a-z]?)(?:,\s*pp?\.\s*\d+(?:-\d+)?)?\)/g;
    const citations = [];
    let match;
    
    while ((match = citationRegex.exec(text)) !== null) {
      citations.push(match[0]);
    }
    
    if (citations.length > 0) {
      results.passing.push({
        message: `Found ${citations.length} properly formatted citation(s)`,
        details: 'Citations follow APA author-date format'
      });
    }
    
    // Check for quotes without page numbers
    const quotes = text.match(/"[^"]{20,}"/g) || [];
    let quotesWithoutPages = 0;
    
    quotes.forEach(quote => {
      const quoteIndex = text.indexOf(quote);
      const afterQuote = text.substring(quoteIndex + quote.length, quoteIndex + quote.length + 50);
      
      if (!afterQuote.match(/^\s*\([^)]+,\s*\d{4}[^)]*,\s*pp?\.\s*\d+/)) {
        quotesWithoutPages++;
      }
    });
    
    if (quotesWithoutPages > 0) {
      results.issues.push({
        id: 'quotes-missing-pages',
        severity: 'error',
        message: `${quotesWithoutPages} direct quote(s) missing page numbers`,
        details: 'All direct quotes must include page numbers: (Author, Year, p. #)'
      });
    }
  }

  validateReferences(docStructure, results) {
    const { text } = docStructure;
    
    const referencesMatch = text.match(/References\s*([\s\S]*?)(?:\n\s*Appendix|$)/i);
    
    if (referencesMatch) {
      results.passing.push({
        message: 'References section found',
        details: 'Document includes a references section'
      });
      
      const referencesText = referencesMatch[1].trim();
      const references = this.parseReferences(referencesText);
      
      if (references.length > 0) {
        results.passing.push({
          message: `Found ${references.length} reference(s)`,
          details: 'References section contains bibliography entries'
        });
        
        // Check alphabetical order
        const isAlphabetical = this.checkAlphabeticalOrder(references);
        if (isAlphabetical) {
          results.passing.push({
            message: 'References are in alphabetical order',
            details: 'Reference list follows APA alphabetization requirements'
          });
        } else {
          results.issues.push({
            id: 'references-not-alphabetical',
            severity: 'error',
            message: 'References are not in alphabetical order',
            details: 'Sort references alphabetically by first author\'s last name'
          });
        }
      }
    } else {
      results.issues.push({
        id: 'references-missing',
        severity: 'error',
        message: 'References section not found',
        details: 'Document must include a References section'
      });
    }
  }

  parseReferences(referencesText) {
    const lines = referencesText.split('\n');
    const references = [];
    let currentRef = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && /^[A-Z]/.test(trimmed) && currentRef.length > 30) {
        references.push(currentRef.trim());
        currentRef = trimmed;
      } else if (trimmed.length > 0) {
        currentRef += ' ' + trimmed;
      }
    }
    
    if (currentRef.trim().length > 30) {
      references.push(currentRef.trim());
    }
    
    return references;
  }

  checkAlphabeticalOrder(references) {
    const authors = references.map(ref => {
      const match = ref.match(/^([^(,]+)/);
      return match ? match[1].trim().toLowerCase() : '';
    });
    
    for (let i = 1; i < authors.length; i++) {
      if (authors[i] < authors[i - 1]) {
        return false;
      }
    }
    
    return true;
  }
}
