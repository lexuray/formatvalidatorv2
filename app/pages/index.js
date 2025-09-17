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

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
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
        <title>APA 7 Validator - Professional Edition</title>
        <meta name="description" content="Professional APA 7 formatting validation" />
      </Head>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem', color: 'white' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: '700', textShadow: '0 4px 8px rgba(0,0,0,0.3)', marginBottom: '1rem' }}>
            APA 7 Formatter & Validator
          </h1>
          <p style={{ fontSize: '1.5rem', opacity: '0.9' }}>
            Professional-grade APA formatting validation with accurate Word document analysis
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
              onClick={handleUpload}
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
              {loading ? 'Analyzing Document...' : 'Validate APA Formatting'}
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
            Error: {error}
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

            {/* Download Reports */}
            <div style={{ 
              marginTop: '2rem', 
              paddingTop: '2rem', 
              borderTop: '1px solid #dee2e6',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button style={{
                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                📄 Download Detailed Report
              </button>
              <button style={{
                background: 'white',
                color: '#667eea',
                border: '2px solid #667eea',
                padding: '1rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                💡 Download APA Guide
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
