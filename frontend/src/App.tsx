import { useState } from "react"
import { LoginPage } from "@/pages/LoginPage"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { HomePage } from "@/pages/HomePage"

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="page-root">
      <Sidebar />
      <div className="page-main">
        <Header title="Dashboard" />
        <main className="page-content">
          <HomePage />
        </main>
      </div>
    </div>
  )
}

export default App
