
import { Routes, Route, Navigate } from 'react-router-dom'

import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Profile from './pages/Profile'
import CurrentBook from './pages/CurrentBook'
import Backlog from './pages/Backlog'
import Inspo from './pages/Inspo'
import Login from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/current-book" element={<CurrentBook />} />
          <Route path="/backlog" element={<Backlog />} />
          <Route path="/inspo" element={<Inspo />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
