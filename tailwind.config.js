/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#EA580C',
          green: '#064E3B',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
