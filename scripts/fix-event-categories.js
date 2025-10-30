const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-2' });
const ddb = DynamoDBDocumentClient.from(client);

const CATEGORIES_TABLE = 'ScorinGames-CategoriesCategoriesTable6441F570-1SPJLAEBJ8R5E';

async function fixEventCategories() {
  console.log('🔧 Fixing event categories with missing names...');
  
  try {
    // Get all categories
    const { Items: allCategories } = await ddb.send(new ScanCommand({
      TableName: CATEGORIES_TABLE
    }));
    
    // Separate global and event categories
    const globalCategories = allCategories.filter(cat => cat.eventId === 'global');
    const eventCategories = allCategories.filter(cat => cat.eventId !== 'global');
    
    console.log(`Found ${globalCategories.length} global categories and ${eventCategories.length} event categories`);
    
    // Fix event categories missing names
    for (const eventCategory of eventCategories) {
      if (!eventCategory.name) {
        // Find matching global category
        const globalCategory = globalCategories.find(gc => gc.categoryId === eventCategory.categoryId);
        
        if (globalCategory) {
          console.log(`Fixing ${eventCategory.categoryId} in event ${eventCategory.eventId}`);
          
          // Update with global category data
          const updatedCategory = {
            ...eventCategory,
            name: globalCategory.name,
            description: globalCategory.description,
            requirements: globalCategory.requirements,
            minAge: globalCategory.minAge,
            maxAge: globalCategory.maxAge,
            gender: globalCategory.gender,
            updatedAt: new Date().toISOString()
          };
          
          await ddb.send(new PutCommand({
            TableName: CATEGORIES_TABLE,
            Item: updatedCategory
          }));
          
          console.log(`  ✅ Fixed: ${globalCategory.name}`);
        } else {
          console.log(`  ⚠️  No global template found for ${eventCategory.categoryId}`);
        }
      }
    }
    
    console.log('✅ Event categories fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing categories:', error);
  }
}

fixEventCategories();
