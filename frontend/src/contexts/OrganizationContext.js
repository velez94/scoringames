import React, { createContext, useState, useEffect, useContext } from 'react';
import { API, Auth } from 'aws-amplify';

const OrganizationContext = createContext();

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};

export const OrganizationProvider = ({ children }) => {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkSuperAdmin();
    fetchOrganizations();
  }, []);

  const checkSuperAdmin = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const email = user.attributes.email;
      setIsSuperAdmin(email === 'admin@athleon.fitness');
    } catch (error) {
      console.error('Error checking super admin:', error);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const orgs = await API.get('CalisthenicsAPI', '/organizations');
      
      // Add "All Organizations" option for super admin
      const user = await Auth.currentAuthenticatedUser();
      const email = user.attributes.email;
      
      if (email === 'admin@athleon.fitness') {
        const allOrgsOption = {
          organizationId: 'all',
          name: 'All Organizations',
          role: 'super_admin'
        };
        setOrganizations([allOrgsOption, ...orgs]);
        
        const savedOrgId = localStorage.getItem('selectedOrganizationId');
        const defaultOrg = savedOrgId 
          ? [allOrgsOption, ...orgs].find(o => o.organizationId === savedOrgId)
          : allOrgsOption;
        
        setSelectedOrganization(defaultOrg);
      } else {
        setOrganizations(orgs);
        
        const savedOrgId = localStorage.getItem('selectedOrganizationId');
        const defaultOrg = savedOrgId 
          ? orgs.find(o => o.organizationId === savedOrgId) 
          : orgs[0];
        
        if (defaultOrg) {
          setSelectedOrganization(defaultOrg);
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectOrganization = (org) => {
    setSelectedOrganization(org);
    localStorage.setItem('selectedOrganizationId', org.organizationId);
  };

  const createOrganization = async (name, description) => {
    const newOrg = await API.post('CalisthenicsAPI', '/organizations', {
      body: { name, description }
    });
    await fetchOrganizations();
    return newOrg;
  };

  const value = {
    organizations,
    selectedOrganization,
    selectOrganization,
    createOrganization,
    refreshOrganizations: fetchOrganizations,
    loading,
    isSuperAdmin
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};
