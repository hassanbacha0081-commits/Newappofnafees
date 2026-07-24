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
    isDriveConnected = !!cachedAccessToken;
  } else {
    // If not on native platform, clear cached token on Firebase logout
    if (!Capacitor.isNativePlatform()) {
      cachedAccessToken = null;
      isDriveConnected = false;
    }
  }
  
  onAuthChangedListeners.forEach(listener => listener(user, cachedAccessToken));
});

export const addAuthListener = (listener: (user: User | null, token: string | null) => void) => {
  onAuthChangedListeners.push(listener);
  // Call immediately with current state
  listener(auth.currentUser, cachedAccessToken);
  return () => {
    onAuthChangedListeners = onAuthChangedListeners.filter(l => l !== listener);
  };
};

export const setCachedAccessToken = async (token: string): Promise<{ user: User; accessToken: string }> => {
  cachedAccessToken = token;
  isDriveConnected = true;
  await db.settings.put({ key: 'googleDriveConnected', value: 'true' });
  
  let mockUser: User = { 
    uid: 'native_google_user', 
    displayName: 'Nafees ERP Drive Account',
    email: 'connected@nafeesjewellers.com'
  } as any;

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const googleUser = await response.json();
      mockUser = {
        uid: googleUser.id,
        email: googleUser.email,
        displayName: googleUser.name,
        photoURL: googleUser.picture,
      } as any;
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
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          isDriveConnected = true;
          await db.settings.put({ key: 'googleDriveConnected', value: 'true' });
          onAuthChangedListeners.forEach(listener => listener(result.user, cachedAccessToken));
        }
      }
    } catch (error) {
      console.error('getRedirectResult error:', error);
    }
  }
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    if (Capacitor.isNativePlatform()) {
      await signInWithRedirect(auth, provider);
      
      return new Promise((resolve) => {
        nativeResolve = resolve;
      });
    } else {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token from Google Auth');
      }

      cachedAccessToken = credential.accessToken;
      isDriveConnected = true;
      
      // Save to settings that Google Drive backup is enabled
      await db.settings.put({ key: 'googleDriveConnected', value: 'true' });
      
      onAuthChangedListeners.forEach(listener => listener(result.user, cachedAccessToken));
      return { user: result.user, accessToken: cachedAccessToken };
    }
  } catch (error: any) {
    const isPopupClosed = error && (
      error.code === 'auth/popup-closed-by-user' || 
      error.code === 'auth/cancelled-popup-request' ||
      error.message?.includes('popup-closed-by-user') ||
      error.message?.includes('cancelled-popup-request')
    );
    if (isPopupClosed) {
      console.warn('Google Sign-In popup was closed or cancelled by the user/browser.');
    } else {
      console.error('Google Sign-In error:', error);
    }
    throw error;
  } finally {
    if (!Capacitor.isNativePlatform()) {
      isSigningIn = false;
    }
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogleDrive = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  isDriveConnected = false;
  await db.settings.put({ key: 'googleDriveConnected', value: 'false' });
  onAuthChangedListeners.forEach(listener => listener(null, null));
};

// Check if drive is connected
export const isGoogleDriveEnabled = async (): Promise<boolean> => {
  const setting = await db.settings.get('googleDriveConnected');
  return setting?.value === 'true' && !!cachedAccessToken;
};

/**
 * Searches for the backup file in Google Drive.
 * Returns file details (id, modifiedTime) if found, otherwise null.
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
  const token = getAccessToken();
  if (!token) return false;

  try {
    const sales = await db.sales.toArray();
    const orders = await db.orders.toArray();
    const karigars = await db.karigars.toArray();
    const repairs = await db.repairs.toArray();
    const stock = await db.stock.toArray();
    const settings = await db.settings.toArray();
    const goldPurchases = await db.goldPurchases.toArray();
    const expenses = await db.expenses.toArray();

    const data = { 
      sales, 
      orders, 
      karigars, 
      repairs, 
      stock, 
      settings, 
      goldPurchases,
      expenses 
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
  }, 4000); // Wait 4 seconds of idle time before uploading
};

// Setup hooks for auto-backup
export const registerBackupHooks = () => {
  const hookTrigger = () => triggerAutoBackup();

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

  db.expenses.hook('creating', hookTrigger);
  db.expenses.hook('updating', hookTrigger);
  db.expenses.hook('deleting', hookTrigger);
};
