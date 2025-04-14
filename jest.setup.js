// Import Jest DOM matchers
import '@testing-library/jest-dom';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    pathname: '/',
    asPath: '/',
  }),
}));

// Mock WebSocket and RTCPeerConnection for tests
global.WebSocket = class MockWebSocket {
  constructor() {
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 50);
  }
  send() {}
  close() {}
};

global.RTCPeerConnection = class MockRTCPeerConnection {
  constructor() {
    this.onicecandidate = null;
    this.onconnectionstatechange = null;
    this.ondatachannel = null;
    this.connectionState = 'new';
  }
  createDataChannel() {
    return {
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      send: jest.fn(),
      close: jest.fn(),
    };
  }
  createOffer() {
    return Promise.resolve({});
  }
  createAnswer() {
    return Promise.resolve({});
  }
  setLocalDescription() {
    return Promise.resolve();
  }
  setRemoteDescription() {
    return Promise.resolve();
  }
  addIceCandidate() {
    return Promise.resolve();
  }
  close() {}
};

// Mock crypto for browser
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: {
    digest: () => Promise.resolve(new ArrayBuffer(32)),
  },
};

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Polyfill for TextEncoder/TextDecoder
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Buffer polyfill
global.Buffer = require('buffer/').Buffer;
