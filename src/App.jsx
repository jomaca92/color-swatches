import { useState, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useQueries } from '@tanstack/react-query'
import { SunMedium, Shuffle, SwatchBook, LoaderCircle } from 'lucide-react'

/******* Utility Functions *******/

/**
 * Fetch a color from the color API
 * 
 * @param {*} hue 
 * @param {*} saturation 
 * @param {*} lightness 
 * @param {*} signal AbortSignal to cancel the request
 * @returns {Promise<Color>}
 */
const fetchColor = (hue, saturation, lightness, signal) => {
  return fetch(`https://www.thecolorapi.com/id?hsl=(${hue},${saturation}%,${lightness}%)`, { signal }).then(res => res.json())
}

/**
 * Clamp a value between a minimum and maximum
 * 
 * @param {*} value 
 * @param {*} min default 0
 * @param {*} max default 100
 * @returns {number}
 */
function clamp(value, min=0, max=100) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Generate a random integer between a minimum and maximum
 * 
 * @param {*} max 
 * @param {*} min default 0
 * @returns {number}
 */
function randomInt(max, min=0) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/******* Custom Hooks *******/

/**
 * Debounce a value for a given delay so that updates are not triggered too often
 * 
 * @param {*} value 
 * @param {*} delay 
 * @returns value after the delay
 */
function useDebounce(value, delay) {
  // State for the debounced value
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {  
    // when the value changes, set a timeout that will update the debounced value after a delay
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    
    // clear the timeout if value changes or component unmounts preventing updates
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

/**
 * Fetch colors in parallel
 * 
 * @param {*} saturation 
 * @param {*} lightness 
 * @returns {[Array<Color>, boolean]} [colors, loading]
 */
function useColorsParallel(saturation, lightness) {
  // create a debounced value to use as query key so data is only fetched after a delay of inactivity
  const debouncedSaturation = useDebounce(saturation, 200) 
  const debouncedLightness = useDebounce(lightness, 200) 

  // create an array of hue steps to map over when creating the queries
  const hueSteps = Array.from({ length: 360 }, (_, i) => i)

  // fetch colors in parallel - Color API does not appear to be rate limited so we can send all the requests at once
  // if there were rate limits, we would need to fetch the colors in batches
  const colorData = useQueries({
    queries: hueSteps.map((i) => {
      return {
        queryKey: ['colors', debouncedSaturation, debouncedLightness, i],
        queryFn: ({ signal }) => fetchColor(i, debouncedSaturation, debouncedLightness, signal),
        refetchOnWindowFocus: false,
      }
    }),
  })

  // filter out non-unique colors
  const colorsUnique = useMemo(() => {
    const colorMap = {}; // Map of unique color names and their data

    // Build a map of unique color names
    colorData.forEach(color => {
      if (color.isLoading || !color.data) return
      if (!colorMap[color.data.name.value])
        colorMap[color.data.name.value] = color.data
    })

    return colorMap
  }, [colorData])

  // return the unique colors and whether any are still loading
  return [colorsUnique, colorData.some((color) => color.isLoading)]
}

/**
 * Efficiently fetch unique color intervals using a divide-and-conquer approach.
 *
 * @param {number} saturation
 * @param {number} lightness
 * @returns {[Array<Color>, boolean]} [colors, loading]
 */
function useColorsDivideAndConquer(saturation, lightness) {
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(false)

  // Cache for fetched hues to avoid duplicate requests
  const cacheRef = useRef(new Map())  

  // create a debounced value to use as query key so data is only fetched after a delay of inactivity
  const debouncedSaturation = useDebounce(saturation, 200) 
  const debouncedLightness = useDebounce(lightness, 200) 

  useEffect(() => {
    let cancelled = false
    setColors([])
    setLoading(true)
    cacheRef.current.clear()
    const seen = new Set()

    // create a signal to cancel the request when the component unmounts or the saturation or lightness changes
    const abortController = new AbortController()

    // Helper to fetch and cache color
    const getColor = async (hue) => {
      if (cacheRef.current.has(hue)) return cacheRef.current.get(hue)
      const data = await fetchColor(hue, debouncedSaturation, debouncedLightness, abortController.signal)
      cacheRef.current.set(hue, data)
      return data
    }

    // Add color if unique by name
    const addColorIfUnique = (color) => {
      if (!seen.has(color.name.value)) {
        seen.add(color.name.value)
        setColors(prev => [...prev, color])
      }
    }

    // Recursive divide-and-conquer
    async function findIntervals(start, end) {
      const colorStart = await getColor(start)
      const colorEnd = await getColor(end)
      if (cancelled) return
      if (colorStart.name.value === colorEnd.name.value) {
        // Same name: interval is uniform
        addColorIfUnique(colorStart)
      } else if (end - start <= 1) {
        // Adjacent: add both
        addColorIfUnique(colorStart)
        addColorIfUnique(colorEnd)
      } else {
        // Split
        const mid = Math.floor((start + end) / 2)
        await Promise.all([
          findIntervals(start, mid),
          findIntervals(mid + 1, end)
        ])
      }
    }

    // start the recursive function
    (async () => {
      // need to split the hue range into two to begin with since 0 and 359 are nearly the same color
      // can start both in parallel since they are independent
      const mid = Math.floor(359 / 2)
      await Promise.all([
        findIntervals(0, mid),
        findIntervals(mid + 1, 359)
      ])
      if (!cancelled) {
        setLoading(false)
      }
    })()

    // cancel the request when the component unmounts or the saturation or lightness changes
    return () => {
      cancelled = true
      abortController.abort("Request cancelled")
    }
  }, [debouncedSaturation, debouncedLightness])

  // sort the colors by hue to make the UI more consistent
  const colorsSorted = useMemo(() => {
    return Object.values(colors)?.sort((a, b) => a.hsl.h - b.hsl.h)
  }, [colors])

  return [colorsSorted, loading]
}

/******* Components *******/

/**
 * A single color swatch
 * 
 * @param {Color} color 
 * @returns {JSX.Element}
 */
function Swatch({ color }) {
  return (
    <div className="flex-1 aspect-square rounded border border-gray-200 p-1 flex flex-col justify-between" style={{ backgroundColor: color.hex.value }}>
      <div className="flex flex-row justify-between">
        <p className="text-sm xl:text-base font-medium" style={{ color: color.contrast.value }}>{color.name.value}</p>
        <p className="text-sm xl:text-base font-medium" style={{ color: color.contrast.value }}>{color.hex.value}</p>
      </div>
      <div className="flex flex-col">
        <p className="text-sm xl:text-base font-medium" style={{ color: color.contrast.value }}>R: {color.rgb.r}</p>
        <p className="text-sm xl:text-base font-medium" style={{ color: color.contrast.value }}>G: {color.rgb.g}</p>
        <p className="text-sm xl:text-base font-medium" style={{ color: color.contrast.value }}>B: {color.rgb.b}</p>
      </div>
    </div>
  )
}

/**
 * The main app component
 * 
 * @returns {JSX.Element}
 */
function App() {
  const [saturation, setSaturation] = useState(50)
  const [lightness, setLightness] = useState(50)

  // Fetch colors in parallel
  // const [colors, loading] = useColorsParallel(saturation, lightness)

  // Fetch colors in divide and conquer
  const [colors, loading] = useColorsDivideAndConquer(saturation, lightness)

  return (
    <div className="flex flex-col h-screen items-center relative">

      {/* Title */}
      <div className="flex flex-col items-center justify-center gap-2 w-full max-w-md pt-5">
        <h1 className="text-2xl font-bold">Color Picker</h1>
      </div>

      <div className="relative flex flex-col items-center justify-center gap-2 w-full max-w-md p-5 mb-5">

        {/* Loading indicator */}
        {loading && (
            <div className="absolute bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 flex flex-row items-center gap-1 text-muted-foreground">
                 <LoaderCircle className="w-4 h-4 animate-spin" />
                 <p className="text-sm font-medium">Mixing colors...</p>
            </div>
        )}

        {/* Sliders/inputs to control saturation */}
        <div className="flex flex-col justify-center gap-2 w-full">
          <div className="flex flex-row items-center gap-2 w-full">
            <SwatchBook className="w-4 h-4" />
            <label htmlFor="saturation" className="text-sm font-medium">Saturation</label>
          </div>
          <div className="flex flex-row items-center gap-2 w-full">
            <Input
              id="saturation"
              className="w-16"
              value={saturation}
              onChange={(e) => setSaturation(clamp(e.target.value))}
              type="number"
              min={0}
              max={100}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSaturation(randomInt(100))}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Slider
              max={100}
              step={1}
              value={[saturation]}
              className={cn("flex-1")}
              onValueChange={(e) => setSaturation(e[0])}
            />
          </div>

          {/* Sliders/inputs to control lightness */}
          <div className="flex flex-row items-center gap-2 w-full">
            <SunMedium className="w-4 h-4" />
            <label htmlFor="lightness" className="text-sm font-medium">Lightness</label>
          </div>
          <div className="flex flex-row items-center gap-2 w-full">
            <Input
              id="lightness"
              className="w-16"
              value={lightness}
              onChange={(e) => setLightness(clamp(e.target.value))}
              type="number"
              min={0}
              max={100}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLightness(randomInt(100))}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Slider
              max={100}
              step={1}
              value={[lightness]}
              className={cn("flex-1")}
              onValueChange={(e) => setLightness(e[0])}
            />
          </div>
        </div>
      </div>

      {/* Grid of colors */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 justify-center w-full px-2 pb-2">        
        {Object.values(colors).map((color) => (
          <Swatch key={color.hex.value} color={color} />
        ))}
        {loading && (
          <div className="flex flex-1 aspect-square rounded bg-gray-200 animate-pulse justify-center items-center">
            Loading colors...
          </div>
        )}
      </div>

      
    </div>
  )
}

export default App
