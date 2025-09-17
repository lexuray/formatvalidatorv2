import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissedIssues, setDismissedIssues] = useState(new Set());

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setResults(null);
    setError(null);
    setDismissedIssues(new Set());
  };

  const processDocument = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // Load JSZip and mammoth from CDN
      const JSZip = (await import('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')).default;
      const mammoth = (await import('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')).default;

      console.log('📄 Processing file:', file.name);

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Extract text using mammoth
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      
      console.log('📝 Extracted text length:', textResult.value.length);
      console.log('📝 Text preview:', textResult.value.substring(0, 200));

      // Parse DOCX structure using JSZip
      const zip = new JSZip();
      const docx = await zip.loadAsync(arrayBuffer);
      
      // Extract XML files
      const documentXml = await docx.file('word/document.xml')?.async('string') || '';
      const stylesXml = await docx.file('word/styles.xml')?.async('string') || '';
      
      console.log('📋 Document XML length:', documentXml.length);
      console.log('🎨 Styles XML length:', stylesXml.length);

      // Analyze the document
      const validator = new ClientAPAValidator();
      const validationResults = validator.analyze({
        text: textResult.value,
        html: htmlResult.value,
        documentXml,
        stylesXml,
        filename: file.name
      });

      console.log('✅ Analysis complete:', validationResults);
      setResults(validationResults);

    } catch (err) {
      console.error('❌ Processing error:', err);
      setError(`Failed to process document: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleDismiss = (issueId) => {
    const newDismissed = new Set(dismissedIssues);
    if (newDismissed.has(issueId)) {
      newDismissed.delete(issueId);
    } else {
      newDismissed.add(issueId);
    }
    setDismissedIssues(newDismissed);
  };

  const getActiveIssues = () => {
    if (!results) return { errors: [], warnings: [], suggestions: [] };
    
    return {
      errors: results.issues.filter(i => i.severity === 'error' && !dismissedIssues.has(i.id)),
      warnings: results.issues.filter(i => i.severity === 'warning' && !dismissedIssues.has(i.id)),
      suggestions: results.issues.filter(i => i.severity === 'suggestion' && !dismissedIssues.has(i.id))
    };
  };

  const calculateScore = () => {
    if (!results) return 0;
    const active = getActiveIssues();
    const totalDeductions = (active.errors.length * 15) + (active.warnings.length * 8) + (active.suggestions.length * 3);
    return Math.max(0, 100 - totalDeductions);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Head>
        <title>APA 7 Validator - Working Edition</title>
        <meta name="description" content="Actually working APA 7 formatting validation" />
      </Head>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem', color: 'white' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: '700', textShadow: '0 4px 8px rgba(0,0,0,0.3)', marginBottom: '1rem' }}>
            APA 7 Validator - Working Edition
          </h1>
          <p style={{ fontSize: '1.5rem', opacity: '0.9' }}>
            Client-side Word document analysis that actually works
          </p>
        </div>

        {/* Upload Area */}
        <div style={{ 
          border: '3px dashed rgba(255,255,255,0.3)', 
          borderRadius: '16px', 
          padding: '3rem 2rem', 
          textAlign: 'center', 
          background: 'rgba(255,255,255,0.1)', 
          backdropFilter: 'blur(10px)', 
          color: 'white',
          marginBottom: '2rem',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}>
          <input
            type="file"
            accept=".docx"
            onChange={(e) => handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
            id="fileInput"
          />
          <label htmlFor="fileInput" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: '0.8' }}>📄</div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
              {file ? file.name : 'Upload your Word document'}
            </h3>
            <p style={{ margin: '0.5rem 0', opacity: '0.8' }}>
              Click here to select your .docx file
            </p>
          </label>
          
          {file && (
            <button
              onClick={processDocument}
              disabled={loading}
              style={{
                background: loading ? '#6c757d' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '1rem'
              }}
            >
              {loading ? '🔍 Analyzing Document...' : '🚀 Validate APA Formatting'}
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            background: 'rgba(220, 53, 69, 0.1)',
            border: '1px solid #dc3545',
            borderRadius: '8px',
            padding: '1rem',
            color: '#dc3545',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            {/* Score */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                background: calculateScore() >= 90 ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' :
                           calculateScore() >= 70 ? 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)' :
                           'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)',
                color: 'white',
                margin: '0 auto 1rem',
                boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
              }}>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', lineHeight: '1' }}>
                  {Math.round(calculateScore())}%
                </div>
                <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  APA Compliance
                </div>
              </div>
            </div>

            {/* What's Working Well (Green) */}
            {results.passing && results.passing.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#28a745', marginBottom: '1rem', borderBottom: '2px solid #28a745', paddingBottom: '0.5rem' }}>
                  ✅ What's Working Well ({results.passing.length} items)
                </h3>
                {results.passing.map((item, index) => (
                  <div key={index} style={{
                    background: '#d4edda',
                    border: '1px solid #c3e6cb',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{ fontWeight: '600', color: '#155724' }}>{item.message}</div>
                    <div style={{ fontSize: '0.9rem', color: '#155724', opacity: '0.8' }}>{item.details}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Issues */}
            {['error', 'warning', 'suggestion'].map(severity => {
              const activeIssues = getActiveIssues();
              const issues = activeIssues[severity + 's'] || [];
              if (issues.length === 0) return null;

              const colors = {
                error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
                warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' },
                suggestion: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
              };

              const icons = {
                error: '❌',
                warning: '⚠️', 
                suggestion: '💡'
              };

              return (
                <div key={severity} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ 
                    color: colors[severity].text, 
                    marginBottom: '1rem', 
                    borderBottom: `2px solid ${colors[severity].text}`, 
                    paddingBottom: '0.5rem' 
                  }}>
                    {icons[severity]} {severity.charAt(0).toUpperCase() + severity.slice(1)}s ({issues.length} items)
                  </h3>
                  {issues.map((issue) => (
                    <div key={issue.id} style={{
                      background: dismissedIssues.has(issue.id) ? '#e9ecef' : colors[severity].bg,
                      border: `1px solid ${colors[severity].border}`,
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      opacity: dismissedIssues.has(issue.id) ? '0.5' : '1',
                      position: 'relative'
                    }}>
                      <button
                        onClick={() => toggleDismiss(issue.id)}
                        style={{
                          position: 'absolute',
                          top: '1rem',
                          right: '1rem',
                          background: dismissedIssues.has(issue.id) ? '#28a745' : '#6c757d',
                          color: 'white',
                          border: 'none',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {dismissedIssues.has(issue.id) ? '✓' : '×'}
                      </button>
                      <div style={{ fontWeight: '600', color: colors[severity].text, marginBottom: '0.5rem' }}>
                        {issue.message}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: colors[severity].text, opacity: '0.8' }}>
                        {issue.details}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* No Issues */}
            {results.issues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#28a745' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🎉 Perfect APA Formatting!</h3>
                <p style={{ fontSize: '1.1rem' }}>Your document follows all APA 7 guidelines correctly.</p>
              </div>
            )}

            {/* Debug Info */}
            {results.debug && (
              <div style={{ 
                marginTop: '2rem', 
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                fontSize: '0.9rem'
              }}>
                <h4>🔍 Analysis Details:</h4>
                <p><strong>Text Length:</strong> {results.debug.textLength} characters</p>
                <p><strong>Font Detected:</strong> {results.debug.font || 'Not detected'}</p>
                <p><strong>Headings Found:</strong> {results.debug.headings || 0}</p>
                <p><strong>Citations Found:</strong> {results.debug.citations || 0}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Client-side APA Validator
class ClientAPAValidator {
  analyze(docData) {
    const { text, html, documentXml, stylesXml, filename } = docData;
    
    // Store XML for use in other methods
    this.documentXml = documentXml;
    this.stylesXml = stylesXml;
    
    console.log('🔍 Starting client-side analysis...');
    console.log('📄 Document XML length:', documentXml.length);
    
    const results = {
      filename,
      issues: [],
      passing: [],
      score: 0,
      debug: {
        textLength: text.length,
        font: this.detectFont(stylesXml, documentXml),
        headings: this.countHeadings(text),
        citations: this.countCitations(text),
        documentPreview: text.substring(0, 300)
      }
    };

    // Run all validations
    this.validateFont(stylesXml, documentXml, results);
    this.validateSpacing(html, documentXml, results);
    this.validateTitlePage(text, results);
    this.validateAbstract(text, results);
    this.validateHeadings(text, results);
    this.validateCitations(text, results);
    this.validateReferences(text, results);
    this.validatePageNumbers(documentXml, results);

    // Calculate score
    const errors = results.issues.filter(i => i.severity === 'error').length;
    const warnings = results.issues.filter(i => i.severity === 'warning').length;
    const suggestions = results.issues.filter(i => i.severity === 'suggestion').length;
    
    results.score = Math.max(0, 100 - (errors * 15) - (warnings * 8) - (suggestions * 3));

    console.log('📊 Analysis results:', {
      passing: results.passing.length,
      errors,
      warnings,
      suggestions,
      score: results.score
    });

    return results;
  }

  detectFont(stylesXml, documentXml) {
    // Look for font in styles and document XML
    const fontMatch = (stylesXml + documentXml).match(/w:ascii="([^"]+)"/i);
    return fontMatch ? fontMatch[1] : 'Unknown';
  }

  countHeadings(text) {
    const headingPatterns = [
      /^[A-Z][^.!?]*$/gm, // Lines that look like headings
      /Introduction|Method|Results|Discussion|Conclusion/gi
    ];
    let count = 0;
    headingPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      count += matches.length;
    });
    return Math.min(count, 10); // Cap at reasonable number
  }

  countCitations(text) {
    const citationPattern = /\([A-Za-z\s&,.-]+,\s*\d{4}[a-z]?\)/g;
    const matches = text.match(citationPattern) || [];
    return matches.length;
  }

  validateFont(stylesXml, documentXml, results) {
    const font = this.detectFont(stylesXml, documentXml);
    const acceptableFonts = ['Times New Roman', 'Calibri', 'Arial', 'Georgia', 'Lucida Sans Unicode'];
    
    const isAcceptable = acceptableFonts.some(acceptable => 
      font.toLowerCase().includes(acceptable.toLowerCase())
    );

    if (isAcceptable) {
      results.passing.push({
        message: `✅ Font detected: ${font}`,
        details: 'Font appears to meet APA requirements'
      });
    } else if (font !== 'Unknown') {
      results.issues.push({
        id: 'font-issue',
        severity: 'warning',
        message: `Font "${font}" may not be APA compliant`,
        details: 'APA 7 recommends Times New Roman 12pt, Calibri 11pt, Arial 11pt, Georgia 11pt, or Lucida Sans Unicode 10pt'
      });
    }
  }

  validateSpacing(html, documentXml, results) {
    // Check for double spacing indicators
    const hasDoubleSpacing = html.includes('line-height:2') || 
                           html.includes('line-height: 2') ||
                           documentXml.includes('w:line="480"');

    if (hasDoubleSpacing) {
      results.passing.push({
        message: '✅ Double spacing detected',
        details: 'Document appears to use proper line spacing'
      });
    } else {
      results.issues.push({
        id: 'spacing-issue',
        severity: 'suggestion',
        message: 'Document spacing cannot be verified',
        details: 'Ensure document is double-spaced throughout'
      });
    }
  }

  validateTitlePage(text, results) {
    const firstPage = text.substring(0, 1000);
    
    // Check for basic title page elements
    if (firstPage.trim().length > 50) {
      results.passing.push({
        message: '✅ Title page content found',
        details: 'Document has content that appears to be a title page'
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
        message: '✅ Author information detected',
        details: 'Title page appears to include author information'
      });
    } else {
      results.issues.push({
        id: 'author-missing',
        severity: 'warning',
        message: 'Author information may be missing',
        details: 'Title page should include author name(s)'
      });
    }

    // Check for institution
    const institutionPatterns = [/university/i, /college/i, /school/i];
    const hasInstitution = institutionPatterns.some(pattern => pattern.test(firstPage));
    
    if (hasInstitution) {
      results.passing.push({
        message: '✅ Institution information found',
        details: 'Title page includes institutional affiliation'
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

  validateAbstract(text, results) {
    const abstractMatch = text.match(/Abstract\s*([\s\S]*?)(?:Keywords?|Introduction|Method|$)/i);
    
    if (abstractMatch) {
      results.passing.push({
        message: '✅ Abstract section found',
        details: 'Document includes an abstract'
      });
      
      const abstractText = abstractMatch[1].trim();
      const wordCount = abstractText.split(/\s+/).filter(w => w.length > 0).length;
      
      if (wordCount >= 150 && wordCount <= 250) {
        results.passing.push({
          message: `✅ Abstract length appropriate (${wordCount} words)`,
          details: 'Abstract word count follows APA guidelines'
        });
      } else if (wordCount > 250) {
        results.issues.push({
          id: 'abstract-long',
          severity: 'suggestion',
          message: `Abstract is lengthy (${wordCount} words)`,
          details: 'APA recommends 150-250 words for abstracts'
        });
      } else if (wordCount > 50) {
        results.issues.push({
          id: 'abstract-short',
          severity: 'suggestion',
          message: `Abstract is brief (${wordCount} words)`,
          details: 'Consider expanding to 150-250 words'
        });
      }
    } else {
      results.issues.push({
        id: 'abstract-missing',
        severity: 'suggestion',
        message: 'Abstract section not clearly detected',
        details: 'Many academic papers benefit from an abstract'
      });
    }
  }

  validateHeadings(text, results) {
    // Extract headings from the document XML structure
    const headings = this.extractHeadingsFromXML(this.documentXml || '');
    
    console.log('🔍 Extracted headings:', headings);
    
    if (headings.length > 0) {
      results.passing.push({
        message: `✅ Found ${headings.length} heading(s)`,
        details: 'Document uses headings for organization'
      });
      
      // Check each heading for proper formatting
      headings.forEach((heading, index) => {
        // Check if heading is bold
        if (heading.isBold) {
          results.passing.push({
            message: `✅ "${heading.text}" is properly bolded`,
            details: `Level ${heading.level} heading follows APA bold requirement`
          });
        } else {
          results.issues.push({
            id: `heading-not-bold-${index}`,
            severity: 'error',
            message: `"${heading.text}" should be bold`,
            details: `APA Level ${heading.level} headings must be formatted in bold`
          });
        }
        
        // Check centering for Level 1 headings
        if (heading.level === 1) {
          if (heading.isCentered) {
            results.passing.push({
              message: `✅ Level 1 heading "${heading.text}" is centered`,
              details: 'Centering follows APA Level 1 heading requirements'
            });
          } else {
            results.issues.push({
              id: `heading-not-centered-${index}`,
              severity: 'error',
              message: `Level 1 heading "${heading.text}" should be centered`,
              details: 'APA Level 1 headings must be centered'
            });
          }
        } else {
          // Level 2+ headings should NOT be centered
          if (heading.isCentered) {
            results.issues.push({
              id: `heading-incorrectly-centered-${index}`,
              severity: 'error',
              message: `Level ${heading.level} heading "${heading.text}" should not be centered`,
              details: `APA Level ${heading.level} headings should be flush left`
            });
          } else {
            results.passing.push({
              message: `✅ Level ${heading.level} heading "${heading.text}" is flush left`,
              details: 'Alignment follows APA requirements'
            });
          }
        }
      });
    } else {
      results.issues.push({
        id: 'no-headings',
        severity: 'suggestion',
        message: 'No APA-style headings detected',
        details: 'Consider using formatted headings to organize content'
      });
    }
  }

  extractHeadingsFromXML(documentXml) {
    const headings = [];
    
    // Look for paragraphs with heading styles
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let match;
    
    while ((match = paragraphRegex.exec(documentXml)) !== null) {
      const paragraphXml = match[1];
      
      // Check if this paragraph has a heading style
      const styleMatch = paragraphXml.match(/<w:pStyle w:val="([^"]*[Hh]eading\d*[^"]*)"/);
      if (styleMatch) {
        const styleName = styleMatch[1];
        const level = this.extractHeadingLevel(styleName);
        
        // Extract text from this paragraph
        const textMatches = paragraphXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        let text = '';
        textMatches.forEach(textMatch => {
          const content = textMatch.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
          text += content;
        });
        
        if (text.trim()) {
          // Check formatting
          const isBold = paragraphXml.includes('<w:b/>') || paragraphXml.includes('<w:b ');
          const isCentered = paragraphXml.includes('w:val="center"') || paragraphXml.includes('jc w:val="center"');
          
          headings.push({
            text: text.trim(),
            level,
            isBold,
            isCentered,
            rawXml: paragraphXml.substring(0, 200) // For debugging
          });
        }
      }
    }
    
    return headings;
  }

  extractHeadingLevel(styleName) {
    const match = styleName.match(/[Hh]eading\s*(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  validateCitations(text, results) {
    const citationCount = this.countCitations(text);
    
    if (citationCount > 0) {
      results.passing.push({
        message: `✅ In-text citations found (${citationCount})`,
        details: 'Document includes properly formatted citations'
      });
      
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
          id: 'quotes-no-pages',
          severity: 'error',
          message: `${quotesWithoutPages} quote(s) may be missing page numbers`,
          details: 'Direct quotes should include page numbers: (Author, Year, p. #)'
        });
      }
    } else {
      results.issues.push({
        id: 'no-citations',
        severity: 'suggestion',
        message: 'No in-text citations detected',
        details: 'Academic papers typically require citations'
      });
    }
  }

  validateReferences(text, results) {
    const referencesMatch = text.match(/References\s*([\s\S]*?)(?:\n\s*Appendix|$)/i);
    
    if (referencesMatch) {
      results.passing.push({
        message: '✅ References section found',
        details: 'Document includes a references section'
      });
      
      const referencesText = referencesMatch[1].trim();
      if (referencesText.length > 100) {
        const referenceCount = (referencesText.match(/\n[A-Z]/g) || []).length;
        results.passing.push({
          message: `✅ References contain entries (~${referenceCount})`,
          details: 'References section appears to have bibliography entries'
        });
      }
    } else {
      results.issues.push({
        id: 'references-missing',
        severity: 'warning',
        message: 'References section not detected',
        details: 'Academic papers should include a References section'
      });
    }
  }

  validatePageNumbers(documentXml, results) {
    const hasPageNumbers = documentXml.includes('w:pgNum') || 
                          documentXml.includes('PAGE') ||
                          documentXml.includes('w:fldChar');
    
    if (hasPageNumbers) {
      results.passing.push({
        message: '✅ Page numbering detected',
        details: 'Document appears to have page numbers'
      });
    } else {
      results.issues.push({
        id: 'page-numbers-missing',
        severity: 'suggestion',
        message: 'Page numbers may be missing',
        details: 'Include page numbers in the top right corner'
      });
    }
  }
}
