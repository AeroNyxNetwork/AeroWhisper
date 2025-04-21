import { ReconnectionConfig } from './types';

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  initialDelay: 1000, // Start with 1 second delay
  maxDelay: 30000,    // Max delay of 30 seconds
  maxAttempts: 10,    // Max 10 reconnection attempts
  jitter: true        // Add randomness to prevent thundering herd
};

/**
 * Calculate backoff delay for reconnection using exponential backoff
 * @param attempt Current reconnection attempt
 * @param config Reconnection configuration
 * @returns Delay in milliseconds before next reconnection attempt
 */
export function calculateBackoffDelay(attempt: number, config: ReconnectionConfig): number {
  // Calculate base delay with exponential increase
  const baseDelay = Math.min(
    config.maxDelay,
    config.initialDelay * Math.pow(2, attempt)
  );
  
  // Add jitter to prevent thundering herd
  const jitter = config.jitter ? 
    (Math.random() * 0.3 + 0.85) : // 0.85-1.15 randomization factor
    1;
  
  return Math.floor(baseDelay * jitter);
}

/**
 * Check if reconnection should be attempted based on error code
 * @param code WebSocket close code or error code
 * @returns True if reconnection should be attempted
 */
export function shouldAttemptReconnect(code: number): boolean {
  // Common codes where reconnection makes sense
  const reconnectCodes = [1000, 1001, 1006, 1012, 1013];
  return reconnectCodes.includes(code);
}

/**
 * Check if more reconnection attempts should be made
 * @param attempts Current number of attempts
 * @param maxAttempts Maximum allowed attempts
 * @returns True if more reconnection attempts should be made
 */
export function canRetry(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts;
}

/**
 * Calculate status message based on reconnection attempt
 * @param attempt Current reconnection attempt
 * @param maxAttempts Maximum allowed attempts
 * @param delay Delay before next attempt in ms
 * @returns User-friendly status message
 */
export function getReconnectionStatus(attempt: number, maxAttempts: number, delay: number): string {
  const delaySeconds = Math.ceil(delay / 1000);
  return `Reconnecting: Attempt ${attempt}/${maxAttempts} in ${delaySeconds}s`;
}

/**
 * Format reconnection event data
 * @param attempt Current reconnection attempt
 * @param maxAttempts Maximum allowed attempts
 * @param delay Delay before next attempt in ms
 * @returns Object with reconnection information
 */
export function createReconnectionEvent(attempt: number, maxAttempts: number, delay: number) {
  return {
    attempt,
    maxAttempts,
    delay,
    delaySeconds: Math.ceil(delay / 1000),
    progress: attempt / maxAttempts
  };
}
