import { API } from 'aws-amplify';

const ROLE_MAPPING = {
  'super_admin': 'super_admin',
  'organizer': 'org_member',
  'athlete': 'athlete'
};

export const syncUserRole = async (user) => {
  try {
    if (!user?.attributes) return;
    
    const cognitoRole = user.attributes['custom:role'];
    const rbacRole = ROLE_MAPPING[cognitoRole];
    
    if (!rbacRole) {
      console.log('No RBAC role mapping for:', cognitoRole);
      return;
    }
    
    // Non-blocking sync - don't await to prevent render blocking
    setTimeout(async () => {
      try {
        const userRoles = await API.get('CalisthenicsAPI', '/authorization/user-roles');
        const existingRole = userRoles.find(ur => 
          ur.userId === user.attributes.sub && ur.contextId === 'global'
        );
        
        if (!existingRole || existingRole.roleId !== rbacRole) {
          await API.post('CalisthenicsAPI', '/authorization/user-roles', {
            body: {
              userId: user.attributes.sub,
              email: user.attributes.email,
              roleId: rbacRole,
              contextId: 'global'
            }
          });
          
          console.log(`Synced role: ${cognitoRole} -> ${rbacRole}`);
        }
      } catch (error) {
        console.error('Error syncing user role:', error);
      }
    }, 100);
  } catch (error) {
    console.error('Error in syncUserRole:', error);
  }
};
