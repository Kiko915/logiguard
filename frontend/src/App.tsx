import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { HomePage } from "@/pages/HomePage"

function App() {
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
