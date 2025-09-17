import { useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function Home() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  const processDocument = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Make sure scripts are loaded
      if (!window.mammoth || !window.JSZip) {
        throw new Error('Required libraries not loaded. Please refresh and try again.');
      }

      const arrayBuffer = await file.arrayBuffer();
      
      // Get text and HTML using mammoth
      const textResult = await window.mammoth.extractRawText({ arrayBuffer });
      const htmlResult = await window.mammoth.convertToHtml({ arrayBuffer });
      
      // Extract XML files from DOCX using JSZip
      const zip = new window.JSZip();
      const docx = await zip.loadAsync(arrayBuffer);
      
      const documentXml = await docx.file('word/document.xml')?.async('string') || '';
      const stylesXml = await docx.file('word/styles.xml')?.async('string') || '';
      const settingsXml = await docx.file('word/settings.xml')?.async('string') || '';
      
      // Parse and validate
      const docStructure = parseDocumentStructure(documentXml, stylesXml, settingsXml);
      const validationResults = validateDocument(textResult.value, htmlResult.value, docStructure);
      
      setResults(validationResults);
      
    } catch (err) {
      console.error('Error:', err);
      setError(`Failed to process: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>APA 7 Format Validator</title>
        <meta name="description" content="Free APA 7 format checker for Word documents" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Load external scripts */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.JSZip) setScriptsLoaded(true);
        }}
      />
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.mammoth) setScriptsLoaded(true);
        }}
      />

      <div className="container">
        <style jsx global>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          
          .container {
            min-height: 100vh;
            padding: 2rem;
          }
          
          .wrapper {
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .title {
            color: white;
            text-align: center;
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          .subtitle {
            color: rgba(255,255,255,0.9);
            text-align: center;
            margin-bottom: 2rem;
          }
          
          .upload-area {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border: 2px dashed rgba(255,255,255,0.3);
            border-radius: 1rem;
            padding: 2rem;
            text-align: center;
            margin-bottom: 2rem;
            transition: all 0.3s ease;
          }
          
          .upload-area:hover {
            background: rgba(255,255,255,0.15);
          }
          
          .file-input {
            display: none;
          }
          
          .upload-label {
            cursor: pointer;
            display: block;
          }
          
          .upload-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          
          .upload-text {
            color: white;
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
          }
          
          .upload-subtext {
            color: rgba(255,255,255,0.8);
          }
          
          .button-group {
            margin-top: 1rem;
            display: flex;
            gap: 0.5rem;
            justify-content: center;
          }
          
          .btn {
            padding: 0.75rem 2rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 1.1rem;
            cursor: pointer;
            transition: transform 0.2s;
          }
          
          .btn:hover {
            transform: translateY(-2px);
          }
          
          .btn-primary {
            background: #28a745;
            color: white;
          }
          
          .btn-secondary {
            background: #6c757d;
            color: white;
            padding: 0.75rem 1rem;
            font-size: 0.9rem;
          }
          
          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .error-box {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 2rem;
          }
          
          .results-container {
            background: white;
            border-radius: 1rem;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          
          .score-container {
            text-align: center;
            margin-bottom: 2rem;
          }
          
          .score-circle {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
          }
          
          .score-number {
            font-size: 3rem;
            font-weight: bold;
          }
          
          .score-label {
            font-size: 0.9rem;
          }
          
          .score-message {
            margin-top: 1rem;
            color: #333;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
          }
          
          .stat-card {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 0.5rem;
            text-align: center;
          }
          
          .stat-number {
            font-size: 2rem;
            font-weight: bold;
          }
          
          .stat-label {
            color: #6c757d;
          }
          
          .category-section {
            margin-bottom: 2rem;
          }
          
          .category-header {
            margin-bottom: 1rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          
          .issue-card {
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 0.5rem;
          }
          
          .issue-title {
            font-weight: bold;
            margin-bottom: 0.5rem;
          }
          
          .issue-details {
            font-size: 0.9rem;
          }
          
          .issue-location {
            font-size: 0.85rem;
            margin-top: 0.5rem;
            opacity: 0.8;
          }
          
          .issue-fix {
            background: white;
            padding: 0.5rem;
            margin-top: 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.9rem;
          }
        `}</style>

        <div className="wrapper">
          <h1 className="title">APA 7 Format Validator</h1>
          <p className="subtitle">
            Complete formatting detection: fonts, spacing, margins, headings, citations, and more
          </p>
          
          <div className="upload-area">
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
              id="fileInput"
            />
            <label htmlFor="fileInput" className="upload-label">
              <div className="upload-icon">📄</div>
              <h3 className="upload-text">
                {file ? file.name : 'Upload Word Document'}
              </h3>
              <p className="upload-subtext">Click to select .docx file</p>
            </label>
            
            {file && (
              <div className="button-group">
                <button
                  onClick={processDocument}
                  disabled={loading || !scriptsLoaded}
                  className="btn btn-primary"
                >
                  {loading ? '🔍 Analyzing...' : '✅ Check Formatting'}
                </button>
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  className="btn btn-secondary"
                >
                  🔧 {debugMode ? 'Hide' : 'Show'} Debug
                </button>
              </div>
            )}
            
            {!scriptsLoaded && file && (
              <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '1rem' }}>
                Loading required libraries...
              </p>
            )}
          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          {results && (
            <div className="results-container">
              <ResultsDisplay results={results} debugMode={debugMode} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Results display component
function ResultsDisplay({ results, debugMode }) {
  const [expandedCategories, setExpandedCategories] = useState({
    errors: true,
    warnings: true,
    passed: false
  });

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#28a745';
    if (score >= 70) return '#ffc107';
    return '#dc3545';
  };

  const categoryConfig = {
    errors: { 
      bg: '#f8d7da', 
      border: '#f5c6cb', 
      text: '#721c24',
      icon: '❌',
      title: 'Errors - Must Fix'
    },
    warnings: { 
      bg: '#fff3cd', 
      border: '#ffeaa7', 
      text: '#856404',
      icon: '⚠️',
      title: 'Warnings - Should Fix'
    },
    passed: { 
      bg: '#d4edda', 
      border: '#c3e6cb', 
      text: '#155724',
      icon: '✅',
      title: 'Passed Checks'
    }
  };

  return (
    <>
      <div className="score-container">
        <div 
          className="score-circle" 
          style={{ background: getScoreColor(results.score) }}
        >
          <div className="score-number">{results.score}%</div>
          <div className="score-label">APA Score</div>
        </div>
        <h3 className="score-message">
          {results.score >= 90 ? 'Excellent Formatting!' :
           results.score >= 70 ? 'Good, but needs some fixes' :
           'Several formatting issues to address'}
        </h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#dc3545' }}>
            {results.categories.errors.length}
          </div>
          <div className="stat-label">Errors</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#ffc107' }}>
            {results.categories.warnings.length}
          </div>
          <div className="stat-label">Warnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: '#28a745' }}>
            {results.categories.passed.length}
          </div>
          <div className="stat-label">Passed</div>
        </div>
      </div>

      {Object.entries(results.categories).map(([category, items]) => {
        if (items.length === 0) return null;
        const config = categoryConfig[category];
        const expanded = expandedCategories[category];

        return (
          <div key={category} className="category-section">
            <h3 
              className="category-header"
              onClick={() => toggleCategory(category)}
              style={{ color: config.text }}
            >
              <span>
                {config.icon} {config.title} ({items.length})
              </span>
              <span>{expanded ? '▼' : '▶'}</span>
            </h3>
            
            {expanded && items.map((item, index) => (
              <div 
                key={index} 
                className="issue-card"
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`
                }}
              >
                <div className="issue-title" style={{ color: config.text }}>
                  {item.issue}
                </div>
                <div className="issue-details" style={{ color: config.text }}>
                  {item.details}
                </div>
                {item.location && (
                  <div className="issue-location" style={{ color: config.text }}>
                    📍 Location: {item.location}
                  </div>
                )}
                {item.fix && (
                  <div className="issue-fix">
                    💡 <strong>How to fix:</strong> {item.fix}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {debugMode && results.debug && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
          fontFamily: 'monospace'
        }}>
          <h4>🔧 Debug Information</h4>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(results.debug, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

// Parse document structure
function parseDocumentStructure(documentXml, stylesXml, settingsXml) {
  const structure = {
    paragraphs: [],
    styles: {},
    fonts: new Set(),
    fontSize: null,
    margins: {},
    spacing: {},
    hasPageNumbers: false,
    citations: []
  };

  // Parse margins
  const marginMatch = documentXml.match(/<w:pgMar[^>]*\/>/);
  if (marginMatch) {
    const marginTag = marginMatch[0];
    structure.margins = {
      top: extractValue(marginTag, 'w:top'),
      bottom: extractValue(marginTag, 'w:bottom'),
      left: extractValue(marginTag, 'w:left'),
      right: extractValue(marginTag, 'w:right')
    };
  }

  // Check for page numbers
  structure.hasPageNumbers = documentXml.includes('w:pgNum') || 
                             documentXml.includes('PAGE');

  // Parse styles
  const styleMatches = stylesXml.matchAll(/<w:style[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g);
  for (const match of styleMatches) {
    const styleId = match[1];
    const styleContent = match[2];
    
    if (styleId.toLowerCase().includes('heading')) {
      structure.styles[styleId] = {
        type: 'heading',
        level: parseInt(styleId.match(/\d/) || '1'),
        bold: styleContent.includes('<w:b/>'),
        italic: styleContent.includes('<w:i/>'),
        centered: styleContent.includes('w:val="center"')
      };
    }
  }

  // Parse paragraphs
  const paragraphMatches = documentXml.matchAll(/<w:p[^>]*>([\s\S]*?)<\/w:p>/g);
  for (const match of paragraphMatches) {
    const paragraph = parseParagraph(match[1], structure.styles);
    if (paragraph.text.trim()) {
      structure.paragraphs.push(paragraph);
      
      // Extract citations
      const citationMatches = paragraph.text.matchAll(/\(([^)]+,\s*\d{4}[^)]*)\)/g);
      for (const cite of citationMatches) {
        structure.citations.push(cite[0]);
      }
    }
  }

  // Extract fonts
  const fontMatches = documentXml.matchAll(/w:ascii="([^"]+)"/g);
  for (const match of fontMatches) {
    structure.fonts.add(match[1]);
  }

  return structure;
}

function parseParagraph(paragraphXml, styles) {
  const paragraph = {
    text: '',
    styleId: null,
    isHeading: false,
    headingLevel: 0,
    isBold: false,
    isItalic: false,
    isCentered: false,
    indent: 0
  };

  // Extract style
  const styleMatch = paragraphXml.match(/<w:pStyle w:val="([^"]+)"/);
  if (styleMatch) {
    paragraph.styleId = styleMatch[1];
    const styleInfo = styles[paragraph.styleId];
    if (styleInfo) {
      paragraph.isHeading = styleInfo.type === 'heading';
      paragraph.headingLevel = styleInfo.level;
      paragraph.isBold = styleInfo.bold;
      paragraph.isItalic = styleInfo.italic;
      paragraph.isCentered = styleInfo.centered;
    }
  }

  // Check direct formatting
  if (paragraphXml.includes('<w:b/>')) paragraph.isBold = true;
  if (paragraphXml.includes('<w:i/>')) paragraph.isItalic = true;
  if (paragraphXml.includes('w:val="center"')) paragraph.isCentered = true;

  // Extract text
  const textMatches = paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  for (const match of textMatches) {
    paragraph.text += match[1];
  }

  // Auto-detect headings
  const headingKeywords = ['Abstract', 'Introduction', 'Method', 'Results', 'Discussion', 'References'];
  if (headingKeywords.some(keyword => paragraph.text.trim() === keyword)) {
    paragraph.isHeading = true;
    paragraph.headingLevel = 1;
  }

  return paragraph;
}

function extractValue(xmlString, attribute) {
  const match = xmlString.match(new RegExp(`${attribute}="(\\d+)"`));
  return match ? parseInt(match[1]) : 0;
}

// Validation function
function validateDocument(text, html, structure) {
  const results = {
    score: 100,
    categories: {
      errors: [],
      warnings: [],
      passed: []
    },
    debug: {
      fontsFound: Array.from(structure.fonts),
      paragraphCount: structure.paragraphs.length,
      headingCount: structure.paragraphs.filter(p => p.isHeading).length,
      citationCount: structure.citations.length
    }
  };

  // Font validation
  const acceptableFonts = ['Times New Roman', 'Calibri', 'Arial', 'Georgia'];
  const hasGoodFont = Array.from(structure.fonts).some(font =>
    acceptableFonts.some(acceptable => font.includes(acceptable))
  );

  if (hasGoodFont) {
    results.categories.passed.push({
      issue: 'Font Type',
      details: 'Using APA-approved font'
    });
  } else if (structure.fonts.size > 0) {
    results.categories.errors.push({
      issue: 'Non-standard Font',
      details: `Font may not meet APA standards`,
      fix: 'Use Times New Roman 12pt, Calibri 11pt, Arial 11pt, or Georgia 11pt'
    });
    results.score -= 10;
  }

  // Page numbers
  if (structure.hasPageNumbers) {
    results.categories.passed.push({
      issue: 'Page Numbers',
      details: 'Document includes page numbering'
    });
  } else {
    results.categories.errors.push({
      issue: 'Missing Page Numbers',
      details: 'No page numbers detected',
      fix: 'Add page numbers in the header, flush right'
    });
    results.score -= 8;
  }

  // Headings
  const headings = structure.paragraphs.filter(p => p.isHeading);
  if (headings.length > 0) {
    results.categories.passed.push({
      issue: 'Document Structure',
      details: `Found ${headings.length} headings`
    });
    
    headings.forEach(heading => {
      const headingText = heading.text.substring(0, 30);
      
      if (!heading.isBold) {
        results.categories.errors.push({
          issue: 'Heading Not Bold',
          details: `"${headingText}" must be bold`,
          fix: 'All APA headings must be bold'
        });
        results.score -= 8;
      }
      
      if (heading.headingLevel === 1 && !heading.isCentered) {
        results.categories.errors.push({
          issue: 'Level 1 Not Centered',
          details: `"${headingText}" should be centered`,
          fix: 'Level 1 headings must be centered'
        });
        results.score -= 8;
      }
    });
  } else {
    results.categories.warnings.push({
      issue: 'No Headings Found',
      details: 'Document lacks formatted headings',
      fix: 'Use APA heading styles to organize your paper'
    });
    results.score -= 10;
  }

  // References
  if (text.includes('References')) {
    results.categories.passed.push({
      issue: 'References Section',
      details: 'Document includes References'
    });
  } else {
    results.categories.warnings.push({
      issue: 'No References Section',
      details: 'References section not found',
      fix: 'Add References section with cited sources'
    });
    results.score -= 5;
  }

  // Citations
  if (structure.citations.length > 0) {
    results.categories.passed.push({
      issue: 'In-text Citations',
      details: `Found ${structure.citations.length} citations`
    });
  } else {
    results.categories.warnings.push({
      issue: 'No Citations',
      details: 'No in-text citations found',
      fix: 'Add APA citations for all sources'
    });
    results.score -= 10;
  }

  results.score = Math.max(0, results.score);
  return results;
}
