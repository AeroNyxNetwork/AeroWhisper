// src/types/validation.ts

// Import the interfaces defined for payloads and core types
import {
    MessagePayload,
    ChatInfoPayload,
    ParticipantsPayload,
    WebRTCSignalPayload,
    KeyRotationRequestPayload,
    KeyRotationResponsePayload,
    ChatInfo, // Import nested types if needed for deeper validation
    Participant // Import nested types if needed for deeper validation
} from '../lib/socket/types'; // Adjust path if your types are elsewhere

// --- Helper Type Guards ---

/**
 * Checks if a value is a non-null object.
 * @param value The value to check.
 * @returns True if the value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Checks if a value is a string and optionally non-empty.
 * @param value The value to check.
 * @param allowEmpty Whether to allow empty strings (default: false).
 * @returns True if the value is a string matching the criteria.
 */
function isString(value: unknown, allowEmpty: boolean = false): value is string {
    return typeof value === 'string' && (allowEmpty || value.length > 0);
}

/**
 * Checks if a value is a number.
 * @param value The value to check.
 * @returns True if the value is a number.
 */
function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * Checks if a value is a boolean.
 * @param value The value to check.
 * @returns True if the value is a boolean.
 */
function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

// --- Payload Type Guards ---

/**
 * Type guard for MessagePayload objects.
 * Checks essential fields and their types.
 */
export function isMessageType(payload: any): payload is MessagePayload {
    if (!isObject(payload)) return false;

    return (
        payload.type === 'message' &&
        isString(payload.id) &&
        isString(payload.content, true) && // Allow empty content? Adjust if needed
        isString(payload.senderId) &&
        isString(payload.senderName, true) && // Allow potentially empty senderName?
        isString(payload.timestamp) // Check if it's a valid ISO string if necessary
        // Optional checks for status, isEncrypted based on your needs
    );
}

/**
 * Type guard for ChatInfoPayload objects.
 * Checks the 'data' object and some of its key fields.
 */
export function isChatInfoPayload(payload: any): payload is ChatInfoPayload {
    if (!isObject(payload)) return false;

    if (payload.type === 'chatInfo' && isObject(payload.data)) {
        // Perform basic checks on the nested data object
        const data = payload.data;
        return (
            isString(data.id) &&
            isString(data.name, true) && // Allow potentially empty chat name?
            isString(data.createdBy) &&
            isString(data.createdAt) &&
            isNumber(data.participantCount) &&
            isBoolean(data.useP2P) &&
            isBoolean(data.isEncrypted)
            // Add checks for other mandatory fields in ChatInfo if needed
        );
    }
    return false;
}

/**
 * Type guard for ParticipantsPayload objects.
 * Checks if 'data' is an array. Optionally checks array elements.
 */
export function isParticipantsPayload(payload: any): payload is ParticipantsPayload {
    if (!isObject(payload)) return false;

    if (payload.type === 'participants' && Array.isArray(payload.data)) {
        // Optional: Add a check for the structure of elements within the array
        // For performance, you might only check the first element or skip deep checks
        // if (payload.data.length > 0 && !isParticipant(payload.data[0])) {
        //     console.warn("First participant in payload data has invalid structure");
        //     return false;
        // }
        return true; // Primarily check if 'data' is an array
    }
    return false;
}

// Optional: Helper type guard for individual Participant objects if deep checking is needed
function isParticipant(participant: any): participant is Participant {
    if (!isObject(participant)) return false;
    return (
        isString(participant.id) &&
        isString(participant.name) &&
        isString(participant.publicKey) &&
        (participant.status === 'online' || participant.status === 'offline' || participant.status === 'away')
    );
}

/**
 * Type guard for WebRTCSignalPayload objects.
 * Checks essential fields for WebRTC signaling.
 */
export function isWebRTCSignalPayload(payload: any): payload is WebRTCSignalPayload {
    if (!isObject(payload)) return false;

    return (
        payload.type === 'webrtc-signal' &&
        isString(payload.peerId) &&
        isString(payload.signalType) &&
        ['offer', 'answer', 'candidate'].includes(payload.signalType) &&
        payload.signalData !== undefined // Check existence, specific type depends on signalType
        // Optional: Add deeper validation based on signalType
        // if (payload.signalType === 'offer' || payload.signalType === 'answer') {
        //     return isObject(payload.signalData) && isString(payload.signalData.sdp);
        // } else if (payload.signalType === 'candidate') {
        //     return isObject(payload.signalData) && (payload.signalData.candidate !== undefined || payload.signalData.sdpMid !== undefined);
        // }
    );
}

/**
 * Type guard for KeyRotationRequestPayload objects.
 * Placeholder - Adjust based on your actual key rotation protocol.
 */
export function isKeyRotationRequestPayload(payload: any): payload is KeyRotationRequestPayload {
     if (!isObject(payload)) return false;

     // Check for possible type strings if both client and server can initiate
     const typeMatch = payload.type === 'request-key-rotation' || payload.type === 'KeyRotationRequest';

     return (
        typeMatch &&
        (payload.sessionId === undefined || isString(payload.sessionId)) && // Allow optional sessionId
        isNumber(payload.timestamp)
        // Add checks for other mandatory fields defined in your protocol
     );
}

/**
 * Type guard for KeyRotationResponsePayload objects.
 * Placeholder - Adjust based on your actual key rotation protocol.
 */
export function isKeyRotationResponsePayload(payload: any): payload is KeyRotationResponsePayload {
     if (!isObject(payload)) return false;

     const typeMatch = payload.type === 'key-rotation-response' || payload.type === 'KeyRotationResponse';

     return (
        typeMatch &&
        isString(payload.rotation_id) && // Assuming rotation_id is mandatory
        isString(payload.status) &&
        ['success', 'failure'].includes(payload.status) &&
        // Optional fields - check only if they exist
        (payload.encrypted_key === undefined || Array.isArray(payload.encrypted_key)) &&
        (payload.key_nonce === undefined || Array.isArray(payload.key_nonce)) &&
        (payload.message === undefined || isString(payload.message, true))
        // Add checks for other mandatory fields defined in your protocol
     );
}

/**
 * Generic structure validation fallback (optional).
 * Checks only for the existence of a 'type' property.
 * @param message The parsed message object.
 * @returns True if the message has a 'type' property.
 */
export function validateMessageStructure(message: any): boolean {
    return isObject(message) && typeof message.type === 'string';
}

/**
 * Validate a generic payload against expected schema
 * This is a more flexible validation approach for dynamic payloads
 * @param payload Payload to validate
 * @param schema Schema defining required properties and their types
 * @returns True if payload matches schema
 */
export function validatePayload(
    payload: any, 
    schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'>
): boolean {
    if (!isObject(payload)) return false;
    
    for (const [key, type] of Object.entries(schema)) {
        // Check if required key exists
        if (!(key in payload)) return false;
        
        const value = payload[key];
        
        // Check type
        switch (type) {
            case 'string':
                if (typeof value !== 'string') return false;
                break;
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) return false;
                break;
            case 'boolean':
                if (typeof value !== 'boolean') return false;
                break;
            case 'object':
                if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
                break;
            case 'array':
                if (!Array.isArray(value)) return false;
                break;
            case 'any':
                if (value === undefined) return false;
                break;
            default:
                return false; // Unexpected schema type
        }
    }
    
    return true;
}

/**
 * Validate nested data structure recursively
 * @param data Data to validate
 * @param schema Nested schema with type information
 * @returns True if data matches schema
 */
export function validateNestedStructure(
    data: any,
    schema: {
        type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'any';
        properties?: Record<string, any>;
        items?: any;
        required?: boolean;
    }
): boolean {
    // Handle null/undefined
    if (data === null || data === undefined) {
        return schema.required === false;
    }
    
    // Check type
    switch (schema.type) {
        case 'string':
            return typeof data === 'string';
            
        case 'number':
            return typeof data === 'number' && !isNaN(data);
            
        case 'boolean':
            return typeof data === 'boolean';
            
        case 'object':
            if (!isObject(data)) return false;
            
            // If properties are defined, check each one
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    // Skip if property is not required and is missing
                    if (!(key in data) && !propSchema.required) continue;
                    
                    // Validate the property recursively
                    if (!validateNestedStructure(data[key], propSchema)) {
                        return false;
                    }
                }
            }
            return true;
            
        case 'array':
            if (!Array.isArray(data)) return false;
            
            // If items schema is defined, check each item
            if (schema.items) {
                for (const item of data) {
                    if (!validateNestedStructure(item, schema.items)) {
                        return false;
                    }
                }
            }
            return true;
            
        case 'any':
            return true;
            
        default:
            return false;
    }
}

// --- Additional Security Validation Functions ---

/**
 * Validate a string parameter to prevent XSS and injection attacks
 * @param input String to validate
 * @param maxLength Maximum allowed length (default: 1000)
 * @returns Sanitized string or null if invalid
 */
export function validateAndSanitizeString(input: string, maxLength: number = 1000): string | null {
    if (typeof input !== 'string') return null;
    
    // Limit length
    if (input.length > maxLength) return null;
    
    // Remove dangerous HTML tags and attributes
    // This is a simple approach - use a dedicated library for production
    const sanitized = input
        .replace(/<(|\/|[^>\/bi]|\/[^>bi]|[^\/>][^>]+|\/[^>][^>]+)>/g, '')
        .replace(/javascript:/gi, 'blocked-js:')
        .replace(/data:/gi, 'blocked-data:')
        .replace(/on\w+=/gi, 'blocked-event=');
    
    return sanitized;
}

/**
 * Validate a numeric parameter within range
 * @param input Value to validate
 * @param min Minimum allowed value (default: 0)
 * @param max Maximum allowed value (default: Number.MAX_SAFE_INTEGER)
 * @returns Validated number or null if invalid
 */
export function validateNumericRange(
    input: number, 
    min: number = 0, 
    max: number = Number.MAX_SAFE_INTEGER
): number | null {
    if (typeof input !== 'number' || isNaN(input)) return null;
    if (input < min || input > max) return null;
    return input;
}

/**
 * Validate an object ID (for protection against database ID attacks)
 * @param id ID to validate
 * @param pattern Optional regex pattern (default: alphanumeric + common delimiters)
 * @returns Validated ID or null if invalid
 */
export function validateId(
    id: string, 
    pattern: RegExp = /^[a-zA-Z0-9_\-.:]+$/
): string | null {
    if (typeof id !== 'string') return null;
    if (!pattern.test(id)) return null;
    if (id.length > 100) return null; // Reasonable maximum length
    return id;
}
