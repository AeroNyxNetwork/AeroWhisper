// src/lib/socket/reconnection.ts
import { CloseCodes } from './networking';

/**
 * Reconnection strategy types
 */
export type ReconnectionStrategy = 'exponential' | 'linear' | 'fibonacci';

/**
 * Configuration for reconnection behavior
 */
export interface ReconnectionConfig {
  initialDelay: number;           // Initial delay in milliseconds
  maxDelay: number;               // Maximum delay cap in milliseconds
  maxAttempts: number;            // Maximum number of reconnection attempts (0 for infinite)
  jitter: boolean;                // Whether to add random jitter to the delay
  strategy?: ReconnectionStrategy; // Backoff strategy to use (default: exponential)
  resetThreshold?: number;        // Time threshold in ms to reset attempt counter
  timeoutFactor?: number;         // Factor to multiply delay by for connection timeout
}

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  initialDelay: 2000,   // Changed from 1000 to 2000ms
  maxDelay: 60000,      // Changed from 30000 to 60000ms (1 minute cap)
  maxAttempts: 3,       // Changed from 10 to 3
  jitter: true,
  strategy: 'exponential',
  resetThreshold: 60000, // 1 minute
  timeoutFactor: 1.5
};

/**
 * State for tracking reconnection attempts across multiple disconnects
 */
export interface ReconnectionState {
  attempts: number;         // Current attempt count
  lastAttempt: number;      // Timestamp of last attempt
  lastSuccess: number;      // Timestamp of last successful connection
  delays: number[];         // History of delays used
  codes: number[];          // History of close codes
  totalAttempts: number;    // Lifetime counter of reconnection attempts
}

/**
 * Creates a new reconnection state
 */
export function createReconnectionState(): ReconnectionState {
  return {
    attempts: 0,
    lastAttempt: 0,
    lastSuccess: 0,
    delays: [],
    codes: [],
    totalAttempts: 0
  };
}

/**
 * Updates reconnection state for a new attempt
 * @param state Current reconnection state
 * @param delay The calculated delay for this attempt
 * @param code Optional close code that triggered this attempt
 * @returns Updated reconnection state
 */
export function trackReconnectionAttempt(
  state: ReconnectionState,
  delay: number,
  code?: number
): ReconnectionState {
  const now = Date.now();
  return {
    ...state,
    attempts: state.attempts + 1,
    lastAttempt: now,
    delays: [...state.delays.slice(-9), delay], // Keep last 10 delays
    codes: code ? [...state.codes.slice(-9), code] : state.codes,
    totalAttempts: state.totalAttempts + 1
  };
}

/**
 * Resets the attempt counter if the connection was stable for the threshold period
 * @param state Current reconnection state
 * @param config Reconnection configuration
 * @returns Updated reconnection state with potentially reset attempt counter
 */
export function evaluateResetThreshold(
  state: ReconnectionState,
  config: ReconnectionConfig
): ReconnectionState {
  const now = Date.now();
  // Ensure threshold has a default value even if both config options are undefined
  const threshold = config.resetThreshold || DEFAULT_RECONNECTION_CONFIG.resetThreshold || 60000;
  
  // If we had a successful connection for longer than the threshold, reset attempts
  if (state.lastSuccess > 0 && (now - state.lastSuccess) > threshold) {
    return {
      ...state,
      attempts: 0,
      codes: [],
      delays: []
    };
  }
  
  return state;
}
/**
 * Calculates the reconnection delay using exponential backoff with optional jitter.
 * @param attempt The current reconnection attempt number (starting from 0).
 * @param config The reconnection configuration.
 * @returns The calculated delay in milliseconds.
 */
export function calculateBackoffDelay(
  attempt: number, 
  config: ReconnectionConfig
): number {
  const { 
    initialDelay, 
    maxDelay, 
    jitter, 
    strategy = 'exponential' 
  } = config;

  // Base delay calculation based on strategy
  let delay: number;
  
  switch (strategy) {
    case 'linear':
      // Linear: delay = initialDelay * attempt
      delay = initialDelay * Math.max(1, attempt);
      break;
      
    case 'fibonacci':
      // Fibonacci sequence (1, 1, 2, 3, 5, 8, 13, 21, ...)
      if (attempt <= 1) {
        delay = initialDelay;
      } else {
        // Calculate nth Fibonacci number (optimized)
        let a = 1, b = 1;
        for (let i = 2; i < attempt; i++) {
          const temp = a + b;
          a = b;
          b = temp;
        }
        delay = initialDelay * b;
      }
      break;
      
    case 'exponential':
    default:
      // More aggressive exponential backoff: delay = initialDelay * 2^min(attempt,6)
      // Cap the exponent at 6 to avoid overflow but still allow significant delay growth
      delay = initialDelay * Math.pow(2, Math.min(attempt, 6)); 
      break;
  }
  
  // Apply jitter if enabled
  if (jitter) {
    // Add random jitter between -15% and +15% of the current delay
    const jitterFactor = 1 + (Math.random() * 0.3 - 0.15);
    delay *= jitterFactor;
  }
  
  // Apply bounds: ensure minimum is initialDelay, maximum is maxDelay
  return Math.min(Math.max(Math.round(delay), initialDelay), maxDelay);
}
/**
 * Calculates connection timeout based on reconnection delay
 * @param delay The calculated reconnection delay
 * @param config Reconnection configuration
 * @returns Timeout duration in milliseconds
 */
export function calculateConnectionTimeout(
  delay: number,
  config: ReconnectionConfig
): number {
  const factor = config.timeoutFactor || DEFAULT_RECONNECTION_CONFIG.timeoutFactor || 1.5;
  return Math.round(delay * factor);
}

/**
 * Checks if reconnection should be attempted based on the current attempt count.
 * @param currentAttempts The number of attempts already made.
 * @param maxAttempts The maximum allowed attempts (0 means infinite).
 * @returns True if another attempt can be made, false otherwise.
 */
export function canRetry(currentAttempts: number, maxAttempts: number): boolean {
  // Infinite retries if maxAttempts is 0 or negative
  if (maxAttempts <= 0) {
    return true;
  }
  
  return currentAttempts < maxAttempts;
}

/**
 * Determines if a reconnection attempt should be made based on the WebSocket close code.
 * @param code The WebSocket close event code.
 * @returns True if the close code suggests a potentially temporary issue warranting reconnection.
 */
export function shouldAttemptReconnect(code: number): boolean {
  // Normal closures - don't reconnect
  if (code === CloseCodes.NORMAL_CLOSURE || code === CloseCodes.GOING_AWAY) {
    return false;
  }
  
  // Permanent errors - don't reconnect
  if (
    code === CloseCodes.AUTH_FAILED ||
    code === CloseCodes.POLICY_VIOLATION ||
    code === CloseCodes.CHAT_DELETED ||
    code === CloseCodes.KICKED
  ) {
    return false;
  }
  
  // Always reconnect for these specific codes
  if (
    code === CloseCodes.ABNORMAL_CLOSURE ||
    code === CloseCodes.SERVICE_RESTART ||
    code === CloseCodes.TRY_AGAIN_LATER
  ) {
    return true;
  }
  
  // For custom application error codes
  if (code >= 4000) {
    // Only reconnect for specific ranges that are known to be temporary
    return (code >= 4500 && code < 4600) || // Server errors
           (code >= 4200 && code < 4300);    // Temporary resource issues
  }
  
  // For all other codes (including abnormal closures), attempt reconnection
  return true;
}

/**
 * Analyzes reconnection patterns to detect potential issues
 * @param state Reconnection state
 * @returns Analysis result with warnings/recommendations or null if no issues detected
 */
export function analyzeReconnectionPatterns(
  state: ReconnectionState
): { issue: string; recommendation: string } | null {
  
  // Check for frequent disconnects
  if (state.attempts >= 3 && state.delays.length >= 3) {
    const timeSpan = state.lastAttempt - (state.lastSuccess || 0);
    
    // Rapid disconnects (multiple in a short period)
    if (timeSpan < 30000 && state.attempts >= 5) {
      return {
        issue: 'Rapid disconnections detected',
        recommendation: 'Check network stability or server connection limits'
      };
    }
    
    // Check for consistent error patterns
    if (state.codes.length >= 3) {
      const mostFrequentCode = findMostFrequentCode(state.codes);
      if (mostFrequentCode && mostFrequentCode.count >= 3) {
        return {
          issue: `Repeated close code ${mostFrequentCode.code} (${mostFrequentCode.count} times)`,
          recommendation: getRecommendationForCode(mostFrequentCode.code)
        };
      }
    }
  }
  
  return null;
}

/**
 * Finds the most frequent close code in the history
 */
function findMostFrequentCode(codes: number[]): { code: number; count: number } | null {
  if (codes.length === 0) return null;
  
  const counts = new Map<number, number>();
  let maxCode = codes[0];
  let maxCount = 1;
  
  for (const code of codes) {
    const count = (counts.get(code) || 0) + 1;
    counts.set(code, count);
    
    if (count > maxCount) {
      maxCode = code;
      maxCount = count;
    }
  }
  
  return { code: maxCode, count: maxCount };
}

/**
 * Gets a recommendation based on a specific close code
 */
function getRecommendationForCode(code: number): string {
  switch (code) {
    case CloseCodes.ABNORMAL_CLOSURE:
      return 'Network may be unstable or server might be dropping connections';
    case CloseCodes.SERVICE_RESTART:
      return 'Server is undergoing maintenance, try again later';
    case CloseCodes.TRY_AGAIN_LATER:
      return 'Server is experiencing high load, consider reducing connection frequency';
    case CloseCodes.MESSAGE_TOO_BIG:
      return 'Messages may be too large, consider reducing payload size';
    case CloseCodes.RATE_LIMITED:
      return 'You may be sending messages too frequently, implement rate limiting';
    default:
      return 'Consider investigating this specific close code pattern';
  }
}
