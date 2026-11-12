
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
        <span>✳ the reading room</span>
        <span>made with love, Carla</span>
      </footer>
    </div>
  )
}

export default MainLayout
