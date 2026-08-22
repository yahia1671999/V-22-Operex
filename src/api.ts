const API_BASE_URL = '/api';

// --- REST API Client ---

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface ApiErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// Mock storage
export const storage = {};
export const ref = (s: any, path: string) => path;
export const uploadBytes = async (path: string, file: File) => {
  console.log('Mock upload:', path, file);
  return { ref: path };
};
export const getDownloadURL = async (path: string) => {
  return `https://mock-storage.com/${path}`;
};

// Shims for Firestore operations
const getApiPath = (collectionName: string) => {
  // Map collection names to our API paths if they differ
  const mapping: Record<string, string> = {
    'payrollRuns': 'payroll-runs',
    'allowanceTypes': 'allowance-types',
    'attendanceRecords': 'attendance-records',
    'attendanceDevices': 'attendance-devices',
    'attendanceShifts': 'attendance-shifts',
    'absenceTypes': 'absence-types',
    'absenceRecords': 'absence-records',
    'missionTypes': 'mission-types',
    'projectTasks': 'project-tasks',
    'adminDepartments': 'admin-departments',
    'leaveRequests': 'leave-requests',
    'payrollResults': 'payroll-results',
    'systemLogs': 'system-logs',
    'systemSettings': 'system-settings',
    'system-settings': 'system-settings',
    'users': 'app-users',
    'missionAllowanceRuns': 'mission-allowance-runs',
    'missionAllowanceRunLines': 'mission-allowance-run-lines'
  };
  return mapping[collectionName] || collectionName;
};

// Log helper to ensure all actions are persisted in systemLogs
const logAction = async (action: string, entity: string, entityId: string, details: any) => {
  if (entity === 'systemLogs' || entity === 'system-logs') return; 
  
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const token = localStorage.getItem('auth_token');
  const logEntry = {
    id: Math.random().toString(36).substring(2, 9),
    userId: user.id || 'system',
    userName: user.name || user.email || 'system',
    action,
    entity,
    entityId,
    details,
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(`${API_BASE_URL}/system-logs`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(logEntry)
    });
  } catch (e) {
    console.error('Failed to log action:', e);
  }
};

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const db = {};
export const collection = (db: any, name: string) => name;
export const doc = (dbOrCol: any, collectionOrId?: string, id?: string) => {
  if (id) {
    return { collection: collectionOrId, id };
  } else if (collectionOrId) {
    return { collection: dbOrCol, id: collectionOrId };
  } else {
    return { collection: dbOrCol, id: Math.random().toString(36).substring(2, 9) };
  }
};

const safeParseJson = async (response: Response) => {
  const text = await response.text();
  const contentType = response.headers.get('content-type');
  
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setTimeout(() => {
      window.location.reload();
    }, 100);
    throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
  }

  if (contentType && contentType.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON:', text.substring(0, 500));
      throw new Error(`استجابة خادم غير صالحة بترميز JSON (الحالة ${response.status})`);
    }
  }
  
  // Handled non-json (frequent when getting HTML error pages from webservers)
  console.warn(`Non-JSON response received (status ${response.status}):`, text.substring(0, 300));
  
  if (response.status === 403) {
    throw new Error('ليس لديك صلاحية لتنفيذ هذا الإجراء');
  }
  if (response.status === 404) {
    throw new Error('السجل أو المسار المطلوبة غير موجود على الخادم');
  }
  
  throw new Error(`خطأ غير متوقع من الخادم (الحالة ${response.status})`);
};

export const getDoc = async (docRef: { collection: string, id: string }) => {
  const path = getApiPath(docRef.collection);
  const response = await fetch(`${API_BASE_URL}/${path}/${docRef.id}`, { headers: getHeaders() });
  if (!response.ok) {
    if (response.status === 404) {
      return { exists: () => false, data: () => null, id: docRef.id };
    }
    const errorMsg = await safeParseJson(response).then(d => d.error).catch(err => err.message);
    throw new Error(errorMsg || 'فشل جلب السجل');
  }
  const item = await safeParseJson(response);
  return {
    exists: () => !!item,
    data: () => item,
    id: docRef.id
  };
};

export const getDocs = async (queryOrCol: any) => {
  const collectionName = typeof queryOrCol === 'string' ? queryOrCol : (queryOrCol.collection || queryOrCol);
  const path = getApiPath(collectionName);
  const response = await fetch(`${API_BASE_URL}/${path}`, { headers: getHeaders() });
  if (!response.ok) {
    const errorMsg = await safeParseJson(response).then(d => d.error).catch(err => err.message);
    throw new Error(errorMsg || 'فشل جلب البيانات');
  }
  const data = await safeParseJson(response);
  return {
    empty: !Array.isArray(data) || data.length === 0,
    docs: Array.isArray(data) ? data.map((item: any) => ({
      id: item.id,
      data: () => item
    })) : []
  };
};

export const setDoc = async (docRef: { collection: string, id: string }, data: any, options?: { merge?: boolean }) => {
  const path = getApiPath(docRef.collection);
  logAction(options?.merge ? 'update' : 'set', docRef.collection, docRef.id, data);

  // Check if document exists first via GET
  let exists = false;
  let canView = true;
  try {
    const getRes = await fetch(`${API_BASE_URL}/${path}/${docRef.id}`, { headers: getHeaders() });
    if (getRes.status === 200) {
      exists = true;
    } else if (getRes.status === 404) {
      exists = false;
    } else if (getRes.status === 403) {
      // If we cannot view, we cannot determine existence. We will fallback to the traditional method.
      canView = false;
    }
  } catch (err) {
    console.error("Error checking existence:", err);
    canView = false;
  }

  if (canView) {
    if (!exists) {
      const createResponse = await fetch(`${API_BASE_URL}/${path}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, id: docRef.id })
      });
      if (!createResponse.ok) {
        const errorData = await safeParseJson(createResponse);
        throw new Error(errorData.error || `Failed to create document`);
      }
      return await safeParseJson(createResponse);
    } else {
      const response = await fetch(`${API_BASE_URL}/${path}/${docRef.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ ...data, id: docRef.id })
      });
      if (!response.ok) {
        const errorData = await safeParseJson(response);
        throw new Error(errorData.error || `Failed to update document`);
      }
      return await safeParseJson(response);
    }
  } else {
    // Traditional fallback path if GET is forbidden but we want to attempt PUT and fallback to POST on 404 or 403
    const response = await fetch(`${API_BASE_URL}/${path}/${docRef.id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ ...data, id: docRef.id })
    });
    
    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        const createResponse = await fetch(`${API_BASE_URL}/${path}`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ ...data, id: docRef.id })
        });
        if (!createResponse.ok) {
          const errorData = await safeParseJson(createResponse);
          throw new Error(errorData.error || `Failed to create document`);
        }
        return await safeParseJson(createResponse);
      } else {
        const errorData = await safeParseJson(response);
        throw new Error(errorData.error || `Failed to update document`);
      }
    }
    return await safeParseJson(response);
  }
};

export const updateDoc = async (docRef: { collection: string, id: string }, data: any) => {
  const path = getApiPath(docRef.collection);
  logAction('update', docRef.collection, docRef.id, data);
  
  let finalData = { ...data };
  const hasArrayUnion = Object.values(finalData).some((v: any) => v && v.__type === 'arrayUnion');
  
  if (hasArrayUnion) {
    try {
      const existingDoc = await getDoc(docRef);
      const existingData = existingDoc.data() || {};
      for (const key in finalData) {
        if (finalData[key] && finalData[key].__type === 'arrayUnion') {
          const val = finalData[key].value;
          let currentArr: any[] = [];
          if (Array.isArray(existingData[key])) {
            currentArr = existingData[key];
          } else if (typeof existingData[key] === 'string') {
            try {
              const parsed = JSON.parse(existingData[key]);
              if (Array.isArray(parsed)) currentArr = parsed;
              else if (parsed && typeof parsed === 'object') currentArr = [parsed];
            } catch {
              if (existingData[key].trim()) currentArr = [{ note: existingData[key] }];
            }
          } else if (existingData[key] && typeof existingData[key] === 'object') {
            currentArr = [existingData[key]];
          }
          finalData[key] = [...currentArr, val];
        }
      }
    } catch (e) {
      console.warn('Failed to fetch existing doc for arrayUnion, falling back to overwrite', e);
    }
  }

  const response = await fetch(`${API_BASE_URL}/${path}/${docRef.id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(finalData)
  });
  if (!response.ok) {
    const errorData = await safeParseJson(response);
    throw new Error(errorData.error || `Failed to update document`);
  }
  return await safeParseJson(response);
};

export const addDoc = async (collectionName: string, data: any) => {
  const path = getApiPath(collectionName);
  logAction('create', collectionName, 'new', data);
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await safeParseJson(response);
    throw new Error(errorData.error || `Failed to add document`);
  }
  const newItem = await safeParseJson(response);
  return { id: newItem.id, ...newItem };
};

export const deleteDoc = async (docRef: { collection: string, id: string }) => {
  const path = getApiPath(docRef.collection);
  logAction('delete', docRef.collection, docRef.id, null);
  const response = await fetch(`${API_BASE_URL}/${path}/${docRef.id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) {
    const errorData = await safeParseJson(response);
    throw new Error(errorData.error || `Failed to delete document`);
  }
  return await safeParseJson(response);
};

export const query = (col: any, ...constraints: any[]) => ({ collection: col, constraints });
export const where = (...args: any[]) => ({ type: 'where', args });
export const orderBy = (...args: any[]) => ({ type: 'orderBy', args });
export const limit = (...args: any[]) => ({ type: 'limit', args });
export const startAfter = (...args: any[]) => ({ type: 'startAfter', args });
export const onSnapshot = (ref: any, callback: any, errorCallback?: any) => {
  // This is a dummy for now as real-time is handled by polling in DataContext
  return () => {};
};

export const writeBatch = (dbRef?: any) => {
    let operations: Array<() => Promise<any>> = [];
    return {
        set: (docRef: any, data: any) => {
            operations.push(() => setDoc(docRef, data));
        },
        update: (docRef: any, data: any) => {
            operations.push(() => updateDoc(docRef, data));
        },
        delete: (docRef: any) => {
            operations.push(() => deleteDoc(docRef));
        },
        commit: async () => {
            for (const op of operations) {
                await op();
            }
        }
    };
};
export const arrayUnion = (item: any) => ({ __type: 'arrayUnion', value: item });
export const serverTimestamp = () => new Date().toISOString();

// Auth shim
export const auth = {};
export const signInWithPopup = async () => {
    alert('Please use the email login. Social login is currently disabled.');
};
export const signOut = async (authRef?: any) => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user_email');
    window.location.reload();
};
export const signInWithEmailAndPassword = async () => {};
export const createUserWithEmailAndPassword = async () => {};

export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!response.ok) throw new Error('فشل رفع الملف');
  return await response.json();
};

export function handleApiError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('API Error: ', error, operationType, path);
}

// --- Custom Enterprise Payroll & Mission Allowance Runs API Wrappers ---

export const calculatePayrollRun = async (periodMonth: string, selectedEmployees?: string[]) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/calculate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ periodMonth, selectedEmployees })
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل احتساب مسير الرواتب');
  }
  return await response.json();
};

export const submitPayrollRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/${id}/submit`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل تقديم مسير الرواتب');
  }
  return await response.json();
};

export const reviewPayrollRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/${id}/review`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل مراجعة مسير الرواتب');
  }
  return await response.json();
};

export const approvePayrollRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/${id}/approve`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل اعتماد مسير الرواتب');
  }
  return await response.json();
};

export const lockPayrollRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/${id}/lock`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل قفل مسير الرواتب');
  }
  return await response.json();
};

export const exportPayrollRunAudit = async (id: string, format: string) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/${id}/export-audit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ format })
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل تسجيل تصدير مسير الرواتب');
  }
  return await response.json();
};

export const reopenPayrollRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/payroll-runs/${id}/reopen`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل إعادة فتح مسير الرواتب');
  }
  return await response.json();
};

export const generateMissionAllowanceLines = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/generate-lines`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل توليد أسطر مسير المأموريات');
  }
  return await response.json();
};

export const submitMissionAllowanceRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/submit`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل تقديم مسير المأموريات');
  }
  return await response.json();
};

export const reviewMissionAllowanceRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/review`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل مراجعة مسير المأموريات');
  }
  return await response.json();
};

export const approveMissionAllowanceRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/approve`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل اعتماد مسير المأموريات');
  }
  return await response.json();
};

export const lockMissionAllowanceRun = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/lock`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل قفل مسير المأموريات');
  }
  return await response.json();
};

export const exportMissionAllowanceRunAudit = async (id: string, format: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/export-audit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ format })
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل تسجيل تصدير مسير المأموريات');
  }
  return await response.json();
};

export const getMissionAllowanceRunLines = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/mission-allowance-runs/${id}/lines`, {
    headers: getHeaders()
  });
  if (!response.ok) {
    const data = await safeParseJson(response).catch(() => ({}));
    throw new Error(data.error || 'فشل جلب أسطر مسير المأموريات');
  }
  return await response.json();
};
