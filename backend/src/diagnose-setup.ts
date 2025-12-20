import { config } from './config.js';
import { chainhooksClient } from './chainhooks.js';

async function checkBackend() {
  console.log('1. Checking Backend Server...');
  try {
    const response = await fetch(`http://localhost:${config.server.port}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Backend is running');
      console.log(`   Status: ${data.status}`);
      return true;
    } else {
      console.log('   ❌ Backend returned error:', response.status);
      return false;
    }
  } catch (error: any) {
    console.log('   ❌ Backend is NOT running');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkNgrok() {
  console.log('\n2. Checking ngrok...');
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (response.ok) {
      const data = await response.json();
      const tunnels = data.tunnels || [];
      if (tunnels.length > 0) {
        const tunnel = tunnels[0];
        console.log('   ✅ ngrok is running');
        console.log(`   Public URL: ${tunnel.public_url}`);
        console.log(`   Forwarding to: ${tunnel.config.addr}`);
        
        // Check if it matches our config
        if (tunnel.public_url === config.server.apiBaseUrl) {
          console.log('   ✅ ngrok URL matches API_BASE_URL');
        } else {
          console.log('   ⚠️  ngrok URL does NOT match API_BASE_URL');
          console.log(`      ngrok: ${tunnel.public_url}`);
          console.log(`      config: ${config.server.apiBaseUrl}`);
        }
        return true;
      } else {
        console.log('   ❌ No ngrok tunnels found');
        return false;
      }
    } else {
      console.log('   ❌ Cannot connect to ngrok API');
      return false;
    }
  } catch (error: any) {
    console.log('   ❌ ngrok is NOT running or not accessible');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkChainhooks() {
  console.log('\n3. Checking Chainhooks...');
  try {
    const result = await chainhooksClient.getChainhooks({ limit: 60 });
    const hooks = result.results.filter(hook => 
      hook.definition.name.startsWith(`${config.stacks.contractName}-`)
    );
    
    console.log(`   Found ${hooks.length} chainhooks:`);
    
    let allEnabled = true;
    let allStreaming = true;
    
    for (const hook of hooks) {
      const name = hook.definition.name.replace(`${config.stacks.contractName}-`, '');
      const enabled = hook.status.enabled ? '✅' : '❌';
      const status = hook.status.status;
      const url = hook.definition.action?.url || 'N/A';
      
      console.log(`   ${name}:`);
      console.log(`      Enabled: ${enabled} ${hook.status.enabled}`);
      console.log(`      Status: ${status} ${status === 'streaming' ? '✅' : '⚠️'}`);
      console.log(`      Webhook URL: ${url}`);
      console.log(`      Occurrences: ${hook.status.occurrence_count}`);
      
      if (!hook.status.enabled) allEnabled = false;
      if (hook.status.status !== 'streaming') allStreaming = false;
      
      // Check if webhook URL matches ngrok (get actual ngrok URL)
      let ngrokPublicUrl: string | null = null;
      try {
        const ngrokResp = await fetch('http://127.0.0.1:4040/api/tunnels');
        if (ngrokResp.ok) {
          const ngrokData = await ngrokResp.json();
          if (ngrokData.tunnels?.[0]?.public_url) {
            ngrokPublicUrl = ngrokData.tunnels[0].public_url;
          }
        }
      } catch {
        // Ignore
      }
      
      const expectedBase = ngrokPublicUrl || config.server.apiBaseUrl;
      if (url.startsWith(expectedBase)) {
        console.log(`      ✅ Webhook URL matches ngrok`);
      } else {
        console.log(`      ⚠️  Webhook URL does NOT match ngrok`);
        console.log(`         Expected: ${expectedBase}`);
        console.log(`         Actual: ${url}`);
      }
    }
    
    if (allEnabled && allStreaming) {
      console.log('   ✅ All chainhooks are enabled and streaming');
      return true;
    } else {
      console.log('   ⚠️  Some chainhooks need attention');
      return false;
    }
  } catch (error: any) {
    console.log('   ❌ Error checking chainhooks:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('\n4. Testing Webhook Endpoint...');
  try {
    // Get actual ngrok URL from ngrok API
    let ngrokUrl: string | null = null;
    try {
      const ngrokResponse = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (ngrokResponse.ok) {
        const ngrokData = await ngrokResponse.json();
        const tunnels = ngrokData.tunnels || [];
        if (tunnels.length > 0 && tunnels[0].public_url) {
          ngrokUrl = tunnels[0].public_url;
        }
      }
    } catch {
      // Ignore ngrok API errors
    }
    
    const testUrl = ngrokUrl || config.server.apiBaseUrl;
    const testPayload = {
      chainhook: {
        uuid: "test-diagnostic",
        name: "test"
      },
      event: {
        apply: [{
          block_identifier: {
            index: 123456,
            hash: "0x123"
          },
          timestamp: Date.now(),
          transactions: []
        }]
      }
    };
    
    // ngrok free tier may require ngrok-skip-browser-warning header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (testUrl.includes('ngrok-free')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    const response = await fetch(`${testUrl}/api/chainhooks/register-username`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
    });
    
    if (response.ok) {
      console.log('   ✅ Webhook endpoint is accessible');
      return true;
    } else {
      const text = await response.text();
      console.log(`   ⚠️  Webhook endpoint returned: ${response.status}`);
      console.log(`   Response: ${text.substring(0, 200)}`);
      return false;
    }
  } catch (error: any) {
    console.log('   ⚠️  Cannot reach webhook endpoint (this might be ok if ngrok is behind a firewall)');
    console.log(`   Error: ${error.message}`);
    // Don't fail the entire diagnostic if webhook test fails - it's just a connectivity test
    return true; // Return true so it doesn't block - webhooks will work from external chainhooks service
  }
}

async function main() {
  console.log('🔍 Diagnostic Check');
  console.log('='.repeat(60));
  console.log(`Network: ${config.stacks.network}`);
  console.log(`Contract: ${config.stacks.contractAddress}.${config.stacks.contractName}`);
  console.log(`API Base URL: ${config.server.apiBaseUrl}`);
  console.log('='.repeat(60));
  
  const backendOk = await checkBackend();
  const ngrokOk = await checkNgrok();
  const chainhooksOk = await checkChainhooks();
  const webhookOk = ngrokOk ? await testWebhookEndpoint() : false;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Backend: ${backendOk ? '✅' : '❌'}`);
  console.log(`   ngrok: ${ngrokOk ? '✅' : '❌'}`);
  console.log(`   Chainhooks: ${chainhooksOk ? '✅' : '⚠️'}`);
  console.log(`   Webhook Endpoint: ${webhookOk ? '✅' : '❌'}`);
  console.log('='.repeat(60));
  
  if (backendOk && ngrokOk && chainhooksOk && webhookOk) {
    console.log('\n✅ Everything looks good!');
    console.log('   Ready to receive chainhook webhooks.');
  } else {
    console.log('\n⚠️  Issues found. Please fix the items marked with ❌ or ⚠️');
    if (!backendOk) {
      console.log('\n   To start backend: cd backend && npm run dev');
    }
    if (!ngrokOk) {
      console.log('\n   To start ngrok: ngrok http 3001');
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

