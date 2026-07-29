import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../db';

// Initialize Firebase App and Auth once
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive file-level access
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let onAuthChangedListeners: Array<(user: User | null, token: string | null) => void> = [];
let nativeResolve: ((res: { user: User; accessToken: string } | null) => void) | null = null;

// Track if Google Drive is enabled/connected in settings or state
let isDriveConnected = false;

// Initialize auth state listener
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    if (cachedAccessToken) {
      isDriveConnected = true;
    }
  }
  onAuthChangedListeners.forEach(listener => listener(user || (cachedAccessToken ? buildMockUser() : null), cachedAccessToken));
});

function buildMockUser(googleUser?: any): User {
  if (googleUser) {
    return {
      uid: googleUser.id || 'google_drive_user',
      email: googleUser.email || 'connected@nafeesjewellers.com',
      displayName: googleUser.name || 'Nafees ERP Drive Account',
      photoURL: googleUser.picture || '',
    } as any;
  }
  return {
    uid: 'google_drive_user',
    displayName: 'Nafees ERP Drive Account',
    email: 'connected@nafeesjewellers.com'
  } as any;
}

export const addAuthListener = (listener: (user: User | null, token: string | null) => void) => {
  onAuthChangedListeners.push(listener);
  // Call immediately with current state
  const currentUser = auth.currentUser || (cachedAccessToken ? buildMockUser() : null);
  listener(currentUser, cachedAccessToken);
  return () => {
    onAuthChangedListeners = onAuthChangedListeners.filter(l => l !== listener);
  };
};

export const initDriveFromStorage = async (): Promise<boolean> => {
  try {
    let token = cachedAccessToken;
    if (!token) {
      token = localStorage.getItem('google_drive_access_token');
      if (!token) {
        const savedSetting = await db.settings.get('googleDriveAccessToken');
        if (savedSetting?.value) token = savedSetting.value;
      }
    }

    if (token) {
      // Validate token with Google userinfo
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const googleUser = await response.json();
        const userObj = buildMockUser(googleUser);
        cachedAccessToken = token;
        isDriveConnected = true;

        await db.settings.put({ key: 'googleDriveConnected', value: 'true' });
        await db.settings.put({ key: 'googleDriveAccessToken', value: token });
        localStorage.setItem('google_drive_access_token', token);

        onAuthChangedListeners.forEach(listener => listener(userObj, token));
        return true;
      } else {
        console.warn('Stored Google Drive token expired or invalid:', response.status);
        // Clean up stale token
        localStorage.removeItem('google_drive_access_token');
        await db.settings.put({ key: 'googleDriveAccessToken', value: '' });
      }
    }
  } catch (err) {
    console.error('Error initializing Google Drive from storage:', err);
  }
  return false;
};

// Immediately try hydrating from storage on module load
initDriveFromStorage().catch(() => {});

export const setCachedAccessToken = async (token: string): Promise<{ user: User; accessToken: string }> => {
  cachedAccessToken = token;
  isDriveConnected = true;

  try {
    localStorage.setItem('google_drive_access_token', token);
    await db.settings.put({ key: 'googleDriveConnected', value: 'true' });
    await db.settings.put({ key: 'googleDriveAccessToken', value: token });
  } catch (e) {
    console.error('Failed to persist drive token:', e);
  }

  let mockUser = buildMockUser();

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const googleUser = await response.json();
      mockUser = buildMockUser(googleUser);
    }
  } catch (err) {
    console.error('Error fetching Google User profile info:', err);
  }

  onAuthChangedListeners.forEach(listener => listener(mockUser, token));

  if (nativeResolve) {
    nativeResolve({ user: mockUser, accessToken: token });
    nativeResolve = null;
  }
  isSigningIn = false;
  return { user: mockUser, accessToken: token };
};

export const handleAuthRedirectResult = async () => {
  // 1. Check window.location.hash for web OAuth redirects
  if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      await setCachedAccessToken(token);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
  }

  // 2. Check Firebase Redirect result for native/web
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        await setCachedAccessToken(credential.accessToken);
      }
    }
  } catch (error) {
    console.error('getRedirectResult error:', error);
  }
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  isSigningIn = true;

  // 1. First attempt standard Firebase Auth popup (works on Web & modern Capacitor WebViews)
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      const authRes = await setCachedAccessToken(credential.accessToken);
      return authRes;
    }
  } catch (popupErr: any) {
    console.warn('signInWithPopup failed or was blocked, attempting fallback:', popupErr);
  }

  // 2. Fallback: If on Capacitor Native Platform, use Firebase Auth redirect flow
  if (Capacitor.isNativePlatform()) {
    try {
      await signInWithRedirect(auth, provider);
      return new Promise((resolve) => {
        nativeResolve = resolve;
        setTimeout(() => {
          if (nativeResolve) {
            nativeResolve(null);
            nativeResolve = null;
            isSigningIn = false;
          }
        }, 120000);
      });
    } catch (redirectErr) {
      console.warn('signInWithRedirect failed on native platform:', redirectErr);
    }
  }

  // 3. Web & Desktop Fallback: OAuth 2.0 Implicit Flow using valid current HTTPS origin
  try {
    const clientId = firebaseConfig.oAuthClientId || '832891644845-1p2fddt518q3s6c2lan134plq9tkjiqj.apps.googleusercontent.com';
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=consent`;

    const popupWin = window.open(authUrl, 'google_drive_oauth', 'width=520,height=650,left=100,top=100');
    if (popupWin && !popupWin.closed) {
      return new Promise((resolve) => {
        const interval = setInterval(async () => {
          try {
            if (popupWin.closed) {
              clearInterval(interval);
              isSigningIn = false;
              resolve(null);
              return;
            }
            if (popupWin.location.hash && popupWin.location.hash.includes('access_token=')) {
              const hashParams = new URLSearchParams(popupWin.location.hash.substring(1));
              const token = hashParams.get('access_token');
              clearInterval(interval);
              popupWin.close();
              if (token) {
                const res = await setCachedAccessToken(token);
                resolve(res);
              } else {
                resolve(null);
              }
            }
          } catch (e) {
            // Cross-origin restriction while popup is on google.com - ignore
          }
        }, 500);
      });
    } else {
      // Popup completely blocked, fallback to full page redirect
      window.location.href = authUrl;
      return null;
    }
  } catch (error: any) {
    console.error('Google OAuth sign-in completely failed:', error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken || localStorage.getItem('google_drive_access_token');
};

export const ensureAccessToken = async (): Promise<string | null> => {
  let token = getAccessToken();
  if (token) return token;

  const saved = await db.settings.get('googleDriveAccessToken');
  if (saved?.value) {
    cachedAccessToken = saved.value;
    isDriveConnected = true;
    return saved.value;
  }

  try {
    const res = await googleSignIn();
    return res?.accessToken || null;
  } catch (err) {
    console.error('Failed to get Google Drive access token:', err);
    return null;
  }
};

export const logoutGoogleDrive = async () => {
  try {
    await auth.signOut();
  } catch (e) {}
  cachedAccessToken = null;
  isDriveConnected = false;
  localStorage.removeItem('google_drive_access_token');
  await db.settings.put({ key: 'googleDriveConnected', value: 'false' });
  await db.settings.put({ key: 'googleDriveAccessToken', value: '' });
  onAuthChangedListeners.forEach(listener => listener(null, null));
};

export const isGoogleDriveEnabled = async (): Promise<boolean> => {
  const token = getAccessToken();
  return !!token;
};

/**
 * Searches for the backup file in Google Drive.
 */
export const findBackupOnDrive = async (token: string): Promise<{ id: string; name: string; modifiedTime: string } | null> => {
  try {
    const query = encodeURIComponent("name = 'nafees_jewellers_backup.json' and trashed = false");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Error searching backup on Drive:', await response.text());
      return null;
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  } catch (error) {
    console.error('Search backup error:', error);
    return null;
  }
};

/**
 * Downloads the content of a file from Google Drive.
 */
export const downloadBackupContent = async (token: string, fileId: string): Promise<any | null> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Error downloading backup file:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Download backup error:', error);
    return null;
  }
};

/**
 * Uploads (creates or overwrites) a backup to Google Drive.
 */
export const uploadBackupToDrive = async (token: string, backupData: any): Promise<boolean> => {
  try {
    const existingFile = await findBackupOnDrive(token);
    
    if (existingFile) {
      // Overwrite / Update existing file content
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData),
      });

      if (!response.ok) {
        console.error('Error updating backup file on Drive:', await response.text());
        return false;
      }
      return true;
    } else {
      // Create new file with metadata first
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'nafees_jewellers_backup.json',
          mimeType: 'application/json',
        }),
      });

      if (!createResponse.ok) {
        console.error('Error creating backup metadata on Drive:', await createResponse.text());
        return false;
      }

      const fileMetadata = await createResponse.json();
      const newFileId = fileMetadata.id;

      // Update the content (media)
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`;
      const mediaResponse = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData),
      });

      if (!mediaResponse.ok) {
        console.error('Error uploading backup content on Drive:', await mediaResponse.text());
        return false;
      }
      return true;
    }
  } catch (error) {
    console.error('Upload backup error:', error);
    return false;
  }
};

/**
 * Performs full database backup and uploads it to Google Drive.
 */
export const autoBackupToDrive = async (): Promise<boolean> => {
  let token = getAccessToken();
  if (!token) {
    token = await ensureAccessToken();
  }
  if (!token) return false;

  try {
    const sales = await db.sales.toArray();
    const orders = await db.orders.toArray();
    const karigars = await db.karigars.toArray();
    const repairs = await db.repairs.toArray();
    const stock = await db.stock.toArray();
    const settings = await db.settings.toArray();
    const goldPurchases = await db.goldPurchases.toArray();
    const expenses = db.expenses ? await db.expenses.toArray() : [];
    const khaataAccounts = db.khaataAccounts ? await db.khaataAccounts.toArray() : [];
    const khaataEntries = db.khaataEntries ? await db.khaataEntries.toArray() : [];

    const data = { 
      sales, 
      orders, 
      karigars, 
      repairs, 
      stock, 
      settings, 
      goldPurchases,
      expenses,
      khaataAccounts,
      khaataEntries
    };

    const success = await uploadBackupToDrive(token, data);
    if (success) {
      await db.settings.put({ key: 'lastDriveBackupDate', value: new Date().toISOString() });
      console.log('Automated backup uploaded successfully to Google Drive.');
    }
    return success;
  } catch (error) {
    console.error('Auto backup to Drive failed:', error);
    return false;
  }
};

// Setup automatic debounced backup triggers on any DB modifications
let backupTimeout: NodeJS.Timeout | null = null;
export const triggerAutoBackup = () => {
  const token = getAccessToken();
  if (!token) return;

  if (backupTimeout) {
    clearTimeout(backupTimeout);
  }

  backupTimeout = setTimeout(() => {
    autoBackupToDrive().catch(err => {
      console.error('Background auto-backup failed:', err);
    });
  }, 5000); // Wait 5 seconds of idle time before uploading
};

// Setup hooks for auto-backup
let isHooksRegistered = false;
export const registerBackupHooks = () => {
  if (isHooksRegistered) return;
  isHooksRegistered = true;

  const hookTrigger = () => {
    setTimeout(() => {
      triggerAutoBackup();
    }, 0);
  };

  db.sales.hook('creating', hookTrigger);
  db.sales.hook('updating', hookTrigger);
  db.sales.hook('deleting', hookTrigger);

  db.orders.hook('creating', hookTrigger);
  db.orders.hook('updating', hookTrigger);
  db.orders.hook('deleting', hookTrigger);

  db.karigars.hook('creating', hookTrigger);
  db.karigars.hook('updating', hookTrigger);
  db.karigars.hook('deleting', hookTrigger);

  db.repairs.hook('creating', hookTrigger);
  db.repairs.hook('updating', hookTrigger);
  db.repairs.hook('deleting', hookTrigger);

  db.stock.hook('creating', hookTrigger);
  db.stock.hook('updating', hookTrigger);
  db.stock.hook('deleting', hookTrigger);

  db.goldPurchases.hook('creating', hookTrigger);
  db.goldPurchases.hook('updating', hookTrigger);
  db.goldPurchases.hook('deleting', hookTrigger);

  if (db.expenses) {
    db.expenses.hook('creating', hookTrigger);
    db.expenses.hook('updating', hookTrigger);
    db.expenses.hook('deleting', hookTrigger);
  }

  if (db.khaataAccounts) {
    db.khaataAccounts.hook('creating', hookTrigger);
    db.khaataAccounts.hook('updating', hookTrigger);
    db.khaataAccounts.hook('deleting', hookTrigger);
  }

  if (db.khaataEntries) {
    db.khaataEntries.hook('creating', hookTrigger);
    db.khaataEntries.hook('updating', hookTrigger);
    db.khaataEntries.hook('deleting', hookTrigger);
  }
};
