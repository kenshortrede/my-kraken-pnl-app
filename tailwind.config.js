/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",      // If you have an `app` dir under `src`
    "./src/pages/**/*.{js,ts,jsx,tsx}",    // If you also have a `pages` dir
    "./src/components/**/*.{js,ts,jsx,tsx}", // If you keep components here
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
