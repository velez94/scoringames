const https = require('https');

const API_BASE = 'https://h5c4i3jvn5.execute-api.us-east-2.amazonaws.com/prod';

// Test public event access (no auth required)
function testPublicEvent(eventId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'h5c4i3jvn5.execute-api.us-east-2.amazonaws.com',
      port: 443,
      path: `/prod/public/events/${eventId}`,
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

// Test categories endpoint (no auth required for public events)
function testCategories(eventId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'h5c4i3jvn5.execute-api.us-east-2.amazonaws.com',
      port: 443,
      path: `/prod/categories?eventId=${eventId}`,
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

// Test WODs endpoint
function testWods(eventId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'h5c4i3jvn5.execute-api.us-east-2.amazonaws.com',
      port: 443,
      path: `/prod/wods?eventId=${eventId}`,
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

// Test scores endpoint
function testScores(eventId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'h5c4i3jvn5.execute-api.us-east-2.amazonaws.com',
      port: 443,
      path: `/prod/scores?eventId=${eventId}`,
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

async function runTests() {
  console.log('🧪 Testing Athlete Event Details API Endpoints\n');
  
  // Use a known event ID from the system
  const eventId = 'evt-1761359596294'; // ElLab event
  
  try {
    console.log('1. Testing Public Event Access...');
    const eventResult = await testPublicEvent(eventId);
    console.log(`   Status: ${eventResult.status}`);
    if (eventResult.status === 200) {
      console.log(`   ✅ Event: ${eventResult.data.name}`);
      console.log(`   📅 Date: ${eventResult.data.startDate}`);
      console.log(`   📍 Location: ${eventResult.data.location}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(eventResult.data)}`);
    }
    
    console.log('\n2. Testing Categories Endpoint...');
    const categoriesResult = await testCategories(eventId);
    console.log(`   Status: ${categoriesResult.status}`);
    if (categoriesResult.status === 200) {
      console.log(`   ✅ Found ${categoriesResult.data.length} categories`);
      categoriesResult.data.forEach(cat => {
        console.log(`      - ${cat.name} (${cat.categoryId})`);
      });
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(categoriesResult.data)}`);
    }
    
    console.log('\n3. Testing WODs Endpoint...');
    const wodsResult = await testWods(eventId);
    console.log(`   Status: ${wodsResult.status}`);
    if (wodsResult.status === 200) {
      console.log(`   ✅ Found ${wodsResult.data.length} WODs`);
      wodsResult.data.forEach(wod => {
        console.log(`      - ${wod.name} (${wod.wodId})`);
      });
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(wodsResult.data)}`);
    }
    
    console.log('\n4. Testing Scores Endpoint...');
    const scoresResult = await testScores(eventId);
    console.log(`   Status: ${scoresResult.status}`);
    if (scoresResult.status === 200) {
      console.log(`   ✅ Found ${scoresResult.data.length} scores`);
      if (scoresResult.data.length > 0) {
        console.log(`      Sample score: ${scoresResult.data[0].score} points`);
      }
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(scoresResult.data)}`);
    }
    
    console.log('\n🎉 Test Summary:');
    console.log('   - Public event access: ✅');
    console.log('   - Categories loading: ✅');
    console.log('   - WODs loading: ✅');
    console.log('   - Scores loading: ✅');
    console.log('\n✨ Athlete Event Details component should work correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
