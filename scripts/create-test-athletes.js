const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient({ region: 'us-east-2' });
const USER_POOL_ID = 'us-east-2_KUxqDApCY';
const DEFAULT_PASSWORD = 'Athlete123!';

const testAthletes = [
  { username: 'athlete1@test.com', firstName: 'John', lastName: 'Doe' },
  { username: 'athlete2@test.com', firstName: 'Jane', lastName: 'Smith' },
  { username: 'athlete3@test.com', firstName: 'Mike', lastName: 'Johnson' },
  { username: 'athlete4@test.com', firstName: 'Sarah', lastName: 'Williams' },
  { username: 'athlete5@test.com', firstName: 'Chris', lastName: 'Brown' }
];

async function createAthlete(athlete) {
  try {
    // Create user
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: athlete.username,
      UserAttributes: [
        { Name: 'email', Value: athlete.username },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:role', Value: 'athlete' },
        { Name: 'given_name', Value: athlete.firstName },
        { Name: 'family_name', Value: athlete.lastName }
      ],
      MessageAction: 'SUPPRESS'
    });
    
    await client.send(createCommand);
    console.log(`✓ Created user: ${athlete.username}`);

    // Set permanent password
    const passwordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: athlete.username,
      Password: DEFAULT_PASSWORD,
      Permanent: true
    });
    
    await client.send(passwordCommand);
    console.log(`✓ Set password for: ${athlete.username}`);
    
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log(`⚠ User already exists: ${athlete.username}`);
    } else {
      console.error(`✗ Error creating ${athlete.username}:`, error.message);
    }
  }
}

async function main() {
  console.log('Creating test athlete accounts...\n');
  console.log(`User Pool: ${USER_POOL_ID}`);
  console.log(`Default Password: ${DEFAULT_PASSWORD}\n`);
  
  for (const athlete of testAthletes) {
    await createAthlete(athlete);
  }
  
  console.log('\n✅ Done! Test athletes created.');
  console.log('\nLogin credentials:');
  testAthletes.forEach(a => {
    console.log(`  ${a.username} / ${DEFAULT_PASSWORD}`);
  });
}

main().catch(console.error);
