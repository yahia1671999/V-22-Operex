import React, { createContext, useContext, useEffect, useState } from 'react';
import { Employee, AppUser } from './types';

interface AuthContextType {
  user: { uid: string; email: string; name?: string; displayName?: string } | null;
  profile: Employee | AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isHR: boolean;
  isFinance: boolean;
  isOperations: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isHR: false,
  isFinance: false,
  isOperations: false,
  login: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ uid: string; email: string; name?: string; displayName?: string } | null>(null);
  const [profile, setProfile] = useState<Employee | AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    const token = localStorage.getItem('auth_token');
    const userJson = localStorage.getItem('auth_user');
    
    if (!token || !userJson) {
      setLoading(false);
      return;
    }

    try {
      const userData = JSON.parse(userJson);
      
      const response = await fetch(`/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const freshUser = await response.json();
        setUser({ 
          uid: freshUser.id, 
          email: freshUser.email, 
          name: freshUser.name, 
          displayName: freshUser.name 
        });
        
        // Find associated employee if any
        const empResponse = await fetch('/api/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (empResponse.ok) {
            const employees = await empResponse.json();
            const employee = employees.find((e: any) => e.email?.toLowerCase() === freshUser.email.toLowerCase());
            setProfile(freshUser.role ? freshUser : (employee || null));
        } else {
            setProfile(freshUser);
        }
      } else {
        logout();
      }
    } catch (e) {
      console.error('Auth check failed', e);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل تسجيل الدخول');
      }

      const data = await response.json();
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      await fetchProfile();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const userRole = (profile as any)?.role || '';
  const isExecutive = ['Admin', 'Super Admin', 'Executive Director', 'General Manager', 'CEO'].includes(userRole);
  const isAdmin = userRole === 'Admin' || userRole === 'Super Admin' || isExecutive;
  const isHR = userRole === 'HR' || userRole === 'HR Manager' || userRole === 'HR Officer' || userRole === 'Attendance Officer' || isAdmin;
  const isFinance = userRole === 'Finance' || userRole === 'Payroll Manager' || userRole === 'Payroll Officer' || isAdmin;
  const isOperations = userRole === 'Operations' || userRole === 'Operations Director' || userRole === 'Project Manager' || userRole === 'Team Leader' || userRole === 'Operations User' || isAdmin;
  const refreshProfile = fetchProfile;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isHR, isFinance, isOperations, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
