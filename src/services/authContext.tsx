import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
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
        
        // Bloquear usuário desativado
        if (profile.ativo === false) {
          console.warn('[Auth Flow] Conta desativada pelo administrador Master:', profile.email);
          await signOut(auth);
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          setCurrentUser(null);
          return null;
        }

        // Se for o e-mail master padrão, garante role superadmin
        if (profile.email?.toLowerCase() === 'comercial@pedeai.com.br' || profile.email?.toLowerCase() === 'master@delivery.com') {
          profile.role = 'superadmin';
        }

        console.log('[Auth Flow] Perfil users/' + user.uid + ' encontrado:', {
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
        console.log('[Auth Flow] Documento users/' + user.uid + ' NÃO existe no Firestore. Verificando por e-mail...');

        // Tentar encontrar perfil existente pelo e-mail
        if (user.email) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase().trim()));
            const snapEmail = await getDocs(q);
            if (!snapEmail.empty) {
              const profile = snapEmail.docs[0].data() as UserProfile;
              // Sincronizar o uid se for diferente
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

        // Se for master padrão autenticado no Auth mas sem doc ainda
        if (user.email?.toLowerCase() === 'comercial@pedeai.com.br' || user.email?.toLowerCase() === 'master@delivery.com') {
          const masterProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            nome: 'Administrador Master',
            role: 'superadmin',
            ativo: true,
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
      console.log('[Auth Flow] onAuthStateChanged disparado:', user ? `UID: ${user.uid} (${user.email})` : 'Usuário Firebase deslogado');
      setFirebaseUser(user);
      if (user) {
        await loadUserProfile(user);
      } else {
        // Se não há usuário Firebase Auth, verificar se há sessão em cache de usuário administrativo/temporário
        const cachedRaw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as UserProfile;
            if (cached?.uid) {
              const snap = await getDoc(doc(db, 'users', cached.uid));
              if (snap.exists()) {
                const fresh = snap.data() as UserProfile;
                if (fresh.ativo === false) {
                  localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                  if (isMounted) setCurrentUser(null);
                } else {
                  if (isMounted) setCurrentUser(fresh);
                }
              } else {
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                if (isMounted) setCurrentUser(null);
              }
            }
          } catch {
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            if (isMounted) setCurrentUser(null);
          }
        } else {
          if (isMounted) setCurrentUser(null);
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
    if (auth.currentUser) {
      return await loadUserProfile(auth.currentUser);
    }
    if (currentUser?.uid) {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const fresh = snap.data() as UserProfile;
        if (fresh.ativo === false) {
          await logout();
          return null;
        }
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(fresh));
        setCurrentUser(fresh);
        return fresh;
      }
    }
    return null;
  };

  const login = async (email: string, senha: string): Promise<LoginResult> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanSenha = senha.trim();
    console.log('[Auth Flow] Iniciando login com e-mail/senha:', cleanEmail);

    // 1. Tentar primeiro via Firebase Auth oficial
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanSenha);
      console.log('[Auth Flow] Login com e-mail/senha aprovado pelo Firebase Auth. UID:', cred.user.uid);
      const profile = await loadUserProfile(cred.user);

      if (!profile) {
        // Fallback básico se perfil não foi retornado mas autenticou
        const basicProfile: UserProfile = {
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          nome: 'Usuário',
          role: cleanEmail === 'comercial@pedeai.com.br' ? 'superadmin' : 'owner',
          ativo: true,
        };
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(basicProfile));
        setCurrentUser(basicProfile);
        return { success: true, user: basicProfile };
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
      // 2. Se falhar no Firebase Auth (por exemplo credencial inválida, usuário criado diretamente no Firestore, ou senha temporária emitida pelo Master)
      console.warn('[Auth Flow] Firebase Auth não aceitou credencial diretamente. Verificando perfil no Firestore...');
      try {
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const userDoc = snap.docs[0].data() as UserProfile;

          // Verificar se a conta está desativada
          if (userDoc.ativo === false) {
            return {
              success: false,
              message: 'Esta conta de usuário foi desativada pelo administrador Master. Entre em contato com o suporte.',
            };
          }

          // Verificar se a senha informada bate com senhaTemporaria ou senha salva
          const matchTemp = userDoc.senhaTemporaria && userDoc.senhaTemporaria === cleanSenha;
          const matchPass = userDoc.senha && userDoc.senha === cleanSenha;

          if (matchTemp || matchPass) {
            console.log('[Auth Flow] Login autenticado com sucesso via credencial administrativa para:', cleanEmail);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userDoc));
            setCurrentUser(userDoc);
            return { success: true, user: userDoc };
          }
        }
      } catch (firestoreErr) {
        console.error('[Auth Flow] Erro ao consultar perfil no Firestore:', firestoreErr);
      }

      // Retorna erro amigável formatado
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
