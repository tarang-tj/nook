// Lets a test read a file as text (Vite's "?raw" import).
declare module "*?raw" {
  const text: string;
  export default text;
}
