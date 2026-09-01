/** @type {import('tailwindcss').Config} */
export default {
  content: ['./docs/index.html'],
  theme: {
    extend: {
      colors: {
        brisk: {
          purple: { 900:'#310D5E',800:'#4A148C',400:'#7C43BD',100:'#E1BEE7',50:'#F3E5F5' },
          yellow: { 900:'#F57F17',600:'#FBC02D',400:'#FFEB3B',100:'#FFF9C4',50:'#FFFDE7' },
          gray: { 950:'#1A1A1A',800:'#333333',600:'#757575',300:'#E0E0E0',50:'#FAFAFA' }
        }
      },
      fontFamily: {
        sans: ['Inter','system-ui','-apple-system','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif'],
        mono: ['ui-monospace','SFMono-Regular','SF Mono','Menlo','Consolas','Liberation Mono','monospace']
      }
    }
  }
}
