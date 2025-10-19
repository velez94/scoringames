#!/usr/bin/env node

/**
 * Bootstrap script to create super admin users
 * Usage: node scripts/create-super-admin.js --email=admin@example.com --password=SecurePass123! --profile=labvel-dev
 */

const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const { email, password, profile, region = 'us-east-1', userPoolId } = args;

if (!email || !password) {
  console.error('❌ Error: Missing required arguments');
  console.log('\nUsage: node scripts/create-super-admin.js --email=admin@example.com --password=SecurePass123! --profile=labvel-dev [--userPoolId=us-east-1_xxxxx]');
  console.log('\nIf userPoolId is not provided, it will be read from CDK outputs.');
  process.exit(1);
}

// Validate password strength
if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
  console.error('❌ Password must be at least 8 characters with uppercase, lowercase, and numbers');
  process.exit(1);
}

async function createSuperAdmin() {
  // Get User Pool ID from CDK outputs if not provided
  let poolId = userPoolId;
  if (!poolId) {
    const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
    const cfClient = new CloudFormationClient({ 
      region,
      ...(profile && { credentials: { profile } })
    });
    
    const stackName = 'CalisthenicsAppStack';
    const { Stacks } = await cfClient.send(new DescribeStacksCommand({ StackName: stackName }));
    const output = Stacks[0].Outputs.find(o => o.OutputKey === 'UserPoolId');
    
    if (!output) {
      throw new Error('UserPoolId not found in stack outputs. Deploy the stack first or provide --userPoolId');
    }
    
    poolId = output.OutputValue;
    console.log(`📋 Using User Pool: ${poolId}`);
  }

  const client = new CognitoIdentityProviderClient({ 
    region,
    ...(profile && { credentials: { profile } })
  });

  try {
    // Create user
    console.log(`\n🔨 Creating super admin user: ${email}`);
    await client.send(new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:isSuperAdmin', Value: 'true' }
      ],
      MessageAction: 'SUPPRESS' // Don't send welcome email
    }));

    // Set permanent password
    console.log('🔑 Setting permanent password...');
    await client.send(new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: email,
      Password: password,
      Permanent: true
    }));

    console.log('\n✅ Super admin created successfully!');
    console.log(`\n📧 Email: ${email}`);
    console.log(`🔐 Password: ${password}`);
    console.log(`👑 Role: Super Admin`);
    console.log('\n⚠️  Store these credentials securely and change the password after first login.');

  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.error(`\n❌ User ${email} already exists. Updating to super admin...`);
      
      try {
        await client.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: poolId,
          Username: email,
          UserAttributes: [
            { Name: 'custom:isSuperAdmin', Value: 'true' }
          ]
        }));
        
        console.log('✅ User updated to super admin successfully!');
      } catch (updateError) {
        console.error('❌ Failed to update user:', updateError.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Error creating super admin:', error.message);
      process.exit(1);
    }
  }
}

createSuperAdmin();
