#!/usr/bin/env node

/**
 * Pieces API Diagnostic Tool
 * 
 * Run this script to test all Pieces APIs and see what's working
 * Usage: node diagnose-pieces-api.js
 */

const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');

class PiecesDiagnostics {
  constructor() {
    this.results = [];
    this.configuration = null;
    this.port = null;
  }

  log(category, message, status = 'info') {
    const icon = status === 'success' ? '✓' : status === 'error' ? '✗' : status === 'warning' ? '⚠' : 'ℹ';
    console.log(`${icon} [${category}] ${message}`);
    this.results.push({ category, message, status });
  }

  async discoverPort() {
    this.log('SETUP', 'Discovering Pieces OS port...', 'info');
    
    const ports = [1000, 39300, 5323];
    
    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}/.well-known/health`);
        if (response.ok) {
          const health = await response.text();
          if (health.includes('ok')) {
            this.port = port;
            this.log('SETUP', `Pieces OS found on port ${port}`, 'success');
            return port;
          }
        }
      } catch (e) {
        // Continue to next port
      }
    }
    
    this.log('SETUP', 'Pieces OS not found on any port', 'error');
    throw new Error('Pieces OS not running');
  }

  async testConnection() {
    console.log('\n========================================');
    console.log('1. Testing Connection');
    console.log('========================================\n');
    
    try {
      this.port = await this.discoverPort();
      this.configuration = new pieces.Configuration({
        basePath: `http://localhost:${this.port}`
      });
      
      const wellKnownApi = new pieces.WellKnownApi(this.configuration);
      const health = await wellKnownApi.getWellKnownHealth();
      
      this.log('CONNECTION', `Health check: ${health}`, 'success');
      return true;
    } catch (error) {
      this.log('CONNECTION', error.message, 'error');
      return false;
    }
  }

  async testApplicationRegistration() {
    console.log('\n========================================');
    console.log('2. Testing Application Registration');
    console.log('========================================\n');
    
    try {
      const connectorApi = new pieces.ConnectorApi(this.configuration);
      
      const platform = os.platform();
      const platformEnum = platform === 'darwin' ? 'Macos' : 
                          platform === 'win32' ? 'Windows' : 'Linux';
      
      const result = await connectorApi.connect({
        seededConnectorConnection: {
          application: {
            name: 'DiagnosticTool',
            version: '1.0.0',
            platform: platformEnum
          }
        }
      });
      
      this.log('REGISTRATION', 'Application registered successfully', 'success');
      return true;
    } catch (error) {
      this.log('REGISTRATION', error.message, 'error');
      return false;
    }
  }

  async testAssetsAPI() {
    console.log('\n========================================');
    console.log('3. Testing Assets API');
    console.log('========================================\n');
    
    try {
      const assetsApi = new pieces.AssetsApi(this.configuration);
      const snapshot = await assetsApi.assetsSnapshot({});
      
      const count = snapshot.iterable?.length || 0;
      this.log('ASSETS', `Retrieved ${count} assets`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstAsset = snapshot.iterable[0];
        this.log('ASSETS', `First asset: "${firstAsset.name}"`, 'info');
        this.log('ASSETS', `Has classification: ${!!firstAsset.original?.reference?.classification}`, 'info');
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('ASSETS', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async testWorkstreamSummariesAPI() {
    console.log('\n========================================');
    console.log('4. Testing Workstream Summaries API');
    console.log('========================================\n');
    
    try {
      const summariesApi = new pieces.WorkstreamSummariesApi(this.configuration);
      const snapshot = await summariesApi.workstreamSummariesSnapshot({
        transferables: true
      });
      
      const count = snapshot.iterable?.length || 0;
      this.log('WORKSTREAM', `Found ${count} workstream summaries`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        // Test annotation fetching
        const annotationApi = new pieces.AnnotationApi(this.configuration);
        const firstSummary = snapshot.iterable[0];
        
        this.log('WORKSTREAM', `First summary ID: ${firstSummary.id}`, 'info');
        this.log('WORKSTREAM', `Has annotations: ${!!firstSummary.annotations?.iterable?.length}`, 'info');
        
        if (firstSummary.annotations?.iterable?.length > 0) {
          try {
            const annotationRef = firstSummary.annotations.iterable[0];
            const annotation = await annotationApi.annotationSpecificAnnotationSnapshot(annotationRef.id);
            
            this.log('WORKSTREAM', `Annotation type: ${annotation.type}`, 'info');
            this.log('WORKSTREAM', `Has content: ${!!annotation.text}`, annotation.text ? 'success' : 'warning');
            
            if (annotation.text) {
              this.log('WORKSTREAM', `Content preview: "${annotation.text.substring(0, 100)}..."`, 'info');
            }
          } catch (e) {
            this.log('WORKSTREAM', `Failed to fetch annotation: ${e.message}`, 'error');
          }
        }
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('WORKSTREAM', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async testActivitiesAPI() {
    console.log('\n========================================');
    console.log('5. Testing Activities API');
    console.log('========================================\n');
    
    try {
      const activitiesApi = new pieces.ActivitiesApi(this.configuration);
      const snapshot = await activitiesApi.activitiesSnapshot({});
      
      const count = snapshot.iterable?.length || 0;
      this.log('ACTIVITIES', `Found ${count} activities`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstActivity = snapshot.iterable[0];
        this.log('ACTIVITIES', `First activity app: ${firstActivity.application?.name || 'unknown'}`, 'info');
        this.log('ACTIVITIES', `Has event data: ${!!firstActivity.event}`, 'info');
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('ACTIVITIES', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async testWPEAPI() {
    console.log('\n========================================');
    console.log('6. Testing WPE (Vision) API');
    console.log('========================================\n');
    
    try {
      const wpeApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
      
      // Check status
      const status = await wpeApi.workstreamPatternEngineProcessorsVisionStatus();
      this.log('WPE', `Vision status: ${status.vision ? 'ACTIVE' : 'INACTIVE'}`, status.vision ? 'success' : 'warning');
      
      if (!status.vision) {
        this.log('WPE', 'Attempting to activate...', 'info');
        try {
          await wpeApi.workstreamPatternEngineProcessorsVisionActivate();
          this.log('WPE', 'Activation requested', 'success');
        } catch (e) {
          this.log('WPE', `Activation failed: ${e.message}`, 'error');
        }
      }
      
      // Try to fetch events WITH transferables
      this.log('WPE', 'Fetching vision events with transferables...', 'info');
      const snapshot = await wpeApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
        transferables: true
      });
      
      const count = snapshot.iterable?.length || 0;
      this.log('WPE', `Found ${count} vision events`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstEvent = snapshot.iterable[0];
        this.log('WPE', `First event app: ${firstEvent.application?.name || 'unknown'}`, 'info');
        this.log('WPE', `Has OCR text: ${!!firstEvent.textContent}`, firstEvent.textContent ? 'success' : 'warning');
        
        if (firstEvent.textContent) {
          this.log('WPE', `OCR preview: "${firstEvent.textContent.substring(0, 100)}..."`, 'info');
        }
      }
      
      return { success: true, active: status.vision, count };
    } catch (error) {
      this.log('WPE', error.message, 'error');
      return { success: false, active: false, count: 0 };
    }
  }

  async testConversationsAPI() {
    console.log('\n========================================');
    console.log('7. Testing Conversations API');
    console.log('========================================\n');
    
    try {
      const conversationsApi = new pieces.ConversationsApi(this.configuration);
      const snapshot = await conversationsApi.conversationsSnapshot({
        transferables: true
      });
      
      const count = snapshot.iterable?.length || 0;
      this.log('CONVERSATIONS', `Found ${count} conversations`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstConvo = snapshot.iterable[0];
        this.log('CONVERSATIONS', `First conversation: "${firstConvo.name || 'unnamed'}"`, 'info');
        this.log('CONVERSATIONS', `Message count: ${firstConvo.messages?.iterable?.length || 0}`, 'info');
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('CONVERSATIONS', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async testAnchorsAPI() {
    console.log('\n========================================');
    console.log('8. Testing Anchors API');
    console.log('========================================\n');
    
    try {
      const anchorsApi = new pieces.AnchorsApi(this.configuration);
      const snapshot = await anchorsApi.anchorsSnapshot({
        transferables: true
      });
      
      const count = snapshot.iterable?.length || 0;
      this.log('ANCHORS', `Found ${count} anchors`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstAnchor = snapshot.iterable[0];
        this.log('ANCHORS', `First anchor: "${firstAnchor.name || firstAnchor.fullpath || 'unnamed'}"`, 'info');
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('ANCHORS', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async testWebsitesAPI() {
    console.log('\n========================================');
    console.log('9. Testing Websites API');
    console.log('========================================\n');
    
    try {
      const websitesApi = new pieces.WebsitesApi(this.configuration);
      const snapshot = await websitesApi.websitesSnapshot({});
      
      const count = snapshot.iterable?.length || 0;
      this.log('WEBSITES', `Found ${count} websites`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstWebsite = snapshot.iterable[0];
        this.log('WEBSITES', `First website: "${firstWebsite.name || firstWebsite.url || 'unnamed'}"`, 'info');
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('WEBSITES', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async testQGPTAPI() {
    console.log('\n========================================');
    console.log('10. Testing QGPT (AI) API');
    console.log('========================================\n');
    
    try {
      const qgptApi = new pieces.QGPTApi(this.configuration);
      
      // Test simple question
      this.log('QGPT', 'Sending test question...', 'info');
      const result = await qgptApi.question({
        qGPTQuestionInput: {
          query: 'What is 2+2?',
          relevant: { iterable: [] }
        }
      });
      
      const answer = result.answers?.iterable?.[0]?.text || 'No answer';
      this.log('QGPT', `Response: "${answer.substring(0, 100)}"`, 'success');
      
      return { success: true };
    } catch (error) {
      this.log('QGPT', error.message, 'error');
      return { success: false };
    }
  }

  async testOCRAPI() {
    console.log('\n========================================');
    console.log('11. Testing OCR Analyses API');
    console.log('========================================\n');
    
    try {
      const ocrApi = new pieces.OCRAnalysesApi(this.configuration);
      const snapshot = await ocrApi.ocrAnalysesSnapshot({
        transferables: true
      });
      
      const count = snapshot.iterable?.length || 0;
      this.log('OCR', `Found ${count} OCR analyses`, count > 0 ? 'success' : 'warning');
      
      if (count > 0) {
        const firstOcr = snapshot.iterable[0];
        this.log('OCR', `Has text: ${!!firstOcr.raw}`, firstOcr.raw ? 'success' : 'warning');
      }
      
      return { success: true, count };
    } catch (error) {
      this.log('OCR', error.message, 'error');
      return { success: false, count: 0 };
    }
  }

  async runDiagnostics() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Pieces API Diagnostic Tool                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Pieces SDK: ${require('@pieces.app/pieces-os-client/package.json').version}`);
    console.log('');
    
    const connected = await this.testConnection();
    if (!connected) {
      console.log('\n❌ Pieces OS is not running. Please start Pieces OS first.');
      process.exit(1);
    }
    
    await this.testApplicationRegistration();
    
    const results = {
      assets: await this.testAssetsAPI(),
      workstreamSummaries: await this.testWorkstreamSummariesAPI(),
      activities: await this.testActivitiesAPI(),
      wpe: await this.testWPEAPI(),
      conversations: await this.testConversationsAPI(),
      anchors: await this.testAnchorsAPI(),
      websites: await this.testWebsitesAPI(),
      qgpt: await this.testQGPTAPI(),
      ocr: await this.testOCRAPI()
    };
    
    this.printSummary(results);
  }

  printSummary(results) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     DIAGNOSTIC SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    
    const working = [];
    const broken = [];
    const empty = [];
    
    Object.entries(results).forEach(([api, result]) => {
      if (!result.success) {
        broken.push(api);
      } else if (result.count === 0) {
        empty.push(api);
      } else {
        working.push(`${api} (${result.count} items)`);
      }
    });
    
    console.log('✅ Working APIs:');
    working.forEach(api => console.log(`   • ${api}`));
    
    console.log('\n⚠️  Empty (but working):');
    empty.forEach(api => console.log(`   • ${api}`));
    
    console.log('\n❌ Broken/Failed:');
    broken.forEach(api => console.log(`   • ${api}`));
    
    console.log('\n');
    console.log('========================================');
    console.log('KEY FINDINGS:');
    console.log('========================================');
    
    if (results.wpe.count === 0) {
      console.log('🔴 WPE (Vision/OCR): Not returning data');
      console.log('   → Ensure Pieces OS has screen recording permission');
      console.log('   → Check WPE is enabled in Pieces OS settings');
      console.log('   → On macOS: System Preferences > Security > Screen Recording');
    }
    
    if (results.workstreamSummaries.count === 0) {
      console.log('🟡 Workstream Summaries: No data');
      console.log('   → Use your computer for 30+ minutes with Pieces running');
      console.log('   → LTM needs time to generate summaries');
    }
    
    if (results.activities.count === 0) {
      console.log('🟡 Activities: No data');
      console.log('   → Pieces tracks activities over time');
      console.log('   → Work normally and check back later');
    }
    
    console.log('');
  }
}

// Run diagnostics
const diagnostics = new PiecesDiagnostics();
diagnostics.runDiagnostics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
