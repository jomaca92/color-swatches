import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { useSelector, useDispatch } from 'react-redux'
import { Button } from '@/components/ui/button'
import { increment, decrement } from '@/features/counter/counterSlice'

function App() {
  const count = useSelector((state) => state.counter.value)
  const dispatch = useDispatch()

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-5">
      <div className="flex flex-row items-center justify-center gap-5">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1 className="text-2xl font-bold">Vite + React</h1>
      <div className="flex items-center justify-center gap-5">
        <Button onClick={() => dispatch(increment())}>Increment</Button>
        <span>{count}</span>
        <Button onClick={() => dispatch(decrement())}>Decrement</Button>
      </div>
      <p>
        Edit <code>src/App.jsx</code> and save to test HMR
      </p>
      <p className="text-sm text-gray-500">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
