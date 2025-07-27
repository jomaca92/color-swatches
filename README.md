# Color Swatches

Given a user input for Lightness (L) and Saturation (S), this application will return all unqiue hue names from the color api (https://www.thecolorapi.com/).

## Project Summary

The core design decisions for this project centered around user experience and efficient API querying. For the user interface, I implemented a combination of sliders and number inputs, allowing for both intuitive control and precise value entry. During testing, I found myself wanting to explore random values, which inspired the addition of randomization buttons for each input. To optimize API interactions, I implemented debouncing between user input and API calls, preventing excessive requests during slider adjustments or value entry. The debounce delay is set at 200ms to make it nearly imperceivable. I added a loading indicator to the UI to give the user feedback while the application is loading colors. I leveraged Radix UI for the input components to make the UI more consistent and to leverage their accessibility features. Finally, I used the contrast color returned from the API to ensure the text color is always readable on the background color of each swatch.

For the API queries, I initially developed a solution that didn't assume any specific behaior about the API. I used the `useQueries` hook from TanStack Query to create parallel requests for each hue and efficently manage the state and refetching when the input is changed. Since the API does not appear to be rate limited, all the requests are started at the same time to avoid a request waterfall that would result in a slow experience. I wrapped all this logic in a custom hook that returned the colors and a loading state called `useColorsParallel` to make it easy to reuse this logic in any component. I implemented a second custom hook for fetching colors that assumed the API color names progressed in one direction: `useColorsDivideAndConquer`. This hook uses a recursive function to repeatedly split the hue range into two and query the colors in each half until an interval is found that starts and ends with the same unique color name or the start and end are adjacent. This solution greatly reduced the number of requests made to the API (with as little as 4 requests for a color like white). I left both strategies in the codebase, but left the latter as the enabled option. You can toggle between the two strategies by commenting out the call to the `useColorsDivideAndConquer` hook in the `App.jsx` file and uncommenting the call to the `useColorsParallel` hook.

## Tech Stack

- Vite
- React
- Tanstack Query
- Radix UI (Shadcn UI)
- Tailwind CSS
- Lucide Icons

## Running Locally

1. Clone the repository
2. Run `npm install` to install the dependencies
3. Run `npm run dev` to start the development server
