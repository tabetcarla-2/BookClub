
import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

function MainLayout() {
  return (
    <div className="app">
      <Navbar />

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <span>nyc book club</span>
        <span>made with love, Carla</span>
      </footer>
    </div>
  )
}

export default MainLayout
