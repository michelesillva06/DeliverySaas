import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

export interface LoginResult {
  success: boolean;
  user?: UserProfile;
  errorCode?: string;
  message?: string;
}

export interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  customerAnonymousUid: string;
  loading: boolean;
  login: (email: string, senha: string) => Promise<LoginResult>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<UserProfile | null>;
}

export function formatFirebaseAuthError(err: any): string {
  if (!err) return 'Erro desconhecido na autenticação.';
  const code = err.code || '';
  const message = err.message || '';

  console.error('[Auth Flow] Detalhes do erro Firebase:', { code, message, errorObj: err });

  let ptMessage = 'Ocorreu um erro ao processar sua autenticação.';

  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    ptMessage = 'E-mail ou senha incorretos.';
  } else if (code === 'auth/invalid-email') {
    ptMessage = 'O formato do e-mail digitado é inválido.';
  } else if (code === 'auth/email-already-in-use') {
    ptMessage = 'Este e-mail já está cadastrado no sistema.';
  } else if (code === 'auth/weak-password') {
    ptMessage = 'A senha informada é muito fraca (mínimo 6 caracteres).';
  } else if (code === 'auth/user-disabled') {
    ptMessage = 'Esta conta de usuário foi desativada.';
  } else if (code === 'auth/too-many-requests') {
    ptMessage = 'Muitas tentativas consecutivas. Aguarde alguns instantes e tente novamente.';
  } else if (code === 'auth/operation-not-allowed') {
    ptMessage = 'O provedor de e-mail e senha não está habilitado no console do Firebase.';
  } else if (code === 'auth/network-request-failed') {
    ptMessage = 'Falha de conexão com os servidores do Firebase. Verifique sua internet.';
  } else if (code.includes('api-key-not-valid')) {
    ptMessage = 'A chave de API do Firebase está inválida. Verifique a configuração.';
  }

  return code ? `${ptMessage} (Código: ${code})` : ptMessage;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Anonymous customer UID per device
  const [customerAnonymousUid] = useState<string>(() => {
    let uid = localStorage.getItem('delivery_customer_anon_uid');
    if (!uid) {
      uid = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('delivery_customer_anon_uid', uid);
    }
    return uid;
  });

  const loadUserProfile = async (user: FirebaseUser): Promise<UserProfile | null> => {
    try {
      console.log('[Auth Flow] Carregando perfil users/' + user.uid + ' do Firestore...');
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        console.log('[Auth Flow] Perfil users/' + user.uid + ' encontrado:', {
          uid: profile.uid,
          email: profile.email,
          nome: profile.nome,
          role: profile.role,
          storeId: profile.storeId || 'NENHUM',
        });
        setCurrentUser(profile);
        return profile;
      } else {
        console.log('[Auth Flow] Documento users/' + user.uid + ' NÃO existe no Firestore.');
        setCurrentUser(null);
        return null;
      }
    } catch (err) {
      console.error('[Auth Flow] Erro ao ler users/' + user.uid + ' do Firestore:', err);
      setCurrentUser(null);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth Flow] onAuthStateChanged disparado:', user ? `UID: ${user.uid} (${user.email})` : 'Usuário deslogado');
      setFirebaseUser(user);
      if (user) {
        await loadUserProfile(user);
      } else {
        setCurrentUser(null);
      }
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const refreshUserProfile = async (): Promise<UserProfile | null> => {
    if (!auth.currentUser) return null;
    return await loadUserProfile(auth.currentUser);
  };

  const login = async (email: string, senha: string): Promise<LoginResult> => {
    const cleanEmail = email.trim().toLowerCase();
    console.log('[Auth Flow] Iniciando login com e-mail/senha:', cleanEmail);
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, senha);
      console.log('[Auth Flow] Login com e-mail/senha aprovado pelo Firebase Auth. UID:', cred.user.uid);
      const profile = await loadUserProfile(cred.user);

      if (!profile) {
        return {
          success: true,
          user: {
            uid: cred.user.uid,
            email: cred.user.email || cleanEmail,
            nome: 'Usuário',
            role: 'owner',
          },
        };
      }

      return { success: true, user: profile };
    } catch (err: any) {
      console.error('[Auth Flow] Erro no signInWithEmailAndPassword:', err);
      return {
        success: false,
        errorCode: err.code,
        message: formatFirebaseAuthError(err),
      };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Digite seu e-mail para receber as instruções de recuperação.' };
    }
    try {
      console.log('[Auth Flow] Enviando reset de senha para:', cleanEmail);
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: 'Link de redefinição de senha enviado para seu e-mail! Verifique sua caixa de entrada e spam.',
      };
    } catch (err: any) {
      console.error('[Auth Flow] Erro no sendPasswordResetEmail:', err);
      return {
        success: false,
        message: formatFirebaseAuthError(err),
      };
    }
  };

  const logout = async () => {
    console.log('[Auth Flow] Realizando logout...');
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[Auth Flow] Erro ao deslogar do Firebase Auth:', err);
    }
    setCurrentUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        customerAnonymousUid,
        loading,
        login,
        sendPasswordReset,
        logout,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
