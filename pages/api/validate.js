
import formidable from 'formidable';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';

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
    console.log('🔍 Starting file upload processing...');
    
    // Parse the uploaded file
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);
    const file = files.document[0];

    console.log('📁 File received:', file?.originalFilename, 'Size:', file?.size);

    if (!file || !file.originalFilename.endsWith('.docx')) {
      return res.status(400).json({ error: 'Please upload a .docx file' });
    }

    // Read file buffer
    const fileBuffer = await fs.readFile(file.filepath);
    console.log('📖 File buffer size:', fileBuffer.length);

    // Parse the DOCX
    const validator = new APAValidator();
    const results = await validator.validateDocument(fileBuffer, file.originalFilename);

    // Clean up temp file
    await fs.unlink(file.filepath);

    console.log('✅ Validation complete. Results:', {
      passing: results.passing?.length || 0,
      issues: results.issues?.length || 0,
      score: results.score
    });

    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Validation error:', error);
    res.status(500).json({ 
      error: 'Failed to validate document',
      details: error.message,
      stack: error.stack
    });
  }
}

class APAValidator {
  async validateDocument(buffer, filename) {
    console.log('🔬 Starting document analysis for:', filename);
    
    try {
      // Try to parse DOCX
      const zip = new AdmZip(buffer);
      console.log('📦 ZIP created successfully');
      
      const entries = zip.getEntries();
      console.log('📋 ZIP entries found:', entries.map(e => e.entryName));
      
      // Check if required files exist
      const documentXml = zip.readAsText('word/document.xml');
      const stylesXml = zip.readAsText('word/styles.xml') || '';
      console.log('📄 Document XML length:', documentXml?.length || 0);
      console.log('🎨 Styles XML length:', stylesXml?.length || 0);
      
      const docStructure = this.parseDocxStructure(zip);
      console.log('🏗️ Document structure parsed:', {
        textLength: docStructure.text?.length || 0,
        fontDetected: docStructure.fontInfo?.font || 'none',
        sizeDetected: docStructure.fontInfo?.size || 'none',
        spacingDetected: docStructure.spacingInfo?.isDoubleSpaced || false,
        headingsFound: docStructure.headings?.length || 0,
        pageNumbersFound: docStructure.pageNumbers || false
      });
      
      const results = {
        filename,
        issues: [],
        passing: [],
        score: 0,
        debug: {
          textPreview: docStructure.text?.substring(0, 200) || 'No text found',
          fontInfo: docStructure.fontInfo,
          spacingInfo: docStructure.spacingInfo,
          headingsCount: docStructure.headings?.length || 0
        }
      };

      // Run validations with detailed logging
      this.validateGeneralFormatting(docStructure, results);
      this.validateTitlePage(docStructure, results);
      this.validateAbstract(docStructure, results);
      this.validateHeadings(docStructure, results);
      this.validateCitations(docStructure, results);
      this.validateReferences(docStructure, results);

      // Calculate score
      const errors = results.issues.filter(i => i.severity === 'error').length;
      const warnings = results.issues.filter(i => i.severity === 'warning').length;
      const suggestions = results.issues.filter(i => i.severity === 'suggestion').length;
      
      results.score = Math.max(0, 100 - (errors * 15) - (warnings * 8) - (suggestions * 3));

      console.log('📊 Final results:', {
        passing: results.passing.length,
        errors,
        warnings,
        suggestions,
        score: results.score
      });

      return results;
    } catch (error) {
      console.error('💥 Document parsing error:', error);
      
      // Return a fallback result with error info
      return {
        filename,
        issues: [{
          id: 'parsing-error',
          severity: 'error',
          message: 'Failed to parse document',
          details: `Error: ${error.message}`
        }],
        passing: [],
        score: 0,
        debug: {
          error: error.message,
          stack: error.stack
        }
      };
    }
  }

  parseDocxStructure(zip) {
    console.log('🔍 Parsing DOCX structure...');
    
    try {
      // Read XML files
      const documentXml = zip.readAsText('word/document.xml');
      const stylesXml = zip.readAsText('word/styles.xml') || '';
      
      // Extract text using simple regex (more reliable than XML parsing)
      const text = this.extractTextFromXml(documentXml);
      console.log('📝 Extracted text length:', text.length);
      console.log('📝 Text preview:', text.substring(0, 300));
      
      // Extract font info using regex
      const fontInfo = this.extractFontInfoRegex(stylesXml, documentXml);
      console.log('🔤 Font info extracted:', fontInfo);
      
      // Extract spacing info
      const spacingInfo = this.extractSpacingInfoRegex(stylesXml, documentXml);
      console.log('📏 Spacing info extracted:', spacingInfo);
      
      // Extract headings
      const headings = this.extractHeadingsRegex(documentXml);
      console.log('📑 Headings extracted:', headings.length);
      
      // Check page numbers
      const pageNumbers = this.detectPageNumbersRegex(documentXml, zip);
      console.log('📄 Page numbers detected:', pageNumbers);
      
      return {
        text,
        fontInfo,
        spacingInfo,
        headings,
        pageNumbers,
        documentXml,
        stylesXml
      };
    } catch (error) {
      console.error('💥 Structure parsing error:', error);
      throw error;
    }
  }

  extractTextFromXml(xml) {
    // Extract text from w:t elements using regex
    const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    let text = '';
    
    textMatches.forEach(match => {
      const content = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
      text += content + ' ';
    });
    
    return text.trim();
  }

  extractFontInfoRegex(stylesXml, documentXml) {
    // Look for font information in styles and document
    const allXml = stylesXml + documentXml;
    
    // Find font family
    const fontMatch = allXml.match(/w:ascii="([^"]+)"/i);
    let font = fontMatch ? fontMatch[1] : 'Times New Roman';
    
    // Find font size (Word uses half-points)
    const sizeMatch = allXml.match(/w:val="(\d+)"/);
    let size = sizeMatch ? parseInt(sizeMatch[1]) / 2 : 12;
    
    // If we find specific font info, use it
    const timesMatch = allXml.match(/Times\s*New\s*Roman/i);
    const calibriMatch = allXml.match(/Calibri/i);
    
    if (timesMatch) font = 'Times New Roman';
    if (calibriMatch) font = 'Calibri';
    
    console.log('🔤 Font detection details:', { fontMatch: fontMatch?.[1], sizeMatch: sizeMatch?.[1], font, size });
    
    return { font, size };
  }

  extractSpacingInfoRegex(stylesXml, documentXml) {
    const allXml = stylesXml + documentXml;
    
    // Look for double spacing indicators
    const doubleSpacingPatterns = [
      /w:line="480"/i,
      /w:lineRule="auto"/i,
      /line-height:\s*2/i,
      /spacing="2"/i
    ];
    
    const isDoubleSpaced = doubleSpacingPatterns.some(pattern => pattern.test(allXml));
    
    console.log('📏 Spacing detection:', { isDoubleSpaced });
    
    return { isDoubleSpaced };
  }

  extractHeadingsRegex(documentXml) {
    const headings = [];
    
    // Look for heading styles
    const headingMatches = documentXml.match(/<w:pStyle w:val="[^"]*[Hh]eading\d*"[^>]*>[\s\S]*?<\/w:p>/g) || [];
    
    headingMatches.forEach((match, index) => {
      // Extract heading level
      const levelMatch = match.match(/[Hh]eading(\d+)/);
      const level = levelMatch ? parseInt(levelMatch[1]) : 1;
      
      // Extract text
      const textMatches = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      let text = '';
      textMatches.forEach(textMatch => {
        const content = textMatch.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
        text += content + ' ';
      });
      
      if (text.trim()) {
        headings.push({
          level,
          text: text.trim(),
          isBold: match.includes('<w:b/>') || match.includes('<w:b '),
          isCentered: match.includes('w:val="center"')
        });
      }
    });
    
    console.log('📑 Headings found:', headings);
    
    return headings;
  }

  detectPageNumbersRegex(documentXml, zip) {
    // Check for page number fields
    const pageNumberPatterns = [
      /<w:fldChar.*?w:fldCharType="begin".*?>[\s\S]*?PAGE[\s\S]*?<w:fldChar.*?w:fldCharType="end"/i,
      /<w:instrText[^>]*>\s*PAGE\s*<\/w:instrText>/i,
      /<w:pgNum/i
    ];
    
    // Check in document
    let hasPageNumbers = pageNumberPatterns.some(pattern => pattern.test(documentXml));
    
    // Check in headers/footers
    try {
      const header1 = zip.readAsText('word/header1.xml') || '';
      const footer1 = zip.readAsText('word/footer1.xml') || '';
      const headerFooterXml = header1 + footer1;
      
      if (!hasPageNumbers) {
        hasPageNumbers = pageNumberPatterns.some(pattern => pattern.test(headerFooterXml));
      }
    } catch (e) {
      console.log('📄 No header/footer files found');
    }
    
    console.log('📄 Page number detection:', hasPageNumbers);
    
    return hasPageNumbers;
  }

  validateGeneralFormatting(docStructure, results) {
    const { fontInfo, spacingInfo, pageNumbers } = docStructure;
    
    console.log('🔍 Validating general formatting...');
    
    // Font validation - be more specific
    const acceptableFonts = [
      { name: 'Times New Roman', size: 12 },
      { name: 'Calibri', size: 11 },
      { name: 'Arial', size: 11 },
      { name: 'Georgia', size: 11 },
      { name: 'Lucida Sans Unicode', size: 10 }
    ];
    
    const isAcceptableFont = acceptableFonts.some(acceptable => 
      fontInfo.font.toLowerCase().includes(acceptable.name.toLowerCase()) && 
      Math.abs(fontInfo.size - acceptable.size) <= 1 // Allow 1pt difference
    );
    
    if (isAcceptableFont) {
      results.passing.push({
        message: `✅ Font is correct: ${fontInfo.font} ${fontInfo.size}pt`,
        details: 'Meets APA 7 font requirements'
      });
    } else {
      results.issues.push({
        id: 'font-incorrect',
        severity: 'warning',
        message: `Font "${fontInfo.font} ${fontInfo.size}pt" may not be APA compliant`,
        details: 'APA 7 acceptable fonts: Times New Roman 12pt, Calibri 11pt, Arial 11pt, Georgia 11pt, or Lucida Sans Unicode 10pt'
      });
    }
    
    // Spacing validation
    if (spacingInfo.isDoubleSpaced) {
      results.passing.push({
        message: '✅ Document is properly double-spaced',
        details: 'Line spacing follows APA 7 requirements'
      });
    } else {
      results.issues.push({
        id: 'spacing-incorrect',
        severity: 'suggestion',
        message: 'Document may not be double-spaced',
        details: 'Ensure line spacing is set to double (2.0) throughout the document'
      });
    }
    
    // Page numbers validation
    if (pageNumbers) {
      results.passing.push({
        message: '✅ Page numbers are present',
        details: 'Page numbering detected in document'
      });
    } else {
      results.issues.push({
        id: 'page-numbers-missing',
        severity: 'suggestion',
        message: 'Page numbers may be missing',
        details: 'Insert page numbers in the top right corner of every page'
      });
    }
  }

  validateTitlePage(docStructure, results) {
    const { text } = docStructure;
    const firstPage = text.substring(0, 1500);
    
    console.log('🔍 Validating title page...');
    
    // Check for title presence
    if (firstPage.trim().length > 50) {
      results.passing.push({
        message: '✅ Title page content detected',
        details: 'Document appears to have a title page with content'
      });
    }
    
    // Check for author
    const authorPatterns = [
      /^[A-Z][a-z]+\s+[A-Z][a-z]+/m,
      /Author/i,
      /By\s+[A-Z]/i,
      /Student.*Name/i
    ];
    
    const hasAuthor = authorPatterns.some(pattern => pattern.test(firstPage));
    if (hasAuthor) {
      results.passing.push({
        message: '✅ Author information found',
        details: 'Title page includes author information'
      });
    } else {
      results.issues.push({
        id: 'author-missing',
        severity: 'warning',
        message: 'Author information may be missing',
        details: 'Include author name(s) on the title page'
      });
    }
    
    // Check for institution
    const institutionPatterns = [/university/i, /college/i, /school/i, /institution/i];
    const hasInstitution = institutionPatterns.some(pattern => pattern.test(firstPage));
    
    if (hasInstitution) {
      results.passing.push({
        message: '✅ Institutional affiliation found',
        details: 'Title page includes institutional information'
      });
    } else {
      results.issues.push({
        id: 'institution-missing',
        severity: 'suggestion',
        message: 'Institutional affiliation may be missing',
        details: 'Include your university or institution on the title page'
      });
    }
  }

  validateAbstract(docStructure, results) {
    const { text } = docStructure;
    const abstractMatch = text.match(/Abstract\s*([\s\S]*?)(?:Keywords?|Introduction|Method|$)/i);
    
    if (abstractMatch) {
      results.passing.push({
        message: '✅ Abstract section found',
        details: 'Document includes an abstract section'
      });
      
      const abstractText = abstractMatch[1].trim();
      const wordCount = abstractText.split(/\s+/).filter(word => word.length > 0).length;
      
      if (wordCount >= 150 && wordCount <= 250) {
        results.passing.push({
          message: `✅ Abstract word count is appropriate (${wordCount} words)`,
          details: 'Abstract length follows APA guidelines (150-250 words)'
        });
      } else if (wordCount > 250) {
        results.issues.push({
          id: 'abstract-too-long',
          severity: 'suggestion',
          message: `Abstract is long (${wordCount} words)`,
          details: 'APA recommends 150-250 words for abstracts'
        });
      } else if (wordCount > 50) {
        results.issues.push({
          id: 'abstract-short',
          severity: 'suggestion',
          message: `Abstract is brief (${wordCount} words)`,
          details: 'Consider expanding to 150-250 words if appropriate'
        });
      }
    }
  }

  validateHeadings(docStructure, results) {
    const { headings } = docStructure;
    
    console.log('🔍 Validating headings...');
    
    if (headings.length === 0) {
      results.issues.push({
        id: 'no-headings',
        severity: 'suggestion',
        message: 'No APA-style headings detected',
        details: 'Consider using formatted headings to organize your content'
      });
      return;
    }
    
    // Filter out special headings
    const contentHeadings = headings.filter(h => 
      !['abstract', 'references', 'keywords'].includes(h.text.toLowerCase())
    );
    
    if (contentHeadings.length > 0) {
      results.passing.push({
        message: `✅ Document uses ${contentHeadings.length} heading(s)`,
        details: 'Headings help organize content according to APA style'
      });
      
      // Check if headings are bold
      const boldHeadings = contentHeadings.filter(h => h.isBold);
      if (boldHeadings.length > 0) {
        results.passing.push({
          message: `✅ ${boldHeadings.length} heading(s) are properly bolded`,
          details: 'Bold formatting follows APA requirements'
        });
      }
      
      // Check for centered headings (Level 1)
      const centeredHeadings = contentHeadings.filter(h => h.isCentered && h.level === 1);
      if (centeredHeadings.length > 0) {
        results.passing.push({
          message: `✅ Level 1 heading(s) are centered`,
          details: 'Centering follows APA Level 1 heading requirements'
        });
      }
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
        message: `✅ Found ${citations.length} properly formatted citation(s)`,
        details: 'Citations follow APA author-date format'
      });
    } else {
      results.issues.push({
        id: 'no-citations',
        severity: 'suggestion',
        message: 'No in-text citations detected',
        details: 'Academic papers typically require citations to support claims'
      });
    }
  }

  validateReferences(docStructure, results) {
    const { text } = docStructure;
    
    const referencesMatch = text.match(/References\s*([\s\S]*?)(?:\n\s*Appendix|$)/i);
    
    if (referencesMatch) {
      results.passing.push({
        message: '✅ References section found',
        details: 'Document includes a references section'
      });
      
      const referencesText = referencesMatch[1].trim();
      if (referencesText.length > 100) {
        results.passing.push({
          message: '✅ References section contains content',
          details: 'Bibliography entries detected in references section'
        });
      }
    } else {
      results.issues.push({
        id: 'references-missing',
        severity: 'suggestion',
        message: 'References section not clearly detected',
        details: 'Academic papers typically require a References section'
      });
    }
  }
}
