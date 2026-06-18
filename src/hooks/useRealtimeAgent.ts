'use client';

/**
 * useRealtimeAgent — version Groq + Web Speech API
 *
 * Architecture :
 *   Micro → SpeechRecognition (browser) → /api/chat (Groq llama-3.3-70b)
 *           → tool calls exécutés browser-side → historique reconstitué
 *           → /api/chat (2e tour avec historique complet) → réponse finale
 *           → SpeechSynthesis (browser) → état idle → relance l'écoute
 *
 * Interface publique IDENTIQUE à la version OpenAI Realtime :
 *   connect, disconnect, speakFromContext, injectContext,
 *   cancelResponse, toggleMute, getTranscript, state, caption, muted
 *
 * Compatibilité :
 *   ✅ Chrome, Edge (SpeechRecognition natif)
 *   ✅ Safari 14.1+ (webkitSpeechRecognition)
 *   ⚠️  Firefox : SpeechRecognition absent → état 'error' + message console
 */

import { useCallback, useRef, useState } from 'react';
import type { TranscriptEntry } from '@/lib/types';

export type AgentState =
  | 'off'
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface UseRealtimeAgentOptions {
  getSessionPayload: () => {
    propertyId: string;
    visitId: string | null;
    mode: string;
    visitorLabel?: string;
  };
  onToolCall: ToolHandler;
  onUserUtterance?: (text: string) => void;
  onAssistantUtterance?: (text: string) => void;
  onSpeechStarted?: () => void;
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type ChatMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: unknown[];
};

type ToolCall = { callId: string; name: string; args: Record<string, unknown> };

// ----------------------------------------------------------------
export function useRealtimeAgent(opts: UseRealtimeAgentOptions) {
  const [state, setState] = useState<AgentState>('off');
  const [caption, setCaption] = useState('');
  const [muted, setMuted] = useState(false);

  // Refs stables
  const optsRef        = useRef(opts);
  optsRef.current      = opts;

  const messagesRef    = useRef<ChatMessage[]>([]);   // historique de conv
  const transcriptRef  = useRef<TranscriptEntry[]>([]);
  const activeRef      = useRef(false);               // true entre connect et disconnect
  const mutedRef       = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speakingRef    = useRef(false);               // SpeechSynthesis en cours
  const pendingNarRef  = useRef<(() => void) | null>(null); // resolver speakFromContext

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  const pushTranscript = (role: 'user' | 'assistant', text: string) => {
    if (!text.trim()) return;
    transcriptRef.current.push({ role, text: text.trim(), at: new Date().toISOString() });
  };

  // ----------------------------------------------------------------
  // SpeechSynthesis — parole de l'agent
  // ----------------------------------------------------------------
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text.trim() || !activeRef.current) { resolve(); return; }

      window.speechSynthesis.cancel(); // annuler toute parole précédente

      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'fr-FR';
      utt.rate = 1.05;
      utt.pitch = 1.0;

      // Choisir une voix française si disponible
      const voices = window.speechSynthesis.getVoices();
      const frVoice = voices.find(
        (v) => v.lang.startsWith('fr') && !v.name.toLowerCase().includes('compact')
      );
      if (frVoice) utt.voice = frVoice;

      setState('speaking');
      speakingRef.current = true;
      setCaption(text);

      utt.onend = () => {
        speakingRef.current = false;
        setTimeout(() => setCaption(''), 1500);
        if (activeRef.current) setState('idle');
        resolve();
        // Résolution narration guidée si en attente
        if (pendingNarRef.current) {
          pendingNarRef.current();
          pendingNarRef.current = null;
        }
      };

      utt.onerror = () => {
        speakingRef.current = false;
        if (activeRef.current) setState('idle');
        resolve();
      };

      window.speechSynthesis.speak(utt);
    });
  }, []);

  // ----------------------------------------------------------------
  // /api/chat — appel Groq + gestion tool calls (2 tours)
  //
  // FIX BUG 1 : protocole tool calls corrigé.
  // Le 1er tour retourne { toolCalls, assistantMsg }.
  // On reconstruit l'historique complet côté client :
  //   user → assistant(tool_calls) → tool results
  // puis on envoie tout dans messages au 2e tour (sans toolResults séparés).
  // Groq reçoit ainsi la séquence valide et ne retourne plus d'erreur 400.
  // ----------------------------------------------------------------
  const callGroq = useCallback(async (
    extraMessages: ChatMessage[] = [],
  ): Promise<string> => {
    const payload = optsRef.current.getSessionPayload();
    const allMessages = [...messagesRef.current, ...extraMessages];

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: payload.propertyId,
        visitId: payload.visitId,
        mode: payload.mode,
        messages: allMessages,
      }),
    });

    if (!res.ok) throw new Error(`/api/chat ${res.status}`);
    const data = await res.json() as {
      reply: string;
      toolCalls?: ToolCall[];
      assistantMsg?: ChatMessage;
    };

    // ---- Tool calls → exécuter côté browser, reconstruire historique, 2e appel ----
    if (data.toolCalls?.length) {
      // 1. Exécuter tous les tools en parallèle
      const results = await Promise.all(
        data.toolCalls.map(async (tc) => {
          let result: unknown;
          try {
            result = await optsRef.current.onToolCall(tc.name, tc.args);
          } catch (e) {
            result = { error: e instanceof Error ? e.message : 'tool error' };
          }
          return { callId: tc.callId, name: tc.name, result };
        })
      );

      // 2. Reconstruire l'historique complet AVANT le 2e appel :
      //    user message(s) → assistant message (avec tool_calls) → tool results
      messagesRef.current.push(...extraMessages);

      if (data.assistantMsg) {
        messagesRef.current.push(data.assistantMsg);
      }

      for (const r of results) {
        messagesRef.current.push({
          role: 'tool',
          tool_call_id: r.callId,
          name: r.name,
          content: JSON.stringify(r.result ?? { ok: true }),
        });
      }

      // 3. 2e appel : pas d'extraMessages, l'historique est complet dans messagesRef
      return callGroq([]);
    }

    // ---- Réponse finale : mettre à jour l'historique ----
    if (extraMessages.length) messagesRef.current.push(...extraMessages);
    if (data.reply) {
      messagesRef.current.push({ role: 'assistant', content: data.reply });
    }

    return data.reply ?? '';
  }, []);

  // ----------------------------------------------------------------
  // SpeechRecognition — écoute du visiteur
  // ----------------------------------------------------------------
  const startListening = useCallback(() => {
    if (!activeRef.current || mutedRef.current || speakingRef.current) return;

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.error('[Agent] SpeechRecognition non supporté sur ce navigateur (Firefox ?)');
      setState('error');
      return;
    }

    const recognition: SpeechRecognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (activeRef.current) setState('listening');
    };

    recognition.onspeechstart = () => {
      optsRef.current.onSpeechStarted?.();
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (!transcript.trim() || !activeRef.current) return;

      pushTranscript('user', transcript);
      optsRef.current.onUserUtterance?.(transcript.trim());
      setState('thinking');

      try {
        const userMsg: ChatMessage = { role: 'user', content: transcript };
        const reply = await callGroq([userMsg]);

        if (reply && activeRef.current) {
          pushTranscript('assistant', reply);
          optsRef.current.onAssistantUtterance?.(reply);
          await speak(reply);
        }
      } catch (e) {
        console.error('[Agent] callGroq error', e);
      }

      // Relancer l'écoute après la réponse
      if (activeRef.current && !mutedRef.current) {
        setTimeout(() => startListening(), 300);
      }
    };

    recognition.onerror = (event) => {
      // 'no-speech' est normal (silence) → relancer discrètement
      if (event.error === 'no-speech') {
        if (activeRef.current && !mutedRef.current && !speakingRef.current) {
          setTimeout(() => startListening(), 200);
        }
        return;
      }
      // 'aborted' = annulation volontaire (mute, disconnect…)
      if (event.error === 'aborted') return;
      console.warn('[Agent] SpeechRecognition error', event.error);
      if (activeRef.current) setState('idle');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognition.start();
  }, [callGroq, speak]);

  // ----------------------------------------------------------------
  // connect — démarre l'agent
  // ----------------------------------------------------------------
  const connect = useCallback(async () => {
    if (activeRef.current) return;
    setState('connecting');
    activeRef.current = true;
    messagesRef.current = [];
    transcriptRef.current = [];

    try {
      // Attendre que les voix soient chargées (Safari / Chrome au 1er chargement)
      if (window.speechSynthesis.getVoices().length === 0) {
        await new Promise<void>((res) => {
          window.speechSynthesis.onvoiceschanged = () => res();
          setTimeout(res, 2000); // timeout fallback
        });
      }

      setState('idle');

      // Message d'accueil initial
      setState('thinking');
      const greeting = await callGroq([
        {
          role: 'user',
          content: "__init__: Le visiteur vient d'arriver dans la visite. Accueille-le chaleureusement, présente-toi et propose-lui de commencer la visite ou de poser ses questions.",
        },
      ]);

      if (greeting && activeRef.current) {
        pushTranscript('assistant', greeting);
        optsRef.current.onAssistantUtterance?.(greeting);
        await speak(greeting);
      }

      // Lancer l'écoute
      if (activeRef.current) startListening();

    } catch (e) {
      console.error('[Agent] connect error', e);
      setState('error');
      activeRef.current = false;
    }
  }, [callGroq, speak, startListening]);

  // ----------------------------------------------------------------
  // disconnect
  // ----------------------------------------------------------------
  const disconnect = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    setState('off');
    setCaption('');
  }, []);

  // ----------------------------------------------------------------
  // speakFromContext — narration visite guidée
  // Renvoie une Promise résolue quand l'agent finit de parler.
  // ----------------------------------------------------------------
  const speakFromContext = useCallback((instructions: string): Promise<void> => {
    return new Promise(async (resolve) => {
      // Arrêter l'écoute pendant la narration
      recognitionRef.current?.abort();
      recognitionRef.current = null;

      setState('thinking');
      try {
        const narMsg: ChatMessage = {
          role: 'user',
          content: `__narration__: ${instructions}`,
        };
        const reply = await callGroq([narMsg]);

        if (reply && activeRef.current) {
          pushTranscript('assistant', reply);
          optsRef.current.onAssistantUtterance?.(reply);
          // Stocker le resolver pour que speak() le déclenche à la fin
          pendingNarRef.current = resolve;
          await speak(reply);
        } else {
          resolve();
        }
      } catch (e) {
        console.error('[Agent] speakFromContext error', e);
        resolve();
      }

      // Reprendre l'écoute après narration
      if (activeRef.current && !mutedRef.current) {
        setTimeout(() => startListening(), 300);
      }
    });
  }, [callGroq, speak, startListening]);

  // ----------------------------------------------------------------
  // injectContext — contexte silencieux (changement de pièce, idle…)
  // ----------------------------------------------------------------
  const injectContext = useCallback((text: string, withResponse = true) => {
    messagesRef.current.push({ role: 'user', content: `__context__: ${text}` });

    if (!withResponse || !activeRef.current) return;

    // Réponse discrète sans interrompre une parole en cours
    if (speakingRef.current) return;

    (async () => {
      try {
        setState('thinking');
        const reply = await callGroq();
        if (reply && activeRef.current && !speakingRef.current) {
          pushTranscript('assistant', reply);
          optsRef.current.onAssistantUtterance?.(reply);
          await speak(reply);
          if (activeRef.current && !mutedRef.current) startListening();
        }
      } catch (e) {
        console.warn('[Agent] injectContext error', e);
        if (activeRef.current) setState('idle');
      }
    })();
  }, [callGroq, speak, startListening]);

  // ----------------------------------------------------------------
  // cancelResponse — interruption
  // ----------------------------------------------------------------
  const cancelResponse = useCallback(() => {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    pendingNarRef.current = null;
    if (activeRef.current) setState('idle');
  }, []);

  // ----------------------------------------------------------------
  // toggleMute
  // ----------------------------------------------------------------
  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);

    if (mutedRef.current) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    } else if (activeRef.current && !speakingRef.current) {
      setTimeout(() => startListening(), 200);
    }
  }, [startListening]);

  // ----------------------------------------------------------------
  return {
    state,
    caption,
    muted,
    connect,
    disconnect,
    speakFromContext,
    injectContext,
    cancelResponse,
    toggleMute,
    getTranscript: () => transcriptRef.current,
  };
}
