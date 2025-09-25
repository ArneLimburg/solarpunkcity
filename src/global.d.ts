import earcut from 'earcut';

type earcutType = typeof earcut;

declare global {
  interface Window {
    earcut: earcutType;
  }
}