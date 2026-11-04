import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, isMasterRole } from '../types';

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

  const isUserCredentialError =
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-email';

  if (isUserCredentialError) {
    console.warn('[Auth Flow] Tentativa de login com credenciais incorretas ou inválidas:', { code, cleanMessage: message });
  } else {
    console.error('[Auth Flow] Detalhes do erro Firebase:', { code, message, errorObj: err });
  }

  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'E-mail ou senha incorretos. Verifique suas credenciais ou utilize a recuperação de senha.';
  } else if (code === 'auth/invalid-email') {
    return 'O formato do e-mail digitado é inválido. Verifique o endereço e tente novamente.';
  } else if (code === 'auth/email-already-in-use') {
    return 'Este e-mail já está cadastrado no sistema.';
  } else if (code === 'auth/weak-password') {
    return 'A senha informada é muito fraca (mínimo 6 caracteres).';
  } else if (code === 'auth/user-disabled') {
    return 'Esta conta de usuário foi desativada pelo administrador.';
  } else if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas malsucedidas. Por favor, aguarde alguns instantes ou redefina sua senha.';
  } else if (code === 'auth/operation-not-allowed') {
    return 'O provedor de e-mail/senha não está habilitado no console do Firebase.';
  } else if (code === 'auth/network-request-failed') {
    return 'Falha de conexão com o servidor. Verifique sua conexão com a internet.';
  } else if (code.includes('api-key-not-valid')) {
    return 'Chave de API do Firebase inválida. Entre em contato com o suporte.';
  }

  return code ? `Erro na autenticação (${code}).` : 'Ocorreu um erro ao processar sua autenticação.';
}

const LOCAL_STORAGE_USER_KEY = 'pedeai_custom_auth_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Exige validação oficial do Firebase Auth antes de conceder acesso na sessão
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
    // Clientes anônimos nunca recebem perfil administrativo ou de lojista
    if (user.isAnonymous) {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      setCurrentUser(null);
      return null;
    }

    try {
      console.log('[Auth Flow] Carregando perfil users/' + user.uid + ' do Firestore...');
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        
        // Bloquear usuário desativado
        if (profile.ativo === false) {
          console.warn('[Auth Flow] Conta desativada pelo administrador Master:', profile.email);
          await signOut(auth);
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          setCurrentUser(null);
          return null;
        }

        // Validação estrita do administrador inicial: somente o e-mail oficial autenticado no Firebase Auth
        if (user.email?.toLowerCase() === 'comercial@pedeai.com.br') {
          profile.role = 'superadmin';
        }

        console.log('[Auth Flow] Perfil users/' + user.uid + ' autenticado com sucesso:', {
          uid: profile.uid,
          email: profile.email,
          nome: profile.nome,
          role: profile.role,
          storeId: profile.storeId || 'NENHUM',
          ativo: profile.ativo ?? true,
        });

        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
        setCurrentUser(profile);
        return profile;
      } else {
        console.log('[Auth Flow] Documento users/' + user.uid + ' NÃO existe no Firestore. Verificando bootstrap...');

        // Tentar encontrar perfil existente pelo e-mail verificado do Auth
        if (user.email) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase().trim()));
            const snapEmail = await getDocs(q);
            if (!snapEmail.empty) {
              const profile = snapEmail.docs[0].data() as UserProfile;
              // Sincronizar o uid oficial do Firebase Auth
              profile.uid = user.uid;
              await setDoc(doc(db, 'users', user.uid), profile, { merge: true });

              if (profile.ativo === false) {
                await signOut(auth);
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                setCurrentUser(null);
                return null;
              }

              localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(profile));
              setCurrentUser(profile);
              return profile;
            }
          } catch (eEmail) {
            console.warn('[Auth Flow] Erro na consulta de perfil por e-mail:', eEmail);
          }
        }

        // Bootstrap seguro do primeiro administrador Master (apenas se autenticado com comercial@pedeai.com.br no Firebase Auth)
        if (user.email?.toLowerCase() === 'comercial@pedeai.com.br') {
          const masterProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            nome: 'Administrador Master',
            role: 'superadmin',
            ativo: true,
            criadoEm: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', user.uid), masterProfile, { merge: true });
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(masterProfile));
          setCurrentUser(masterProfile);
          return masterProfile;
        }

        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        setCurrentUser(null);
        return null;
      }
    } catch (err) {
      console.error('[Auth Flow] Erro ao ler users/' + user.uid + ' do Firestore:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth Flow] onAuthStateChanged disparado:', user ? `UID: ${user.uid} (${user.email || 'anônimo'})` : 'Usuário Firebase deslogado');
      setFirebaseUser(user);

      if (user && !user.isAnonymous) {
        await loadUserProfile(user);
      } else {
        // NUNCA restaura sessão do localStorage sem sessão ativa e verificada no Firebase Auth
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        if (isMounted) {
          setCurrentUser(null);
        }
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
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      return await loadUserProfile(auth.currentUser);
    }
    // Sem sessão Firebase Auth ativa e válida, o perfil deve ser nulo
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    return null;
  };

  const login = async (email: string, senha: string): Promise<LoginResult> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanSenha = senha.trim();
    console.log('[Auth Flow] Iniciando login com e-mail/senha:', cleanEmail);

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanSenha);
      console.log('[Auth Flow] Login com e-mail/senha aprovado pelo Firebase Auth. UID:', cred.user.uid);
      const profile = await loadUserProfile(cred.user);

      if (!profile) {
        return {
          success: false,
          message: 'Perfil de usuário não encontrado.',
        };
      }

      if (profile.ativo === false) {
        await signOut(auth);
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        setCurrentUser(null);
        return {
          success: false,
          message: 'Esta conta de usuário foi desativada pelo administrador Master. Entre em contato com o suporte.',
        };
      }

      return { success: true, user: profile };
    } catch (err: any) {
      console.error('[Auth Flow] Erro na autenticação Firebase Auth:', err);
      return {
        success: false,
        errorCode: err?.code,
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
        message: 'Link oficial de redefinição de senha enviado para seu e-mail! Verifique sua caixa de entrada e spam.',
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
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    try {
      sessionStorage.removeItem('pedeai_active_store_id');
      localStorage.removeItem('pedeai_active_store_id');
    } catch {}
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
