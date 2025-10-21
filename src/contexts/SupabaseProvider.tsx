import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// 🕒 GESTÃO INTELIGENTE DE HORÁRIOS DE FUNCIONAMENTO
// =============================================================================

const BUSINESS_HOURS_CONFIG = {
  days: {
    1: { name: 'Segunda', open: 8, close: 18, enabled: true },
    2: { name: 'Terça', open: 8, close: 18, enabled: true },
    3: { name: 'Quarta', open: 8, close: 18, enabled: true },
    4: { name: 'Quinta', open: 8, close: 18, enabled: true },
    5: { name: 'Sexta', open: 8, close: 18, enabled: true },
    6: { name: 'Sábado', open: 8, close: 13, enabled: true },
    0: { name: 'Domingo', open: 0, close: 0, enabled: false }
  }
};

const formatTime = (decimalHours: number): string => {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const getBusinessHoursStatus = (): { isOpen: boolean; message: string; nextChange?: string } => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHour + (currentMinutes / 60);

  const todayConfig = BUSINESS_HOURS_CONFIG.days[currentDay];
  
  if (!todayConfig || !todayConfig.enabled) {
    return { isOpen: false, message: `🔒 ${todayConfig?.name || 'Hoje'} - FECHADO` };
  }

  const isOpen = currentTime >= todayConfig.open && currentTime < todayConfig.close;
  
  if (isOpen) {
    return { isOpen: true, message: `🟢 ${todayConfig.name} - ABERTO (${formatTime(todayConfig.open)}h - ${formatTime(todayConfig.close)}h)`, nextChange: `Fecha às ${formatTime(todayConfig.close)}h` };
  } else {
    let nextDay = (currentDay + 1) % 7;
    while (BUSINESS_HOURS_CONFIG.days[nextDay] && !BUSINESS_HOURS_CONFIG.days[nextDay].enabled && nextDay !== currentDay) {
      nextDay = (nextDay + 1) % 7;
    }
    const nextDayConfig = BUSINESS_HOURS_CONFIG.days[nextDay];
    
    if (currentTime < todayConfig.open) {
        return { isOpen: false, message: `🔴 ${todayConfig.name} - FECHADO (abre às ${formatTime(todayConfig.open)}h)`, nextChange: `Abre às ${formatTime(todayConfig.open)}h` };
    }
    
    return { isOpen: false, message: `🔴 ${todayConfig.name} - FECHADO (abre ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h)`, nextChange: `Próxima abertura: ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h` };
  }
};


// =============================================================================
// ⚙️ CONFIGURAÇÕES DE PERFORMANCE E RESILIÊNCIA
// =============================================================================

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
const TOKEN_REFRESH_MARGIN = 15 * 60 * 1000; // 15 minutos (Renovação proativa)
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================================================
// 🏗️ COMPONENTE PRINCIPAL
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // Refs para o cliente e canal (garantem estabilidade e previnem loops)
    const supabaseClientRef = useRef<SupabaseClient<Database> | null>(null);
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

    // Estados para o Contexto e renderização
    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
    const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
    const [isChannelReady, setIsChannelReady] = useState(false); // Estado chave para o carregamento
    
    // Refs de controle
    const isRefreshingRef = useRef<boolean>(false);
    const reconnectAttemptsRef = useRef<number>(0);
    const lastEventTimeRef = useRef<number>(Date.now());
    const isActiveRef = useRef<boolean>(true);
    const setRealtimeAuthRef = useRef<((client: SupabaseClient<Database>) => Promise<boolean>) | null>(null); 

    // Log inicial
    useEffect(() => {
        const businessStatus = getBusinessHoursStatus();
        console.log(`🏪 ${businessStatus.message}`);
        if (businessStatus.nextChange) {
            console.log(`   ⏰ ${businessStatus.nextChange}`);
        }
    }, []);

    // Função 1: Obtém e valida o token
    const getTokenWithValidation = useCallback(async () => {
        try {
            const token = await getToken({ template: 'supabase' });
            if (!token) return null;

            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const exp = payload.exp * 1000;
                const remainingMinutes = Math.round((exp - Date.now()) / 1000 / 60);
                
                console.log(`[AUTH] Token expira em: ${remainingMinutes} minutos`);
                if (remainingMinutes < 5) console.warn('[AUTH] Token prestes a expirar');
                
                return token;
            } catch (parseError) {
                console.error('[AUTH] Erro ao parsear token:', parseError);
                return token;
            }
        } catch (error) {
            console.error('[AUTH] Erro ao obter token:', error);
            return null;
        }
    }, [getToken]);

    // Função 2: Define o token de autenticação no cliente
    const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>): Promise<boolean> => {
        if (isRefreshingRef.current) {
            console.log('[AUTH] ⏳ Autenticação já em progresso');
            return false;
        }
        isRefreshingRef.current = true;
        console.log('[AUTH] 3. Processo de autenticação do cliente iniciado.');

        try {
            if (!client) return false;

            // 🟢 CORREÇÃO CRÍTICA: Lógica para usuários anônimos (rotas públicas/cardápio)
            if (!isSignedIn) { 
                console.log('[AUTH] ⚠️ Usuário não logado. Tentando Realtime anônimo.');
                try { 
                    await client.realtime.setAuth(null); // Limpa qualquer token residual
                    setConnectionHealthy(true); 
                    setRealtimeAuthCounter(prev => prev + 1);
                } catch (e) {
                    console.error('[AUTH] Falha ao limpar auth para anônimo', e);
                    return false;
                }
                return true; // Sucesso na configuração anônima
            }
            
            // CASO AUTENTICADO
            const token = await getTokenWithValidation();
            if (!token) {
                await client.realtime.setAuth(null);
                setConnectionHealthy(false);
                return false;
            }
            
            await client.realtime.setAuth(token); 
            console.log('[AUTH] ✅ Token aplicado com sucesso no cliente.');
            setConnectionHealthy(true);
            setRealtimeAuthCounter(prev => prev + 1);
            return true;
        } catch (error) {
            console.error('[AUTH] ‼️ Erro na autenticação:', error);
            setConnectionHealthy(false);
            return false;
        } finally {
            isRefreshingRef.current = false;
        }
    }, [isSignedIn, getTokenWithValidation]);
    
    // Atualiza a ref da função de autenticação
    useEffect(() => {
        setRealtimeAuthRef.current = setRealtimeAuth;
    }, [setRealtimeAuth]);


    // Função 4: Backoff exponencial otimizado
    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current || !supabaseClientRef.current) return;
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido. Parando.');
            return;
        }

        const client = supabaseClientRef.current;
        const delayTime = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        
        console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delayTime}ms (REATIVA)`);
        
        setTimeout(() => {
            if (isActiveRef.current && client) {
                // Chama forceChannelReconnect via Ref
                forceChannelReconnectRef.current?.(client, channel, 'REACTIVE');
            }
        }, delayTime);
    }, []); // Não depende de forceChannelReconnect diretamente, mas sim da sua Ref

    const forceChannelReconnectRef = useRef<((client: SupabaseClient<Database>, channel: RealtimeChannel, reason: 'PROACTIVE' | 'REACTIVE') => Promise<void>) | null>(null);

    // Função 3: Re-inscrição forçada
    const forceChannelReconnect = useCallback(async (client: SupabaseClient<Database>, channel: RealtimeChannel, reason: 'PROACTIVE' | 'REACTIVE') => {
        console.log(`[RECONNECT] 🧠 ${reason} - Forçando re-inscrição do canal...`);
        setConnectionHealthy(false); 

        // 1. Define o NOVO token no cliente (ou limpa para anônimo)
        const authSuccess = await setRealtimeAuth(client);
        
        if (!authSuccess) {
            console.warn('[RECONNECT] Falha ao obter/aplicar novo token. Abortando re-inscrição.');
            // O isChannelReady permanece false, mantendo o spinner.
            return;
        }

        // 2. Limpa o canal antes de re-inscrever
        if (channel.state !== 'closed' && channel.state !== 'errored') {
            console.log('[RECONNECT] Desinscrevendo do canal...');
            channel.unsubscribe(); 
        }

        // 3. Força a RE-INSCRIÇÃO.
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[RECONNECT] ✅ Sucesso: Canal re-inscrito com novo token.');
                reconnectAttemptsRef.current = 0;
                setConnectionHealthy(true);

                // ✅ CORREÇÃO DE CARREGAMENTO: Seta o estado de prontidão após a inscrição!
                if (!isChannelReady) { 
                    setIsChannelReady(true); 
                }
            } else if (status === 'CHANNEL_ERROR') {
                 console.error('[RECONNECT] ‼️ Erro ao re-inscrever. Acionando recuperação reativa.');
                 if (reason !== 'REACTIVE') handleReconnect(channel); 
            }
        });
    }, [setRealtimeAuth, isChannelReady, handleReconnect]);
    
    // Atualiza a ref da função de reconexão
    useEffect(() => {
        forceChannelReconnectRef.current = forceChannelReconnect;
    }, [forceChannelReconnect]);


    // Effect 1: Create Client and Channel (Inicialização Única)
    useEffect(() => {
        // Sai se já estiver carregado ou se o Clerk não carregou
        if (!isLoaded || supabaseClientRef.current) {
            return;
        }

        // 1. Cria o Cliente
        console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
        const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: {
                fetch: async (input, init) => {
                    const token = await getToken();
                    const headers = new Headers(init?.headers);
                    if (token) headers.set('Authorization', `Bearer ${token}`);
                    return fetch(input, { ...init, headers });
                },
            },
        });
        supabaseClientRef.current = client;
        setSupabaseClient(client); // Força o primeiro render

        // 2. Cria o Canal
        isActiveRef.current = true;
        console.log('[LIFECYCLE] 🚀 Inicializando canal realtime');
        const channel = client.channel('public:orders');
        realtimeChannelRef.current = channel;

        // 3. Configura Handlers
        channel.on('SUBSCRIBED', () => {
            if (!isActiveRef.current) return;
            console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
            setConnectionHealthy(true);
            lastEventTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', (error) => {
            if (!isActiveRef.current) return;
            console.warn(`[LIFECYCLE] ❌ Canal fechado. ${error?.reason ? `Motivo: ${error.reason}` : ''}. Acionando reconexão reativa.`);
            setConnectionHealthy(false);
            handleReconnect(channel);
        });

        channel.on('error', (error) => {
            if (!isActiveRef.current) return;
            console.error('[LIFECYCLE] 💥 Erro no canal:', error);
            setConnectionHealthy(false);
            handleReconnect(channel);
        });
        
        // Listener de eventos do banco (apenas para o health check)
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            () => lastEventTimeRef.current = Date.now() 
        );
        
        // 4. Inscrição Inicial - Chama via Ref (já atualizada)
        forceChannelReconnectRef.current?.(client, channel, 'PROACTIVE');

        // 5. Cleanup
        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando recursos (Cleanup do Init)');
            isActiveRef.current = false;
            client.removeChannel(channel); 
            realtimeChannelRef.current = null;
            supabaseClientRef.current = null;
        };
    }, [isLoaded, getToken, handleReconnect]);


    // Effect 2: Timers (Token Refresh e Health Check)
    useEffect(() => {
        const client = supabaseClientRef.current;
        const channel = realtimeChannelRef.current;
        
        if (!isChannelReady || !client || !channel) return;

        // HEALTH CHECK
        const healthCheckInterval = setInterval(() => {
            if (!isActiveRef.current) return;
            
            const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
            const isChannelSubscribed = channel.state === 'joined';
            const businessStatus = getBusinessHoursStatus();
            
            if (isChannelSubscribed && timeSinceLastEvent > 5 * 60 * 1000 && businessStatus.isOpen) {
                console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há 5+ minutos. Recuperação proativa.');
                forceChannelReconnect(client, channel, 'PROACTIVE');
            }
        }, HEALTH_CHECK_INTERVAL);

        // TOKEN REFRESH (PROATIVO)
        const tokenRefreshInterval = setInterval(() => {
            if (!isActiveRef.current || !isSignedIn) return;
            
            console.log('[TOKEN-REFRESH] 🔄 Refresh PROATIVO (15min). Forçando re-inscrição.');
            forceChannelReconnect(client, channel, 'PROACTIVE');
        }, TOKEN_REFRESH_MARGIN);

        return () => {
            clearInterval(healthCheckInterval);
            clearInterval(tokenRefreshInterval);
        };
    }, [isSignedIn, isChannelReady, forceChannelReconnect]);

    // Effect 3: Wake-Up Call (Mantido)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && supabaseClientRef.current && isSignedIn) {
                console.log('👁️ Aba visível - verificando conexão (apenas setAuth)');
                setRealtimeAuthRef.current?.(supabaseClientRef.current); 
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isSignedIn]);

    // Funções de Contexto para chamadas externas
    const refreshConnection = useCallback(async () => {
        const client = supabaseClientRef.current;
        const channel = realtimeChannelRef.current;

        if (client && channel) {
            console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
            await forceChannelReconnect(client, channel, 'PROACTIVE');
        }
    }, [forceChannelReconnect]);

    const requestReconnect = useCallback(async () => {
        await refreshConnection();
        return true;
    }, [refreshConnection]);

    // Condição de Bloqueio para o Spinner
    if (!supabaseClient || !isChannelReady) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Spinner size="large" />
            </div>
        );
    }

    // Renderização do Contexto
    return (
        <SupabaseContext.Provider value={{
            supabaseClient, 
            realtimeChannel: realtimeChannelRef.current,
            connectionHealthy,
            realtimeAuthCounter,
            requestReconnect,
            setRealtimeAuth: () => supabaseClient && setRealtimeAuthRef.current?.(supabaseClient).then(() => {}),
            refreshConnection,
        }}>
            {children}
            
            <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${
                connectionHealthy ? 'bg-green-500' : 'bg-red-500'
            } z-50 border border-white shadow-lg`} 
            title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} | ${getBusinessHoursStatus().message}`} />
        </SupabaseContext.Provider>
    );
}
