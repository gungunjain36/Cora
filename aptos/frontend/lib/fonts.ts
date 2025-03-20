// For React Vite, we'll use CSS imports instead of Next.js font system

// Define font family variables
export const FONT_NEUE_POWER = '--font-neue-power';
export const FONT_BAI_JAMJUREE = '--font-bai-jamjuree';

// Create a function to load fonts
export function loadFonts() {
  // Create style element
  const style = document.createElement('style');
  
  // Define font-face declarations
  style.textContent = `
    @font-face {
      font-family: 'Neue Power';
      src: url('/fonts/NeuePowerTrial-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Neue Power';
      src: url('/fonts/NeuePowerTrial-Heavy.ttf') format('truetype');
      font-weight: 800;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/bai-jamjuree-regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/bai-jamjuree-500.woff2') format('woff2');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/bai-jamjuree-600.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    
    :root {
      ${FONT_NEUE_POWER}: 'Neue Power', sans-serif;
      ${FONT_BAI_JAMJUREE}: 'Bai Jamjuree', sans-serif;
    }
  `;
  
  // Append to head
  document.head.appendChild(style);
} 