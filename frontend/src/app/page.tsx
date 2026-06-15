"use client";

import { useState } from "react";
import "./globals.css";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [caseLaw, setCaseLaw] = useState("");
  const [provider, setProvider] = useState("openai");
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [loadingPrecedent, setLoadingPrecedent] = useState(false);
  
  // State for Caching
  const [extractedText, setExtractedText] = useState<string | null>(null);
  
  const [initialResults, setInitialResults] = useState<any>(null);
  const [strategyResults, setStrategyResults] = useState<any>(null);
  const [finalResults, setFinalResults] = useState<any>(null);
  
  // New States for Parties
  const [partyAEntities, setPartyAEntities] = useState<string[]>([]);
  const [partyBEntities, setPartyBEntities] = useState<string[]>([]);
  const [unassignedEntities, setUnassignedEntities] = useState<string[]>([]);
  const [newEntityText, setNewEntityText] = useState("");
  
  // New States for Precedent Upload
  const [precedentFiles, setPrecedentFiles] = useState<File[]>([]);
  const [loadingPrecedentExtract, setLoadingPrecedentExtract] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = "https://wp-res-backend-812016027146.us-central1.run.app";
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setInitialResults(null);
      setStrategyResults(null);
      setFinalResults(null);
      setCaseLaw("");
      setExtractedText(null);
      setPartyAEntities([]);
      setPartyBEntities([]);
      setUnassignedEntities([]);
      setNewEntityText("");
      setPrecedentFiles([]);
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProvider(e.target.value);
  };

  const handleInitialAnalyze = async () => {
    if (files.length === 0) {
      setError("Please select at least one document to analyze.");
      return;
    }
    
    setLoadingInitial(true);
    setError(null);
    setInitialResults(null);
    setStrategyResults(null);
    setFinalResults(null);
    
    try {
      let currentExtractedText = extractedText;
      
      // Step 1: Extract Text if we don't have it cached
      if (!currentExtractedText) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append("files", file);
        });

        const extractResponse = await fetch(`${API_BASE_URL}/api/extraction/extract`, {
          method: "POST",
          body: formData,
        });
        
        const extractData = await extractResponse.json();
        
        if (!extractResponse.ok || extractData.status !== "success") {
          throw new Error(extractData.detail || extractData.message || "Failed to extract text from document.");
        }
        
        currentExtractedText = extractData.data.extracted_text;
        setExtractedText(currentExtractedText);
      }

      // Step 2: Run Initial Analysis
      const analyzeResponse = await fetch(`${API_BASE_URL}/api/analysis/initial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          document_text: currentExtractedText,
          provider: provider
        }),
      });
      
      const analyzeData = await analyzeResponse.json();
      
      if (analyzeResponse.ok && analyzeData.status === "success") {
        setInitialResults(analyzeData.data);
        setPartyAEntities(analyzeData.data.suggested_party_a || []);
        setPartyBEntities(analyzeData.data.suggested_party_b || []);
        setUnassignedEntities(analyzeData.data.unassigned_entities || []);
      } else {
        throw new Error(analyzeData.detail || analyzeData.message || "An error occurred during initial analysis.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to the backend server. Make sure it is running.");
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleStrategyAnalyze = async () => {
    if (!initialResults?.phase_3 || !initialResults?.phase_4) {
      setError("Please run the initial analysis first.");
      return;
    }
    if (partyAEntities.length === 0 || partyBEntities.length === 0) {
      setError("Please specify at least one entity for both Party A and Party B.");
      return;
    }

    setLoadingStrategy(true);
    setError(null);
    setStrategyResults(null);
    setFinalResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analysis/strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phase_3: initialResults.phase_3,
          phase_4: initialResults.phase_4,
          party_a: partyAEntities.join(", "),
          party_b: partyBEntities.join(", "),
          provider: provider
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === "success") {
        setStrategyResults(data.data);
      } else {
        throw new Error(data.detail || data.message || "An error occurred during strategy analysis.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to the backend server. Make sure it is running.");
    } finally {
      setLoadingStrategy(false);
    }
  };

  const handlePrecedentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPrecedentFiles(Array.from(e.target.files));
    }
  };

  const handlePrecedentAnalyze = async () => {
    if (!strategyResults?.phase_6) {
      setError("Please run the strategy analysis first.");
      return;
    }

    setLoadingPrecedent(true);
    setError(null);

    try {
      let summarizedPrecedentText = "";
      
      // Step 3a: Summarize precedent files if any are uploaded
      if (precedentFiles.length > 0) {
        const formData = new FormData();
        precedentFiles.forEach(file => {
          formData.append("files", file);
        });
        formData.append("provider", provider);

        const summaryResponse = await fetch(`${API_BASE_URL}/api/extraction/summarize-precedents`, {
          method: "POST",
          body: formData,
        });
        
        const summaryData = await summaryResponse.json();
        
        if (!summaryResponse.ok || summaryData.status !== "success") {
          throw new Error(summaryData.detail || summaryData.message || "Failed to summarize precedent documents.");
        }
        
        summarizedPrecedentText = summaryData.data.summarized_text;
      }
      
      // Combine manual context and AI-summarized precedents
      let combinedContext = "";
      if (caseLaw.trim()) {
        combinedContext += `Additional Case Context Provided by User:\n${caseLaw.trim()}\n\n`;
      }
      if (summarizedPrecedentText) {
        combinedContext += `Summarized Precedents Extracted from Uploaded Files:\n${summarizedPrecedentText}\n\n`;
      }

      // Step 3b: Run Final Precedent Matching
      const response = await fetch(`${API_BASE_URL}/api/analysis/precedent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phase_6: strategyResults.phase_6,
          case_law_context: combinedContext,
          provider: provider
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.status === "success") {
        setFinalResults(data.data);
      } else {
        throw new Error(data.detail || data.message || "An error occurred during precedent analysis.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to the backend server. Make sure it is running.");
    } finally {
      setLoadingPrecedent(false);
    }
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleDownloadWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Legal Analysis</title></head><body>";
    const footer = "</body></html>";
    let content = "<h1>Legal Case Strategist Analysis</h1>";
    
    if (initialResults) {
      content += "<h2>Phase 1: Raw Fact Extraction</h2><p>" + initialResults.phase_1.replace(/\n/g, "<br>") + "</p>";
      content += "<h2>Phase 2: Narrative Mapping</h2><p>" + initialResults.phase_2.replace(/\n/g, "<br>") + "</p>";
      content += "<h2>Phase 3: Objective Formalization</h2><p>" + initialResults.phase_3.replace(/\n/g, "<br>") + "</p>";
      content += "<h2>Phase 4: Regulatory Mapping</h2><p>" + initialResults.phase_4.replace(/\n/g, "<br>") + "</p>";
    }
    if (strategyResults) {
      content += "<h2>Phase 5: Critical Vulnerability (SWOT)</h2><p>" + strategyResults.phase_5.replace(/\n/g, "<br>") + "</p>";
      content += "<h2>Phase 6: Adversarial Strategy</h2><p>" + strategyResults.phase_6.replace(/\n/g, "<br>") + "</p>";
      content += "<h2>Precedent Search Terms Suggested</h2><p>" + strategyResults.search_terms.replace(/\n/g, "<br>") + "</p>";
    }
    if (finalResults) {
      content += "<h2>Phase 7: Precedent Matching</h2><p>" + finalResults.phase_7.replace(/\n/g, "<br>") + "</p>";
    }
    
    const html = header + content + footer;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Legal_Analysis.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="container">
      <header style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }} className="no-print">
          <button className="btn" onClick={handleDownloadPDF} style={{ backgroundColor: "#3b82f6" }}>Download PDF</button>
          <button className="btn" onClick={handleDownloadWord} style={{ backgroundColor: "#2563eb" }}>Download Word</button>
        </div>
        <h1 className="title">Legal Case Strategist</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1.2rem", marginBottom: "1rem" }} className="no-print">
          Interactive 3-Step Document Analysis Workflow
        </p>
        <div className="no-print" style={{ display: "inline-block", backgroundColor: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <label htmlFor="provider-select" style={{ marginRight: "1rem", fontWeight: "bold" }}>AI Provider:</label>
          <select 
            id="provider-select" 
            value={provider} 
            onChange={handleProviderChange}
            style={{ padding: "0.5rem", borderRadius: "4px", backgroundColor: "var(--bg-color)", color: "var(--text-primary)", border: "1px solid var(--primary-color)" }}
          >
            <option value="openai">OpenAI (GPT-4o-mini)</option>
            <option value="google">Google Cloud (Gemini 1.5 Flash)</option>
          </select>
        </div>
      </header>

      {/* Step 1 */}
      <section className="card no-print" style={{ textAlign: "center", padding: "3rem", marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Step 1: Upload Exhibits & Facts Analysis</h2>
        <input 
          type="file" 
          multiple
          onChange={handleFileUpload}
          style={{ display: "none" }}
          id="file-upload"
        />
        <label htmlFor="file-upload" className="btn" style={{ display: "inline-block", cursor: "pointer", marginRight: "1rem" }}>
          Select Document(s)
        </label>
        
        {files.length > 0 && (
          <div style={{ marginTop: "1.5rem", textAlign: "left", display: "inline-block" }}>
            <p style={{ color: "var(--success)", fontWeight: "bold", marginBottom: "0.5rem" }}>
              {files.length} Document(s) Selected:
            </p>
            <ul style={{ color: "var(--text-secondary)", listStyleType: "circle", paddingLeft: "1.5rem" }}>
              {files.map((f, i) => (
                <li key={i}>{f.name}</li>
              ))}
            </ul>
          </div>
        )}

        {error && !initialResults && <p style={{ color: "#ef4444", margin: "1rem 0" }}>{error}</p>}

        <button 
          onClick={handleInitialAnalyze} 
          disabled={loadingInitial || files.length === 0}
          className="btn" 
          style={{ 
            width: "100%", 
            fontSize: "1.2rem", 
            padding: "1rem",
            marginTop: "2rem",
            opacity: (loadingInitial || files.length === 0) ? 0.5 : 1
          }}
        >
          {loadingInitial ? `Running Fact Extraction...` : `Run Fact Extraction (${provider === 'openai' ? 'OpenAI' : 'Google Gemini'})`}
        </button>
        {extractedText && !loadingInitial && (
          <p style={{ color: "var(--success)", fontSize: "0.9rem", marginTop: "1rem" }}>
            ✓ OCR Text Cached. Toggling the AI Provider will be instant!
          </p>
        )}
      </section>

      {/* Initial Results */}
      {initialResults && (
        <section className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "2rem", textAlign: "center", color: "var(--primary-color)" }}>Fact Analysis Complete ({provider.toUpperCase()})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {[
              { title: "Phase 1: Raw Fact Extraction", content: initialResults.phase_1 },
              { title: "Phase 2: Narrative Mapping", content: initialResults.phase_2 },
              { title: "Phase 3: Objective Formalization", content: initialResults.phase_3 },
              { title: "Phase 4: Regulatory Mapping", content: initialResults.phase_4 },
            ].map((phase, index) => (
              <div key={index} style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <h3 style={{ marginBottom: "1rem", color: "var(--primary-color)" }}>{phase.title}</h3>
                <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", lineHeight: "1.6" }}>
                  {phase.content}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 */}
      {initialResults && (
        <section className="card no-print" style={{ textAlign: "center", padding: "3rem", marginBottom: "2rem", border: "2px solid var(--secondary-color)" }}>
          <h2 style={{ marginBottom: "1.5rem" }}>Step 2: Assign Parties for Strategy</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", fontSize: "1rem" }}>
            The AI has intelligently grouped the entities found in your document into primary opposing sides.
            You can move entities between the boxes, remove irrelevant ones, or manually add completely new entities below to perfect the opposing sides.
          </p>
          
          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "2rem", gap: "1.5rem", flexWrap: "wrap", alignItems: "stretch" }}>
            {/* Party A Box */}
            <div style={{ flex: 1, minWidth: "280px", backgroundColor: "rgba(59, 130, 246, 0.05)", border: "1px solid #3b82f6", borderRadius: "8px", padding: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "#3b82f6" }}>Party A (e.g. Petitioner/Claimant)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {partyAEntities.map((entity, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-color)", padding: "0.5rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", fontSize: "0.9rem" }}>
                    <span style={{ textAlign: "left", flex: 1, marginRight: "0.5rem" }}>{entity}</span>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button onClick={() => {
                        setPartyAEntities(partyAEntities.filter((_, idx) => idx !== i));
                        setUnassignedEntities([...unassignedEntities, entity]);
                      }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1.2rem", fontWeight: "bold" }} title="Remove to Unassigned">×</button>
                    </div>
                  </div>
                ))}
                {partyAEntities.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>No entities assigned</p>}
              </div>
            </div>

            {/* Unassigned Pool */}
            <div style={{ flex: 1, minWidth: "280px", backgroundColor: "rgba(255, 255, 255, 0.02)", border: "1px dashed var(--border-color)", borderRadius: "8px", padding: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>Unassigned / Ambiguous</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {unassignedEntities.map((entity, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-color)", padding: "0.5rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", fontSize: "0.9rem" }}>
                    <button onClick={() => {
                        setUnassignedEntities(unassignedEntities.filter((_, idx) => idx !== i));
                        setPartyAEntities([...partyAEntities, entity]);
                      }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: "1.2rem", fontWeight: "bold" }} title="Move to Party A">←</button>
                    <span style={{ textAlign: "center", flex: 1, margin: "0 0.5rem" }}>{entity}</span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => {
                          setUnassignedEntities(unassignedEntities.filter((_, idx) => idx !== i));
                          setPartyBEntities([...partyBEntities, entity]);
                        }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#10b981", fontSize: "1.2rem", fontWeight: "bold" }} title="Move to Party B">→</button>
                      <button onClick={() => {
                          setUnassignedEntities(unassignedEntities.filter((_, idx) => idx !== i));
                        }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1.2rem", fontWeight: "bold" }} title="Delete Permanently">×</button>
                    </div>
                  </div>
                ))}
                {unassignedEntities.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>No unassigned entities</p>}
              </div>
            </div>

            {/* Party B Box */}
            <div style={{ flex: 1, minWidth: "280px", backgroundColor: "rgba(16, 185, 129, 0.05)", border: "1px solid #10b981", borderRadius: "8px", padding: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "#10b981" }}>Party B (e.g. Respondent/Defendant)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {partyBEntities.map((entity, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-color)", padding: "0.5rem 0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", fontSize: "0.9rem" }}>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button onClick={() => {
                        setPartyBEntities(partyBEntities.filter((_, idx) => idx !== i));
                        setUnassignedEntities([...unassignedEntities, entity]);
                      }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1.2rem", fontWeight: "bold" }} title="Remove to Unassigned">×</button>
                    </div>
                    <span style={{ textAlign: "right", flex: 1, marginLeft: "0.5rem" }}>{entity}</span>
                  </div>
                ))}
                {partyBEntities.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>No entities assigned</p>}
              </div>
            </div>
          </div>

          {/* Manual Entity Addition */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem", display: "inline-block" }}>
            <h4 style={{ marginBottom: "1rem" }}>Missing an entity? Add it manually:</h4>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <input 
                type="text" 
                value={newEntityText} 
                onChange={(e) => setNewEntityText(e.target.value)} 
                placeholder="Type entity name..." 
                style={{ minWidth: "300px", padding: "0.75rem", borderRadius: "4px", backgroundColor: "var(--bg-color)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }} 
              />
              <button 
                onClick={() => {
                  if (newEntityText.trim()) {
                    setPartyAEntities([...partyAEntities, newEntityText.trim()]);
                    setNewEntityText("");
                  }
                }}
                className="btn"
                style={{ padding: "0.75rem 1rem", backgroundColor: "#3b82f6", fontSize: "0.9rem" }}
              >
                + Add to Party A
              </button>
              <button 
                onClick={() => {
                  if (newEntityText.trim()) {
                    setPartyBEntities([...partyBEntities, newEntityText.trim()]);
                    setNewEntityText("");
                  }
                }}
                className="btn"
                style={{ padding: "0.75rem 1rem", backgroundColor: "#10b981", fontSize: "0.9rem" }}
              >
                + Add to Party B
              </button>
            </div>
          </div>

          {error && initialResults && !strategyResults && <p style={{ color: "#ef4444", margin: "1rem 0" }}>{error}</p>}

          <button 
            onClick={handleStrategyAnalyze} 
            disabled={loadingStrategy || partyAEntities.length === 0 || partyBEntities.length === 0}
            className="btn" 
            style={{ 
              width: "100%", 
              fontSize: "1.2rem", 
              padding: "1rem",
              backgroundColor: "var(--secondary-color)",
              opacity: (loadingStrategy || partyAEntities.length === 0 || partyBEntities.length === 0) ? 0.5 : 1
            }}
          >
            {loadingStrategy ? "Generating Strategy..." : "Run Strategy & SWOT Analysis"}
          </button>
        </section>
      )}

      {/* Strategy Results */}
      {strategyResults && (
        <section className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "2rem", textAlign: "center", color: "var(--primary-color)" }}>Strategy Analysis Complete</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {[
              { title: "Phase 5: Critical Vulnerability (SWOT)", content: strategyResults.phase_5 },
              { title: "Phase 6: Adversarial Strategy", content: strategyResults.phase_6 },
              { title: "Suggested Precedent Search Terms", content: strategyResults.search_terms }
            ].map((phase, index) => (
              <div key={index} style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <h3 style={{ marginBottom: "1rem", color: index === 2 ? "var(--warning)" : "var(--primary-color)" }}>{phase.title}</h3>
                <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", lineHeight: "1.6" }}>
                  {phase.content}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 3 */}
      {strategyResults && (
        <section className="card no-print" style={{ textAlign: "center", padding: "3rem", marginBottom: "2rem", border: "2px solid var(--primary-color)" }}>
          <h2 style={{ marginBottom: "1.5rem" }}>Step 3: Precedent Matching</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1rem", fontSize: "1rem" }}>
            Use the <strong>Suggested Search Terms</strong> above to find relevant precedents.
          </p>
          
          <div style={{ textAlign: "left", marginBottom: "1rem" }}>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "0.5rem" }}>Additional Case Context (Optional)</label>
            <textarea 
              value={caseLaw}
              onChange={(e) => setCaseLaw(e.target.value)}
              placeholder="Type any specific inputs or wider context about the case here. Do NOT paste raw precedent case laws here..."
              style={{
                width: "100%",
                height: "120px",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                resize: "vertical",
                fontSize: "1rem"
              }}
            />
          </div>

          {/* File Upload for Precedent */}
          <div style={{ marginBottom: "2rem", textAlign: "left", backgroundColor: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <p style={{ marginBottom: "1rem", fontWeight: "bold" }}>Upload Precedent Case Laws (Optional)</p>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1rem", fontSize: "0.9rem" }}>
              The AI will automatically extract and summarize only the relevant judgements and reasons to preserve tokens.
            </p>
            <input 
              type="file" 
              multiple
              onChange={handlePrecedentFileUpload}
              style={{ display: "none" }}
              id="precedent-file-upload"
            />
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <label htmlFor="precedent-file-upload" className="btn" style={{ cursor: "pointer", backgroundColor: "var(--primary-color)" }}>
                Select Precedent Files
              </label>
              
              {precedentFiles.length > 0 && (
                <span style={{ color: "var(--success)", fontWeight: "bold" }}>{precedentFiles.length} file(s) selected</span>
              )}
            </div>
          </div>

          {error && strategyResults && <p style={{ color: "#ef4444", margin: "1rem 0" }}>{error}</p>}

          <button 
            onClick={handlePrecedentAnalyze} 
            disabled={loadingPrecedent}
            className="btn" 
            style={{ 
              width: "100%", 
              fontSize: "1.2rem", 
              padding: "1rem",
              backgroundColor: "var(--success)",
              opacity: loadingPrecedent ? 0.5 : 1
            }}
          >
            {loadingPrecedent ? "Processing Precedents & Matching..." : "Run Phase 7: Precedent Matching"}
          </button>
        </section>
      )}

      {/* Final Results */}
      {finalResults && (
        <section className="card">
          <h2 style={{ marginBottom: "2rem", textAlign: "center", color: "var(--success)" }}>Final Strategy Generated</h2>
          <div style={{ padding: "1.5rem", border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.02)" }}>
            <h3 style={{ marginBottom: "1rem", color: "var(--primary-color)" }}>Phase 7: Precedent Matching</h3>
            <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", lineHeight: "1.6" }}>
              {finalResults.phase_7}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
