const https = require('https');

// Test the public endpoints that the athlete event details component will use
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'h5c4i3jvn5.execute-api.us-east-2.amazonaws.com',
      port: 443,
      path: `/prod${path}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testPublicEventDetails() {
  console.log('🧪 Testing Existing Public Event Details Access\n');
  
  const eventId = 'evt-1761359596294'; // ElLab event
  
  try {
    // Test 1: Public event access (this should work)
    console.log('1. Testing /public/events/{eventId}...');
    const eventResult = await makeRequest(`/public/events/${eventId}`);
    console.log(`   Status: ${eventResult.status}`);
    if (eventResult.status === 200) {
      console.log(`   ✅ Event: ${eventResult.data.name}`);
      console.log(`   📅 Date: ${eventResult.data.startDate}`);
      console.log(`   📍 Location: ${eventResult.data.location}`);
      console.log(`   🔓 Published: ${eventResult.data.published}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(eventResult.data)}`);
    }
    
    // Test 2: Check existing public scores endpoint
    console.log('\n2. Testing existing /public/scores endpoint...');
    const scoresResult = await makeRequest(`/public/scores?eventId=${eventId}`);
    console.log(`   Status: ${scoresResult.status}`);
    if (scoresResult.status === 200) {
      console.log(`   ✅ Scores available (${Array.isArray(scoresResult.data) ? scoresResult.data.length : 'object'} items)`);
    } else {
      console.log(`   ❌ Error: ${JSON.stringify(scoresResult.data)}`);
    }
    
    // Test 3: Check if we need to make categories and wods public
    console.log('\n3. Testing endpoints that may need to be made public...');
    
    const endpoints = [
      { name: 'Categories', path: `/categories?eventId=${eventId}` },
      { name: 'WODs', path: `/wods?eventId=${eventId}` },
      { name: 'Athletes', path: '/athletes' }
    ];
    
    for (const endpoint of endpoints) {
      const result = await makeRequest(endpoint.path);
      console.log(`   ${endpoint.name}: Status ${result.status}`);
      if (result.status === 200) {
        console.log(`     ✅ Data available (${Array.isArray(result.data) ? result.data.length : 'object'} items)`);
      } else if (result.status === 401 || result.status === 403) {
        console.log(`     🔒 Requires authentication - needs public endpoint`);
      } else {
        console.log(`     ❌ Error: ${JSON.stringify(result.data)}`);
      }
    }
    
    console.log('\n📋 Current Status:');
    console.log('   ✅ /public/events/{id} - Working');
    console.log('   ✅ /public/scores - Already exists');
    console.log('   🔒 /categories - Needs public access');
    console.log('   🔒 /wods - Needs public access');
    console.log('   🔒 /athletes - Needs public access');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPublicEventDetails();
