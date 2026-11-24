import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
] as const;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'consent',
});

let isSigningIn = false;
// Store OAuth access token strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthChange: (state: {
    user: User | null;
    accessToken: string | null;
    needsAuth: boolean;
  }) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthChange({
          user,
          accessToken: cachedAccessToken,
          needsAuth: false,
        });
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthChange({
          user,
          accessToken: null,
          needsAuth: true,
        });
      }
    } else {
      cachedAccessToken = null;
      onAuthChange({
        user: null,
        accessToken: null,
        needsAuth: true,
      });
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se recibió el token de acceso de Google Workspace.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearWorkspaceAccessToken = () => {
  cachedAccessToken = null;
};

export const getIdToken = async (forceRefresh = false): Promise<string | null> => {
  const current = auth.currentUser;
  if (!current) return null;
  return current.getIdToken(forceRefresh);
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};
