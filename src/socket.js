import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from './api';

let socket = null;
let socketToken = null;

/** Idempotent: calling it twice with the same login returns the same connection (React StrictMode runs effects twice in dev). */
export function connectSocket() {
  const token = localStorage.getItem('token');
  if (socket && socketToken === token) return socket;
  disconnectSocket();
  socketToken = token;
  socket = io(API_ORIGIN || undefined, { auth: { token } });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}

export const getSocket = () => socket;

/** Subscribe to a server push event for as long as the component is mounted. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    if (!s) return undefined;
    const fn = (...args) => ref.current(...args);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event]);
}
